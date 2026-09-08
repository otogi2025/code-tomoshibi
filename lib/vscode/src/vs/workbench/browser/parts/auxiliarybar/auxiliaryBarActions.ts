/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { AuxiliaryBarMaximizedContext, AuxiliaryBarVisibleContext, IsAuxiliaryWindowContext, SecondarySideBarVisibleContext } from '../../../common/contextkeys.js';
import { ViewContainerLocation, ViewContainerLocationToString } from '../../../common/views.js';
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts } from '../../../services/layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { SwitchCompositeViewAction } from '../compositeBarActions.js';

const maximizeIcon = registerIcon('auxiliarybar-maximize', Codicon.screenFull, localize('maximizeIcon', '用于最大化辅助侧边栏的图标。'));
const closeIcon = registerIcon('auxiliarybar-close', Codicon.close, localize('closeIcon', '用于关闭辅助侧栏的图标。'));

const auxiliaryBarRightIcon = registerIcon('auxiliarybar-right-layout-icon', Codicon.layoutSidebarRight, localize('toggleAuxiliaryIconRight', '用于在其右侧位置关闭辅助侧栏的图标。'));
const auxiliaryBarRightOffIcon = registerIcon('auxiliarybar-right-off-layout-icon', Codicon.layoutSidebarRightOff, localize('toggleAuxiliaryIconRightOn', '用于在其右侧位置打开辅助侧栏的图标。'));
const auxiliaryBarLeftIcon = registerIcon('auxiliarybar-left-layout-icon', Codicon.layoutSidebarLeft, localize('toggleAuxiliaryIconLeft', '用于在其左侧位置切换辅助侧栏的图标。'));
const auxiliaryBarLeftOffIcon = registerIcon('auxiliarybar-left-off-layout-icon', Codicon.layoutSidebarLeftOff, localize('toggleAuxiliaryIconLeftOn', '用于在其左侧位置打开辅助侧栏的图标。'));

export class ToggleAuxiliaryBarAction extends Action2 {

	static readonly ID = 'workbench.action.toggleAuxiliaryBar';
	static readonly LABEL = localize2('toggleAuxiliaryBar', "切换辅助侧栏可见性");

	constructor() {
		super({
			id: ToggleAuxiliaryBarAction.ID,
			title: ToggleAuxiliaryBarAction.LABEL,
			toggled: {
				condition: SecondarySideBarVisibleContext,
				title: localize('closeSecondarySideBar', '隐藏辅助侧栏'),
				icon: closeIcon,
				mnemonicTitle: localize({ key: 'miCloseSecondarySideBar', comment: ['&& denotes a mnemonic'] }, "辅助(&&S)侧边栏"),
			},
			icon: closeIcon,
			category: Categories.View,
			metadata: {
				description: localize('openAndCloseAuxiliaryBar', '打开/显示和关闭/隐藏辅助侧边栏'),
			},
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyB
			},
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: '0_workbench_layout',
					order: 1
				},
				{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 2
				}
			]
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IWorkbenchLayoutService).toggleSecondarySideBar();
	}
}

registerAction2(ToggleAuxiliaryBarAction);

MenuRegistry.appendMenuItem(MenuId.AuxiliaryBarTitle, {
	command: {
		id: ToggleAuxiliaryBarAction.ID,
		title: localize('closeSecondarySideBar', '隐藏辅助侧栏'),
		icon: closeIcon
	},
	group: 'navigation',
	order: 2,
	when: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT)
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.closeAuxiliaryBar',
			title: localize2('closeSecondarySideBar', '隐藏辅助侧栏'),
			category: Categories.View,
			precondition: AuxiliaryBarVisibleContext,
			f1: true,
		});
	}
	run(accessor: ServicesAccessor) {
		accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.AUXILIARYBAR_PART);
	}
});

