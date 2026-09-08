/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './media/terminalSymbolIcons.css';
import { SYMBOL_ICON_ENUMERATOR_FOREGROUND, SYMBOL_ICON_ENUMERATOR_MEMBER_FOREGROUND, SYMBOL_ICON_METHOD_FOREGROUND, SYMBOL_ICON_VARIABLE_FOREGROUND, SYMBOL_ICON_FILE_FOREGROUND, SYMBOL_ICON_FOLDER_FOREGROUND } from '../../../../../editor/contrib/symbolIcons/browser/symbolIcons.js';
import { registerColor } from '../../../../../platform/theme/common/colorUtils.js';
import { localize } from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../../base/common/codicons.js';

export const TERMINAL_SYMBOL_ICON_FLAG_FOREGROUND = registerColor('terminalSymbolIcon.flagForeground', SYMBOL_ICON_ENUMERATOR_FOREGROUND, localize('terminalSymbolIcon.flagForeground', '标志图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_ALIAS_FOREGROUND = registerColor('terminalSymbolIcon.aliasForeground', SYMBOL_ICON_METHOD_FOREGROUND, localize('terminalSymbolIcon.aliasForeground', '别名图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_OPTION_VALUE_FOREGROUND = registerColor('terminalSymbolIcon.optionValueForeground', SYMBOL_ICON_ENUMERATOR_MEMBER_FOREGROUND, localize('terminalSymbolIcon.enumMemberForeground', '枚举成员图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_METHOD_FOREGROUND = registerColor('terminalSymbolIcon.methodForeground', SYMBOL_ICON_METHOD_FOREGROUND, localize('terminalSymbolIcon.methodForeground', '方法图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_ARGUMENT_FOREGROUND = registerColor('terminalSymbolIcon.argumentForeground', SYMBOL_ICON_VARIABLE_FOREGROUND, localize('terminalSymbolIcon.argumentForeground', '参数图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_OPTION_FOREGROUND = registerColor('terminalSymbolIcon.optionForeground', SYMBOL_ICON_ENUMERATOR_FOREGROUND, localize('terminalSymbolIcon.optionForeground', '选项图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_INLINE_SUGGESTION_FOREGROUND = registerColor('terminalSymbolIcon.inlineSuggestionForeground', null, localize('terminalSymbolIcon.inlineSuggestionForeground', '内联建议图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_FILE_FOREGROUND = registerColor('terminalSymbolIcon.fileForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.fileForeground', '文件图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_FOLDER_FOREGROUND = registerColor('terminalSymbolIcon.folderForeground', SYMBOL_ICON_FOLDER_FOREGROUND, localize('terminalSymbolIcon.folderForeground', '文件夹图标的前景色。这些图标将显示在终端建议小组件中。'));

export const TERMINAL_SYMBOL_ICON_COMMIT_FOREGROUND = registerColor('terminalSymbolIcon.commitForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.commitForeground', '提交图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_BRANCH_FOREGROUND = registerColor('terminalSymbolIcon.branchForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.branchForeground', '分支图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_TAG_FOREGROUND = registerColor('terminalSymbolIcon.tagForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.tagForeground', '标记图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_STASH_FOREGROUND = registerColor('terminalSymbolIcon.stashForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.stashForeground', '储藏图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_REMOTE_FOREGROUND = registerColor('terminalSymbolIcon.remoteForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.remoteForeground', '远程图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_PULL_REQUEST_FOREGROUND = registerColor('terminalSymbolIcon.pullRequestForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.pullRequestForeground', '拉取请求图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_PULL_REQUEST_DONE_FOREGROUND = registerColor('terminalSymbolIcon.pullRequestDoneForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.pullRequestDoneForeground', '已完成拉取请求图标的前景色。这些图标将显示在终端建议小组件中。'));

export const TERMINAL_SYMBOL_ICON_SYMBOLIC_LINK_FILE_FOREGROUND = registerColor('terminalSymbolIcon.symbolicLinkFileForeground', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.symbolicLinkFileForeground', '符号链接文件图标的前景色。这些图标将显示在终端建议小组件中。'));
export const TERMINAL_SYMBOL_ICON_SYMBOLIC_LINK_FOLDER_FOREGROUND = registerColor('terminalSymbolIcon.symbolicLinkFolderForeground', SYMBOL_ICON_FOLDER_FOREGROUND, localize('terminalSymbolIcon.symbolicLinkFolderForeground', '符号链接文件夹图标的前景色。这些图标将显示在终端建议小组件中。'));

export const TERMINAL_SYMBOL_ICON_SYMBOL_TEXT_FOREGROUND = registerColor('terminalSymbolIcon.symbolText', SYMBOL_ICON_FILE_FOREGROUND, localize('terminalSymbolIcon.symbolTextForeground', '纯文本建议的前景色。这些图标将显示在终端建议小组件中。'));

export const terminalSymbolFlagIcon = registerIcon('terminal-symbol-flag', Codicon.flag, localize('terminalSymbolFlagIcon', '终端建议小组件中标志的图标。'), TERMINAL_SYMBOL_ICON_FLAG_FOREGROUND);
export const terminalSymbolAliasIcon = registerIcon('terminal-symbol-alias', Codicon.symbolMethod, localize('terminalSymbolAliasIcon', '终端建议小组件中别名的图标。'), TERMINAL_SYMBOL_ICON_ALIAS_FOREGROUND);
export const terminalSymbolEnumMember = registerIcon('terminal-symbol-option-value', Codicon.symbolEnumMember, localize('terminalSymbolOptionValue', '终端建议小组件中枚举成员的图标。'), TERMINAL_SYMBOL_ICON_OPTION_VALUE_FOREGROUND);
export const terminalSymbolMethodIcon = registerIcon('terminal-symbol-method', Codicon.symbolMethod, localize('terminalSymbolMethodIcon', '终端建议小组件中方法的图标。'), TERMINAL_SYMBOL_ICON_METHOD_FOREGROUND);
export const terminalSymbolArgumentIcon = registerIcon('terminal-symbol-argument', Codicon.symbolVariable, localize('terminalSymbolArgumentIcon', '终端建议小组件中参数的图标。'), TERMINAL_SYMBOL_ICON_ARGUMENT_FOREGROUND);
export const terminalSymbolOptionIcon = registerIcon('terminal-symbol-option', Codicon.symbolEnum, localize('terminalSymbolOptionIcon', '终端建议小组件中选项的图标。'), TERMINAL_SYMBOL_ICON_OPTION_FOREGROUND);
export const terminalSymbolInlineSuggestionIcon = registerIcon('terminal-symbol-inline-suggestion', Codicon.star, localize('terminalSymbolInlineSuggestionIcon', '终端建议小组件中内联建议的图标。'), TERMINAL_SYMBOL_ICON_INLINE_SUGGESTION_FOREGROUND);
export const terminalSymbolFileIcon = registerIcon('terminal-symbol-file', Codicon.symbolFile, localize('terminalSymbolFileIcon', '终端建议小组件中文件的图标。'), TERMINAL_SYMBOL_ICON_FILE_FOREGROUND);
export const terminalSymbolFolderIcon = registerIcon('terminal-symbol-folder', Codicon.symbolFolder, localize('terminalSymbolFolderIcon', '终端建议小组件中文件夹的图标。'), TERMINAL_SYMBOL_ICON_FOLDER_FOREGROUND);

export const terminalSymbolCommitIcon = registerIcon('terminal-symbol-commit', Codicon.gitCommit, localize('terminalSymbolCommitIcon', '终端建议小组件中的提交图标。'), TERMINAL_SYMBOL_ICON_COMMIT_FOREGROUND);
export const terminalSymbolBranchIcon = registerIcon('terminal-symbol-branch', Codicon.gitBranch, localize('terminalSymbolBranchIcon', '终端建议小组件中的分支图标。'), TERMINAL_SYMBOL_ICON_BRANCH_FOREGROUND);
export const terminalSymbolTagIcon = registerIcon('terminal-symbol-tag', Codicon.tag, localize('terminalSymbolTagIcon', '终端建议小组件中的标记图标。'), TERMINAL_SYMBOL_ICON_TAG_FOREGROUND);
export const terminalSymbolStashIcon = registerIcon('terminal-symbol-stash', Codicon.gitStash, localize('terminalSymbolStashIcon', '终端建议小组件中的储藏图标。'), TERMINAL_SYMBOL_ICON_STASH_FOREGROUND);
export const terminalSymbolRemoteIcon = registerIcon('terminal-symbol-remote', Codicon.remote, localize('terminalSymbolRemoteIcon', '终端建议小组件中的远程图标。'), TERMINAL_SYMBOL_ICON_REMOTE_FOREGROUND);
export const terminalSymbolPullRequestIcon = registerIcon('terminal-symbol-pull-request', Codicon.gitPullRequest, localize('terminalSymbolPullRequestIcon', '终端建议小组件中拉取请求的图标。'), TERMINAL_SYMBOL_ICON_PULL_REQUEST_FOREGROUND);
export const terminalSymbolPullRequestDoneIcon = registerIcon('terminal-symbol-pull-request-done', Codicon.gitPullRequestDone, localize('terminalSymbolPullRequestDoneIcon', '终端建议小组件中已完成的拉取请求的图标。'), TERMINAL_SYMBOL_ICON_PULL_REQUEST_DONE_FOREGROUND);

export const terminalSymbolSymbolicLinkFileIcon = registerIcon('terminal-symbol-symbolic-link-file', Codicon.fileSymlinkFile, localize('terminalSymbolSymbolicLinkFileIcon', '终端建议小组件中符号链接文件的图标。'), TERMINAL_SYMBOL_ICON_SYMBOLIC_LINK_FILE_FOREGROUND);
export const terminalSymbolSymbolicLinkFolderIcon = registerIcon('terminal-symbol-symbolic-link-folder', Codicon.fileSymlinkDirectory, localize('terminalSymbolSymbolicLinkFolderIcon', '终端建议小组件中符号链接文件夹的图标。'), TERMINAL_SYMBOL_ICON_SYMBOLIC_LINK_FOLDER_FOREGROUND);

export const terminalSymbolSymbolTextIcon = registerIcon('terminal-symbol-symbol-text', Codicon.symbolKey, localize('terminalSymbolSymboTextIcon', '终端建议小组件中纯文本建议的图标。'), TERMINAL_SYMBOL_ICON_SYMBOL_TEXT_FOREGROUND);
