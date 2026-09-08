/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Action, IAction, Separator } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { ITerminalLocationOptions, ITerminalService } from './terminal.js';
import { TerminalCommandId, TERMINAL_VIEW_ID } from '../common/terminal.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { terminalStrings } from '../common/terminalStrings.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { HasSpeechProvider } from '../../speech/common/speechService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { expandOnlyTomoshibiGroup, promptTomoshibiInput } from './terminalView.js';
import { ITomoshibiSessionService } from './tomoshibiSessionService.js';

export const enum TerminalContextMenuGroup {
	Chat = '0_chat',
	Create = '1_create',
	Edit = '3_edit',
	Clear = '5_clear',
	Kill = '7_kill',
	Config = '9_config'
}

export const enum TerminalMenuBarGroup {
	Create = '1_create',
	Run = '3_run',
	Manage = '5_manage',
	Configure = '7_configure'
}

/**
 * ⛔ 这里曾经往 MenuId.MenubarTerminalMenu 注册「新建终端 / 新建终端窗口 / 拆分终端 / 运行活动文件 /
 * 运行所选文本」五项，2026-09 删掉：菜单栏早就只剩一个 MenubarTomoshibiMenu 子菜单
 * （browser/parts/titlebar/menubar.contribution.ts），全仓再没有第二处 `submenu: MenuId.MenubarTerminalMenu`，
 * 这个 MenuId 永远不会被任何 UI 取出来渲染。要往菜单栏加终端相关的项，加到 MenubarTomoshibiMenu 上。
 */
