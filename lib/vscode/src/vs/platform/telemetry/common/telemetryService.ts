/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { DisposableStore } from '../../../base/common/lifecycle.js';
import { mixin } from '../../../base/common/objects.js';
import { isWeb } from '../../../base/common/platform.js';
import { PolicyCategory } from '../../../base/common/policy.js';
import { escapeRegExpCharacters } from '../../../base/common/strings.js';
import { localize } from '../../../nls.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { IMeteredConnectionService } from '../../meteredConnection/common/meteredConnection.js';
import product from '../../product/common/product.js';
import { IProductService } from '../../product/common/productService.js';
import { Registry } from '../../registry/common/platform.js';
import { ClassifiedEvent, IGDPRProperty, OmitMetadata, StrictPropertyCheck } from './gdprTypings.js';
import { ITelemetryData, ITelemetryService, TelemetryConfiguration, TelemetryLevel, TELEMETRY_CRASH_REPORTER_SETTING_ID, TELEMETRY_OLD_SETTING_ID, TELEMETRY_SECTION_ID, TELEMETRY_SETTING_ID, ICommonProperties } from './telemetry.js';
import { cleanData, getTelemetryLevel, ITelemetryAppender, TelemetryTrustedValue } from './telemetryUtils.js';

export interface ITelemetryServiceConfig {
	appenders: ITelemetryAppender[];
	sendErrorTelemetry?: boolean;
	commonProperties?: ICommonProperties;
	piiPaths?: string[];
	/**
	 * If true, telemetry events will be buffered until setExperimentProperty is called
	 * (up to 10 seconds) to ensure experiment context is attached to all events.
	 */
	waitForExperimentProperties?: boolean;
	/**
	 * If provided, telemetry events will be dropped when the connection is metered.
	 */
	meteredConnectionService?: IMeteredConnectionService;
}

interface IPendingEvent {
	eventName: string;
	eventLevel: TelemetryLevel;
	data: ITelemetryData | undefined;
}

export class TelemetryService implements ITelemetryService {

	static readonly IDLE_START_EVENT_NAME = 'UserIdleStart';
	static readonly IDLE_STOP_EVENT_NAME = 'UserIdleStop';

	private static readonly BUFFER_FLUSH_TIMEOUT = 10000; // 10 seconds
	private static readonly MAX_BUFFER_SIZE = 1000;

	declare readonly _serviceBrand: undefined;

	readonly sessionId: string;
	readonly machineId: string;
	readonly sqmId: string;
	readonly devDeviceId: string;
	readonly firstSessionDate: string;
	readonly msftInternal: boolean | undefined;

	private _appenders: ITelemetryAppender[];
	private _commonProperties: ICommonProperties;
	private _experimentProperties: { [name: string]: string | TelemetryTrustedValue<string> } = {};
	private _piiPaths: string[];
	private _telemetryLevel: TelemetryLevel;
	private _sendErrorTelemetry: boolean;

	private readonly _meteredConnectionService: IMeteredConnectionService | undefined;

	private _pendingEvents: IPendingEvent[] = [];
	private _isExperimentPropertySet = false;
	private _flushTimeout: ReturnType<typeof setTimeout> | undefined;

	private readonly _disposables = new DisposableStore();
	private _cleanupPatterns: RegExp[] = [];

