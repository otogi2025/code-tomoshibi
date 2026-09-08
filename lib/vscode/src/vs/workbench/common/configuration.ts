/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../nls.js';
import { ConfigurationScope, IConfigurationNode, IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { IWorkbenchContribution } from './contributions.js';
import { IWorkspaceContextService, IWorkspaceFolder, WorkbenchState } from '../../platform/workspace/common/workspace.js';
import { ConfigurationTarget, IConfigurationService, IConfigurationValue, IInspectValue } from '../../platform/configuration/common/configuration.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { Emitter } from '../../base/common/event.js';
import { IRemoteAgentService } from '../services/remote/common/remoteAgentService.js';
import { OperatingSystem, isWindows } from '../../base/common/platform.js';
import { URI } from '../../base/common/uri.js';
import { equals } from '../../base/common/objects.js';
import { DeferredPromise } from '../../base/common/async.js';
import { IUserDataProfile, IUserDataProfilesService } from '../../platform/userDataProfile/common/userDataProfile.js';

export const applicationConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	'id': 'application',
	'order': 100,
	'title': localize('applicationConfigurationTitle', "应用程序"),
	'type': 'object'
});

export const workbenchConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	'id': 'workbench',
	'order': 7,
	'title': localize('workbenchConfigurationTitle', "工作台"),
	'type': 'object',
});

export const securityConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	'id': 'security',
	'scope': ConfigurationScope.APPLICATION,
	'title': localize('securityConfigurationTitle', "安全性"),
	'type': 'object',
	'order': 7
});

export const problemsConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	'id': 'problems',
	'title': localize('problemsConfigurationTitle', "问题"),
	'type': 'object',
	'order': 101
});

export const windowConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	'id': 'window',
	'order': 8,
	'title': localize('windowConfigurationTitle', "窗口"),
	'type': 'object',
});

export const Extensions = {
	ConfigurationMigration: 'base.contributions.configuration.migration'
};

type ConfigurationValue = { value: unknown | undefined /* Remove */ };
export type ConfigurationKeyValuePairs = [string, ConfigurationValue][];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConfigurationMigrationFn = (value: any, valueAccessor: (key: string) => any) => ConfigurationValue | ConfigurationKeyValuePairs | Promise<ConfigurationValue | ConfigurationKeyValuePairs>;
export type ConfigurationMigration = { key: string; migrateFn: ConfigurationMigrationFn };

export interface IConfigurationMigrationRegistry {
	registerConfigurationMigrations(configurationMigrations: ConfigurationMigration[]): void;
}

class ConfigurationMigrationRegistry implements IConfigurationMigrationRegistry {

	readonly migrations: ConfigurationMigration[] = [];

	private readonly _onDidRegisterConfigurationMigrations = new Emitter<ConfigurationMigration[]>();
	readonly onDidRegisterConfigurationMigration = this._onDidRegisterConfigurationMigrations.event;

	registerConfigurationMigrations(configurationMigrations: ConfigurationMigration[]): void {
		this.migrations.push(...configurationMigrations);
	}

}

const configurationMigrationRegistry = new ConfigurationMigrationRegistry();
Registry.add(Extensions.ConfigurationMigration, configurationMigrationRegistry);

export class ConfigurationMigrationWorkbenchContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.configurationMigration';

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
	) {
		super();
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(async (e) => {
			for (const folder of e.added) {
				await this.migrateConfigurationsForFolder(folder, configurationMigrationRegistry.migrations);
			}
		}));
		this.migrateConfigurations(configurationMigrationRegistry.migrations);
		this._register(configurationMigrationRegistry.onDidRegisterConfigurationMigration(migration => this.migrateConfigurations(migration)));
	}

	private async migrateConfigurations(migrations: ConfigurationMigration[]): Promise<void> {
		await this.migrateConfigurationsForFolder(undefined, migrations);
		for (const folder of this.workspaceService.getWorkspace().folders) {
			await this.migrateConfigurationsForFolder(folder, migrations);
		}
	}

	private async migrateConfigurationsForFolder(folder: IWorkspaceFolder | undefined, migrations: ConfigurationMigration[]): Promise<void> {
		await Promise.all([migrations.map(migration => this.migrateConfigurationsForFolderAndOverride(migration, folder?.uri))]);
	}

	private async migrateConfigurationsForFolderAndOverride(migration: ConfigurationMigration, resource?: URI): Promise<void> {
		const inspectData = this.configurationService.inspect(migration.key, { resource });

		const targetPairs: [keyof IConfigurationValue<unknown>, ConfigurationTarget][] = this.workspaceService.getWorkbenchState() === WorkbenchState.WORKSPACE ? [
			['user', ConfigurationTarget.USER],
			['userLocal', ConfigurationTarget.USER_LOCAL],
			['userRemote', ConfigurationTarget.USER_REMOTE],
			['workspace', ConfigurationTarget.WORKSPACE],
			['workspaceFolder', ConfigurationTarget.WORKSPACE_FOLDER],
		] : [
			['user', ConfigurationTarget.USER],
			['userLocal', ConfigurationTarget.USER_LOCAL],
			['userRemote', ConfigurationTarget.USER_REMOTE],
			['workspace', ConfigurationTarget.WORKSPACE],
		];
		for (const [dataKey, target] of targetPairs) {
			const inspectValue = inspectData[dataKey] as IInspectValue<unknown> | undefined;
			if (!inspectValue) {
				continue;
			}

			const migrationValues: [[string, ConfigurationValue], string[]][] = [];

			if (inspectValue.value !== undefined) {
				const keyValuePairs = await this.runMigration(migration, dataKey, inspectValue.value, resource, undefined);
				for (const keyValuePair of keyValuePairs ?? []) {
					migrationValues.push([keyValuePair, []]);
				}
			}

			for (const { identifiers, value } of inspectValue.overrides ?? []) {
				if (value !== undefined) {
					const keyValuePairs = await this.runMigration(migration, dataKey, value, resource, identifiers);
					for (const keyValuePair of keyValuePairs ?? []) {
						migrationValues.push([keyValuePair, identifiers]);
					}
				}
			}

			if (migrationValues.length) {
				// apply migrations
				await Promise.allSettled(migrationValues.map(async ([[key, value], overrideIdentifiers]) =>
					this.configurationService.updateValue(key, value.value, { resource, overrideIdentifiers }, target)));
			}
		}
	}

	private async runMigration(migration: ConfigurationMigration, dataKey: keyof IConfigurationValue<unknown>, value: unknown, resource: URI | undefined, overrideIdentifiers: string[] | undefined): Promise<ConfigurationKeyValuePairs | undefined> {
		const valueAccessor = (key: string) => {
			const inspectData = this.configurationService.inspect(key, { resource });
			const inspectValue = inspectData[dataKey] as IInspectValue<unknown> | undefined;
			if (!inspectValue) {
				return undefined;
			}
			if (!overrideIdentifiers) {
				return inspectValue.value;
			}
			return inspectValue.overrides?.find(({ identifiers }) => equals(identifiers, overrideIdentifiers))?.value;
		};
		const result = await migration.migrateFn(value, valueAccessor);
		return Array.isArray(result) ? result : [[migration.key, result]];
	}
}

