/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { CommonFindController } from '../../../../editor/contrib/find/browser/findController.js';
import { CONTEXT_FIND_WIDGET_FOCUSED } from '../../../../editor/contrib/find/browser/findModel.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../platform/accessibility/browser/accessibleView.js';
import { AccessibleViewRegistry, IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';

/**
 * Accessible view implementation for Find and Replace help in the code editor.
 * Provides comprehensive accessibility support for the Find dialog, including:
 * - Search status information (current term, match count, position)
 * - Navigation instructions for keyboard control
 * - Focus behavior explanation
 * - Available settings and options
 * - Platform-specific guidance
 *
 * Activated via Alt+F1 when any element in the Find widget is focused.
 */
export class EditorFindAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'editor-find';
	readonly when = CONTEXT_FIND_WIDGET_FOCUSED;
	readonly type = AccessibleViewType.Help;

	/**
	 * Creates an accessible view content provider for the active code editor's Find/Replace dialog.
	 * @param accessor Service accessor for retrieving the code editor service
	 * @returns The provider instance, or undefined if no active editor or find controller is found
	 */
	getProvider(accessor: ServicesAccessor) {
		const codeEditorService = accessor.get(ICodeEditorService);
		const codeEditor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();

		if (!codeEditor) {
			return;
		}

		const findController = CommonFindController.get(codeEditor);
		if (!findController) {
			return;
		}

		return new EditorFindAccessibilityHelpProvider(findController);
	}
}

/**
 * Content provider for the Find and Replace accessibility help.
 * Generates localized, context-aware help information based on the current Find state.
 *
 * The implementation:
 * - Adapts content based on whether Replace mode is active
 * - Provides current search status (term, match count, position)
 * - Explains focus behavior (how focus moves between Find input, Replace input, and editor)
 * - Lists keyboard navigation shortcuts for different contexts
 * - Documents available Find and Replace options
 * - References relevant settings that affect Find behavior
 * - Includes platform-specific guidance where applicable
 */
class EditorFindAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.EditorFindHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	constructor(
		private readonly _findController: CommonFindController
	) {
		super();
	}

	/**
	 * Returns focus to the last focused element in the Find widget when the accessibility help is closed.
	 * This handles focus restoration for any element (inputs, checkboxes, buttons) not just the text inputs.
	 */
	onClose(): void {
		this._findController.focusLastElement();
	}

	/**
	 * Generates the complete accessibility help content for Find and Replace.
	 * The content structure varies based on whether Replace mode is visible:
	 *
	 * Replace Mode Content:
	 * - Header identifying the dialog
	 * - Context explaining what the dialog does
	 * - Current search and replace status
	 * - Focus behavior explanation
	 * - Keyboard shortcuts for Find, Replace, and Editor contexts
	 * - Find and Replace options explanation
	 * - Configurable settings documentation
	 * - Platform-specific settings (macOS)
	 *
	 * Find-Only Mode Content:
	 * - Similar structure but without Replace-specific sections
	 *
	 * @returns The complete help text as a newline-joined string for audio announcement
	 */
	provideContent(): string {
		const state = this._findController.getState();
		const isReplaceVisible = state.isReplaceRevealed;
		const searchString = state.searchString;
		const matchCount = state.matchesCount;
		const matchPosition = state.matchesPosition;

		const content: string[] = [];

		if (isReplaceVisible) {
			// ========== REPLACE MODE CONTENT ==========
			content.push(localize('replace.header', "辅助功能帮助: 查找和替换"));
			content.push(localize('replace.context', "你当前位于活动编辑器的“查找和替换”对话框中。可通过此对话框查找并替换文本。编辑器是一个独立区域，显示每个匹配项及其上下文。"));
			content.push('');

			// Current Search Status
			content.push(localize('replace.statusHeader', "当前搜索状态:"));
			if (searchString) {
				content.push(localize('replace.searchTerm', "你正在搜索:“{0}”。", searchString));
				if (matchCount !== undefined && matchPosition !== undefined) {
					if (matchCount === 0) {
						content.push(localize('replace.noMatches', "当前文件中未找到匹配项。请尝试调整搜索文本或以下选项。"));
					} else {
						content.push(localize('replace.matchStatus', "第 {0} 项匹配，共 {1} 项。", matchPosition, matchCount));
					}
				}
			} else {
				content.push(localize('replace.noSearchTerm', "尚未输入搜索文本。开始输入以在编辑器中查找匹配项。"));
			}

			const replaceString = state.replaceString;
			if (replaceString) {
				content.push(localize('replace.replaceText', "替换文本:“{0}”。", replaceString));
			} else {
				content.push(localize('replace.noReplaceText', "尚未输入替换文本。按 Tab 以移动到“替换”输入，然后键入替换文本。"));
			}
			content.push('');

			// Inside the Find and Replace Dialog
			content.push(localize('replace.dialogHeader', "在“查找和替换”对话框内(它的作用):"));
			content.push(localize('replace.dialogDesc', "当你在任一输入框时，焦点会保持在该输入框内。你可以在不离开的情况下键入、编辑或导航匹配项。从“查找”输入导航到匹配项时，编辑器会在后台更新，但焦点仍然停留在对话框中。按 Tab 键可在“查找”和“替换”之间切换。"));
			content.push('');

			// What You Hear
			content.push(localize('replace.hearHeader', "每次移动到匹配项时听到的内容:"));
			content.push(localize('replace.hearDesc', "每个导航步骤都提供完整的语音更新:"));
			content.push(localize('replace.hear1', "1) 先读取包含匹配项的完整行，以便获取即时上下文。"));
			content.push(localize('replace.hear2', "2) 系统将播报你在匹配项中的位置，以便你了解你在结果中的进度。"));
			content.push(localize('replace.hear3', "3) 系统将播报确切的行和列，以便你准确了解匹配项在文件中的位置。"));
			content.push('');

			// Focus Behavior
			content.push(localize('replace.focusHeader', "聚焦行为(重要):"));
			content.push(localize('replace.focusDesc1', "从“查找”对话框内部导航时，当焦点保留在输入中时，编辑器会更新。这是有意为之，以便你不断调整搜索，而不会失去你的位置。"));
			content.push(localize('replace.focusDesc2', "从“替换”输入执行替换时，系统会替换当前匹配项并将焦点移至下一个匹配项。如果已替换所有匹配项，则对话框将保持打开。"));
			content.push(localize('replace.focusDesc3', "如果要将焦点移动到编辑器以编辑文本，请按 Esc 关闭对话框。焦点会回到编辑器中上次替换的位置。"));
			content.push('');

			// Keyboard Navigation Summary
			content.push(localize('replace.keyboardHeader', "键盘导航摘要:"));
			content.push('');
			content.push(localize('replace.keyNavFindHeader', "当焦点位于“查找”输入中时:"));
			content.push(localize('replace.keyEnter', "- Enter: 在“查找”中停留时移动到下一个匹配项。"));
			content.push(localize('replace.keyShiftEnter', "- Shift+Enter: 在“查找”中停留时移动到上一个匹配项。"));
			content.push(localize('replace.keyTab', "- Tab: 在“查找”和“替换”输入之间切换。"));
			content.push('');
			content.push(localize('replace.keyNavReplaceHeader', "当焦点位于“替换”输入中时:"));
			content.push(localize('replace.keyReplaceEnter', "- Enter: 替换当前匹配项并移到下一个匹配项。"));
			content.push(localize('replace.keyReplaceOne', "- {0}: 仅替换当前匹配项。", '<keybinding:editor.action.replaceOne>'));
			content.push(localize('replace.keyReplaceAll', "- {0}: 一次替换所有匹配项。", '<keybinding:editor.action.replaceAll>'));
			content.push('');
			content.push(localize('replace.keyNavEditorHeader', "当焦点位于编辑器(而不是“查找”输入)中时:"));
			content.push(localize('replace.keyF3', "- {0}: 移动到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('replace.keyShiftF3', "- {0}: 移动到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push('');
			content.push(localize('replace.keyNavNote', "注意: 当焦点在编辑器中时，请勿按 Enter 或 Shift+Enter，这会插入换行符，而非导航。"));
			content.push('');

			// Find and Replace Options
			content.push(localize('replace.optionsHeader', "对话框中的“查找和替换”选项:"));
			content.push(localize('replace.optionCase', "- 区分大小写: 仅包含完全大小写匹配项。"));
			content.push(localize('replace.optionWord', "- 全字: 仅匹配完整字词。"));
			content.push(localize('replace.optionRegex', "- 正则表达式: 对高级搜索使用模式匹配。"));
			content.push(localize('replace.optionSelection', "- 在选定内容中查找: 将匹配项限制为当前所选内容。"));
			content.push(localize('replace.optionPreserve', "- 保留大小写: 替换时保持原匹配项的大小写。"));
			content.push('');

			// Settings
			content.push(localize('replace.settingsHeader', "可调整的设置({0} 可打开“设置”):", '<keybinding:workbench.action.openSettings>'));
			content.push(localize('replace.settingsIntro', "这些设置会影响“查找和替换”的行为或匹配项的突出显示方式。"));
			content.push(localize('replace.settingVerbosity', "- `accessibility.verbosity.find`: 控制“查找和替换”输入是否播报辅助功能帮助提示。"));
			content.push(localize('replace.settingFindOnType', "- `editor.find.findOnType`: 键入时运行“查找”。"));
			content.push(localize('replace.settingCursorMove', "- `editor.find.cursorMoveOnType`: 在键入时将光标移动到最佳匹配项。"));
			content.push(localize('replace.settingSeed', "- `editor.find.seedSearchStringFromSelection`: 控制何时使用选中文本作为查找的初始内容。"));
			content.push(localize('replace.settingAutoSelection', "- `editor.find.autoFindInSelection`: 根据选择类型自动启用“在选定内容中查找”。"));
			content.push(localize('replace.settingLoop', "- `editor.find.loop`: 在文件开头或结尾处循环搜索。"));
			content.push(localize('replace.settingExtraSpace', "- `editor.find.addExtraSpaceOnTop`: 添加额外的滚动空间，避免匹配项被“查找和替换”对话框遮挡。"));
			content.push(localize('replace.settingFindHistory', "- `editor.find.history`: 控制是否保存“查找”搜索历史记录。"));
			content.push(localize('replace.settingReplaceHistory', "- `editor.find.replaceHistory`: 控制是否存储“替换”历史记录。"));
			content.push(localize('replace.settingOccurrences', "- `editor.occurrencesHighlight`: 突出显示当前符号的其他出现位置。"));
			content.push(localize('replace.settingOccurrencesDelay', "- `editor.occurrencesHighlightDelay`: 控制突出显示的发生时间。"));
			content.push(localize('replace.settingSelectionHighlight', "- `editor.selectionHighlight`: 突出显示当前所选内容的其他匹配项。"));
			content.push(localize('replace.settingSelectionMaxLength', "- `editor.selectionHighlightMaxLength`: 限制所选内容的突出显示长度。"));
			content.push(localize('replace.settingSelectionMultiline', "- `editor.selectionHighlightMultiline`: 控制是否突出显示多行选择。"));

			// Platform-specific setting
			if (isMacintosh) {
				content.push('');
				content.push(localize('replace.macSettingHeader', "特定于平台的设置(仅限 macOS):"));
				content.push(localize('replace.macSetting', "- `editor.find.globalFindClipboard`: 使用共享 macOS“查找”剪贴板(如果可用)。"));
			}

			content.push('');
			content.push(localize('replace.closingHeader', "关闭:"));
			content.push(localize('replace.closingDesc', "按 Esc 可关闭“查找和替换”。焦点会回到编辑器中的上次替换位置，并且搜索和替换历史记录将保留。"));
		} else {
			// ========== FIND-ONLY MODE CONTENT ==========
			content.push(localize('find.header', "辅助功能帮助: 编辑器查找"));
			content.push(localize('find.context', "你当前位于活动编辑器的“查找”对话框中。可在此对话框中键入要查找的内容。编辑器是一个独立区域，显示每个匹配项及其上下文。"));
			content.push('');

			// Current Search Status
			content.push(localize('find.statusHeader', "当前搜索状态:"));
			if (searchString) {
				content.push(localize('find.searchTerm', "你正在搜索:“{0}”。", searchString));
				if (matchCount !== undefined && matchPosition !== undefined) {
					if (matchCount === 0) {
						content.push(localize('find.noMatches', "当前文件中未找到匹配项。请尝试调整搜索文本或以下选项。"));
					} else {
						content.push(localize('find.matchStatus', "第 {0} 项匹配，共 {1} 项。", matchPosition, matchCount));
					}
				}
			} else {
				content.push(localize('find.noSearchTerm', "尚未输入搜索文本。开始输入以在编辑器中查找匹配项。"));
			}
			content.push('');

			// Inside the Find Dialog
			content.push(localize('find.dialogHeader', "在“查找”对话框内(它的作用):"));
			content.push(localize('find.dialogDesc', "当你位于“查找”对话框中时，焦点将停留在字段中。你可以继续键入、编辑搜索文本或在不离开对话框的情况下浏览匹配项。从此处导航到匹配项时，编辑器会在后台更新，但焦点仍然停留在“查找”对话框中。"));
			content.push('');

			// What You Hear
			content.push(localize('find.hearHeader', "每次移动到匹配项时听到的内容:"));
			content.push(localize('find.hearDesc', "每个导航步骤都提供完整的语音更新，以便你始终知道所处的位置。顺序是一致的:"));
			content.push(localize('find.hear1', "1) 先读取包含匹配项的完整行，以便获取即时上下文。"));
			content.push(localize('find.hear2', "2) 系统将播报你在匹配项中的位置，以便你了解你在结果中的进度。"));
			content.push(localize('find.hear3', "3) 系统将播报确切的行和列，以便你准确了解匹配项在文件中的位置。"));
			content.push(localize('find.hearConclusion', "每次向前或向后移动时都会执行此序列。"));
			content.push('');

			// Outside the Find Dialog
			content.push(localize('find.outsideHeader', "在“查找”对话框外部(编辑器内部):"));
			content.push(localize('find.outsideDesc', "当焦点位于编辑器而不是“查找”对话框中时，仍可导航匹配项。"));
			content.push(localize('find.outsideF3', "- 按 {0} 可移动到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('find.outsideShiftF3', "- 按 {0} 可移动到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push(localize('find.outsideConclusion', "你将听到相同的三步序列: 全行、匹配位置、行和列。"));
			content.push('');

			// Focus Behavior
			content.push(localize('find.focusHeader', "聚焦行为(重要):"));
			content.push(localize('find.focusDesc1', "从“查找”对话框内部导航时，当焦点保留在输入中时，编辑器会更新。这是有意为之，以便你不断调整搜索，而不会失去你的位置。"));
			content.push(localize('find.focusDesc2', "如果要将焦点移到编辑器中以编辑文本或检查周围的代码，请按 Esc 关闭“查找”。焦点会回到编辑器中的最近一个匹配项。"));
			content.push('');

			// Keyboard Navigation Summary
			content.push(localize('find.keyboardHeader', "键盘导航摘要:"));
			content.push('');
			content.push(localize('find.keyNavFindHeader', "当焦点位于“查找”输入中时:"));
			content.push(localize('find.keyEnter', "- Enter: 在“查找”对话框中停留时移动到下一个匹配项。"));
			content.push(localize('find.keyShiftEnter', "- Shift+Enter: 在“查找”对话框中停留时移动到上一个匹配项。"));
			content.push('');
			content.push(localize('find.keyNavEditorHeader', "当焦点位于编辑器(而不是“查找”输入)中时:"));
			content.push(localize('find.keyF3', "- {0}: 移动到下一个匹配项。", '<keybinding:editor.action.nextMatchFindAction>'));
			content.push(localize('find.keyShiftF3', "- {0}: 移动到上一个匹配项。", '<keybinding:editor.action.previousMatchFindAction>'));
			content.push('');
			content.push(localize('find.keyNavNote', "注意: 当焦点在编辑器中时，请勿按 Enter 或 Shift+Enter，这会插入换行符，而非导航。"));
			content.push('');

			// Find Options
			content.push(localize('find.optionsHeader', "对话框中的“查找”选项:"));
			content.push(localize('find.optionCase', "- 区分大小写: 仅包含完全大小写匹配项。"));
			content.push(localize('find.optionWord', "- 全字: 仅匹配完整字词。"));
			content.push(localize('find.optionRegex', "- 正则表达式: 对高级搜索使用模式匹配。"));
			content.push(localize('find.optionSelection', "- 在选定内容中查找: 将匹配项限制为当前所选内容。"));
			content.push('');

			// Settings
			content.push(localize('find.settingsHeader', "可调整的设置({0} 可打开“设置”):", '<keybinding:workbench.action.openSettings>'));
			content.push(localize('find.settingsIntro', "这些设置会影响“查找”的行为或匹配项的突出显示方式。"));
			content.push(localize('find.settingVerbosity', "- `accessibility.verbosity.find`: 控制“查找”输入是否播报辅助功能帮助提示。"));
			content.push(localize('find.settingFindOnType', "- `editor.find.findOnType`: 键入时运行“查找”。"));
			content.push(localize('find.settingCursorMove', "- `editor.find.cursorMoveOnType`: 在键入时将光标移动到最佳匹配项。"));
			content.push(localize('find.settingSeed', "- `editor.find.seedSearchStringFromSelection`: 控制何时使用选中文本作为查找的初始内容。"));
			content.push(localize('find.settingAutoSelection', "- `editor.find.autoFindInSelection`: 根据选择类型自动启用“在选定内容中查找”。"));
			content.push(localize('find.settingLoop', "- `editor.find.loop`: 在文件开头或结尾处循环搜索。"));
			content.push(localize('find.settingCloseOnResult', "- `editor.find.closeOnResult`: 在显式查找导航命令定位到匹配项后关闭“查找”对话框。"));
			content.push(localize('find.settingExtraSpace', "- `editor.find.addExtraSpaceOnTop`: 添加额外的滚动空间，避免匹配项被“查找”对话框遮挡。"));
			content.push(localize('find.settingHistory', "- `editor.find.history`: 控制是否保存“查找”搜索历史记录。"));
			content.push(localize('find.settingOccurrences', "- `editor.occurrencesHighlight`: 突出显示当前符号的其他出现位置。"));
			content.push(localize('find.settingOccurrencesDelay', "- `editor.occurrencesHighlightDelay`: 控制突出显示的发生时间。"));
			content.push(localize('find.settingSelectionHighlight', "- `editor.selectionHighlight`: 突出显示当前所选内容的其他匹配项。"));
			content.push(localize('find.settingSelectionMaxLength', "- `editor.selectionHighlightMaxLength`: 限制所选内容的突出显示长度。"));
			content.push(localize('find.settingSelectionMultiline', "- `editor.selectionHighlightMultiline`: 控制是否突出显示多行选择。"));

			// Platform-specific setting
			if (isMacintosh) {
				content.push('');
				content.push(localize('find.macSettingHeader', "特定于平台的设置(仅限 macOS):"));
				content.push(localize('find.macSetting', "- `editor.find.globalFindClipboard`: 使用共享 macOS“查找”剪贴板(如果可用)。"));
			}

			content.push('');
			content.push(localize('find.closingHeader', "关闭:"));
			content.push(localize('find.closingDesc', "按 Esc 可关闭“查找”。焦点会回到编辑器中的最近一个匹配项，并且搜索历史记录将保留。"));
		}

		return content.join('\n');
	}
}

// Register the accessibility help provider
AccessibleViewRegistry.register(new EditorFindAccessibilityHelp());
