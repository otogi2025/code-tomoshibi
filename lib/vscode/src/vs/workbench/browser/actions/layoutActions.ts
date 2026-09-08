/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ILocalizedString, localize, localize2 } from '../../../nls.js';
import { MenuId, MenuRegistry, registerAction2, Action2 } from '../../../platform/actions/common/actions.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { alert } from '../../../base/browser/ui/aria/aria.js';
import { EditorActionsLocation, EditorTabsMode, IWorkbenchLayoutService, LayoutSettings, Parts, Position, ZenModeSettings, positionToString } from '../../services/layout/browser/layoutService.js';
import { ServicesAccessor, IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { KeyMod, KeyCode } from '../../../base/common/keyCodes.js';
import { isWindows, isLinux, isWeb, isMacintosh, isNative } from '../../../base/common/platform.js';
import { IsMacNativeContext } from '../../../platform/contextkey/common/contextkeys.js';
import { KeybindingWeight } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService, ViewContainerLocation, IViewDescriptor, ViewContainerLocationToString } from '../../common/views.js';
import { IViewsService } from '../../services/views/common/viewsService.js';
import { QuickPickItem, IQuickInputService, IQuickPickItem, IQuickPickSeparator, IQuickPick } from '../../../platform/quickinput/common/quickInput.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { IPaneCompositePartService } from '../../services/panecomposite/browser/panecomposite.js';
import { ToggleAuxiliaryBarAction } from '../parts/auxiliarybar/auxiliaryBarActions.js';
import { TogglePanelAction } from '../parts/panel/panelActions.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { AuxiliaryBarVisibleContext, PanelAlignmentContext, PanelVisibleContext, SideBarVisibleContext, FocusedViewContext, InEditorZenModeContext, IsMainEditorCenteredLayoutContext, MainEditorAreaVisibleContext, IsMainWindowFullscreenContext, PanelPositionContext, IsAuxiliaryWindowFocusedContext, IsSessionsWindowContext, TitleBarStyleContext, IsAuxiliaryWindowContext } from '../../common/contextkeys.js';
import { Codicon } from '../../../base/common/codicons.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { registerIcon } from '../../../platform/theme/common/iconRegistry.js';
import { ICommandActionTitle } from '../../../platform/action/common/action.js';
import { mainWindow } from '../../../base/browser/window.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { MenuSettings, TitlebarStyle } from '../../../platform/window/common/window.js';
import { IPreferencesService } from '../../services/preferences/common/preferences.js';
import { QuickInputAlignmentContextKey } from '../../../platform/quickinput/browser/quickInput.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';

// Register Icons
const menubarIcon = registerIcon('menuBar', Codicon.layoutMenubar, localize('menuBarIcon', "表示菜单栏"));
const activityBarLeftIcon = registerIcon('activity-bar-left', Codicon.layoutActivitybarLeft, localize('activityBarLeft', "表示活动栏在左侧位置"));
const activityBarRightIcon = registerIcon('activity-bar-right', Codicon.layoutActivitybarRight, localize('activityBarRight', "表示活动栏在右侧位置"));
const panelLeftIcon = registerIcon('panel-left', Codicon.layoutSidebarLeft, localize('panelLeft', "表示左侧位置的侧栏"));
const panelLeftOffIcon = registerIcon('panel-left-off', Codicon.layoutSidebarLeftOff, localize('panelLeftOff', "表示已关闭的左侧位置的侧栏"));
const panelRightIcon = registerIcon('panel-right', Codicon.layoutSidebarRight, localize('panelRight', "表示右侧位置的侧栏"));
const panelRightOffIcon = registerIcon('panel-right-off', Codicon.layoutSidebarRightOff, localize('panelRightOff', "表示已关闭的右侧位置的侧栏"));
const panelIcon = registerIcon('panel-bottom', Codicon.layoutPanel, localize('panelBottom', "表示底部面板"));
const statusBarIcon = registerIcon('statusBar', Codicon.layoutStatusbar, localize('statusBarIcon', "表示状态栏"));

const panelAlignmentLeftIcon = registerIcon('panel-align-left', Codicon.layoutPanelLeft, localize('panelBottomLeft', "表示底部面板对齐方式设为左对齐"));
const panelAlignmentRightIcon = registerIcon('panel-align-right', Codicon.layoutPanelRight, localize('panelBottomRight', "表示底部面板对齐方式设为右对齐"));
const panelAlignmentCenterIcon = registerIcon('panel-align-center', Codicon.layoutPanelCenter, localize('panelBottomCenter', "表示底部面板对齐方式设为居中"));
const panelAlignmentJustifyIcon = registerIcon('panel-align-justify', Codicon.layoutPanelJustify, localize('panelBottomJustify', "表示设置底部面板对齐方式设为两端对齐"));

const quickInputAlignmentTopIcon = registerIcon('quickInputAlignmentTop', Codicon.arrowUp, localize('quickInputAlignmentTop', "表示设置为顶部的快速输入对齐方式"));
const quickInputAlignmentCenterIcon = registerIcon('quickInputAlignmentCenter', Codicon.circle, localize('quickInputAlignmentCenter', "表示设置为中心的快速输入对齐方式"));

const centerLayoutIcon = registerIcon('centerLayoutIcon', Codicon.layoutCentered, localize('centerLayoutIcon', "表示居中布局模式"));
const zenModeIcon = registerIcon('zenMode', Codicon.target, localize('zenModeIcon', "表示禅模式"));

export const ToggleActivityBarVisibilityActionId = 'workbench.action.toggleActivityBarVisibility';

// --- Toggle Centered Layout

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleCenteredLayout',
			title: {
				...localize2('toggleCenteredLayout', "切换居中布局"),
				mnemonicTitle: localize({ key: 'miToggleCenteredLayout', comment: ['&& denotes a mnemonic'] }, "居中布局(&&C)"),
			},
			precondition: ContextKeyExpr.and(IsAuxiliaryWindowFocusedContext.toNegated(), IsSessionsWindowContext.negate()),
			category: Categories.View,
			f1: true,
			toggled: IsMainEditorCenteredLayoutContext,
			menu: [{
				id: MenuId.MenubarAppearanceMenu,
				group: '1_toggle_view',
				order: 3,
				when: IsSessionsWindowContext.negate()
			}]
		});
	}

	run(accessor: ServicesAccessor): void {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const editorGroupService = accessor.get(IEditorGroupsService);

		layoutService.centerMainEditorLayout(!layoutService.isMainEditorLayoutCentered());
		editorGroupService.activeGroup.focus();
	}
});

// --- Set Sidebar Position
const sidebarPositionConfigurationKey = 'workbench.sideBar.location';

