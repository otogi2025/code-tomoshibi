/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';


export namespace CommentContextKeys {

	/**
	 * A context key that is set when the active cursor is in a commenting range.
	 */
	export const activeCursorHasCommentingRange = new RawContextKey<boolean>('activeCursorHasCommentingRange', false, {
		description: nls.localize('hasCommentingRange', "活动光标处的位置是否具有评论范围"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the active cursor is in the range of an existing comment.
	 */
	export const activeCursorHasComment = new RawContextKey<boolean>('activeCursorHasComment', false, {
		description: nls.localize('hasComment', "活动光标处的位置是否具有注释"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the active editor has commenting ranges.
	 */
	export const activeEditorHasCommentingRange = new RawContextKey<boolean>('activeEditorHasCommentingRange', false, {
		description: nls.localize('editorHasCommentingRange', "活动编辑器是否具有注释范围"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the workspace has either comments or commenting ranges.
	 */
	export const WorkspaceHasCommenting = new RawContextKey<boolean>('workspaceHasCommenting', false, {
		description: nls.localize('hasCommentingProvider', "打开的工作区是否具有评论或评论范围。"),
		type: 'boolean'
	});

	/**
	 * A context key that is set when the comment thread has no comments.
	 */
	export const commentThreadIsEmpty = new RawContextKey<boolean>('commentThreadIsEmpty', false, { type: 'boolean', description: nls.localize('commentThreadIsEmpty', "在注释线程没有注释时设置") });
	/**
	 * A context key that is set when the comment has no input.
	 */
	export const commentIsEmpty = new RawContextKey<boolean>('commentIsEmpty', false, { type: 'boolean', description: nls.localize('commentIsEmpty', "在注释没有输入时设置") });
	/**
	 * The context value of the comment.
	 */
	export const commentContext = new RawContextKey<string>('comment', undefined, { type: 'string', description: nls.localize('comment', "注释的上下文值") });
	/**
	 * The context value of the comment thread.
	 */
	export const commentThreadContext = new RawContextKey<string>('commentThread', undefined, { type: 'string', description: nls.localize('commentThread', "注释线程的上下文值") });
	/**
	 * The comment controller id associated with a comment thread.
	 */
	export const commentControllerContext = new RawContextKey<string>('commentController', undefined, { type: 'string', description: nls.localize('commentController', "与注释线程关联的注释控制器 ID") });

	/**
	 * The comment widget is focused.
	 */
	export const commentFocused = new RawContextKey<boolean>('commentFocused', false, { type: 'boolean', description: nls.localize('commentFocused', "在注释聚焦时设置") });

	/**
	 * A context key that is set when a comment widget is visible in the editor.
	 */
	export const commentWidgetVisible = new RawContextKey<boolean>('commentWidgetVisible', false, { type: 'boolean', description: nls.localize('commentWidgetVisible', "当编辑器中显示注释小组件时进行设置") });

	/**
	 * A context key that is set when commenting is enabled.
	 */
	export const commentingEnabled = new RawContextKey<boolean>('commentingEnabled', true, {
		description: nls.localize('commentingEnabled', "是否启用批注功能"),
		type: 'boolean'
	});
}
