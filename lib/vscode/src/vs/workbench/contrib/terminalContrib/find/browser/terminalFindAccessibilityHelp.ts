/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { AccessibilityVerbositySettingId } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TerminalFindCommandId } from '../common/terminal.find.js';

export class TerminalFindAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'terminal-find';
	readonly type = AccessibleViewType.Help;
	readonly when = TerminalContextKeys.findFocus;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		const commandService = accessor.get(ICommandService);
		return new TerminalFindAccessibilityHelpProvider(commandService);
	}
}

class TerminalFindAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.TerminalFindHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	constructor(
		private readonly _commandService: ICommandService
	) {
		super();
	}

	onClose(): void {
		// The Escape key that closes the accessible help will also propagate
		// and close the terminal find widget. Re-open the find widget after
		// the Escape event has fully propagated through all handlers.
		setTimeout(() => {
			this._commandService.executeCommand(TerminalFindCommandId.FindFocus);
		}, 200);
	}

	provideContent(): string {
		const content: string[] = [];

		// Header
		content.push(localize('terminal.header', "辅助功能帮助: 终端查找"));
		content.push(localize('terminal.context', "你位于终端查找输入中。它会搜索整个终端缓冲区，包括当前输出和回滚历史记录。"));
		content.push('');

		// Current Search Status
		content.push(localize('terminal.statusHeader', "当前搜索状态:"));
		content.push(localize('terminal.statusDesc', "你正在搜索终端缓冲区。"));
		content.push('');

		// Inside the Terminal Find Input
		content.push(localize('terminal.inputHeader', "在终端查找输入内(它的作用):"));
		content.push(localize('terminal.inputDesc', "当你位于终端查找输入中时，焦点将停留在字段中。可以在不退出输入的情况下键入、编辑搜索词或导航匹配项。导航到匹配项时，终端会滚动以显示它，但焦点仍保留在“查找”输入中。"));
		content.push('');

		// What You Hear
		content.push(localize('terminal.hearHeader', "每次移动到匹配项时听到的内容:"));
		content.push(localize('terminal.hearDesc', "每个导航步骤都提供完整的语音更新:"));
		content.push(localize('terminal.hear1', "1) 先读取包含匹配项的完整行，以便获取即时上下文。"));
		content.push(localize('terminal.hear2', "2) 系统将播报你在匹配项中的位置，以便你了解你在结果中的进度。"));
		content.push(localize('terminal.hear3', "3) 系统将播报确切的行和列，以便你准确了解匹配项在缓冲区中的位置。"));
		content.push('');

		// Focus Behavior
		content.push(localize('terminal.focusHeader', "聚焦行为(重要):"));
		content.push(localize('terminal.focusDesc1', "从终端查找输入导航时，终端缓冲区会在后台更新，而焦点将保留在输入中。这是有意为之，以便你不断优化搜索，而不会失去你的位置。"));
		content.push(localize('terminal.focusDesc2', "终端会自动滚动以显示你导航到的匹配项。"));
		content.push(localize('terminal.focusDesc3', "如果想关闭“查找”并将焦点返回终端命令行，请按 Esc。焦点会移至终端底部的命令输入框。"));
		content.push('');

		// Keyboard Navigation Summary
		content.push(localize('terminal.keyboardHeader', "键盘导航摘要:"));
		content.push('');
		content.push(localize('terminal.keyNavHeader', "当焦点位于“查找”输入中时:"));
		content.push(localize('terminal.keyEnter', "- Enter: 在“查找”输入中停留时移动到下一个匹配项。"));
		content.push(localize('terminal.keyShiftEnter', "- Shift+Enter: 在“查找”输入中停留时移动到上一个匹配项。"));
		content.push('');
		content.push(localize('terminal.keyNavNote', "注意: 终端查找会将焦点保持在“查找”输入中。如果需要返回终端命令行，请按 Esc 关闭查找。"));
		content.push('');

		// Find Options
		content.push(localize('terminal.optionsHeader', "“查找”选项:"));
		content.push(localize('terminal.optionCase', "- 匹配事例: 仅包含完全大小写匹配项。"));
		content.push(localize('terminal.optionWord', "- 全字: 仅匹配完整字词。"));
		content.push(localize('terminal.optionRegex', "- 正则表达式: 对高级搜索使用模式匹配。"));
		content.push('');

		// Settings
		content.push(localize('terminal.settingsHeader', "可调整的设置({0} 可打开“设置”):", '<keybinding:workbench.action.openSettings>'));
		content.push(localize('terminal.settingsDesc', "终端查找具有有限的配置选项。大部分行为由终端本身控制。"));
		content.push(localize('terminal.settingVerbosity', "- `accessibility.verbosity.find`: 控制终端查找输入是否播报辅助功能帮助提示。"));
		content.push('');

		// Closing
		content.push(localize('terminal.closingHeader', "关闭:"));
		content.push(localize('terminal.closingDesc', "按 Esc 可关闭终端查找。焦点将移至终端命令行，并且你的搜索历史记录将在下一次查找时可用。"));

		return content.join('\n');
	}
}
