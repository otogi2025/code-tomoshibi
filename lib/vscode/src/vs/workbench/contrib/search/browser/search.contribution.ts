/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import * as platform from '../../../../base/common/platform.js';
import * as nls from '../../../../nls.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Extensions as QuickAccessExtensions, IQuickAccessRegistry } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { searchViewIcon } from './searchIcons.js';
import { SearchView } from './searchView.js';
import { registerContributions as searchWidgetContributions } from './searchWidget.js';
import { SearchViewModelWorkbenchService } from './searchTreeModel/searchModel.js';
import { ISearchViewModelWorkbenchService } from './searchTreeModel/searchViewModelWorkbenchService.js';
import { SearchSortOrder, SEARCH_EXCLUDE_CONFIG, VIEWLET_ID, ViewMode, VIEW_ID, DEFAULT_MAX_SEARCH_RESULTS, SemanticSearchBehavior } from '../../../services/search/common/search.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { assertType } from '../../../../base/common/types.js';
import { getWorkspaceSymbols, IWorkspaceSymbol, searchConfigurationNode } from '../common/search.js';
import * as Constants from '../common/constants.js';

import './searchActionsCopy.js';
import './searchActionsFind.js';
import './searchActionsNav.js';
import './searchActionsRemoveReplace.js';
import './searchActionsTopBar.js';
import './searchActionsTextQuickAccess.js';
import './searchQuickAccess.contribution.js';
import './search.common.contribution.js';
import { TEXT_SEARCH_QUICK_ACCESS_PREFIX, TextSearchQuickAccess } from './quickTextSearch/textSearchQuickAccess.js';
import { Extensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { SearchAccessibilityHelp } from './searchAccessibilityHelp.js';

registerSingleton(ISearchViewModelWorkbenchService, SearchViewModelWorkbenchService, InstantiationType.Delayed);

searchWidgetContributions();


AccessibleViewRegistry.register(new SearchAccessibilityHelp());

const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	title: nls.localize2('search', "搜索"),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: true,
	icon: searchViewIcon,
	order: 1,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

const viewDescriptor: IViewDescriptor = {
	id: VIEW_ID,
	containerIcon: searchViewIcon,
	name: nls.localize2('search', "搜索"),
	ctorDescriptor: new SyncDescriptor(SearchView),
	canToggleVisibility: false,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: viewContainer.id,
		mnemonicTitle: nls.localize({ key: 'miViewSearch', comment: ['&& denotes a mnemonic'] }, "搜索(&&S)"),
		keybindings: {
			primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
			// Yes, this is weird. See #116188, #115556, #115511, and now #124146, for examples of what can go wrong here.
			when: ContextKeyExpr.regex('neverMatch', /doesNotMatch/)
		},
		order: 1
	}
};

// Register search default location to sidebar
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([viewDescriptor], viewContainer);

// Register Quick Access Handler
const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);

