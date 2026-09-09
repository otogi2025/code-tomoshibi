/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';

/**
 * Code-Tomoshibi has one compact, native application menu. Keeping a single menu model avoids
 * constructing the unused File/Edit/Selection/View/Go/Run/Terminal/Help trees on every iPad load.
 */
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: MenuId.MenubarTomoshibiMenu,
	title: {
		value: 'Code-Tomoshibi',
		original: 'Code-Tomoshibi',
	},
	order: 1,
});

MenuRegistry.appendMenuItems([
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'workbench.view.explorer', title: '文件' }, group: '1_files', order: 1 },
	},
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'workbench.view.search', title: '搜索文件和内容' }, group: '1_files', order: 2 },
	},
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'tomoshibi.upload', title: '上传文件' }, group: '1_files', order: 3 },
	},
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'tomoshibi.newTerminal', title: '新建 Session' }, group: '2_sessions', order: 1 },
	},
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'workbench.action.terminal.tomoshibiSessionManager', title: 'Session 管理中心' }, group: '2_sessions', order: 2 },
	},
	{
		// 命令面板剩下的指针入口只有文本编辑器正文里的右键菜单：齿轮直开自定义设置页，
		// 终端右键菜单里没有，纯手指的 iPad 上等于够不着（通知中心也只能从这里进）。
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'workbench.action.showCommands', title: '命令面板' }, group: '3_manage', order: 1 },
	},
	{
		id: MenuId.MenubarTomoshibiMenu,
		item: { command: { id: 'tomoshibi.openSettings', title: '设置' }, group: '3_manage', order: 2 },
	},
]);