	constructor(
		config: ITelemetryServiceConfig,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IProductService private _productService: IProductService
	) {
		this._appenders = config.appenders;
		this._commonProperties = config.commonProperties ?? Object.create(null);

		this.sessionId = this._commonProperties['sessionID'] as string;
		this.machineId = this._commonProperties['common.machineId'] as string;
		this.sqmId = this._commonProperties['common.sqmId'] as string;
		this.devDeviceId = this._commonProperties['common.devDeviceId'] as string;
		this.firstSessionDate = this._commonProperties['common.firstSessionDate'] as string;
		this.msftInternal = this._commonProperties['common.msftInternal'] as boolean | undefined;

		this._piiPaths = config.piiPaths || [];
		this._telemetryLevel = TelemetryLevel.USAGE;
		this._sendErrorTelemetry = !!config.sendErrorTelemetry;
		this._meteredConnectionService = config.meteredConnectionService;

		// static cleanup pattern for: `vscode-file:///DANGEROUS/PATH/resources/app/Useful/Information`
		this._cleanupPatterns = [/(vscode-)?file:\/\/.*?\/resources\/app\//gi];

		for (const piiPath of this._piiPaths) {
			this._cleanupPatterns.push(new RegExp(escapeRegExpCharacters(piiPath), 'gi'));

			if (piiPath.indexOf('\\') >= 0) {
				this._cleanupPatterns.push(new RegExp(escapeRegExpCharacters(piiPath.replace(/\\/g, '/')), 'gi'));
			}
		}

		this._updateTelemetryLevel();
		this._disposables.add(this._configurationService.onDidChangeConfiguration(e => {
			// Check on the telemetry settings and update the state if changed
			const affectsTelemetryConfig =
				e.affectsConfiguration(TELEMETRY_SETTING_ID)
				|| e.affectsConfiguration(TELEMETRY_OLD_SETTING_ID)
				|| e.affectsConfiguration(TELEMETRY_CRASH_REPORTER_SETTING_ID);
			if (affectsTelemetryConfig) {
				this._updateTelemetryLevel();
			}
		}));

		// Buffer events until experiment properties are set (or timeout expires).
		// This ensures early events include experiment context when available.
		if (config.waitForExperimentProperties) {
			this._flushTimeout = setTimeout(() => this._flushPendingEvents(), TelemetryService.BUFFER_FLUSH_TIMEOUT);
		} else {
			this._isExperimentPropertySet = true;
		}
	}

	setExperimentProperty(name: string, value: string): void {
		this._experimentProperties[name] = new TelemetryTrustedValue(value);

		// On first call, flush all pending events that were buffered waiting for experiment properties
		if (!this._isExperimentPropertySet) {
			this._flushPendingEvents();
		}
	}

	setCommonProperty(name: string, value: string | boolean): void {
		this._commonProperties[name] = value;
	}

	private _flushPendingEvents(): void {
		if (this._isExperimentPropertySet) {
			return;
		}

		this._isExperimentPropertySet = true;

		if (this._flushTimeout !== undefined) {
			clearTimeout(this._flushTimeout);
			this._flushTimeout = undefined;
		}

		// Send all buffered events now that experiment properties are available
		for (const event of this._pendingEvents) {
			this._doLog(event.eventName, event.eventLevel, event.data);
		}
		this._pendingEvents = [];
	}

	private _updateTelemetryLevel(): void {
		let level = getTelemetryLevel(this._configurationService);
		const collectableTelemetry = this._productService.enabledTelemetryLevels;
		// Also ensure that error telemetry is respecting the product configuration for collectable telemetry
		if (collectableTelemetry) {
			this._sendErrorTelemetry = this.sendErrorTelemetry ? collectableTelemetry.error : false;
			// Make sure the telemetry level from the service is the minimum of the config and product
			const maxCollectableTelemetryLevel = collectableTelemetry.usage ? TelemetryLevel.USAGE : collectableTelemetry.error ? TelemetryLevel.ERROR : TelemetryLevel.NONE;
			level = Math.min(level, maxCollectableTelemetryLevel);
		}

		this._telemetryLevel = level;
	}

	get sendErrorTelemetry(): boolean {
		return this._sendErrorTelemetry;
	}

	get telemetryLevel(): TelemetryLevel {
		return this._telemetryLevel;
	}

	dispose(): void {
		// Flush any remaining pending events before disposing
		this._flushPendingEvents();
		this._disposables.dispose();
	}

	private _log(eventName: string, eventLevel: TelemetryLevel, data?: ITelemetryData) {
		// don't send events when the user is optout
		if (this._telemetryLevel < eventLevel) {
			return;
		}

		// Don't send events when the connection is metered
		if (this._meteredConnectionService?.isConnectionMetered) {
			return;
		}

		// Buffer events until experiment properties are set (or timeout expires)
		if (!this._isExperimentPropertySet) {
			if (this._pendingEvents.length < TelemetryService.MAX_BUFFER_SIZE) {
				this._pendingEvents.push({ eventName, eventLevel, data });
			}
			return;
		}

		this._doLog(eventName, eventLevel, data);
	}

	private _doLog(eventName: string, eventLevel: TelemetryLevel, data?: ITelemetryData) {
		// add experiment properties
		data = mixin(data, this._experimentProperties);

		// remove all PII from data
		data = cleanData(data, this._cleanupPatterns);

		// add common properties
		data = mixin(data, this._commonProperties);

		// tag error-level events so the backend can identify them generically
		if (eventLevel === TelemetryLevel.ERROR) {
			data = { ...data, 'isError': true };
		}

		// Log to the appenders of sufficient level
		this._appenders.forEach(a => a.log(eventName, data ?? {}));
	}

	publicLog(eventName: string, data?: ITelemetryData) {
		this._log(eventName, TelemetryLevel.USAGE, data);
	}

	publicLog2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>) {
		this.publicLog(eventName, data as ITelemetryData);
	}