class MoveSidebarPositionAction extends Action2 {
	constructor(id: string, title: ICommandActionTitle, private readonly position: Position) {
		super({
			id,
			title,
			f1: false
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const configurationService = accessor.get(IConfigurationService);

		const position = layoutService.getSideBarPosition();
		if (position !== this.position) {
			return configurationService.updateValue(sidebarPositionConfigurationKey, positionToString(this.position));
		}
	}
}

class MoveSidebarRightAction extends MoveSidebarPositionAction {
	static readonly ID = 'workbench.action.moveSideBarRight';

	constructor() {
		super(MoveSidebarRightAction.ID, localize2('moveSidebarRight', "向右移动主侧栏"), Position.RIGHT);
	}
}

class MoveSidebarLeftAction extends MoveSidebarPositionAction {
	static readonly ID = 'workbench.action.moveSideBarLeft';

	constructor() {
		super(MoveSidebarLeftAction.ID, localize2('moveSidebarLeft', "向左移动主侧栏"), Position.LEFT);
	}
}

registerAction2(MoveSidebarRightAction);
registerAction2(MoveSidebarLeftAction);

// --- Toggle Sidebar Position

export class ToggleSidebarPositionAction extends Action2 {

	static readonly ID = 'workbench.action.toggleSidebarPosition';
	static readonly LABEL = localize('toggleSidebarPosition', "切换主侧栏位置");

	static getLabel(layoutService: IWorkbenchLayoutService): string {
		return layoutService.getSideBarPosition() === Position.LEFT ? localize('moveSidebarRight', "向右移动主侧栏") : localize('moveSidebarLeft', "向左移动主侧栏");
	}

	constructor() {
		super({
			id: ToggleSidebarPositionAction.ID,
			title: localize2('toggleSidebarPosition', "切换主侧栏位置"),
			category: Categories.View,
			f1: true,
			precondition: IsSessionsWindowContext.negate()
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const configurationService = accessor.get(IConfigurationService);

		const position = layoutService.getSideBarPosition();
		const newPositionValue = (position === Position.LEFT) ? 'right' : 'left';

		return configurationService.updateValue(sidebarPositionConfigurationKey, newPositionValue);
	}
}

registerAction2(ToggleSidebarPositionAction);

const configureLayoutIcon = registerIcon('configure-layout-icon', Codicon.layout, localize('cofigureLayoutIcon', '图标表示工作台布局配置。'));
MenuRegistry.appendMenuItem(MenuId.LayoutControlMenu, {
	submenu: MenuId.LayoutControlMenuSubmenu,
	title: localize('configureLayout', "配置布局"),
	icon: configureLayoutIcon,
	group: '1_workbench_layout',
	when: ContextKeyExpr.and(
		IsAuxiliaryWindowContext.negate(),
		ContextKeyExpr.equals('config.workbench.layoutControl.type', 'menu')
	)
});


MenuRegistry.appendMenuItems([{
	id: MenuId.ViewContainerTitleContext,
	item: {
		group: '3_workbench_layout_move',
		command: {
			id: ToggleSidebarPositionAction.ID,
			title: localize('move side bar right', "向右移动主侧栏")
		},
		when: ContextKeyExpr.and(ContextKeyExpr.notEquals('config.workbench.sideBar.location', 'right'), ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
		order: 1
	}
}, {
	id: MenuId.ViewContainerTitleContext,
	item: {
		group: '3_workbench_layout_move',
		command: {
			id: ToggleSidebarPositionAction.ID,
			title: localize('move sidebar left', "向左移动主侧栏")
		},
		when: ContextKeyExpr.and(ContextKeyExpr.equals('config.workbench.sideBar.location', 'right'), ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
		order: 1
	}
}, {
	id: MenuId.ViewContainerTitleContext,
	item: {
		group: '3_workbench_layout_move',
		command: {
			id: ToggleSidebarPositionAction.ID,
			title: localize('move second sidebar left', "向左移动辅助边栏")
		},
		when: ContextKeyExpr.and(ContextKeyExpr.notEquals('config.workbench.sideBar.location', 'right'), ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))),
		order: 1
	}
}, {
	id: MenuId.ViewContainerTitleContext,
	item: {
		group: '3_workbench_layout_move',
		command: {
			id: ToggleSidebarPositionAction.ID,
			title: localize('move second sidebar right', "向右移动辅助边栏")
		},
		when: ContextKeyExpr.and(ContextKeyExpr.equals('config.workbench.sideBar.location', 'right'), ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))),
		order: 1
	}
}]);

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	group: '3_workbench_layout_move',
	command: {
		id: ToggleSidebarPositionAction.ID,
		title: localize({ key: 'miMoveSidebarRight', comment: ['&& denotes a mnemonic'] }, "向右移动主侧栏(&&M)")
	},
	when: ContextKeyExpr.and(ContextKeyExpr.notEquals('config.workbench.sideBar.location', 'right'), IsSessionsWindowContext.negate()),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	group: '3_workbench_layout_move',
	command: {
		id: ToggleSidebarPositionAction.ID,
		title: localize({ key: 'miMoveSidebarLeft', comment: ['&& denotes a mnemonic'] }, "向左移动主侧栏(&&M)")
	},
	when: ContextKeyExpr.and(ContextKeyExpr.equals('config.workbench.sideBar.location', 'right'), IsSessionsWindowContext.negate()),
	order: 2
});

// --- Toggle Editor Visibility

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleEditorVisibility',
			title: {
				...localize2('toggleEditor', "切换编辑器区域可见性"),
				mnemonicTitle: localize({ key: 'miShowEditorArea', comment: ['&& denotes a mnemonic'] }, "显示编辑区域(&&E)"),
			},
			category: Categories.View,
			f1: true,
			toggled: MainEditorAreaVisibleContext,
			// the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
			precondition: ContextKeyExpr.and(IsAuxiliaryWindowFocusedContext.toNegated(), ContextKeyExpr.or(PanelAlignmentContext.isEqualTo('center'), PanelPositionContext.notEqualsTo('bottom')))
		});
	}

	run(accessor: ServicesAccessor): void {
		accessor.get(IWorkbenchLayoutService).toggleMaximizedPanel();
	}
});

MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	group: '2_appearance',
	title: localize({ key: 'miAppearance', comment: ['&& denotes a mnemonic'] }, "外观(&&A)"),
	submenu: MenuId.MenubarAppearanceMenu,
	when: IsSessionsWindowContext.negate(),
	order: 1
});

// Toggle Sidebar Visibility

export class ToggleSidebarVisibilityAction extends Action2 {

	static readonly ID = 'workbench.action.toggleSidebarVisibility';
	static readonly LABEL = localize('compositePart.hideSideBarLabel', "隐藏主边栏");

	constructor() {
		super({
			id: ToggleSidebarVisibilityAction.ID,
			title: localize2('toggleSidebar', '切换主侧栏可见性'),
			toggled: {
				condition: SideBarVisibleContext,
				title: localize('primary sidebar', "主侧边栏"),
				mnemonicTitle: localize({ key: 'primary sidebar mnemonic', comment: ['&& denotes a mnemonic'] }, "主侧边栏(&&P)"),
			},
			metadata: {
				description: localize('openAndCloseSidebar', '打开/显示并关闭/隐藏提要栏'),
			},
			category: Categories.View,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyB
			},
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: '0_workbench_layout',
					order: 0
				},
				{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 1
				}
			]
		});
	}

	run(accessor: ServicesAccessor): void {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const isCurrentlyVisible = layoutService.isVisible(Parts.SIDEBAR_PART);

		layoutService.setPartHidden(isCurrentlyVisible, Parts.SIDEBAR_PART);

		// Announce visibility change to screen readers
		const alertMessage = isCurrentlyVisible
			? localize('sidebarHidden', "主侧边栏已隐藏")
			: localize('sidebarVisible', "主侧边栏已显示");
		alert(alertMessage);
	}
}