export function setupTerminalMenus(): void {
	MenuRegistry.appendMenuItems(
		[
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.KillViewOrEditor,
						title: terminalStrings.kill.value,
					},
					group: TerminalContextMenuGroup.Kill
				}
			},
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.CopySelection,
						title: localize('workbench.action.terminal.copySelection.short', "复制")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 1
				}
			},
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.CopySelectionAsHtml,
						title: localize('workbench.action.terminal.copySelectionAsHtml', "复制为 HTML")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 2
				}
			},
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.Paste,
						title: localize('workbench.action.terminal.paste.short', "粘贴")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 3
				}
			},
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.Clear,
						title: localize('workbench.action.terminal.clear', "清屏")
					},
					group: TerminalContextMenuGroup.Clear,
				}
			},
			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.SizeToContentWidth,
						title: terminalStrings.toggleSizeToContentWidth
					},
					group: TerminalContextMenuGroup.Config
				}
			},

			{
				id: MenuId.TerminalInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.SelectAll,
						title: localize('workbench.action.terminal.selectAll', "全选"),
					},
					group: TerminalContextMenuGroup.Edit,
					order: 3
				}
			},
		]
	);

	MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, {
		command: {
			id: TerminalCommandId.CreateTerminalEditorSameGroup,
			title: terminalStrings.new
		},
		group: '1_zzz_file',
		order: 30,
		when: TerminalContextKeys.processSupported
	});

	MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, {
		command: {
			id: TerminalCommandId.CreateTerminalEditorSameGroup,
			title: terminalStrings.new
		},
		group: '1_zzz_file',
		order: 30,
		when: TerminalContextKeys.processSupported
	});

	MenuRegistry.appendMenuItems(
		[
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					group: TerminalContextMenuGroup.Create,
					command: {
						id: TerminalCommandId.Split,
						title: terminalStrings.split.value
					}
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.New,
						title: terminalStrings.new
					},
					group: TerminalContextMenuGroup.Create
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.KillEditor,
						title: terminalStrings.kill.value
					},
					group: TerminalContextMenuGroup.Kill
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.CopySelection,
						title: localize('workbench.action.terminal.copySelection.short', "复制")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 1
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.CopySelectionAsHtml,
						title: localize('workbench.action.terminal.copySelectionAsHtml', "复制为 HTML")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 2
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.Paste,
						title: localize('workbench.action.terminal.paste.short', "粘贴")
					},
					group: TerminalContextMenuGroup.Edit,
					order: 3
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.Clear,
						title: localize('workbench.action.terminal.clear', "清屏")
					},
					group: TerminalContextMenuGroup.Clear,
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.SelectAll,
						title: localize('workbench.action.terminal.selectAll', "全选"),
					},
					group: TerminalContextMenuGroup.Edit,
					order: 3
				}
			},
			{
				id: MenuId.TerminalEditorInstanceContext,
				item: {
					command: {
						id: TerminalCommandId.SizeToContentWidth,
						title: terminalStrings.toggleSizeToContentWidth
					},
					group: TerminalContextMenuGroup.Config
				}
			}
		]
	);

	MenuRegistry.appendMenuItems(
		[
			{
				id: MenuId.ViewTitle,
				item: {
					command: {
						id: TerminalCommandId.SwitchTerminal,
						title: localize2('workbench.action.terminal.switchTerminal', '切换终端')
					},
					group: 'navigation',
					order: 0,
					// 只看是不是终端视图。上游还要求 tabs.enabled 为假（因为那时标题栏的位置留给侧边
					// 列表），但本 fork 源码层删掉了侧边列表，胶囊条是唯一的 Session 导航，不能再让
					// 一个默认值为 true 的设置把它挡掉。
					when: ContextKeyExpr.equals('view', TERMINAL_VIEW_ID),
				}
			},
			// Code-Tomoshibi's horizontal Session bar already identifies and focuses the active
			// terminal. Do not render the upstream active-terminal title again beside the plus button.
			{
				id: MenuId.ViewTitle,
				item: {
					command: {
						id: TerminalCommandId.Split,
						title: terminalStrings.split,
						icon: Codicon.splitHorizontal
					},
					group: 'navigation',
					order: 2,
					when: TerminalContextKeys.shouldShowViewInlineActions
				}
			},
			{
				id: MenuId.ViewTitle,
				item: {
					command: {
						id: TerminalCommandId.Kill,
						title: localize2('tomoshibi.session.closeFromTitle', "关闭 Session"),
						icon: Codicon.trash
					},
					group: 'navigation',
					order: 3,
					when: TerminalContextKeys.shouldShowViewInlineActions
				}
			},
			{
				id: MenuId.ViewTitle,
				item: {
					command: {
						id: TerminalCommandId.New,
						title: terminalStrings.new,
						icon: Codicon.plus
					},
					alt: {
						id: TerminalCommandId.Split,
						title: terminalStrings.split.value,
						icon: Codicon.splitHorizontal
					},
					group: 'navigation',
					order: 0,
					when: ContextKeyExpr.and(
						ContextKeyExpr.equals('view', TERMINAL_VIEW_ID),
						ContextKeyExpr.or(TerminalContextKeys.webExtensionContributedProfile, TerminalContextKeys.processSupported)
					)
				}
			},
			// Clear/run/dictation commands remain available through the command system. They are
			// intentionally absent from the compact terminal title menu on iPad.
		]
	);

	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: {
			id: TerminalCommandId.MoveToTerminalPanel,
			title: terminalStrings.moveToTerminalPanel
		},
		when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
		group: '2_files'
	});

	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: {
			id: TerminalCommandId.Rename,
			title: terminalStrings.rename
		},
		when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
		group: '2_files'
	});

	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: {
			id: TerminalCommandId.ChangeColor,
			title: terminalStrings.changeColor
		},
		when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
		group: '2_files'
	});

	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: {
			id: TerminalCommandId.ChangeIcon,
			title: terminalStrings.changeIcon
		},
		when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
		group: '2_files'
	});
	MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
		command: {
			id: TerminalCommandId.SizeToContentWidth,
			title: terminalStrings.toggleSizeToContentWidth
		},
		when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
		group: '2_files'
	});

	for (const menuId of [MenuId.EditorTitle, MenuId.CompactWindowEditorTitle]) {
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.CreateTerminalEditorSameGroup,
				title: terminalStrings.new,
				icon: Codicon.plus
			},
			alt: {
				id: TerminalCommandId.Split,
				title: terminalStrings.split.value,
				icon: Codicon.splitHorizontal
			},
			group: 'navigation',
			order: 0,
			when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal)
		});
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.Clear,
				title: localize('workbench.action.terminal.clearLong', "清除终端"),
				icon: Codicon.clearAll
			},
			group: 'navigation',
			order: 6,
			when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
			isHiddenByDefault: true
		});
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.RunActiveFile,
				title: localize('workbench.action.terminal.runActiveFile', "运行活动文件"),
				icon: Codicon.run
			},
			group: 'navigation',
			order: 7,
			when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
			isHiddenByDefault: true
		});
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.RunSelectedText,
				title: localize('workbench.action.terminal.runSelectedText', "运行所选文本"),
				icon: Codicon.selection
			},
			group: 'navigation',
			order: 8,
			when: ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal),
			isHiddenByDefault: true
		});
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.StartVoice,
				title: localize('workbench.action.terminal.startVoiceEditor', "开始听写"),
				icon: Codicon.mic
			},
			group: 'navigation',
			order: 9,
			when: ContextKeyExpr.and(ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal), TerminalContextKeys.terminalDictationInProgress.negate()),
			isHiddenByDefault: true
		});
		MenuRegistry.appendMenuItem(menuId, {
			command: {
				id: TerminalCommandId.StopVoice,
				title: localize('workbench.action.terminal.stopVoiceEditor', "停止听写"),
				icon: Codicon.run
			},
			group: 'navigation',
			order: 10,
			when: ContextKeyExpr.and(ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeTerminal), HasSpeechProvider, TerminalContextKeys.terminalDictationInProgress),
			isHiddenByDefault: true
		});
	}
}