	publicLogError(errorEventName: string, data?: ITelemetryData) {
		if (!this._sendErrorTelemetry) {
			return;
		}

		// Send error event and anonymize paths
		this._log(errorEventName, TelemetryLevel.ERROR, data);
	}

	publicLogError2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>) {
		this.publicLogError(eventName, data as ITelemetryData);
	}
}

function getTelemetryLevelSettingDescription(): string {
	const telemetryText = localize('telemetry.telemetryLevelMd', "控制 {0} 遥测、第一方扩展遥测和参与的第三方扩展遥测。一些第三方扩展可能不遵守此设置。请查阅特定扩展的文档以确定。遥测有助于我们更好地了解 {0} 的执行情况、需要改进的地方以及功能的使用方式。", product.nameLong);
	const externalLinksStatement = !product.privacyStatementUrl ?
		localize("telemetry.docsStatement", "详细了解[我们收集的数据]({0})。", 'https://aka.ms/vscode-telemetry') :
		localize("telemetry.docsAndPrivacyStatement", "详细了解[我们收集的数据]({0})和我们的[隐私声明]({1})。", 'https://aka.ms/vscode-telemetry', product.privacyStatementUrl);
	const restartString = !isWeb ? localize('telemetry.restart', '若要使崩溃报告更改生效，必须完全重新启动应用程序。') : '';

	const crashReportsHeader = localize('telemetry.crashReports', "崩溃报告");
	const errorsHeader = localize('telemetry.errors', "错误遥测");
	const usageHeader = localize('telemetry.usage', "用法数据");

	const telemetryTableDescription = localize('telemetry.telemetryLevel.tableDescription', "下表概述了每个设置所发送的数据:");
	const telemetryTable = `
|       | ${crashReportsHeader} | ${errorsHeader} | ${usageHeader} |
|:------|:-------------:|:---------------:|:----------:|
| all   |       ✓       |        ✓        |     ✓      |
| error |       ✓       |        ✓        |     -      |
| crash |       ✓       |        -        |     -      |
| off   |       -       |        -        |     -      |
`;

	const deprecatedSettingNote = localize('telemetry.telemetryLevel.deprecated', "****注意:*** 如果此设置为“关闭”，则无论其他遥测设置如何，都不会发送遥测数据。如果此设置为“关闭”以外的任何选项，并且使用弃用的设置禁用遥测，则不会发送遥测数据。*");
	const telemetryDescription = `
${telemetryText} ${externalLinksStatement} ${restartString}

&nbsp;

${telemetryTableDescription}
${telemetryTable}

&nbsp;

${deprecatedSettingNote}
`;

	return telemetryDescription;
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': TELEMETRY_SECTION_ID,
	'order': 1,
	'type': 'object',
	'title': localize('telemetryConfigurationTitle', "遥测"),
	'properties': {
		[TELEMETRY_SETTING_ID]: {
			'type': 'string',
			'enum': [TelemetryConfiguration.ON, TelemetryConfiguration.ERROR, TelemetryConfiguration.CRASH, TelemetryConfiguration.OFF],
			'enumDescriptions': [
				localize('telemetry.telemetryLevel.default', "发送使用情况数据、错误、故障报告。"),
				localize('telemetry.telemetryLevel.error', "发送常规错误遥测和故障报告。"),
				localize('telemetry.telemetryLevel.crash', "发送 OS 级别故障报告。"),
				localize('telemetry.telemetryLevel.off', "禁用所有产品遥测。")
			],
			'markdownDescription': getTelemetryLevelSettingDescription(),
			'default': TelemetryConfiguration.ON,
			'restricted': true,
			'scope': ConfigurationScope.APPLICATION,
			'tags': ['usesOnlineServices', 'telemetry'],
			'policy': {
				name: 'TelemetryLevel',
				category: PolicyCategory.Telemetry,
				minimumVersion: '1.99',
				localization: {
					description: {
						key: 'telemetry.telemetryLevel.policyDescription',
						value: localize('telemetry.telemetryLevel.policyDescription', "控制遥测级别。"),
					},
					enumDescriptions: [
						{
							key: 'telemetry.telemetryLevel.default',
							value: localize('telemetry.telemetryLevel.default', "发送使用情况数据、错误、故障报告。"),
						},
						{
							key: 'telemetry.telemetryLevel.error',
							value: localize('telemetry.telemetryLevel.error', "发送常规错误遥测和故障报告。"),
						},
						{
							key: 'telemetry.telemetryLevel.crash',
							value: localize('telemetry.telemetryLevel.crash', "发送 OS 级别故障报告。"),
						},
						{
							key: 'telemetry.telemetryLevel.off',
							value: localize('telemetry.telemetryLevel.off', "禁用所有产品遥测。"),
						}
					]
				}
			}
		},
		'telemetry.feedback.enabled': {
			type: 'boolean',
			default: true,
			description: localize('telemetry.feedback.enabled', "启用反馈机制，例如问题报告器、调查和其他反馈选项。"),
			policy: {
				name: 'EnableFeedback',
				category: PolicyCategory.Telemetry,
				minimumVersion: '1.99',
				localization: { description: { key: 'telemetry.feedback.enabled', value: localize('telemetry.feedback.enabled', "启用反馈机制，例如问题报告器、调查和其他反馈选项。") } },
			}
		},
		// Deprecated telemetry setting
		[TELEMETRY_OLD_SETTING_ID]: {
			'type': 'boolean',
			'markdownDescription':
				!product.privacyStatementUrl ?
					localize('telemetry.enableTelemetry', "启用要收集的诊断数据。这有助于我们更好地了解 {0} 的执行情况以及哪里需要改进。", product.nameLong) :
					localize('telemetry.enableTelemetryMd', "启用要收集的诊断数据。这有助于我们更好地了解 {0} 的执行情况以及哪里需要改进。[阅读详细信息]({1})关于我们收集的内容和隐私声明。", product.nameLong, product.privacyStatementUrl),
			'default': true,
			'restricted': true,
			'markdownDeprecationMessage': localize('enableTelemetryDeprecated', "如果此设置为 false，则无论新设置的值如何，都不会发送遥测数据。已弃用，推荐使用 {0} 设置。", `\`#${TELEMETRY_SETTING_ID}#\``),
			'scope': ConfigurationScope.APPLICATION,
			'tags': ['usesOnlineServices', 'telemetry']
		}
	},
});