registerAction2(ToggleSidebarVisibilityAction);

MenuRegistry.appendMenuItems([
	{
		id: MenuId.ViewContainerTitleContext,
		item: {
			group: '3_workbench_layout_move',
			command: {
				id: ToggleSidebarVisibilityAction.ID,
				title: localize('compositePart.hideSideBarLabel', "隐藏主边栏"),
			},
			when: ContextKeyExpr.and(SideBarVisibleContext, ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
			order: 2
		}
	}, {
		id: MenuId.LayoutControlMenu,
		item: {
			group: 'navigation',
			command: {
				id: ToggleSidebarVisibilityAction.ID,
				title: localize('toggleSideBar', "切换主侧栏"),
				icon: panelLeftOffIcon,
				toggled: { condition: SideBarVisibleContext, icon: panelLeftIcon }
			},
			when: ContextKeyExpr.and(
				IsAuxiliaryWindowContext.negate(),
				ContextKeyExpr.or(
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')),
				ContextKeyExpr.equals('config.workbench.sideBar.location', 'left')
			),
			order: 0
		}
	}, {
		id: MenuId.LayoutControlMenu,
		item: {
			group: 'navigation',
			command: {
				id: ToggleSidebarVisibilityAction.ID,
				title: localize('toggleSideBar', "切换主侧栏"),
				icon: panelRightOffIcon,
				toggled: { condition: SideBarVisibleContext, icon: panelRightIcon }
			},
			when: ContextKeyExpr.and(
				IsAuxiliaryWindowContext.negate(),
				ContextKeyExpr.or(
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')),
				ContextKeyExpr.equals('config.workbench.sideBar.location', 'right')
			),
			order: 2
		}
	}
]);

// --- Toggle Statusbar Visibility

export class ToggleStatusbarVisibilityAction extends Action2 {

	static readonly ID = 'workbench.action.toggleStatusbarVisibility';

	private static readonly statusbarVisibleKey = 'workbench.statusBar.visible';

	constructor() {
		super({
			id: ToggleStatusbarVisibilityAction.ID,
			title: {
				...localize2('toggleStatusbar', "切换状态栏可见性"),
				mnemonicTitle: localize({ key: 'miStatusbar', comment: ['&& denotes a mnemonic'] }, "状态栏(&&T)"),
			},
			category: Categories.View,
			f1: true,
			precondition: IsSessionsWindowContext.negate(),
			toggled: ContextKeyExpr.equals('config.workbench.statusBar.visible', true),
			menu: [{
				id: MenuId.MenubarAppearanceMenu,
				group: '2_workbench_layout',
				order: 3,
				when: IsSessionsWindowContext.negate()
			}]
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const configurationService = accessor.get(IConfigurationService);

		const visibility = layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow);
		const newVisibilityValue = !visibility;

		return configurationService.updateValue(ToggleStatusbarVisibilityAction.statusbarVisibleKey, newVisibilityValue);
	}
}

registerAction2(ToggleStatusbarVisibilityAction);

// ------------------- Editor Tabs Layout --------------------------------

export abstract class AbstractSetShowTabsAction extends Action2 {

	constructor(private readonly settingName: string, private readonly value: string, title: ICommandActionTitle, id: string, precondition: ContextKeyExpression, description: string | ILocalizedString | undefined) {
		super({
			id,
			title,
			category: Categories.View,
			precondition: ContextKeyExpr.and(precondition, IsSessionsWindowContext.negate()),
			metadata: description ? { description } : undefined,
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		return configurationService.updateValue(this.settingName, this.value);
	}
}

// --- Hide Editor Tabs

export class HideEditorTabsAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.hideEditorTabs';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.NONE).negate(), InEditorZenModeContext.negate())!;
		const title = localize2('hideEditorTabs', '隐藏编辑器选项卡');
		super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.NONE, title, HideEditorTabsAction.ID, precondition, localize2('hideEditorTabsDescription', "隐藏选项卡栏"));
	}
}

// --- Hide Editor Tabs (Zen Mode)

export class ZenHideEditorTabsAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.zenHideEditorTabs';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.NONE).negate(), InEditorZenModeContext)!;
		const title = localize2('hideEditorTabsZenMode', '在禅模式下隐藏编辑器选项卡');
		super(ZenModeSettings.SHOW_TABS, EditorTabsMode.NONE, title, ZenHideEditorTabsAction.ID, precondition, localize2('hideEditorTabsZenModeDescription', "在禅模式下隐藏选项卡栏"));
	}
}

// --- Show Multiple Editor Tabs

export class ShowMultipleEditorTabsAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.showMultipleEditorTabs';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.MULTIPLE).negate(), InEditorZenModeContext.negate())!;
		const title = localize2('showMultipleEditorTabs', '显示多个编辑器选项卡');

		super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.MULTIPLE, title, ShowMultipleEditorTabsAction.ID, precondition, localize2('showMultipleEditorTabsDescription', "显示具有多个选项卡的选项卡栏"));
	}
}

// --- Show Multiple Editor Tabs (Zen Mode)

export class ZenShowMultipleEditorTabsAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.zenShowMultipleEditorTabs';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.MULTIPLE).negate(), InEditorZenModeContext)!;
		const title = localize2('showMultipleEditorTabsZenMode', '在禅模式下显示多个编辑器选项卡');

		super(ZenModeSettings.SHOW_TABS, EditorTabsMode.MULTIPLE, title, ZenShowMultipleEditorTabsAction.ID, precondition, localize2('showMultipleEditorTabsZenModeDescription', "在 Zen 模式下显示选项卡栏"));
	}
}

// --- Show Single Editor Tab

export class ShowSingleEditorTabAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.showEditorTab';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.SINGLE).negate(), InEditorZenModeContext.negate())!;
		const title = localize2('showSingleEditorTab', '显示单个编辑器选项卡');

		super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.SINGLE, title, ShowSingleEditorTabAction.ID, precondition, localize2('showSingleEditorTabDescription', "显示具有一个选项卡的选项卡栏"));
	}
}

registerAction2(HideEditorTabsAction);
registerAction2(ShowMultipleEditorTabsAction);
registerAction2(ShowSingleEditorTabAction);

// --- Show Single Editor Tab (Zen Mode)

export class ZenShowSingleEditorTabAction extends AbstractSetShowTabsAction {

	static readonly ID = 'workbench.action.zenShowEditorTab';