registerAction2(class FocusAuxiliaryBarAction extends Action2 {

	static readonly ID = 'workbench.action.focusAuxiliaryBar';
	static readonly LABEL = localize2('focusAuxiliaryBar', "将焦点置于辅助侧栏");

	constructor() {
		super({
			id: FocusAuxiliaryBarAction.ID,
			title: FocusAuxiliaryBarAction.LABEL,
			category: Categories.View,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const paneCompositeService = accessor.get(IPaneCompositePartService);
		const layoutService = accessor.get(IWorkbenchLayoutService);

		// Show auxiliary bar
		if (!layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
			layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
		}

		// Focus into active composite
		const composite = paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar);
		composite?.focus();
	}
});

MenuRegistry.appendMenuItems([
	{
		id: MenuId.LayoutControlMenu,
		item: {
			group: 'navigation',
			command: {
				id: ToggleAuxiliaryBarAction.ID,
				title: localize('toggleSecondarySideBar', "切换辅助侧栏"),
				toggled: { condition: AuxiliaryBarVisibleContext, icon: auxiliaryBarLeftIcon },
				icon: auxiliaryBarLeftOffIcon,
			},
			when: ContextKeyExpr.and(
				IsAuxiliaryWindowContext.negate(),
				ContextKeyExpr.or(
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')),
				ContextKeyExpr.equals('config.workbench.sideBar.location', 'right')
			),
			order: 0
		}
	}, {
		id: MenuId.LayoutControlMenu,
		item: {
			group: 'navigation',
			command: {
				id: ToggleAuxiliaryBarAction.ID,
				title: localize('toggleSecondarySideBar', "切换辅助侧栏"),
				toggled: { condition: AuxiliaryBarVisibleContext, icon: auxiliaryBarRightIcon },
				icon: auxiliaryBarRightOffIcon,
			},
			when: ContextKeyExpr.and(
				IsAuxiliaryWindowContext.negate(),
				ContextKeyExpr.or(
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
					ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')),
				ContextKeyExpr.equals('config.workbench.sideBar.location', 'left')
			),
			order: 2
		}
	}, {
		id: MenuId.ViewContainerTitleContext,
		item: {
			group: '3_workbench_layout_move',
			command: {
				id: ToggleAuxiliaryBarAction.ID,
				title: localize2('hideAuxiliaryBar', '隐藏辅助侧栏'),
			},
			when: ContextKeyExpr.and(AuxiliaryBarVisibleContext, ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))),
			order: 2
		}
	}
]);

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.previousAuxiliaryBarView',
			title: localize2('previousAuxiliaryBarView', '上一个辅助侧边栏视图'),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.AuxiliaryBar, -1);
	}
});

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.nextAuxiliaryBarView',
			title: localize2('nextAuxiliaryBarView', '下一个辅助侧边栏视图'),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.AuxiliaryBar, 1);
	}
});

// --- Maximized Mode

class MaximizeAuxiliaryBar extends Action2 {

	static readonly ID = 'workbench.action.maximizeAuxiliaryBar';

	constructor() {
		super({
			id: MaximizeAuxiliaryBar.ID,
			title: localize2('maximizeAuxiliaryBar', '最大化辅助侧栏'),
			tooltip: localize('maximizeAuxiliaryBarTooltip', "最大化辅助侧栏"),
			category: Categories.View,
			f1: true,
			precondition: AuxiliaryBarMaximizedContext.negate(),
		});
	}

	run(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);

		layoutService.setAuxiliaryBarMaximized(true);
	}
}
registerAction2(MaximizeAuxiliaryBar);

class RestoreAuxiliaryBar extends Action2 {

	static readonly ID = 'workbench.action.restoreAuxiliaryBar';

	constructor() {
		super({
			id: RestoreAuxiliaryBar.ID,
			title: localize2('restoreAuxiliaryBar', '还原辅助侧栏'),
			tooltip: localize('restoreAuxiliaryBar', '还原辅助侧栏'),
			category: Categories.View,
			f1: true,
			precondition: AuxiliaryBarMaximizedContext,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyW,
				win: { primary: KeyMod.CtrlCmd | KeyCode.F4, secondary: [KeyMod.CtrlCmd | KeyCode.KeyW] },
			}
		});
	}

	run(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);

		layoutService.setAuxiliaryBarMaximized(false);
	}
}
registerAction2(RestoreAuxiliaryBar);

class ToggleMaximizedAuxiliaryBar extends Action2 {

	static readonly ID = 'workbench.action.toggleMaximizedAuxiliaryBar';

	constructor() {
		super({
			id: ToggleMaximizedAuxiliaryBar.ID,
			title: localize2('toggleMaximizedAuxiliaryBar', '切换最大化的辅助侧栏'),
			tooltip: localize('maximizeAuxiliaryBarTooltip2', "最大化辅助侧栏"),
			f1: true,
			category: Categories.View,
			icon: maximizeIcon,
			toggled: {
				condition: AuxiliaryBarMaximizedContext,
				tooltip: localize('restoreAuxiliaryBar', '还原辅助侧栏'),
			},
			menu: {
				id: MenuId.AuxiliaryBarTitle,
				group: 'navigation',
				order: 1,
			}
		});
	}

	run(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);

		layoutService.toggleMaximizedAuxiliaryBar();
	}
}
registerAction2(ToggleMaximizedAuxiliaryBar);
