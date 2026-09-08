/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from './webview.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';

export class WebviewFindAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'webview-find';
	readonly type = AccessibleViewType.Help;
	readonly when = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		return new WebviewFindAccessibilityHelpProvider();
	}
}

class WebviewFindAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.WebviewFindHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	onClose(): void {
		// Focus will remain on webview
	}

	provideContent(): string {
		const content: string[] = [];

		// Header
		content.push(localize('webview.header', "辅助功能帮助: Web 视图查找"));
		content.push(localize('webview.context', "你位于嵌入式 Web 内容的“查找”输入中。这可能是 Markdown 预览、文档查看器或基于 Web 的扩展界面。"));
		content.push('');

		// Current Search Status
		content.push(localize('webview.statusHeader', "当前搜索状态:"));
		content.push(localize('webview.statusDesc', "你正在搜索 Web 内容。"));
		content.push('');

		// Inside the Webview Find Input
		content.push(localize('webview.inputHeader', "在 Web 视图“查找”输入中(它的作用):"));
		content.push(localize('webview.inputDesc', "当你位于“查找”输入中时，焦点将停留在字段中。可以在不退出输入的情况下键入、编辑搜索词或导航匹配项。导航到匹配项时，Web 视图会更新以显示它，但焦点仍保留在“查找”输入中。"));
		content.push('');

		// What You Hear
		content.push(localize('webview.hearHeader', "每次移动到匹配项时听到的内容:"));
		content.push(localize('webview.hearDesc', "每个导航步骤都提供完整的语音更新:"));
		content.push(localize('webview.hear1', "1) 系统将首先读取包含匹配项的内容，以便你获取即时上下文。"));
		content.push(localize('webview.hear2', "2) 系统将播报你在匹配项中的位置，以便你了解你在结果中的进度。"));
		content.push(localize('webview.hear3', "3) 系统将播报确切的位置信息，以便你了解该匹配项的位置。"));
		content.push('');

		// Focus Behavior
		content.push(localize('webview.focusHeader', "聚焦行为(重要):"));
		content.push(localize('webview.focusDesc1', "从 Web 视图“查找”输入导航时，内容会在后台更新，而焦点将保留在输入中。这是有意为之，以便你不断优化搜索，而不会失去你的位置。"));
		content.push(localize('webview.focusDesc2', "Web 视图可能会滚动以显示匹配项，具体取决于其设计方式。"));
		content.push(localize('webview.focusDesc3', "如果要关闭“查找”并将焦点返回到 Web 视图内容，请按 Esc。焦点将移回 Web 视图中。"));
		content.push('');

		// Keyboard Navigation Summary
		content.push(localize('webview.keyboardHeader', "键盘导航摘要:"));
		content.push('');
		content.push(localize('webview.keyNavHeader', "当焦点位于“查找”输入中时:"));
		content.push(localize('webview.keyEnter', "- Enter: 在“查找”输入中停留时移动到下一个匹配项。"));
		content.push(localize('webview.keyShiftEnter', "- Shift+Enter: 在“查找”输入中停留时移动到上一个匹配项。"));
		content.push('');

		// Find Options
		content.push(localize('webview.optionsHeader', "“查找”选项:"));
		content.push(localize('webview.optionCase', "- 匹配事例: 仅包含完全大小写匹配项。"));
		content.push(localize('webview.optionWord', "- 全字: 仅匹配完整字词。"));
		content.push(localize('webview.optionRegex', "- 正则表达式: 对高级搜索使用模式匹配。"));
		content.push('');

		// Important About Webviews
		content.push(localize('webview.importantHeader', "关于 Web 视图的重要信息:"));
		content.push(localize('webview.importantDesc', "在 VS Code 的“查找”可以使用键盘输入之前，一些 Web 视图会截获键盘输入。如果按 Enter 或 Shift+Enter 不导航匹配项，则 Web 视图可能正在处理这些键。首先尝试单击或键入 Web 视图内容以确保 Web 视图具有焦点，然后重新打开“查找”并重试导航。"));
		content.push('');

		// Settings
		content.push(localize('webview.settingsHeader', "可调整的设置({0} 可打开“设置”):", '<keybinding:workbench.action.openSettings>'));
		content.push(localize('webview.settingsDesc', "Web 视图“查找”的配置最少。大多数行为取决于 Web 视图本身。"));
		content.push(localize('webview.settingVerbosity', "- `accessibility.verbosity.find`: 控制 Web 视图“查找”输入是否播报辅助功能帮助提示。"));
		content.push('');

		// Closing
		content.push(localize('webview.closingHeader', "关闭:"));
		content.push(localize('webview.closingDesc', "按 Esc 可关闭 Web 视图“查找”。焦点将移回到 Web 视图内容中，然后搜索历史记录在下一个“查找”中可用。"));

		return content.join('\n');
	}
}