	constructor() {
		const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.SINGLE).negate(), InEditorZenModeContext)!;
		const title = localize2('showSingleEditorTabZenMode', '在禅模式下显示单个编辑器选项卡');

		super(ZenModeSettings.SHOW_TABS, EditorTabsMode.SINGLE, title, ZenShowSingleEditorTabAction.ID, precondition, localize2('showSingleEditorTabZenModeDescription', "在禅模式下显示带有一个选项卡的选项卡栏"));
	}
}

// --- Tab Bar Submenu in View Appearance Menu

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.EditorTabsBarShowTabsSubmenu,
	title: localize('tabBar', "选项卡栏"),
	group: '3_workbench_layout_move',
	order: 10,
	when: ContextKeyExpr.and(InEditorZenModeContext.negate(), IsSessionsWindowContext.negate())
});

// --- Show Editor Actions in Title Bar

export class EditorActionsTitleBarAction extends Action2 {

	static readonly ID = 'workbench.action.editorActionsTitleBar';

	constructor() {
		super({
			id: EditorActionsTitleBarAction.ID,
			title: localize2('moveEditorActionsToTitleBar', "将编辑器操作移动到标题栏"),
			category: Categories.View,
			precondition: ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.TITLEBAR).negate(), IsSessionsWindowContext.negate()),
			metadata: { description: localize2('moveEditorActionsToTitleBarDescription', "将“编辑器操作”从选项卡栏移动到标题栏") },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.TITLEBAR);
	}
}
registerAction2(EditorActionsTitleBarAction);

// --- Editor Actions Default Position

export class EditorActionsDefaultAction extends Action2 {

	static readonly ID = 'workbench.action.editorActionsDefault';

	constructor() {
		super({
			id: EditorActionsDefaultAction.ID,
			title: localize2('moveEditorActionsToTabBar', "将编辑器操作移动到选项卡栏"),
			category: Categories.View,
			precondition: ContextKeyExpr.and(
				ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.DEFAULT).negate(),
				ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.NONE).negate(),
				IsSessionsWindowContext.negate(),
			),
			metadata: { description: localize2('moveEditorActionsToTabBarDescription', "将“编辑器操作”从标题栏移动到选项卡栏") },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.DEFAULT);
	}
}
registerAction2(EditorActionsDefaultAction);

// --- Hide Editor Actions

export class HideEditorActionsAction extends Action2 {

	static readonly ID = 'workbench.action.hideEditorActions';

	constructor() {
		super({
			id: HideEditorActionsAction.ID,
			title: localize2('hideEditorActons', "隐藏编辑器操作"),
			category: Categories.View,
			precondition: ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.HIDDEN).negate(), IsSessionsWindowContext.negate()),
			metadata: { description: localize2('hideEditorActonsDescription', "在选项卡和标题栏中隐藏“编辑器操作”") },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.HIDDEN);
	}
}
registerAction2(HideEditorActionsAction);

// --- Hide Editor Actions

export class ShowEditorActionsAction extends Action2 {

	static readonly ID = 'workbench.action.showEditorActions';

	constructor() {
		super({
			id: ShowEditorActionsAction.ID,
			title: localize2('showEditorActons', "显示编辑器操作"),
			category: Categories.View,
			precondition: ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.HIDDEN), IsSessionsWindowContext.negate()),
			metadata: { description: localize2('showEditorActonsDescription', "将“编辑器操作”设为可见。") },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.DEFAULT);
	}
}
registerAction2(ShowEditorActionsAction);

// --- Editor Actions Position Submenu in View Appearance Menu

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.EditorActionsPositionSubmenu,
	title: localize('editorActionsPosition', "编辑器操作位置"),
	group: '3_workbench_layout_move',
	order: 11,
	when: IsSessionsWindowContext.negate()
});

// --- Configure Tabs Layout

export class ConfigureEditorTabsAction extends Action2 {

	static readonly ID = 'workbench.action.configureEditorTabs';

	constructor() {
		super({
			id: ConfigureEditorTabsAction.ID,
			title: localize2('configureTabs', "配置选项卡"),
			category: Categories.View,
		});
	}

	run(accessor: ServicesAccessor) {
		const preferencesService = accessor.get(IPreferencesService);
		preferencesService.openSettings({ jsonEditor: false, query: 'workbench.editor tab' });
	}
}
registerAction2(ConfigureEditorTabsAction);

// --- Configure Editor

export class ConfigureEditorAction extends Action2 {

	static readonly ID = 'workbench.action.configureEditor';

	constructor() {
		super({
			id: ConfigureEditorAction.ID,
			title: localize2('configureEditors', "配置编辑器"),
			category: Categories.View,
		});
	}

	run(accessor: ServicesAccessor) {
		const preferencesService = accessor.get(IPreferencesService);
		preferencesService.openSettings({ jsonEditor: false, query: 'workbench.editor' });
	}
}
registerAction2(ConfigureEditorAction);

// --- Toggle Pinned Tabs On Separate Row

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.toggleSeparatePinnedEditorTabs',
			title: localize2('toggleSeparatePinnedEditorTabs', "分离已固定编辑器选项卡"),
			category: Categories.View,
			precondition: ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.MULTIPLE),
			metadata: { description: localize2('toggleSeparatePinnedEditorTabsDescription', "控制固定的编辑器选项卡是否在未固定的选项卡上方呈单独一行显示。") },
			f1: true
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);

		const oldettingValue = configurationService.getValue<string>('workbench.editor.pinnedTabsOnSeparateRow');
		const newSettingValue = !oldettingValue;

		return configurationService.updateValue('workbench.editor.pinnedTabsOnSeparateRow', newSettingValue);
	}
});

// --- Toggle Menu Bar

if (isWindows || isLinux || isWeb) {
	registerAction2(class ToggleMenubarAction extends Action2 {

		constructor() {
			super({
				id: 'workbench.action.toggleMenuBar',
				title: {
					...localize2('toggleMenuBar', "切换菜单栏"),
					mnemonicTitle: localize({ key: 'miMenuBar', comment: ['&& denotes a mnemonic'] }, "菜单栏(&&B)"),
				},
				category: Categories.View,
				f1: true,
				precondition: IsSessionsWindowContext.negate(),
				toggled: ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'hidden'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'toggle'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'compact')),
				menu: [{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 0,
					when: IsSessionsWindowContext.negate()
				}]
			});
		}

		run(accessor: ServicesAccessor): void {
			return accessor.get(IWorkbenchLayoutService).toggleMenuBar();
		}
	});

	// Add separately to title bar context menu so we can use a different title
	for (const menuId of [MenuId.TitleBarContext, MenuId.TitleBarTitleContext]) {
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: 'workbench.action.toggleMenuBar',
				title: localize('miMenuBarNoMnemonic', "菜单栏"),
				toggled: ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'hidden'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'toggle'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'compact'))
			},
			when: ContextKeyExpr.and(IsAuxiliaryWindowFocusedContext.toNegated(), ContextKeyExpr.notEquals(TitleBarStyleContext.key, TitlebarStyle.NATIVE), IsMainWindowFullscreenContext.negate()),
			group: '2_config',
			order: 0
		});
	}
}

