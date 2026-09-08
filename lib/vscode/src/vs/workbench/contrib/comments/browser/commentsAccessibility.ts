/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ctxCommentEditorFocused } from './simpleCommentEditor.js';
import { CommentContextKeys } from '../common/commentContextKeys.js';
import * as nls from '../../../../nls.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { CommentCommandId } from '../common/commentCommandIds.js';
import { ToggleTabFocusModeAction } from '../../../../editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
import { IAccessibleViewContentProvider, AccessibleViewProviderId, IAccessibleViewOptions, AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { Disposable } from '../../../../base/common/lifecycle.js';


export namespace CommentAccessibilityHelpNLS {
	export const intro = nls.localize('intro', "编辑器包含可批注的范围。一些有用的命令包括:");
	export const tabFocus = nls.localize('introWidget', "此小组件包含一个文本区域，用于撰写新注释和操作，该文本区域可在选项卡移动焦点模式后使用“切换 Tab 键移动焦点”命令{0}启用。", `<keybinding:${ToggleTabFocusModeAction.ID}>`);
	export const commentCommands = nls.localize('commentCommands', "一些有用的注释命令包括:");
	export const escape = nls.localize('escape', "- 关闭注释{0}。", `<keybinding:${CommentCommandId.Hide}>`);
	export const nextRange = nls.localize('next', "- 转至下一个评论范围{0}。", `<keybinding:${CommentCommandId.NextRange}>`);
	export const previousRange = nls.localize('previous', "- 转至上一个评论范围{0}。", `<keybinding:${CommentCommandId.PreviousRange}>`);
	export const nextCommentThread = nls.localize('nextCommentThreadKb', "- 转至下一个评论线程{0}。", `<keybinding:${CommentCommandId.NextThread}>`);
	export const previousCommentThread = nls.localize('previousCommentThreadKb', "- 转至上一个评论线程{0}。", `<keybinding:${CommentCommandId.PreviousThread}>`);
	export const nextCommentedRange = nls.localize('nextCommentedRangeKb', "- 转至下一个评论范围{0}。", `<keybinding:${CommentCommandId.NextCommentedRange}>`);
	export const previousCommentedRange = nls.localize('previousCommentedRangeKb', "- 转至上一个评论范围{0}。", `<keybinding:${CommentCommandId.PreviousCommentedRange}>`);
	export const addComment = nls.localize('addCommentNoKb', "- 添加对当前所选内容的注释{0}。", `<keybinding:${CommentCommandId.Add}>`);
	export const submitComment = nls.localize('submitComment', "- 提交注释{0}。", `<keybinding:${CommentCommandId.Submit}>`);
}

export class CommentsAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	id = AccessibleViewProviderId.Comments;
	verbositySettingKey: AccessibilityVerbositySettingId = AccessibilityVerbositySettingId.Comments;
	options: IAccessibleViewOptions = { type: AccessibleViewType.Help };
	private _element: HTMLElement | undefined;
	provideContent(): string {
		return [CommentAccessibilityHelpNLS.tabFocus, CommentAccessibilityHelpNLS.commentCommands, CommentAccessibilityHelpNLS.escape, CommentAccessibilityHelpNLS.addComment, CommentAccessibilityHelpNLS.submitComment, CommentAccessibilityHelpNLS.nextRange, CommentAccessibilityHelpNLS.previousRange].join('\n');
	}
	onClose(): void {
		this._element?.focus();
	}
}

export class CommentsAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 110;
	readonly name = 'comments';
	readonly type = AccessibleViewType.Help;
	readonly when = ContextKeyExpr.or(ctxCommentEditorFocused, CommentContextKeys.commentFocused);
	getProvider(accessor: ServicesAccessor) {
		return accessor.get(IInstantiationService).createInstance(CommentsAccessibilityHelpProvider);
	}
}
