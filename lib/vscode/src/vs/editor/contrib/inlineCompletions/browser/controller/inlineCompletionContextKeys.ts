/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { localize } from '../../../../../nls.js';
import * as nls from '../../../../../nls.js';

export abstract class InlineCompletionContextKeys {

	public static readonly inlineSuggestionVisible = new RawContextKey<boolean>('inlineSuggestionVisible', false, localize('inlineSuggestionVisible', "内联建议是否可见"));
	public static readonly inlineSuggestionAlternativeActionVisible = new RawContextKey<boolean>('inlineSuggestionAlternativeActionVisible', false, localize('inlineSuggestionAlternativeActionVisible', "内联建议的替代操作是否可见。"));
	public static readonly inlineSuggestionHasIndentation = new RawContextKey<boolean>('inlineSuggestionHasIndentation', false, localize('inlineSuggestionHasIndentation', "内联建议是否以空白开头"));
	public static readonly inlineSuggestionHasIndentationLessThanTabSize = new RawContextKey<boolean>('inlineSuggestionHasIndentationLessThanTabSize', true, localize('inlineSuggestionHasIndentationLessThanTabSize', "内联建议是否以小于选项卡插入内容的空格开头"));
	public static readonly suppressSuggestions = new RawContextKey<boolean | undefined>('inlineSuggestionSuppressSuggestions', undefined, localize('suppressSuggestions', "是否应抑制当前建议"));

	public static readonly cursorBeforeGhostText = new RawContextKey<boolean | undefined>('cursorBeforeGhostText', false, localize('cursorBeforeGhostText', "光标是否位于幽灵文本处"));

	public static readonly cursorInIndentation = new RawContextKey<boolean | undefined>('cursorInIndentation', false, localize('cursorInIndentation', "光标是否处于缩进状态"));
	public static readonly hasSelection = new RawContextKey<boolean | undefined>('editor.hasSelection', false, localize('editor.hasSelection', "编辑器是否有选择"));
	public static readonly cursorAtInlineEdit = new RawContextKey<boolean | undefined>('cursorAtInlineEdit', false, localize('cursorAtInlineEdit', "光标是否处于内联编辑状态"));
	public static readonly inlineEditVisible = new RawContextKey<boolean>('inlineEditIsVisible', false, localize('inlineEditVisible', "内联编辑是否可见"));
	public static readonly tabShouldJumpToInlineEdit = new RawContextKey<boolean | undefined>('tabShouldJumpToInlineEdit', false, localize('tabShouldJumpToInlineEdit', "选项卡是否应跳转到内联编辑。"));
	public static readonly tabShouldAcceptInlineEdit = new RawContextKey<boolean | undefined>('tabShouldAcceptInlineEdit', false, localize('tabShouldAcceptInlineEdit', "选项卡是否应接受内联编辑。"));

	public static readonly inInlineEditsPreviewEditor = new RawContextKey<boolean>('inInlineEditsPreviewEditor', true, nls.localize('inInlineEditsPreviewEditor', "当前代码编辑器是否显示内联编辑预览"));
}