// --- Reset View Locations

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.resetViewLocations',
			title: localize2('resetViewLocations', "重置视图位置"),
			category: Categories.View,
			f1: true
		});
	}

	run(accessor: ServicesAccessor): void {
		return accessor.get(IViewDescriptorService).reset();
	}
});

// --- Move View

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.moveView',
			title: localize2('moveView', "移动视图"),
			category: Categories.View,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const instantiationService = accessor.get(IInstantiationService);
		const quickInputService = accessor.get(IQuickInputService);
		const contextKeyService = accessor.get(IContextKeyService);
		const paneCompositePartService = accessor.get(IPaneCompositePartService);

		const focusedViewId = FocusedViewContext.getValue(contextKeyService);
		let viewId: string;

		if (focusedViewId && viewDescriptorService.getViewDescriptorById(focusedViewId)?.canMoveView) {
			viewId = focusedViewId;
		}

		try {
			viewId = await this.getView(quickInputService, viewDescriptorService, paneCompositePartService, viewId!);
			if (!viewId) {
				return;
			}

			const moveFocusedViewAction = new MoveFocusedViewAction();
			instantiationService.invokeFunction(accessor => moveFocusedViewAction.run(accessor, viewId));
		} catch { }
	}

	private getViewItems(viewDescriptorService: IViewDescriptorService, paneCompositePartService: IPaneCompositePartService): Array<QuickPickItem> {
		const results: Array<QuickPickItem> = [];

		const viewlets = paneCompositePartService.getVisiblePaneCompositeIds(ViewContainerLocation.Sidebar);
		viewlets.forEach(viewletId => {
			const container = viewDescriptorService.getViewContainerById(viewletId)!;
			const containerModel = viewDescriptorService.getViewContainerModel(container);

			let hasAddedView = false;
			containerModel.visibleViewDescriptors.forEach(viewDescriptor => {
				if (viewDescriptor.canMoveView) {
					if (!hasAddedView) {
						results.push({
							type: 'separator',
							label: localize('sidebarContainer', "侧边栏/{0}", containerModel.title)
						});
						hasAddedView = true;
					}

					results.push({
						id: viewDescriptor.id,
						label: viewDescriptor.name.value
					});
				}
			});
		});

		const panels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.Panel);
		panels.forEach(panel => {
			const container = viewDescriptorService.getViewContainerById(panel)!;
			const containerModel = viewDescriptorService.getViewContainerModel(container);

			let hasAddedView = false;
			containerModel.visibleViewDescriptors.forEach(viewDescriptor => {
				if (viewDescriptor.canMoveView) {
					if (!hasAddedView) {
						results.push({
							type: 'separator',
							label: localize('panelContainer', "面板/{0}", containerModel.title)
						});
						hasAddedView = true;
					}

					results.push({
						id: viewDescriptor.id,
						label: viewDescriptor.name.value
					});
				}
			});
		});


		const sidePanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.AuxiliaryBar);
		sidePanels.forEach(panel => {
			const container = viewDescriptorService.getViewContainerById(panel)!;
			const containerModel = viewDescriptorService.getViewContainerModel(container);

			let hasAddedView = false;
			containerModel.visibleViewDescriptors.forEach(viewDescriptor => {
				if (viewDescriptor.canMoveView) {
					if (!hasAddedView) {
						results.push({
							type: 'separator',
							label: localize('secondarySideBarContainer', "辅助侧栏/{0}", containerModel.title)
						});
						hasAddedView = true;
					}

					results.push({
						id: viewDescriptor.id,
						label: viewDescriptor.name.value
					});
				}
			});
		});

		return results;
	}

	private async getView(quickInputService: IQuickInputService, viewDescriptorService: IViewDescriptorService, paneCompositePartService: IPaneCompositePartService, viewId?: string): Promise<string> {
		const disposables = new DisposableStore();
		const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
		quickPick.placeholder = localize('moveFocusedView.selectView', "选择要移动的视图");
		quickPick.items = this.getViewItems(viewDescriptorService, paneCompositePartService);
		quickPick.selectedItems = quickPick.items.filter(item => (item as IQuickPickItem).id === viewId) as IQuickPickItem[];

		return new Promise((resolve, reject) => {
			disposables.add(quickPick.onDidAccept(() => {
				const viewId = quickPick.selectedItems[0];
				if (viewId.id) {
					resolve(viewId.id);
				} else {
					reject();
				}

				quickPick.hide();
			}));

			disposables.add(quickPick.onDidHide(() => {
				disposables.dispose();
				reject();
			}));

			quickPick.show();
		});
	}
});

// --- Move Focused View

class MoveFocusedViewAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.moveFocusedView',
			title: localize2('moveFocusedView', "移动焦点视图"),
			category: Categories.View,
			precondition: FocusedViewContext.notEqualsTo(''),
			f1: true
		});
	}

	run(accessor: ServicesAccessor, viewId?: string): void {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const viewsService = accessor.get(IViewsService);
		const quickInputService = accessor.get(IQuickInputService);
		const contextKeyService = accessor.get(IContextKeyService);
		const dialogService = accessor.get(IDialogService);
		const paneCompositePartService = accessor.get(IPaneCompositePartService);

		const focusedViewId = viewId || FocusedViewContext.getValue(contextKeyService);

		if (focusedViewId === undefined || focusedViewId.trim() === '') {
			dialogService.error(localize('moveFocusedView.error.noFocusedView', "当前没有重点视图。"));
			return;
		}

		const viewDescriptor = viewDescriptorService.getViewDescriptorById(focusedViewId);
		if (!viewDescriptor?.canMoveView) {
			dialogService.error(localize('moveFocusedView.error.nonMovableView', "当前焦点视图不可移动。"));
			return;
		}

		const disposables = new DisposableStore();
		const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
		quickPick.placeholder = localize('moveFocusedView.selectDestination', "选择视图的目标");
		quickPick.title = localize({ key: 'moveFocusedView.title', comment: ['{0} indicates the title of the view the user has selected to move.'] }, "视图: 移动 {0}", viewDescriptor.name.value);

		const items: Array<IQuickPickItem | IQuickPickSeparator> = [];
		const currentContainer = viewDescriptorService.getViewContainerByViewId(focusedViewId)!;
		const currentLocation = viewDescriptorService.getViewLocationById(focusedViewId)!;
		const isViewSolo = viewDescriptorService.getViewContainerModel(currentContainer).allViewDescriptors.length === 1;

		if (!(isViewSolo && currentLocation === ViewContainerLocation.Panel)) {
			items.push({
				id: '_.panel.newcontainer',
				label: localize({ key: 'moveFocusedView.newContainerInPanel', comment: ['Creates a new top-level tab in the panel.'] }, "新建面板条目"),
			});
		}

		if (!(isViewSolo && currentLocation === ViewContainerLocation.Sidebar)) {
			items.push({
				id: '_.sidebar.newcontainer',
				label: localize('moveFocusedView.newContainerInSidebar', "新侧边栏条目")
			});
		}

		if (!(isViewSolo && currentLocation === ViewContainerLocation.AuxiliaryBar)) {
			items.push({
				id: '_.auxiliarybar.newcontainer',
				label: localize('moveFocusedView.newContainerInSidePanel', "新建辅助侧栏条目")
			});
		}

		items.push({
			type: 'separator',
			label: localize('sidebar', "侧边栏")
		});

		const pinnedViewlets = paneCompositePartService.getVisiblePaneCompositeIds(ViewContainerLocation.Sidebar);
		items.push(...pinnedViewlets
			.filter(viewletId => {
				if (viewletId === viewDescriptorService.getViewContainerByViewId(focusedViewId)!.id) {
					return false;
				}

				return !viewDescriptorService.getViewContainerById(viewletId)!.rejectAddedViews;
			})
			.map(viewletId => {
				return {
					id: viewletId,
					label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(viewletId)!).title
				};
			}));

		items.push({
			type: 'separator',
			label: localize('panel', "面板")
		});

		const pinnedPanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.Panel);
		items.push(...pinnedPanels
			.filter(panel => {
				if (panel === viewDescriptorService.getViewContainerByViewId(focusedViewId)!.id) {
					return false;
				}

				return !viewDescriptorService.getViewContainerById(panel)!.rejectAddedViews;
			})
			.map(panel => {
				return {
					id: panel,
					label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(panel)!).title
				};
			}));

		items.push({
			type: 'separator',
			label: localize('secondarySideBar', "辅助侧边栏")
		});

		const pinnedAuxPanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.AuxiliaryBar);
		items.push(...pinnedAuxPanels
			.filter(panel => {
				if (panel === viewDescriptorService.getViewContainerByViewId(focusedViewId)!.id) {
					return false;
				}

				return !viewDescriptorService.getViewContainerById(panel)!.rejectAddedViews;
			})
			.map(panel => {
				return {
					id: panel,
					label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(panel)!).title
				};
			}));

		quickPick.items = items;

		disposables.add(quickPick.onDidAccept(() => {
			const destination = quickPick.selectedItems[0];

			if (destination.id === '_.panel.newcontainer') {
				viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.Panel, this.desc.id);
				viewsService.openView(focusedViewId, true);
			} else if (destination.id === '_.sidebar.newcontainer') {
				viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.Sidebar, this.desc.id);
				viewsService.openView(focusedViewId, true);
			} else if (destination.id === '_.auxiliarybar.newcontainer') {
				viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.AuxiliaryBar, this.desc.id);
				viewsService.openView(focusedViewId, true);
			} else if (destination.id) {
				viewDescriptorService.moveViewsToContainer([viewDescriptor], viewDescriptorService.getViewContainerById(destination.id)!, undefined, this.desc.id);
				viewsService.openView(focusedViewId, true);
			}

			quickPick.hide();
		}));

		disposables.add(quickPick.onDidHide(() => disposables.dispose()));

		quickPick.show();
	}
}

registerAction2(MoveFocusedViewAction);

// --- Reset Focused View Location

registerAction2(class extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.resetFocusedViewLocation',
			title: localize2('resetFocusedViewLocation', "重置焦点视图位置"),
			category: Categories.View,
			f1: true,
			precondition: FocusedViewContext.notEqualsTo('')
		});
	}

	run(accessor: ServicesAccessor): void {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const contextKeyService = accessor.get(IContextKeyService);
		const dialogService = accessor.get(IDialogService);
		const viewsService = accessor.get(IViewsService);

		const focusedViewId = FocusedViewContext.getValue(contextKeyService);

		let viewDescriptor: IViewDescriptor | null = null;
		if (focusedViewId !== undefined && focusedViewId.trim() !== '') {
			viewDescriptor = viewDescriptorService.getViewDescriptorById(focusedViewId);
		}

		if (!viewDescriptor) {
			dialogService.error(localize('resetFocusedView.error.noFocusedView', "当前没有重点视图。"));
			return;
		}

		const defaultContainer = viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
		if (!defaultContainer || defaultContainer === viewDescriptorService.getViewContainerByViewId(viewDescriptor.id)) {
			return;
		}

		viewDescriptorService.moveViewsToContainer([viewDescriptor], defaultContainer, undefined, this.desc.id);
		viewsService.openView(viewDescriptor.id, true);
	}
});

// --- Resize View

abstract class BaseResizeViewAction extends Action2 {

	protected static readonly RESIZE_INCREMENT = 60; // This is a css pixel size

	protected resizePart(widthChange: number, heightChange: number, layoutService: IWorkbenchLayoutService, partToResize?: Parts): void {
		if (layoutService.activeContainer !== layoutService.mainContainer) {
			return; // we do not support resizing in auxiliary windows
		}

		let part: Parts | undefined;
		if (partToResize === undefined) {
			const isEditorFocus = layoutService.hasFocus(Parts.EDITOR_PART);
			const isSidebarFocus = layoutService.hasFocus(Parts.SIDEBAR_PART);
			const isPanelFocus = layoutService.hasFocus(Parts.PANEL_PART);
			const isAuxiliaryBarFocus = layoutService.hasFocus(Parts.AUXILIARYBAR_PART);

			if (isSidebarFocus) {
				part = Parts.SIDEBAR_PART;
			} else if (isPanelFocus) {
				part = Parts.PANEL_PART;
			} else if (isEditorFocus) {
				part = Parts.EDITOR_PART;
			} else if (isAuxiliaryBarFocus) {
				part = Parts.AUXILIARYBAR_PART;
			}
		} else {
			part = partToResize;
		}

		if (part) {
			layoutService.resizePart(part, widthChange, heightChange);
		}
	}
}

class IncreaseViewSizeAction extends BaseResizeViewAction {