quickAccessRegistry.registerQuickAccessProvider({
	ctor: TextSearchQuickAccess,
	prefix: TEXT_SEARCH_QUICK_ACCESS_PREFIX,
	contextKey: 'inTextSearchPicker',
	placeholder: nls.localize('textSearchPickerPlaceholder', "在工作区文件中搜索文本。"),
	helpEntries: [
		{
			description: nls.localize('textSearchPickerHelp', "搜索文本"),
			commandId: Constants.SearchCommandIds.QuickTextSearchActionId,
			commandCenterOrder: 25,
		}
	]
});

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	...searchConfigurationNode,
	properties: {
		[SEARCH_EXCLUDE_CONFIG]: {
			type: 'object',
			markdownDescription: nls.localize('exclude', "配置 [glob 模式](https://code.visualstudio.com/docs/editor/codebasics#_advanced-search-options)以在 Quick Open 中的全文搜索和文件搜索中排除文件和文件夹。若要从 Quick Open 中最近打开的列表中排除文件，必须使用绝对模式(例如 `**/node_modules/**`)。从 `#files.exclude#` 设置继承所有 glob 模式。"),
			default: { '**/node_modules': true, '**/bower_components': true, '**/*.code-search': true },
			additionalProperties: {
				anyOf: [
					{
						type: 'boolean',
						description: nls.localize('exclude.boolean', "匹配文件路径所依据的 glob 模式。设置为 true 或 false 可启用或禁用该模式。"),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								markdownDescription: nls.localize({ key: 'exclude.when', comment: ['\\$(basename) should not be translated'] }, '对匹配文件同辈进行额外检查。将 \\$(basename) 用作匹配文件名的变量。')
							}
						}
					}
				]
			},
			scope: ConfigurationScope.RESOURCE
		},
		'search.useIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useIgnoreFiles', "控制在搜索文件时是否使用 `.gitignore` 和 `.ignore` 文件。"),
			default: true,
			scope: ConfigurationScope.RESOURCE
		},
		'search.useGlobalIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useGlobalIgnoreFiles', "控制在搜索文件时是否使用全局 gitignore 文件(例如，从“$HOME/.config/git/ignore”)。需要启用 {0}。", '`#search.useIgnoreFiles#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'search.useParentIgnoreFiles': {
			type: 'boolean',
			markdownDescription: nls.localize('useParentIgnoreFiles', "控制在搜索文件时是否在父目录中使用 “.gitignore”和“.ignore”文件。需要启用 {0}。", '`#search.useIgnoreFiles#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'search.quickOpen.includeSymbols': {
			type: 'boolean',
			description: nls.localize('search.quickOpen.includeSymbols', "控制 Quick Open 文件结果中是否包括全局符号搜索的结果。"),
			default: false
		},
		'search.ripgrep.maxThreads': {
			type: 'number',
			description: nls.localize('search.ripgrep.maxThreads', "用于搜索的线程数。设置为 0 时，引擎将自动确定此值。"),
			default: 0
		},
		'search.quickOpen.includeHistory': {
			type: 'boolean',
			description: nls.localize('search.quickOpen.includeHistory', "是否在 Quick Open 的文件结果中包含最近打开的文件。"),
			default: true,
			agentsWindow: { default: false },
		},
		'search.quickOpen.history.filterSortOrder': {
			type: 'string',
			enum: ['default', 'recency'],
			default: 'default',
			enumDescriptions: [
				nls.localize('filterSortOrder.default', '历史记录条目按与筛选值的相关性排序。首先显示更相关的条目。'),
				nls.localize('filterSortOrder.recency', '历史记录条目按最近时间排序。首先显示最近打开的条目。')
			],
			description: nls.localize('filterSortOrder', "控制在快速打开中筛选时编辑器历史记录的排序顺序。")
		},
		'search.followSymlinks': {
			type: 'boolean',
			description: nls.localize('search.followSymlinks', "控制是否在搜索中跟踪符号链接。"),
			default: true
		},
		'search.smartCase': {
			type: 'boolean',
			description: nls.localize('search.smartCase', "若搜索词全为小写，则不区分大小写进行搜索，否则区分大小写进行搜索。"),
			default: false
		},
		'search.globalFindClipboard': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.globalFindClipboard', "控制搜索视图是否读取或修改 macOS 的共享查找剪贴板。"),
			included: platform.isMacintosh
		},
		'search.maxResults': {
			type: ['number', 'null'],
			default: DEFAULT_MAX_SEARCH_RESULTS,
			markdownDescription: nls.localize('search.maxResults', "控制搜索结果的最大数目，可将其设置为 “null”(空)，以返回无限结果。")
		},
		'search.collapseResults': {
			type: 'string',
			enum: ['auto', 'alwaysCollapse', 'alwaysExpand'],
			enumDescriptions: [
				nls.localize('search.collapseResults.auto', "结果少于10个的文件将被展开。其他的则被折叠。"),
				'',
				''
			],
			default: 'alwaysExpand',
			description: nls.localize('search.collapseAllResults', "控制是折叠还是展开搜索结果。"),
		},
		'search.useReplacePreview': {
			type: 'boolean',
			default: true,
			description: nls.localize('search.useReplacePreview', "控制在选择或替换匹配项时是否打开“替换预览”视图。"),
		},
		'search.showLineNumbers': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.showLineNumbers', "控制是否显示搜索结果所在的行号。"),
		},
		'search.actionsPosition': {
			type: 'string',
			enum: ['auto', 'right'],
			enumDescriptions: [
				nls.localize('search.actionsPositionAuto', "当搜索视图较窄时将操作栏置于右侧，当搜索视图较宽时，将它紧接在内容之后。"),
				nls.localize('search.actionsPositionRight', "始终将操作栏放置在右侧。"),
			],
			default: 'right',
			description: nls.localize('search.actionsPosition', "在搜索视图中控制操作栏的位置。")
		},
		'search.seedWithNearestWord': {
			type: 'boolean',
			default: false,
			description: nls.localize('search.seedWithNearestWord', "当活动编辑器没有选定内容时，从离光标最近的字词开始进行种子设定搜索。")
		},
		'search.seedOnFocus': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('search.seedOnFocus', "聚焦搜索视图时，将搜索查询更新为编辑器的所选文本。单击时或触发 \"workbench.views.search.focus\" 命令时会发生此情况。")
		},
		'search.sortOrder': {
			type: 'string',
			enum: [SearchSortOrder.Default, SearchSortOrder.FileNames, SearchSortOrder.Type, SearchSortOrder.Modified, SearchSortOrder.CountDescending, SearchSortOrder.CountAscending],
			default: SearchSortOrder.Default,
			enumDescriptions: [
				nls.localize('searchSortOrder.default', "结果按文件夹和文件名按字母顺序排序。"),
				nls.localize('searchSortOrder.filesOnly', "结果按文件名排序，忽略文件夹顺序，按字母顺序排列。"),
				nls.localize('searchSortOrder.type', "结果按文件扩展名的字母顺序排序。"),
				nls.localize('searchSortOrder.modified', "结果按文件的最后修改日期按降序排序。"),
				nls.localize('searchSortOrder.countDescending', "结果按每个文件的计数降序排序。"),
				nls.localize('searchSortOrder.countAscending', "结果按每个文件的计数以升序排序。")
			],
			description: nls.localize('search.sortOrder', "控制搜索结果的排序顺序。")
		},
		'search.decorations.colors': {
			type: 'boolean',
			description: nls.localize('search.decorations.colors', "控制搜索文件修饰是否应使用颜色。"),
			default: true
		},
		'search.decorations.badges': {
			type: 'boolean',
			description: nls.localize('search.decorations.badges', "控制搜索文件修饰是否应使用徽章。"),
			default: true
		},
		'search.defaultViewMode': {
			type: 'string',
			enum: [ViewMode.Tree, ViewMode.List],
			default: ViewMode.List,
			enumDescriptions: [
				nls.localize('scm.defaultViewMode.tree', "将搜索结果显示为树。"),
				nls.localize('scm.defaultViewMode.list', "将搜索结果显示为列表。")
			],
			description: nls.localize('search.defaultViewMode', "控制默认搜索结果视图模式。")
		},
		'search.quickAccess.preserveInput': {
			type: 'boolean',
			description: nls.localize('search.quickAccess.preserveInput', "在打开快速搜索视图时，控制是否自动恢复上一次输入的值。"),
			default: false
		},
		'search.experimental.useIgnoreFilesInFindFiles': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('search.experimental.useIgnoreFilesInFindFiles', "启用后，旧版 `findFiles` 扩展 API 会遵循用户的 `#search.useIgnoreFiles#` 设置，而非始终忽略 `.gitignore`。显式传递 `null` 作为 `exclude` 参数的扩展仍会获取未筛选的结果。无论此设置如何，都会发送遥测数据以帮助确定未来默认值。"),
			tags: ['experimental'],
		},
		'search.searchView.semanticSearchBehavior': {
			type: 'string',
			description: nls.localize('search.searchView.semanticSearchBehavior', "控制搜索视图中显示的语义搜索结果的行为。"),
			enum: [SemanticSearchBehavior.Manual, SemanticSearchBehavior.RunOnEmpty, SemanticSearchBehavior.Auto],
			default: SemanticSearchBehavior.Manual,
			enumDescriptions: [
				nls.localize('search.searchView.semanticSearchBehavior.manual', "仅手动请求语义搜索结果。"),
				nls.localize('search.searchView.semanticSearchBehavior.runOnEmpty', "仅在文本搜索结果为空时自动请求语义结果。"),
				nls.localize('search.searchView.semanticSearchBehavior.auto', "每次搜索时都自动请求语义结果。")
			],
			tags: ['preview'],
		},
		'search.searchView.keywordSuggestions': {
			type: 'boolean',
			description: nls.localize('search.searchView.keywordSuggestions', "在搜索视图中启用关键字建议。"),
			default: false,
			tags: ['preview'],
		},
	}
});

CommandsRegistry.registerCommand('_executeWorkspaceSymbolProvider', async function (accessor, ...args): Promise<IWorkspaceSymbol[]> {
	const [query] = args;
	assertType(typeof query === 'string');
	const result = await getWorkspaceSymbols(query);
	return result.map(item => item.symbol);
});

// todo: @andreamah get rid of this after a few iterations
Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'search.experimental.quickAccess.preserveInput',
		migrateFn: (value, _accessor) => ([
			['search.quickAccess.preserveInput', { value }],
			['search.experimental.quickAccess.preserveInput', { value: undefined }]
		])
	}]);
