/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../nls.js';

export namespace AccessibilityHelpNLS {
	export const accessibilityHelpTitle = nls.localize('accessibilityHelpTitle', "辅助功能帮助");
	export const openingDocs = nls.localize("openingDocs", "打开辅助功能文档页。");
	export const readonlyDiffEditor = nls.localize("readonlyDiffEditor", "在差异编辑器的只读窗格中。");
	export const editableDiffEditor = nls.localize("editableDiffEditor", "在一个差异编辑器的窗格中。");
	export const readonlyEditor = nls.localize("readonlyEditor", "在只读代码编辑器中。");
	export const editableEditor = nls.localize("editableEditor", "在代码编辑器中。");
	export const defaultWindowTitleIncludesEditorState = nls.localize("defaultWindowTitleIncludesEditorState", "默认情况下，activeEditorState (如修改、问题等)作为 window.title 设置的一部分包含在内。使用 accessibility.windowTitleOptimized 禁用它。");
	export const defaultWindowTitleExcludingEditorState = nls.localize("defaultWindowTitleExcludingEditorState", "默认情况下，activeEditorState (如修改的、问题等)不作为 window.title 设置的一部分包含在内。使用 accessibility.windowTitleOptimized 启用它。");
	export const toolbar = nls.localize("toolbar", "在工作台周围，当屏幕阅读器宣布你已登录到工具栏时，使用窄键在工具栏的作之间导航。");
	export const changeConfigToOnMac = nls.localize("changeConfigToOnMac", "将应用程序配置为使用屏幕阅读器 (Command+E) 进行优化。");
	export const changeConfigToOnWinLinux = nls.localize("changeConfigToOnWinLinux", "将应用程序配置为使用屏幕阅读器 (Control+E) 进行优化。");
	export const auto_on = nls.localize("auto_on", "对该应用程序进行配置并优化，以配合屏幕读取器的使用。");
	export const auto_off = nls.localize("auto_off", "对该应用程序进行配置但不优化，以配合屏幕读取器的使用。");
	export const screenReaderModeEnabled = nls.localize("screenReaderModeEnabled", "已启用屏幕阅读器优化模式。");
	export const screenReaderModeDisabled = nls.localize("screenReaderModeDisabled", "已禁用屏幕阅读器优化模式。");
	export const tabFocusModeOnMsg = nls.localize("tabFocusModeOnMsg", "在当前编辑器中按 Tab 会将焦点移动到下一个可聚焦元素。切换此行为的开关{0}。", '<keybinding:editor.action.toggleTabFocusMode>');
	export const tabFocusModeOffMsg = nls.localize("tabFocusModeOffMsg", "在当前编辑器中按 Tab 将插入 tab 字符。切换此行为的开关{0}。", '<keybinding:editor.action.toggleTabFocusMode>');
	export const stickScroll = nls.localize("stickScrollKb", "聚焦粘滞滚动{0}以聚焦当前嵌套的范围。", '<keybinding:editor.action.focusStickyDebugConsole>');
	export const suggestActions = nls.localize("suggestActionsKb", "触发建议小组件 {0} 显示可能的内联建议。", '<keybinding:editor.action.triggerSuggest>');
	export const acceptSuggestAction = nls.localize("acceptSuggestAction", "接受建议{0} 接受当前选定的建议。", '<keybinding:acceptSelectedSuggestion>');
	export const toggleSuggestionFocus = nls.localize("toggleSuggestionFocus", "在建议小组件和编辑器{0} 之间切换焦点，并使用{1} 切换详细信息焦点以了解有关建议的详细信息。", '<keybinding:focusSuggestion>', '<keybinding:toggleSuggestionFocus>');
	export const codeFolding = nls.localize("codeFolding", "使用代码折叠可折叠代码块并通过“切换折叠”命令{0}关注你感兴趣的代码。", '<keybinding:editor.toggleFold>');
	export const intellisense = nls.localize("intellisense", "使用 Intellisense 提高编码效率并减少错误。触发建议{0}。", '<keybinding:editor.action.triggerSuggest>');
	export const showOrFocusHover = nls.localize("showOrFocusHover", "显示或聚焦悬停{0}以读取有关当前符号的信息。", '<keybinding:editor.action.showHover>');
	export const goToSymbol = nls.localize("goToSymbol", "转到符号 {0} 以在当前文件中的符号之间快速导航。", '<keybinding:workbench.action.gotoSymbol>');
	export const showAccessibilityHelpAction = nls.localize("showAccessibilityHelpAction", "显示辅助功能帮助");
	export const listSignalSounds = nls.localize("listSignalSoundsCommand", "运行命令: 列出信号声音以概览所有声音及其当前状态。");
	export const listAlerts = nls.localize("listAnnouncementsCommand", "运行命令: 列出信号公告以概览公告及其当前状态。");
	export const announceCursorPosition = nls.localize("announceCursorPosition", "运行命令: 播报光标位置 {0}，即可听到当前的行号和列号。", '<keybinding:editor.action.announceCursorPosition>');
	export const focusNotifications = nls.localize("focusNotifications", "聚焦通知 toast {0}，以便使用键盘导航。接受聚焦通知{1}的主要操作。", '<keybinding:notifications.focusToasts>', '<keybinding:notification.acceptPrimaryAction>');
	export const quickChat = nls.localize("quickChatCommand", "切换快速聊天的开关{0}以打开或关闭聊天会话。", '<keybinding:workbench.action.quickchat.toggle>');
	export const startInlineChat = nls.localize("startInlineChatCommand", "开始内联聊天{0}以创建编辑器聊天会话。", '<keybinding:inlineChat.start>');
	export const chatEditorModification = nls.localize('chatEditorModification', "编辑器包含聊天所做的挂起的修改。");
	export const chatEditorRequestInProgress = nls.localize('chatEditorRequestInProgress', "编辑器当前正在等待聊天进行修改。");
	export const chatEditActions = nls.localize('chatEditing.navigation', '在编辑器中的编辑之间导航，可导航上一个{0} 和下一个{1}、接受{2}、拒绝{3} 或查看当前更改的差异{4}。接受所有文件中的编辑{5}。', '<keybinding:chatEditor.action.navigatePrevious>', '<keybinding:chatEditor.action.navigateNext>', '<keybinding:chatEditor.action.acceptHunk>', '<keybinding:chatEditor.action.undoHunk>', '<keybinding:chatEditor.action.toggleDiff>', '<keybinding:chatEditor.action.acceptAllEdits>');
	export const editorDictation = nls.localize('editorDictation', "Start or stop dictation in the editor{0}.", '<keybinding:workbench.action.editorDictation.start>');
}

