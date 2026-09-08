/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const terminalViewIcon = registerIcon('terminal-view-icon', Codicon.terminal, localize('terminalViewIcon', '查看终端视图的图标。'));

export const renameTerminalIcon = registerIcon('terminal-rename', Codicon.edit, localize('renameTerminalIcon', '用于在终端快速菜单中进行重命名的图标。'));
export const killTerminalIcon = registerIcon('terminal-kill', Codicon.trash, localize('killTerminalIcon', '用于终止终端实例的图标。'));
export const newTerminalIcon = registerIcon('terminal-new', Codicon.add, localize('newTerminalIcon', '用于创建新的终端实例的图标。'));

export const configureTerminalProfileIcon = registerIcon('terminal-configure-profile', Codicon.gear, localize('configureTerminalProfileIcon', '用于创建新的终端配置文件的图标。'));

export const terminalDecorationMark = registerIcon('terminal-decoration-mark', Codicon.circleSmallFilled, localize('terminalDecorationMark', '终端装饰标记的图标。'));
export const terminalDecorationIncomplete = registerIcon('terminal-decoration-incomplete', Codicon.circle, localize('terminalDecorationIncomplete', '命令未完成的终端修饰图标。'));
export const terminalDecorationError = registerIcon('terminal-decoration-error', Codicon.errorSmall, localize('terminalDecorationError', '错误命令的终端修饰图标。'));
export const terminalDecorationSuccess = registerIcon('terminal-decoration-success', Codicon.circleFilled, localize('terminalDecorationSuccess', '成功命令的终端修饰图标。'));

export const commandHistoryRemoveIcon = registerIcon('terminal-command-history-remove', Codicon.close, localize('terminalCommandHistoryRemove', '用于从命令历史记录中删除终端命令的图标。'));
export const commandHistoryOutputIcon = registerIcon('terminal-command-history-output', Codicon.output, localize('terminalCommandHistoryOutput', '用于查看终端命令输出的图标。'));
export const commandHistoryFuzzySearchIcon = registerIcon('terminal-command-history-fuzzy-search', Codicon.searchFuzzy, localize('terminalCommandHistoryFuzzySearch', '用于切换命令历史记录模糊搜索的图标。'));
export const commandHistoryOpenFileIcon = registerIcon('terminal-command-history-open-file', Codicon.symbolReference, localize('terminalCommandHistoryOpenFile', '用于打开 shell 历史记录文件的图标。'));
