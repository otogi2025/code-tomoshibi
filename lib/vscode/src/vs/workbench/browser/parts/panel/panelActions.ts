/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './media/panelpart.css';
import { localize, localize2 } from '../../../../nls.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import { MenuId, MenuRegistry, registerAction2, Action2, IAction2Options } from '../../../../platform/actions/common/actions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { IWorkbenchLayoutService, PanelAlignment, Parts, Position, positionToString } from '../../../services/layout/browser/layoutService.js';
import { IsAuxiliaryWindowContext, PanelAlignmentContext, PanelPositionContext, PanelVisibleContext } from '../../../common/contextkeys.js';
import { ContextKeyExpr, ContextKeyExpression } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { ViewContainerLocation, IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { ICommandActionTitle } from '../../../../platform/action/common/action.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { SwitchCompositeViewAction } from '../compositeBarActions.js';

const closeIcon = registerIcon('panel-close', Codicon.close, localize('closeIcon', '用于关闭面板的图标。'));
const panelIcon = registerIcon('panel-layout-icon', Codicon.layoutPanel, localize('togglePanelOffIcon', '用于在面板打开时关闭面板的图标。'));
const panelOffIcon = registerIcon('panel-layout-icon-off', Codicon.layoutPanelOff, localize('togglePanelOnIcon', '用于在面板关闭时打开面板的图标。'));

export class TogglePanelAction extends Action2 {

	static readonly ID = 'workbench.action.togglePanel';
	static readonly LABEL = localize2('togglePanelVisibility', "切换面板可见性");

	constructor() {
		super({
			id: TogglePanelAction.ID,
			title: TogglePanelAction.LABEL,
			toggled: {
				condition: PanelVisibleContext,
				title: localize('closePanel', '隐藏面板'),
				icon: closeIcon,
				mnemonicTitle: localize({ key: 'miTogglePanelMnemonic', comment: ['&& denotes a mnemonic'] }, "面板(&&P)"),
			},
			icon: closeIcon,
			f1: true,
			category: Categories.View,
			metadata: {
				description: localize('openAndClosePanel', '打开/显示并关闭/隐藏面板'),
			},
			keybinding: { primary: KeyMod.CtrlCmd | KeyCode.KeyJ, weight: KeybindingWeight.WorkbenchContrib },
			menu: [
				{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 5
				}, {
					id: MenuId.LayoutControlMenuSubmenu,
					group: '0_workbench_layout',
					order: 4
				}
			]
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		layoutService.setPartHidden(layoutService.isVisible(Parts.PANEL_PART), Parts.PANEL_PART);
	}
}

registerAction2(TogglePanelAction);

MenuRegistry.appendMenuItem(MenuId.PanelTitle, {
	command: {
		id: TogglePanelAction.ID,
		title: localize('closePanel', '隐藏面板'),
		icon: closeIcon
	},
	group: 'navigation',
	order: 2
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.closePanel',
			title: localize2('closePanel', '隐藏面板'),
			category: Categories.View,
			precondition: PanelVisibleContext,
			f1: true,
		});
	}
	run(accessor: ServicesAccessor) {
		accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.PANEL_PART);
	}
});

