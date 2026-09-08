/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const searchDetailsIcon = registerIcon('search-details', Codicon.ellipsis, localize('searchDetailsIcon', '用于使搜索详细信息可见的图标。'));
export const searchActivityBarIcon = registerIcon('search-see-more', Codicon.goToSearch, localize('searchSeeMoreIcon', '用于在搜索视图中查看更多上下文的图标。'));

export const searchShowContextIcon = registerIcon('search-show-context', Codicon.listSelection, localize('searchShowContextIcon', '搜索编辑器中的“切换上下文”图标。'));
export const searchTerminalIcon = registerIcon('search-terminal', Codicon.terminal, localize('searchTerminalIcon', '搜索视图中的“在终端中查找”图标。'));
export const searchHideReplaceIcon = registerIcon('search-hide-replace', Codicon.chevronRight, localize('searchHideReplaceIcon', '用于折叠搜索视图中的替换部分的图标。'));
export const searchShowReplaceIcon = registerIcon('search-show-replace', Codicon.chevronDown, localize('searchShowReplaceIcon', '用于在搜索视图中展开“替换”部分的图标。'));
export const searchReplaceAllIcon = registerIcon('search-replace-all', Codicon.replaceAll, localize('searchReplaceAllIcon', '搜索视图中的“全部替换”图标。'));
export const searchReplaceIcon = registerIcon('search-replace', Codicon.replace, localize('searchReplaceIcon', '搜索视图中的“替换”图标。'));
export const searchRemoveIcon = registerIcon('search-remove', Codicon.close, localize('searchRemoveIcon', '用于删除搜索结果的图标。'));

export const searchRefreshIcon = registerIcon('search-refresh', Codicon.refresh, localize('searchRefreshIcon', '搜索视图中的“刷新”图标。'));
export const searchCollapseAllIcon = registerIcon('search-collapse-results', Codicon.collapseAll, localize('searchCollapseAllIcon', '搜索视图中的“折叠结果”图标。'));
export const searchExpandAllIcon = registerIcon('search-expand-results', Codicon.expandAll, localize('searchExpandAllIcon', '搜索视图中的“展开结果”图标。'));
export const searchShowAsTree = registerIcon('search-tree', Codicon.listTree, localize('searchShowAsTree', '用于在搜索视图中以树形式查看结果的图标。'));
export const searchShowAsList = registerIcon('search-list', Codicon.listFlat, localize('searchShowAsList', '用于在搜索视图中将结果作为列表查看的图标。'));
export const searchClearIcon = registerIcon('search-clear-results', Codicon.clearAll, localize('searchClearIcon', '搜索视图中的“清除结果”图标。'));
export const searchStopIcon = registerIcon('search-stop', Codicon.searchStop, localize('searchStopIcon', '搜索视图中的“停止”图标。'));

export const searchViewIcon = registerIcon('search-view-icon', Codicon.searchLarge, localize('searchViewIcon', '查看搜索视图的图标。'));

export const searchNewEditorIcon = registerIcon('search-new-editor', Codicon.newFile, localize('searchNewEditorIcon', '用于打开新搜索编辑器的操作的图标。'));
export const searchOpenInFileIcon = registerIcon('search-open-in-file', Codicon.goToFile, localize('searchOpenInFile', '要转到当前搜索结果文件的操作的图标。'));

export const searchSparkleFilled = registerIcon('search-sparkle-filled', Codicon.sparkleFilled, localize('searchSparkleFilled', '用于在搜索中显示 AI 结果的图标。'));
export const searchSparkleEmpty = registerIcon('search-sparkle-empty', Codicon.sparkle, localize('searchSparkleEmpty', '用于在搜索中隐藏 AI 结果的图标。'));