export namespace InspectTokensNLS {
	export const inspectTokensAction = nls.localize('inspectTokens', "开发人员: 检查令牌");
}

export namespace GoToLineNLS {
	export const gotoLineActionLabel = nls.localize('gotoLineActionLabel', "转到行/列...");
	export const gotoOffsetActionLabel = nls.localize('gotoOffsetActionLabel', "转到偏移量...");
}

export namespace QuickHelpNLS {
	export const helpQuickAccessActionLabel = nls.localize('helpQuickAccess', "显示所有快速访问提供程序");
}

export namespace QuickCommandNLS {
	export const quickCommandActionLabel = nls.localize('quickCommandActionLabel', "命令面板");
	export const quickCommandHelp = nls.localize('quickCommandActionHelp', "显示并运行命令");
}

export namespace QuickOutlineNLS {
	export const quickOutlineActionLabel = nls.localize('quickOutlineActionLabel', "转到符号...");
	export const quickOutlineByCategoryActionLabel = nls.localize('quickOutlineByCategoryActionLabel', "按类别转到符号...");
}

export namespace StandaloneCodeEditorNLS {
	export const editorViewAccessibleLabel = nls.localize('editorViewAccessibleLabel', "编辑器内容");
}

export namespace ToggleHighContrastNLS {
	export const toggleHighContrast = nls.localize('toggleHighContrast', "切换高对比度主题");
}

export namespace StandaloneServicesNLS {
	export const bulkEditServiceSummary = nls.localize('bulkEditServiceSummary', "在 {1} 个文件中进行了 {0} 次编辑");
}