registerAction2(class extends Action2 {

	static readonly ID = 'workbench.action.focusPanel';
	static readonly LABEL = localize('focusPanel', "聚焦到面板中");

	constructor() {
		super({
			id: 'workbench.action.focusPanel',
			title: localize2('focusPanel', "聚焦到面板中"),
			category: Categories.View,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const paneCompositeService = accessor.get(IPaneCompositePartService);

		// Show panel
		if (!layoutService.isVisible(Parts.PANEL_PART)) {
			layoutService.setPartHidden(false, Parts.PANEL_PART);
		}

		// Focus into active panel
		const panel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
		panel?.focus();
	}
});

const PositionPanelActionId = {
	LEFT: 'workbench.action.positionPanelLeft',
	RIGHT: 'workbench.action.positionPanelRight',
	BOTTOM: 'workbench.action.positionPanelBottom',
	TOP: 'workbench.action.positionPanelTop'
};

const AlignPanelActionId = {
	LEFT: 'workbench.action.alignPanelLeft',
	RIGHT: 'workbench.action.alignPanelRight',
	CENTER: 'workbench.action.alignPanelCenter',
	JUSTIFY: 'workbench.action.alignPanelJustify',
};

interface PanelActionConfig<T> {
	id: string;
	when: ContextKeyExpression;
	title: ICommandActionTitle;
	shortLabel: string;
	value: T;
}

function createPanelActionConfig<T>(id: string, title: ICommandActionTitle, shortLabel: string, value: T, when: ContextKeyExpression): PanelActionConfig<T> {
	return {
		id,
		title,
		shortLabel,
		value,
		when,
	};
}

function createPositionPanelActionConfig(id: string, title: ICommandActionTitle, shortLabel: string, position: Position): PanelActionConfig<Position> {
	return createPanelActionConfig<Position>(id, title, shortLabel, position, PanelPositionContext.notEqualsTo(positionToString(position)));
}

function createAlignmentPanelActionConfig(id: string, title: ICommandActionTitle, shortLabel: string, alignment: PanelAlignment): PanelActionConfig<PanelAlignment> {
	return createPanelActionConfig<PanelAlignment>(id, title, shortLabel, alignment, PanelAlignmentContext.notEqualsTo(alignment));
}

const PositionPanelActionConfigs: PanelActionConfig<Position>[] = [
	createPositionPanelActionConfig(PositionPanelActionId.TOP, localize2('positionPanelTop', "将面板移到顶部"), localize('positionPanelTopShort', "顶部"), Position.TOP),
	createPositionPanelActionConfig(PositionPanelActionId.LEFT, localize2('positionPanelLeft', "将面板移至左侧"), localize('positionPanelLeftShort', "左"), Position.LEFT),
	createPositionPanelActionConfig(PositionPanelActionId.RIGHT, localize2('positionPanelRight', "将面板移至右侧"), localize('positionPanelRightShort', "右"), Position.RIGHT),
	createPositionPanelActionConfig(PositionPanelActionId.BOTTOM, localize2('positionPanelBottom', "将面板移至底部"), localize('positionPanelBottomShort', "底部"), Position.BOTTOM),
];


const AlignPanelActionConfigs: PanelActionConfig<PanelAlignment>[] = [
	createAlignmentPanelActionConfig(AlignPanelActionId.LEFT, localize2('alignPanelLeft', "将面板对齐方式设置为“左对齐”"), localize('alignPanelLeftShort', "左"), 'left'),
	createAlignmentPanelActionConfig(AlignPanelActionId.RIGHT, localize2('alignPanelRight', "将面板对齐方式设置为“右对齐”"), localize('alignPanelRightShort', "右"), 'right'),
	createAlignmentPanelActionConfig(AlignPanelActionId.CENTER, localize2('alignPanelCenter', "将面板对齐设置为“居中”"), localize('alignPanelCenterShort', "居中"), 'center'),
	createAlignmentPanelActionConfig(AlignPanelActionId.JUSTIFY, localize2('alignPanelJustify', "将面板对齐设置为“两端对齐”"), localize('alignPanelJustifyShort', "两端对齐"), 'justify'),
];

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.PanelPositionMenu,
	title: localize('positionPanel', "面板位置"),
	group: '3_workbench_layout_move',
	order: 4
});

PositionPanelActionConfigs.forEach((positionPanelAction, index) => {
	const { id, title, shortLabel, value, when } = positionPanelAction;

	registerAction2(class extends Action2 {
		constructor() {
			super({
				id,
				title,
				category: Categories.View,
				f1: true
			});
		}
		run(accessor: ServicesAccessor): void {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			layoutService.setPanelPosition(value === undefined ? Position.BOTTOM : value);
		}
	});

	MenuRegistry.appendMenuItem(MenuId.PanelPositionMenu, {
		command: {
			id,
			title: shortLabel,
			toggled: when.negate()
		},
		order: 5 + index
	});
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.PanelAlignmentMenu,
	title: localize('alignPanel', "对齐面板"),
	group: '3_workbench_layout_move',
	order: 5
});

