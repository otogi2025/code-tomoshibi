/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider, IAccessibleViewContentProvider, IAccessibleViewOptions } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { SearchContext } from '../common/constants.js';
import { ISearchViewModelWorkbenchService } from './searchTreeModel/searchViewModelWorkbenchService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { getSearchView } from './searchActionsBase.js';

export class SearchAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'search';
	readonly type = AccessibleViewType.Help;
	readonly when = SearchContext.SearchInputBoxFocusedKey;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		const searchViewModelService = accessor.get(ISearchViewModelWorkbenchService);
		const viewsService = accessor.get(IViewsService);

		const searchModel = searchViewModelService.searchModel;
		if (!searchModel) {
			return undefined;
		}

		return new SearchAccessibilityHelpProvider(searchModel, viewsService);
	}
}

class SearchAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	readonly id = AccessibleViewProviderId.SearchHelp;
	readonly verbositySettingKey = AccessibilityVerbositySettingId.Find;
	readonly options: IAccessibleViewOptions = { type: AccessibleViewType.Help };

	constructor(
		private readonly _searchModel: { searchResult: { count: () => number }; replaceActive: boolean },
		private readonly _viewsService: IViewsService
	) {
		super();
	}

	onClose(): void {
		getSearchView(this._viewsService)?.focus();
	}

	provideContent(): string {
		const content: string[] = [];
		const resultCount = this._searchModel.searchResult.count();
		const isReplaceMode = this._searchModel.replaceActive;

		// Header
		content.push(localize('search.header', "辅助功能帮助: 跨文件搜索"));
		content.push(localize('search.context', "你已处于“搜索”视图。使用此工作区范围的工具，可以在工作区的所有文件中查找文本或模式。"));
		content.push('');

		// Current Search Status
		content.push(localize('search.statusHeader', "当前搜索状态:"));
		content.push(localize('search.statusIntro', "你正在工作区中搜索。"));
		if (resultCount !== undefined) {
			if (resultCount === 0) {
				content.push(localize('search.noResults', "找不到结果。请检查搜索词或调整下面的选项。"));
			} else {
				content.push(localize('search.resultCount', "找到 {0} 个结果。", resultCount));
			}
		} else {
			content.push(localize('search.noSearch', "键入搜索词以查找结果。"));
		}
		content.push('');

		// Inside the Search Input
		content.push(localize('search.inputHeader', "在搜索输入内(它的作用):"));
		content.push(localize('search.inputDesc', "当你位于搜索输入中时，焦点将停留在字段中。可以在不离开输入的情况下键入搜索词并导航搜索结果列表。导航到结果时，编辑器会在后台更新以显示匹配项。"));
		content.push('');

		// What You Hear
		content.push(localize('search.hearHeader', "每次移动到结果时听到的内容:"));
		content.push(localize('search.hearDesc', "每个导航步骤都提供完整的语音更新:"));
		content.push(localize('search.hear1', "1) 首先读取结果所在的文件名，以便你了解哪个文件包含匹配项。"));
		content.push(localize('search.hear2', "2) 读取包含匹配项的完整行，以便获取即时上下文。"));
		content.push(localize('search.hear3', "3) 系统将会播报你在结果中的位置，以便你了解你在结果中的进度。"));
		content.push(localize('search.hear4', "4) 系统将播报确切的行和列，以便你准确了解匹配项在文件中的位置。"));
		content.push('');

		// Focus Behavior
		content.push(localize('search.focusHeader', "聚焦行为(重要):"));
		content.push(localize('search.focusDesc1', "如果从搜索输入导航，则当焦点停留在搜索字段中时，编辑器会更新。这是有意为之，以便你不断优化搜索，而不会失去你的位置。"));
		content.push(localize('search.focusDesc2', "如果按 Tab，焦点将移动到输入下方的结果树，然后你可以导航结果并打开它们。在结果上按 Enter 时，编辑器中会显示匹配项。"));
		content.push(localize('search.focusDesc3', "如果聚焦编辑器以编辑搜索结果处的文本，请使用 {0} 导航到结果并在该位置自动聚焦编辑器。", '<keybinding:search.action.focusNextSearchResult>'));
		content.push('');

		// Keyboard Navigation Summary
		content.push(localize('search.keyboardHeader', "键盘导航摘要:"));
		content.push('');
		content.push(localize('search.keyNavSearchHeader', "在搜索输入中聚焦时:"));
		content.push(localize('search.keyEnter', "- Enter: 运行或刷新搜索。"));
		content.push(localize('search.keyTab', "- Tab: 将焦点移动到下面的结果树。"));
		content.push('');
		content.push(localize('search.keyNavResultsHeader', "导航搜索结果:"));
		content.push(localize('search.keyArrow', "- 向下箭头: 在树中浏览结果。"));
		content.push(localize('search.keyResultEnter', "- Enter (当聚焦于某个结果时): 在编辑器中导航到该结果。"));
		content.push('');
		content.push(localize('search.keyNavGlobalHeader', "从任意位置(搜索输入或编辑器):"));
		content.push(localize('search.keyF4', "- {0}: 跳转到下一个结果并聚焦编辑器。", '<keybinding:search.action.focusNextSearchResult>'));
		content.push(localize('search.keyShiftF4', "- {0}: 跳转到上一个结果并聚焦编辑器。", '<keybinding:search.action.focusPreviousSearchResult>'));
		content.push('');

		// Search Options
		content.push(localize('search.optionsHeader', "对话框中的搜索选项:"));
		content.push(localize('search.optionCase', "- 匹配事例: 仅包含完全大小写匹配项。"));
		content.push(localize('search.optionWord', "- 全字: 仅匹配完整字词。"));
		content.push(localize('search.optionRegex', "- 正则表达式: 对高级搜索使用模式匹配。"));
		content.push('');

		// Replace Mode
		if (isReplaceMode) {
			content.push(localize('search.replaceHeader', "跨文件替换(替换模式处于活动状态):"));
			content.push(localize('search.replaceDesc1', "按 Tab 键转到“替换输入”，然后键入替换文本。"));
			content.push(localize('search.replaceDesc2', "可以同时替换单个匹配项或所有匹配项。"));
			content.push(localize('search.replaceWarning', "警告: 此操作会影响多个文件。请确保已准确搜索要替换的内容。"));
			content.push('');
		}

		// Settings
		content.push(localize('search.settingsHeader', "可调整的设置({0} 可打开“设置”):", '<keybinding:workbench.action.openSettings>'));
		content.push(localize('search.settingsIntro', "这些设置会影响跨文件的搜索行为。"));
		content.push(localize('search.settingVerbosity', "- `accessibility.verbosity.find`: 控制搜索输入是否播报辅助功能帮助提示。"));
		content.push(localize('search.settingSmartCase', "- `search.smartCase`:如果搜索词全为小写，则使用不区分大小写的搜索。"));
		content.push(localize('search.settingSearchOnType', "- `search.searchOnType`: 键入时搜索所有文件。"));
		content.push(localize('search.settingDebounce', "- `search.searchOnTypeDebouncePeriod`: 键入时搜索之前的等待时间(以毫秒为单位)。"));
		content.push(localize('search.settingMaxResults', "- `search.maxResults`: 要显示的最大搜索结果数。"));
		content.push(localize('search.settingCollapse', "- `search.collapseResults`: 展开或折叠结果。"));
		content.push(localize('search.settingLineNumbers', "- `search.showLineNumbers`: 显示结果的行号。"));
		content.push(localize('search.settingSortOrder', "- `search.sortOrder`: 按文件名、类型、修改时间或匹配计数对结果进行排序。"));
		content.push(localize('search.settingContextLines', "- `search.searchEditor.defaultNumberOfContextLines`: 匹配项周围显示的上下文行数。"));
		content.push(localize('search.settingViewMode', "- `search.defaultViewMode`: 将结果显示为列表或树。"));
		content.push(localize('search.settingActions', "- `search.actionsPosition`: 操作按钮的位置。"));

		// Replace-specific setting
		if (isReplaceMode) {
			content.push(localize('search.settingReplacePreview', "- `search.useReplacePreview`: 替换匹配项时打开预览。"));
		}

		// Platform-specific setting
		if (isMacintosh) {
			content.push('');
			content.push(localize('search.macSettingHeader', "特定于平台的设置(仅限 macOS):"));
			content.push(localize('search.macSetting', "- `search.globalFindClipboard`: 使用共享 macOS“查找”剪贴板(如果可用)。"));
		}

		content.push('');
		content.push(localize('search.closingHeader', "关闭:"));
		content.push(localize('search.closingDesc', "按 Esc 以关闭搜索。焦点将返回到编辑器，并保留你的搜索历史记录。"));

		return content.join('\n');
	}
}