export class DynamicWorkbenchSecurityConfiguration extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.dynamicWorkbenchSecurityConfiguration';

	private readonly _ready = new DeferredPromise<void>();
	readonly ready = this._ready.p;

	constructor(
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService
	) {
		super();

		this.create();
	}

	private async create(): Promise<void> {
		try {
			await this.doCreate();
		} finally {
			this._ready.complete();
		}
	}

	private async doCreate(): Promise<void> {
		if (!isWindows) {
			const remoteEnvironment = await this.remoteAgentService.getEnvironment();
			if (remoteEnvironment?.os !== OperatingSystem.Windows) {
				return;
			}
		}

		// Windows: UNC allow list security configuration
		const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		registry.registerConfiguration({
			...securityConfigurationNodeBase,
			'properties': {
				'security.allowedUNCHosts': {
					'type': 'array',
					'items': {
						'type': 'string',
						'pattern': '^[^\\\\]+$',
						'patternErrorMessage': localize('security.allowedUNCHosts.patternErrorMessage', 'UNC 主机名不得包含反斜杠。')
					},
					'default': [],
					'markdownDescription': localize('security.allowedUNCHosts', '无需用户确认即可允许的一组 UNC 主机名(无前导或尾随反斜杠，例如 `192.168.0.1` 或 `my-server`)。如果正在访问的 UNC 主机是此设置不允许访问的或未通过用户确认进行确认，则会发生错误并停止操作。更改此设置时需要重启。有关此设置的详细信息，请访问 https://aka.ms/vscode-windows-unc。'),
					'scope': ConfigurationScope.APPLICATION_MACHINE
				},
				'security.restrictUNCAccess': {
					'type': 'boolean',
					'default': true,
					'markdownDescription': localize('security.restrictUNCAccess', '如果已启用，则仅允许访问 "#security.allowedUNCHosts#" 设置允许的或用户确认后的 UNC 主机名。有关此设置的详细信息，可访问 https://aka.ms/vscode-windows-unc。'),
					'scope': ConfigurationScope.APPLICATION_MACHINE
				}
			}
		});
	}
}

export const CONFIG_NEW_WINDOW_PROFILE = 'window.newWindowProfile';

export class DynamicWindowConfiguration extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.dynamicWindowConfiguration';

	private configurationNode: IConfigurationNode | undefined;
	private newWindowProfile: IUserDataProfile | undefined;

	constructor(
		@IUserDataProfilesService private readonly userDataProfilesService: IUserDataProfilesService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
		this.registerNewWindowProfileConfiguration();
		this._register(this.userDataProfilesService.onDidChangeProfiles((e) => this.registerNewWindowProfileConfiguration()));

		this.setNewWindowProfile();
		this.checkAndResetNewWindowProfileConfig();

		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.source !== ConfigurationTarget.DEFAULT && e.affectsConfiguration(CONFIG_NEW_WINDOW_PROFILE)) {
				this.setNewWindowProfile();
			}
		}));
		this._register(this.userDataProfilesService.onDidChangeProfiles(() => this.checkAndResetNewWindowProfileConfig()));
	}

	private registerNewWindowProfileConfiguration(): void {
		const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		const configurationNode: IConfigurationNode = {
			...windowConfigurationNodeBase,
			'properties': {
				[CONFIG_NEW_WINDOW_PROFILE]: {
					'type': ['string', 'null'],
					'default': null,
					'enum': [...this.userDataProfilesService.profiles.map(profile => profile.name), null],
					'enumItemLabels': [...this.userDataProfilesService.profiles.map(() => ''), localize('active window', "活动窗口")],
					'description': localize('newWindowProfile', "指定打开新窗口时要使用的配置文件。如果提供了配置文件名称，则新窗口将使用该配置文件。如果未提供配置文件名称，则新窗口将使用活动窗口的配置文件，如果没有活动窗口，则使用默认配置文件。"),
					'scope': ConfigurationScope.APPLICATION,
				}
			}
		};
		if (this.configurationNode) {
			registry.updateConfigurations({ add: [configurationNode], remove: [this.configurationNode] });
		} else {
			registry.registerConfiguration(configurationNode);
		}
		this.configurationNode = configurationNode;
	}

	private setNewWindowProfile(): void {
		const newWindowProfileName = this.configurationService.getValue(CONFIG_NEW_WINDOW_PROFILE);
		this.newWindowProfile = newWindowProfileName ? this.userDataProfilesService.profiles.find(profile => profile.name === newWindowProfileName) : undefined;
	}

	private checkAndResetNewWindowProfileConfig(): void {
		const newWindowProfileName = this.configurationService.getValue(CONFIG_NEW_WINDOW_PROFILE);
		if (!newWindowProfileName) {
			return;
		}
		const profile = this.newWindowProfile ? this.userDataProfilesService.profiles.find(profile => profile.id === this.newWindowProfile!.id) : undefined;
		if (newWindowProfileName === profile?.name) {
			return;
		}
		this.configurationService.updateValue(CONFIG_NEW_WINDOW_PROFILE, profile?.name);
	}
}