	constructor() {
		super({
			id: 'workbench.action.increaseViewSize',
			title: localize2('increaseViewSize', '增加当前视图大小'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(BaseResizeViewAction.RESIZE_INCREMENT, BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService));
	}
}

class IncreaseViewWidthAction extends BaseResizeViewAction {

	constructor() {
		super({
			id: 'workbench.action.increaseViewWidth',
			title: localize2('increaseEditorWidth', '增加编辑器宽度'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(BaseResizeViewAction.RESIZE_INCREMENT, 0, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
	}
}

class IncreaseViewHeightAction extends BaseResizeViewAction {

	constructor() {
		super({
			id: 'workbench.action.increaseViewHeight',
			title: localize2('increaseEditorHeight', '增加编辑器高度'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(0, BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
	}
}

class DecreaseViewSizeAction extends BaseResizeViewAction {

	constructor() {
		super({
			id: 'workbench.action.decreaseViewSize',
			title: localize2('decreaseViewSize', '减小当前视图大小'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(-BaseResizeViewAction.RESIZE_INCREMENT, -BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService));
	}
}

class DecreaseViewWidthAction extends BaseResizeViewAction {
	constructor() {
		super({
			id: 'workbench.action.decreaseViewWidth',
			title: localize2('decreaseEditorWidth', '降低编辑器宽度'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(-BaseResizeViewAction.RESIZE_INCREMENT, 0, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
	}
}

class DecreaseViewHeightAction extends BaseResizeViewAction {

	constructor() {
		super({
			id: 'workbench.action.decreaseViewHeight',
			title: localize2('decreaseEditorHeight', '降低编辑器高度'),
			f1: true,
			precondition: IsAuxiliaryWindowFocusedContext.toNegated()
		});
	}

	run(accessor: ServicesAccessor): void {
		this.resizePart(0, -BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
	}
}

registerAction2(IncreaseViewSizeAction);
registerAction2(IncreaseViewWidthAction);
registerAction2(IncreaseViewHeightAction);

registerAction2(DecreaseViewSizeAction);
registerAction2(DecreaseViewWidthAction);
registerAction2(DecreaseViewHeightAction);

//#region Quick Input Alignment Actions

registerAction2(class AlignQuickInputTopAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.alignQuickInputTop',
			title: localize2('alignQuickInputTop', '将快速输入靠上对齐'),
			f1: false
		});
	}

	run(accessor: ServicesAccessor): void {
		const quickInputService = accessor.get(IQuickInputService);
		quickInputService.setAlignment('top');
	}
});

registerAction2(class AlignQuickInputCenterAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.alignQuickInputCenter',
			title: localize2('alignQuickInputCenter', '快速输入中心对齐'),
			f1: false
		});
	}

	run(accessor: ServicesAccessor): void {
		const quickInputService = accessor.get(IQuickInputService);
		quickInputService.setAlignment('center');
	}
});

//#endregion

type ContextualLayoutVisualIcon = { iconA: ThemeIcon; iconB: ThemeIcon; whenA: ContextKeyExpression };
type LayoutVisualIcon = ThemeIcon | ContextualLayoutVisualIcon;

function isContextualLayoutVisualIcon(icon: LayoutVisualIcon): icon is ContextualLayoutVisualIcon {
	return (icon as ContextualLayoutVisualIcon).iconA !== undefined;
}

interface CustomizeLayoutItem {
	id: string;
	active: ContextKeyExpression;
	label: string;
	activeIcon: ThemeIcon;
	visualIcon?: LayoutVisualIcon;
	activeAriaLabel: string;
	inactiveIcon?: ThemeIcon;
	inactiveAriaLabel?: string;
	useButtons: boolean;
}

const CreateToggleLayoutItem = (id: string, active: ContextKeyExpression, label: string, visualIcon?: LayoutVisualIcon): CustomizeLayoutItem => {
	return {
		id,
		active,
		label,
		visualIcon,
		activeIcon: Codicon.eye,
		inactiveIcon: Codicon.eyeClosed,
		activeAriaLabel: localize('selectToHide', "选择以隐藏"),
		inactiveAriaLabel: localize('selectToShow', "选择以显示"),
		useButtons: true,
	};
};

const CreateOptionLayoutItem = (id: string, active: ContextKeyExpression, label: string, visualIcon?: LayoutVisualIcon): CustomizeLayoutItem => {
	return {
		id,
		active,
		label,
		visualIcon,
		activeIcon: Codicon.check,
		activeAriaLabel: localize('active', "活动"),
		useButtons: false
	};
};

const MenuBarToggledContext = ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'hidden'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'toggle'), ContextKeyExpr.notEquals(`config.${MenuSettings.MenuBarVisibility}`, 'compact')) as ContextKeyExpression;
const ToggleVisibilityActions: CustomizeLayoutItem[] = [];
if (!isMacintosh || !isNative) {
	ToggleVisibilityActions.push(CreateToggleLayoutItem('workbench.action.toggleMenuBar', MenuBarToggledContext, localize('menuBar', "菜单栏"), menubarIcon));
}

ToggleVisibilityActions.push(...[
	CreateToggleLayoutItem(ToggleActivityBarVisibilityActionId, ContextKeyExpr.notEquals('config.workbench.activityBar.location', 'hidden'), localize('activityBar', "活动栏"), { whenA: ContextKeyExpr.equals('config.workbench.sideBar.location', 'left'), iconA: activityBarLeftIcon, iconB: activityBarRightIcon }),
	CreateToggleLayoutItem(ToggleSidebarVisibilityAction.ID, SideBarVisibleContext, localize('sideBar', "主侧栏"), { whenA: ContextKeyExpr.equals('config.workbench.sideBar.location', 'left'), iconA: panelLeftIcon, iconB: panelRightIcon }),
	CreateToggleLayoutItem(ToggleAuxiliaryBarAction.ID, AuxiliaryBarVisibleContext, localize('secondarySideBar', "辅助侧边栏"), { whenA: ContextKeyExpr.equals('config.workbench.sideBar.location', 'left'), iconA: panelRightIcon, iconB: panelLeftIcon }),
	CreateToggleLayoutItem(TogglePanelAction.ID, PanelVisibleContext, localize('panel', "面板"), panelIcon),
	CreateToggleLayoutItem(ToggleStatusbarVisibilityAction.ID, ContextKeyExpr.equals('config.workbench.statusBar.visible', true), localize('statusBar', "状态栏"), statusBarIcon),
]);

const MoveSideBarActions: CustomizeLayoutItem[] = [
	CreateOptionLayoutItem(MoveSidebarLeftAction.ID, ContextKeyExpr.equals('config.workbench.sideBar.location', 'left'), localize('leftSideBar', "左对齐"), panelLeftIcon),
	CreateOptionLayoutItem(MoveSidebarRightAction.ID, ContextKeyExpr.equals('config.workbench.sideBar.location', 'right'), localize('rightSideBar', "右对齐"), panelRightIcon),
];

const AlignPanelActions: CustomizeLayoutItem[] = [
	CreateOptionLayoutItem('workbench.action.alignPanelLeft', PanelAlignmentContext.isEqualTo('left'), localize('leftPanel', "左对齐"), panelAlignmentLeftIcon),
	CreateOptionLayoutItem('workbench.action.alignPanelRight', PanelAlignmentContext.isEqualTo('right'), localize('rightPanel', "右对齐"), panelAlignmentRightIcon),
	CreateOptionLayoutItem('workbench.action.alignPanelCenter', PanelAlignmentContext.isEqualTo('center'), localize('centerPanel', "居中"), panelAlignmentCenterIcon),
	CreateOptionLayoutItem('workbench.action.alignPanelJustify', PanelAlignmentContext.isEqualTo('justify'), localize('justifyPanel', "两端对齐"), panelAlignmentJustifyIcon),
];

const QuickInputActions: CustomizeLayoutItem[] = [
	CreateOptionLayoutItem('workbench.action.alignQuickInputTop', QuickInputAlignmentContextKey.isEqualTo('top'), localize('top', "顶部对齐"), quickInputAlignmentTopIcon),
	CreateOptionLayoutItem('workbench.action.alignQuickInputCenter', QuickInputAlignmentContextKey.isEqualTo('center'), localize('center', "居中"), quickInputAlignmentCenterIcon),
];

const MiscLayoutOptions: CustomizeLayoutItem[] = [
	CreateOptionLayoutItem('workbench.action.toggleZenMode', InEditorZenModeContext, localize('zenMode', "禅模式"), zenModeIcon),
	CreateOptionLayoutItem('workbench.action.toggleCenteredLayout', IsMainEditorCenteredLayoutContext, localize('centeredLayout', "居中布局"), centerLayoutIcon),
];

const LayoutContextKeySet = new Set<string>();
for (const { active } of [...ToggleVisibilityActions, ...MoveSideBarActions, ...AlignPanelActions, ...QuickInputActions, ...MiscLayoutOptions]) {
	for (const key of active.keys()) {
		LayoutContextKeySet.add(key);
	}
}

/**
 * Matches the title bar's `editorActionsEnabled` getter: true when editor
 * actions render in the title bar (either explicitly, or because tabs are
 * hidden and the location defaults there).
 */
const EditorActionsInTitleBar = ContextKeyExpr.or(
	ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.TITLEBAR),
	ContextKeyExpr.and(
		ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.DEFAULT),
		ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.NONE)
	)
)!;

registerAction2(class CustomizeLayoutAction extends Action2 {

	private _currentQuickPick?: IQuickPick<IQuickPickItem, { useSeparators: true }>;

	constructor() {
		super({
			id: 'workbench.action.customizeLayout',
			title: localize2('customizeLayout', "自定义布局..."),
			f1: true,
			icon: configureLayoutIcon,
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: 'z_end',
				},
				{
					id: MenuId.LayoutControlMenu,
					when: ContextKeyExpr.and(
						IsAuxiliaryWindowContext.toNegated(),
						ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'),
						EditorActionsInTitleBar.negate()
					),
					group: 'navigation'
				},
				{
					id: MenuId.LayoutControlMenu,
					when: ContextKeyExpr.and(
						IsAuxiliaryWindowContext.toNegated(),
						ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'),
						EditorActionsInTitleBar
					),
					group: '1_layout'
				}
			]
		});
	}

	getItems(contextKeyService: IContextKeyService, keybindingService: IKeybindingService): QuickPickItem[] {
		const toQuickPickItem = (item: CustomizeLayoutItem): IQuickPickItem => {
			const toggled = item.active.evaluate(contextKeyService.getContext(null));
			let label = item.useButtons ?
				item.label :
				item.label + (toggled && item.activeIcon ? ` $(${item.activeIcon.id})` : (!toggled && item.inactiveIcon ? ` $(${item.inactiveIcon.id})` : ''));
			const ariaLabel =
				item.label + (toggled && item.activeAriaLabel ? ` (${item.activeAriaLabel})` : (!toggled && item.inactiveAriaLabel ? ` (${item.inactiveAriaLabel})` : ''));

			if (item.visualIcon) {
				let icon = item.visualIcon;
				if (isContextualLayoutVisualIcon(icon)) {
					const useIconA = icon.whenA.evaluate(contextKeyService.getContext(null));
					icon = useIconA ? icon.iconA : icon.iconB;
				}

				label = `$(${icon.id}) ${label}`;
			}

			const icon = toggled ? item.activeIcon : item.inactiveIcon;

			return {
				type: 'item',
				id: item.id,
				label,
				ariaLabel,
				keybinding: keybindingService.lookupKeybinding(item.id, contextKeyService),
				buttons: !item.useButtons ? undefined : [
					{
						alwaysVisible: false,
						tooltip: ariaLabel,
						iconClass: icon ? ThemeIcon.asClassName(icon) : undefined
					}
				]
			};
		};
		return [
			{
				type: 'separator',
				label: localize('toggleVisibility', "可见性")
			},
			...ToggleVisibilityActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('sideBarPosition', "主侧栏位置")
			},
			...MoveSideBarActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('panelAlignment', "面板对齐方式")
			},
			...AlignPanelActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('quickOpen', "快速输入位置")
			},
			...QuickInputActions.map(toQuickPickItem),
			{
				type: 'separator',
				label: localize('layoutModes', "模式"),
			},
			...MiscLayoutOptions.map(toQuickPickItem),
		];
	}

