/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { mainWindow } from '../../../../../base/browser/window.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { IInstantiationService, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { TomoshibiSettingsOverlay } from './tomoshibiSettingsEditor.js';
import { SettingsSection, TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID, isSettingsSection } from './tomoshibiSettingsInput.js';

/**
 * The one overlay a window can have open, kept here rather than in a service because the settings
 * page has no other state to own. A second click on the gear while it is open only switches the
 * page instead of stacking a second dialog on top of the first.
 */
let currentOverlay: TomoshibiSettingsOverlay | undefined;

class OpenTomoshibiSettingsAction extends Action2 {

	constructor() {
		super({
			id: TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID,
			title: localize2('tomoshibi.openSettings', "设置"),
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, section?: SettingsSection): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const target = isSettingsSection(section) ? section : undefined;
		if (currentOverlay) {
			currentOverlay.show(target);
			return;
		}
		const overlay = instantiationService.createInstance(TomoshibiSettingsOverlay);
		currentOverlay = overlay;
		overlay.onDidClose(() => {
			if (currentOverlay === overlay) {
				currentOverlay = undefined;
			}
		});
		overlay.show(target);
	}
}

registerAction2(OpenTomoshibiSettingsAction);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'tomoshibi',
	order: 200,
	title: localize('tomoshibi.configurationTitle', "Code-Tomoshibi"),
	type: 'object',
	properties: {
		'tomoshibi.scrollbar.thick': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.scrollbarThick', "把终端和工作台的滚动条加粗，方便在 iPad 上用手指拖动。"),
		},
		'tomoshibi.terminal.shiftEnterNewline': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.shiftEnterNewline', "在终端里按 Shift+回车插入换行，而不是直接执行。"),
		},
		'tomoshibi.terminal.touchSelection': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.touchSelection', "长按终端时显示 Apple 式的选择手柄。"),
		},
		'tomoshibi.clipboard.history.enabled': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.clipboardHistory', "记录在 Code-Tomoshibi 里复制过的内容。"),
		},
		'tomoshibi.clipboard.history.limit': {
			type: 'number',
			default: 50,
			minimum: 10,
			maximum: 200,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.clipboardHistoryLimit', "剪贴板历史最多保留多少条。"),
		},
		'tomoshibi.notes.syncToServer': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.notesSync', "把便签存到服务器，换设备也能看到。"),
		},
		'tomoshibi.upload.insertPath': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.uploadInsertPath', "上传完成后，把文件路径插进当前终端。"),
		},
		'tomoshibi.performance.enabled': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.performanceEnabled', "在状态栏显示服务器的 CPU、内存和网络。"),
		},
		'tomoshibi.performance.interval': {
			type: 'number',
			default: 500,
			enum: [250, 500, 1000, 2000, 5000],
			scope: ConfigurationScope.APPLICATION,
			description: localize('tomoshibi.config.performanceInterval', "状态栏性能数字的刷新间隔（毫秒），最快 250 毫秒。"),
		},
	},
});

/**
 * The thick scrollbar is a body class rather than a setting the scrollbar widgets read, because
 * xterm's viewport and Monaco's scrollable elements have no shared option to widen; a class on
 * the body is the one lever that reaches both.
 */
class TomoshibiScrollbarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.tomoshibiScrollbar';

	constructor(
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super();

		const apply = () => {
			mainWindow.document.body.classList.toggle('tomoshibi-thick-scrollbar', configurationService.getValue<boolean>('tomoshibi.scrollbar.thick') !== false);
		};
		apply();
		this._register(configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('tomoshibi.scrollbar.thick')) {
				apply();
			}
		}));
	}
}

registerWorkbenchContribution2(TomoshibiScrollbarContribution.ID, TomoshibiScrollbarContribution, WorkbenchPhase.BlockRestore);
