/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

/**
 * Code-Tomoshibi is a single-user Chinese product. Keep the terminal chrome deterministic even
 * while the remote language catalog is still loading; otherwise the same overflow menu can
 * alternate between English and Chinese across refreshes.
 */
export const terminalStrings = {
	terminal: '终端',
	new: '新建 Session',
	doNotShowAgain: '不再显示',
	currentSessionCategory: '当前 Session',
	previousSessionCategory: '上一个 Session',
	typeTask: '任务',
	typeLocal: '本地',
	actionCategory: { value: '终端', original: 'Terminal' },
	focus: { value: '聚焦终端', original: 'Focus Terminal' },
	focusInstance: { value: '聚焦终端', original: 'Focus Terminal' },
	focusAndHideAccessibleBuffer: { value: '聚焦终端并关闭辅助缓冲区', original: 'Focus Terminal and Hide Accessible Buffer' },
	kill: {
		value: '关闭终端',
		original: 'Kill Terminal',
		short: '关闭',
	},
	moveToEditor: { value: '移到编辑区', original: 'Move Terminal into Editor Area' },
	moveIntoNewWindow: { value: '移到新窗口', original: 'Move Terminal into New Window' },
	newInNewWindow: { value: '新建终端窗口', original: 'New Terminal Window' },
	moveToTerminalPanel: { value: '移到终端面板', original: 'Move Terminal into Panel' },
	changeIcon: { value: '更改图标…', original: 'Change Icon...' },
	changeColor: { value: '更改颜色…', original: 'Change Color...' },
	split: {
		value: '分屏终端',
		original: 'Split Terminal',
		short: '分屏',
	},
	unsplit: { value: '取消分屏', original: 'Unsplit Terminal' },
	rename: { value: '重命名…', original: 'Rename...' },
	toggleSizeToContentWidth: { value: '切换为内容宽度', original: 'Toggle Size to Content Width' },
	focusHover: { value: '聚焦悬浮窗口', original: 'Focus Hover' },
	newWithCwd: { value: '在指定目录新建终端', original: 'Create New Terminal Starting in a Custom Working Directory' },
	renameWithArgs: { value: '重命名当前终端', original: 'Rename the Currently Active Terminal' },
	scrollToPreviousCommand: { value: '滚动到上一条命令', original: 'Scroll to Previous Command' },
	scrollToNextCommand: { value: '滚动到下一条命令', original: 'Scroll to Next Command' },
	revealCommand: { value: '在终端中显示命令', original: 'Reveal Command in Terminal' },
};