	run(accessor: ServicesAccessor): void {
		if (this._currentQuickPick) {
			this._currentQuickPick.hide();
			return;
		}

		const configurationService = accessor.get(IConfigurationService);
		const contextKeyService = accessor.get(IContextKeyService);
		const commandService = accessor.get(ICommandService);
		const quickInputService = accessor.get(IQuickInputService);
		const keybindingService = accessor.get(IKeybindingService);

		const disposables = new DisposableStore();

		const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));

		this._currentQuickPick = quickPick;
		quickPick.items = this.getItems(contextKeyService, keybindingService);
		quickPick.ignoreFocusOut = true;
		quickPick.hideInput = true;
		quickPick.title = localize('customizeLayoutQuickPickTitle', "自定义布局");

		const closeButton = {
			alwaysVisible: true,
			iconClass: ThemeIcon.asClassName(Codicon.close),
			tooltip: localize('close', "关闭")
		};

		const resetButton = {
			alwaysVisible: true,
			iconClass: ThemeIcon.asClassName(Codicon.discard),
			tooltip: localize('restore defaults', "还原默认值")
		};

		quickPick.buttons = [
			resetButton,
			closeButton
		];

		let selectedItem: CustomizeLayoutItem | undefined = undefined;
		disposables.add(contextKeyService.onDidChangeContext(changeEvent => {
			if (changeEvent.affectsSome(LayoutContextKeySet)) {
				quickPick.items = this.getItems(contextKeyService, keybindingService);
				if (selectedItem) {
					quickPick.activeItems = quickPick.items.filter(item => (item as CustomizeLayoutItem).id === selectedItem?.id) as IQuickPickItem[];
				}

				setTimeout(() => quickInputService.focus(), 0);
			}
		}));

		disposables.add(quickPick.onDidAccept(event => {
			if (quickPick.selectedItems.length) {
				selectedItem = quickPick.selectedItems[0] as CustomizeLayoutItem;
				commandService.executeCommand(selectedItem.id);
			}
		}));

		disposables.add(quickPick.onDidTriggerItemButton(event => {
			if (event.item) {
				selectedItem = event.item as CustomizeLayoutItem;
				commandService.executeCommand(selectedItem.id);
			}
		}));

		disposables.add(quickPick.onDidTriggerButton((button) => {
			if (button === closeButton) {
				quickPick.hide();
			} else if (button === resetButton) {

				const resetSetting = (id: string) => {
					const config = configurationService.inspect(id);
					configurationService.updateValue(id, config.defaultValue);
				};

				// Reset all layout options
				resetSetting('workbench.activityBar.location');
				resetSetting('workbench.sideBar.location');
				resetSetting('workbench.statusBar.visible');
				resetSetting('workbench.panel.defaultLocation');

				if (!isMacintosh || !isNative) {
					resetSetting('window.menuBarVisibility');
				}

				commandService.executeCommand('workbench.action.alignPanelCenter');
				commandService.executeCommand('workbench.action.alignQuickInputTop');
			}
		}));

		disposables.add(quickPick.onDidHide(() => {
			quickPick.dispose();
		}));

		disposables.add(quickPick.onDispose(() => {
			this._currentQuickPick = undefined;
			disposables.dispose();
		}));

		quickPick.show();
	}
});