/**
 * Code-Tomoshibi's new-Session dropdown. It is not a profile launcher: the only things it offers
 * are creating a Session, creating a group, and creating a Session straight into a group.
 */
export function getTerminalActionBarArgs(
	location: ITerminalLocationOptions,
	terminalService: ITerminalService,
	sessionService: ITomoshibiSessionService,
	/** 只为兼容 terminalEditor.ts 的老调用签名保留的占位形参，本函数已改用自制浮层、不再用它。 */
	_quickInputService: IQuickInputService | undefined,
	disposableStore: DisposableStore,
	/** 自制浮层贴着谁展开——通常是 +/⌄ 那个按钮本身。菜单张开时才求值，那时它已经渲染完了。 */
	getAnchor?: () => HTMLElement | undefined
): {
	dropdownAction: IAction;
	dropdownMenuActions: IAction[];
	className: string;
	dropdownIcon?: string;
} {
	const dropdownActions: IAction[] = [];
	dropdownActions.push(disposableStore.add(new Action(TerminalCommandId.New, terminalStrings.new, undefined, true, () => createSessionInGroup(location, undefined, terminalService, sessionService))));
	dropdownActions.push(disposableStore.add(new Action('tomoshibi.session.group.create', localize('tomoshibi.session.group.create', "新建分组…"), undefined, true, () => createSessionGroup(location, terminalService, sessionService, getAnchor?.()))));
	// 这个菜单要提供三件事：「新建 Session」「加进已有分组」「新建 Session 到新分组」。这一项就是第三件：
	// 空分组画不到条上（见 createSessionGroup 的注释），所以建组必然连带建一个 Session——两个入口
	// 落到同一个实现上，区别只在这条是站在 Session 的角度命名的，从「新建…」菜单里找得着。
	dropdownActions.push(disposableStore.add(new Action('tomoshibi.session.newInNewGroup', localize('tomoshibi.session.newInNewGroup', "新建 Session 到新分组"), undefined, true, () => createSessionGroup(location, terminalService, sessionService, getAnchor?.()))));

	const groups = sessionService.groups;
	if (groups.length > 0) {
		dropdownActions.push(new Separator());
		// A permanently disabled action is the only caption a context menu can render.
		dropdownActions.push(disposableStore.add(new Action('tomoshibi.session.newInGroup', localize('tomoshibi.session.newInGroup', "新建 Session 到分组"), undefined, false)));
		for (const group of groups) {
			dropdownActions.push(disposableStore.add(new Action(`tomoshibi.session.newInGroup.${group.id}`, group.name, undefined, true, () => createSessionInGroup(location, group.id, terminalService, sessionService))));
		}
	}

	const dropdownAction = disposableStore.add(new Action('tomoshibi.session.newDropdown', localize('tomoshibi.session.newDropdown', "新建…"), 'codicon-chevron-down', true));
	return { dropdownAction, dropdownMenuActions: dropdownActions, className: 'terminal-tab-actions' };
}

/**
 * Creates a Session and files it under `groupId`, expanding that group so the new Session is
 * immediately visible on the strip.
 */
async function createSessionInGroup(location: ITerminalLocationOptions, groupId: string | undefined, terminalService: ITerminalService, sessionService: ITomoshibiSessionService): Promise<void> {
	const instance = await terminalService.createAndFocusTerminal({ location });
	if (!groupId) {
		return;
	}
	sessionService.setGroupOf(instance, groupId);
	expandOnlyTomoshibiGroup(sessionService, groupId);
}

/**
 * A brand new group would be invisible until it has a member, so creating one also creates its
 * first Session.
 */
export async function createSessionGroup(location: ITerminalLocationOptions, terminalService: ITerminalService, sessionService: ITomoshibiSessionService, anchor?: HTMLElement): Promise<void> {
	const name = (await promptTomoshibiInput(anchor, localize('tomoshibi.session.group.createPrompt', "新分组名称"), {
		placeholder: localize('tomoshibi.session.group.createExamples', "例如：网站、脚本"),
	}))?.trim();
	if (!name) {
		return;
	}
	const group = sessionService.createGroup(name);
	await createSessionInGroup(location, group.id, terminalService, sessionService);
}