AlignPanelActionConfigs.forEach(alignPanelAction => {
	const { id, title, shortLabel, value, when } = alignPanelAction;
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id,
				title,
				category: Categories.View,
				toggled: when.negate(),
				f1: true
			});
		}
		run(accessor: ServicesAccessor): void {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			layoutService.setPanelAlignment(value === undefined ? 'center' : value);
		}
	});

	MenuRegistry.appendMenuItem(MenuId.PanelAlignmentMenu, {
		command: {
			id,
			title: shortLabel,
			toggled: when.negate()
		},
		order: 5
	});
});

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.previousPanelView',
			title: localize2('previousPanelView', "上一个面板视图"),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.Panel, -1);
	}
});

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.nextPanelView',
			title: localize2('nextPanelView', "下一个面板视图"),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.Panel, 1);
	}
});

MenuRegistry.appendMenuItems([
	{
		id: MenuId.LayoutControlMenu,
		item: {
			group: 'navigation',
			command: {
				id: TogglePanelAction.ID,
				title: localize('togglePanel', "切换面板"),
				icon: panelOffIcon,
				toggled: { condition: PanelVisibleContext, icon: panelIcon }
			},
			when:
				ContextKeyExpr.and(
					IsAuxiliaryWindowContext.negate(),
					ContextKeyExpr.or(
						ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'),
						ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')
					)
				),
			order: 1
		}
	}
]);

class MoveViewsBetweenPanelsAction extends Action2 {
	constructor(private readonly source: ViewContainerLocation, private readonly destination: ViewContainerLocation, desc: Readonly<IAction2Options>) {
		super(desc);
	}

	run(accessor: ServicesAccessor, ...args: unknown[]): void {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const viewsService = accessor.get(IViewsService);

		const srcContainers = viewDescriptorService.getViewContainersByLocation(this.source);
		const destContainers = viewDescriptorService.getViewContainersByLocation(this.destination);

		if (srcContainers.length) {
			const activeViewContainer = viewsService.getVisibleViewContainer(this.source);

			srcContainers.forEach(viewContainer => viewDescriptorService.moveViewContainerToLocation(viewContainer, this.destination, undefined, this.desc.id));
			layoutService.setPartHidden(false, this.destination === ViewContainerLocation.Panel ? Parts.PANEL_PART : Parts.AUXILIARYBAR_PART);

			if (activeViewContainer && destContainers.length === 0) {
				viewsService.openViewContainer(activeViewContainer.id, true);
			}
		}
	}
}

// --- Move Panel Views To Secondary Side Bar

class MovePanelToSidePanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.movePanelToSidePanel';
	constructor() {
		super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
			id: MovePanelToSidePanelAction.ID,
			title: localize2('movePanelToSecondarySideBar', "将面板视图移动到辅助侧栏"),
			category: Categories.View,
			f1: false
		});
	}
}

export class MovePanelToSecondarySideBarAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.movePanelToSecondarySideBar';
	constructor() {
		super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
			id: MovePanelToSecondarySideBarAction.ID,
			title: localize2('movePanelToSecondarySideBar', "将面板视图移动到辅助侧栏"),
			category: Categories.View,
			f1: true
		});
	}
}

registerAction2(MovePanelToSidePanelAction);
registerAction2(MovePanelToSecondarySideBarAction);

// --- Move Secondary Side Bar Views To Panel

class MoveSidePanelToPanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.moveSidePanelToPanel';

	constructor() {
		super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
			id: MoveSidePanelToPanelAction.ID,
			title: localize2('moveSidePanelToPanel', "将辅助侧栏视图移动到面板"),
			category: Categories.View,
			f1: false
		});
	}
}

export class MoveSecondarySideBarToPanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.moveSecondarySideBarToPanel';

	constructor() {
		super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
			id: MoveSecondarySideBarToPanelAction.ID,
			title: localize2('moveSidePanelToPanel', "将辅助侧栏视图移动到面板"),
			category: Categories.View,
			f1: true
		});
	}
}
registerAction2(MoveSidePanelToPanelAction);
registerAction2(MoveSecondarySideBarToPanelAction);
