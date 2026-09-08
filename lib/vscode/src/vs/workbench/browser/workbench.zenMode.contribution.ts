/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { KeyChord, KeyCode, KeyMod } from '../../base/common/keyCodes.js';
import { localize, localize2 } from '../../nls.js';
import { Categories } from '../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../platform/actions/common/actions.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import { IContextKeyService } from '../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../platform/keybinding/common/keybindingsRegistry.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { InEditorZenModeContext, IsAuxiliaryWindowFocusedContext } from '../common/contextkeys.js';
import { IWorkbenchLayoutService } from '../services/layout/browser/layoutService.js';
import { ZenHideEditorTabsAction, ZenShowMultipleEditorTabsAction, ZenShowSingleEditorTabAction } from './actions/layoutActions.js';

// --- Configuration

(function registerZenModeConfiguration(): void {
	const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

	registry.registerConfiguration({
		'id': 'zenMode',
		'order': 9,
		'title': localize('zenModeConfigurationTitle', "禅模式"),
		'type': 'object',
		'properties': {
			'zenMode.fullScreen': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.fullScreen', "控制在打开禅模式时是否将工作台切换到全屏。")
			},
			'zenMode.centerLayout': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.centerLayout', "控制在打开禅模式时是否启用居中布局。")
			},
			'zenMode.showTabs': {
				'type': 'string',
				'enum': ['multiple', 'single', 'none'],
				'description': localize('zenMode.showTabs', "控制打开禅模式是应该显示多个编辑器选项卡、单个编辑器选项卡还是完全隐藏编辑器标题区域。"),
				'enumDescriptions': [
					localize('zenMode.showTabs.multiple', "每个编辑器在编辑器标题区域显示为选项卡。"),
					localize('zenMode.showTabs.single', "活动编辑器在编辑器标题区域显示为单个大选项卡。"),
					localize('zenMode.showTabs.none', "未显示编辑器标题区域。"),
				],
				'default': 'multiple'
			},
			'zenMode.hideStatusBar': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.hideStatusBar', "控制在打开禅模式时是否隐藏工作台底部的状态栏。")
			},
			'zenMode.hideActivityBar': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.hideActivityBar', "控制在打开禅模式时是否隐藏工作台左侧或右侧的活动栏。")
			},
			'zenMode.hideLineNumbers': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.hideLineNumbers', "控制在打开禅模式时是否隐藏编辑器行号。")
			},
			'zenMode.restore': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.restore', "控制在禅模式下退出的窗口是否应还原为禅模式。")
			},
			'zenMode.silentNotifications': {
				'type': 'boolean',
				'default': true,
				'description': localize('zenMode.silentNotifications', "控制在禅模式下是否应启用通知请勿打扰模式。如果为 true，则仅弹出错误通知。")
			}
		}
	});
})();

// --- Zen Mode Editor Tabs Actions

registerAction2(ZenHideEditorTabsAction);
registerAction2(ZenShowMultipleEditorTabsAction);
registerAction2(ZenShowSingleEditorTabAction);

// --- Tab Bar Submenu in View Appearance Menu (Zen Mode variant)

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.EditorTabsBarShowTabsZenModeSubmenu,
	title: localize('tabBar', "选项卡栏"),
	group: '3_workbench_layout_move',
	order: 10,
	when: InEditorZenModeContext
});

// --- Toggle Zen Mode

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleZenMode',
			title: {
				...localize2('toggleZenMode', "切换禅模式"),
				mnemonicTitle: localize({ key: 'miToggleZenMode', comment: ['&& denotes a mnemonic'] }, "禅模式"),
			},
			precondition: IsAuxiliaryWindowFocusedContext.toNegated(),
			category: Categories.View,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyZ)
			},
			toggled: InEditorZenModeContext,
			menu: [{
				id: MenuId.MenubarAppearanceMenu,
				group: '1_toggle_view',
				order: 2
			}]
		});
	}

	run(accessor: ServicesAccessor): void {
		return accessor.get(IWorkbenchLayoutService).toggleZenMode();
	}
});

// --- Exit Zen Mode

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: 'workbench.action.exitZenMode',
	weight: KeybindingWeight.EditorContrib - 1000,
	handler(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const contextKeyService = accessor.get(IContextKeyService);
		if (InEditorZenModeContext.getValue(contextKeyService)) {
			layoutService.toggleZenMode();
		}
	},
	when: InEditorZenModeContext,
	primary: KeyChord(KeyCode.Escape, KeyCode.Escape)
});
