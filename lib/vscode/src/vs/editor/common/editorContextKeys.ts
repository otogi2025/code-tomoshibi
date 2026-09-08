/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../nls.js';
import { RawContextKey } from '../../platform/contextkey/common/contextkey.js';

export namespace EditorContextKeys {

	export const editorSimpleInput = new RawContextKey<boolean>('editorSimpleInput', false, true);
	/**
	 * A context key that is set when the editor's text has focus (cursor is blinking).
	 * Is false when focus is in simple editor widgets (repl input, scm commit input).
	 */
	export const editorTextFocus = new RawContextKey<boolean>('editorTextFocus', false, nls.localize('editorTextFocus', "编辑器文本是否具有焦点(光标是否闪烁)"));
	/**
	 * A context key that is set when the editor's text or an editor's widget has focus.
	 */
	export const focus = new RawContextKey<boolean>('editorFocus', false, nls.localize('editorFocus', "编辑器或编辑器小组件是否具有焦点(例如焦点在“查找”小组件中)"));

	/**
	 * A context key that is set when any editor input has focus (regular editor, repl input...).
	 */
	export const textInputFocus = new RawContextKey<boolean>('textInputFocus', false, nls.localize('textInputFocus', "编辑器或 RTF 输入是否有焦点(光标是否闪烁)"));

	export const readOnly = new RawContextKey<boolean>('editorReadonly', false, nls.localize('editorReadonly', "编辑器是否为只读"));
	export const inDiffEditor = new RawContextKey<boolean>('inDiffEditor', false, nls.localize('inDiffEditor', "上下文是否为差异编辑器"));
	export const isEmbeddedDiffEditor = new RawContextKey<boolean>('isEmbeddedDiffEditor', false, nls.localize('isEmbeddedDiffEditor', "上下文是否为嵌入式差异编辑器"));
	export const inMultiDiffEditor = new RawContextKey<boolean>('inMultiDiffEditor', false, nls.localize('inMultiDiffEditor', "上下文是否为多个差异编辑器"));
	export const multiDiffEditorAllCollapsed = new RawContextKey<boolean>('multiDiffEditorAllCollapsed', undefined, nls.localize('multiDiffEditorAllCollapsed', "是否折叠多差异编辑器中的所有文件"));
	export const multiDiffEditorItemAllUnchangedRegionsShown = new RawContextKey<boolean>('multiDiffEditorItemAllUnchangedRegionsShown', false, nls.localize('multiDiffEditorItemAllUnchangedRegionsShown', "是否显示多差异编辑器文件的所有未更改区域"));
	export const multiDiffEditorRenderSideBySide = new RawContextKey<boolean>('multiDiffEditorRenderSideBySide', true, nls.localize('multiDiffEditorRenderSideBySide', "多差异编辑器是否并排呈现差异而非内联呈现"));
	export const hasChanges = new RawContextKey<boolean>('diffEditorHasChanges', false, nls.localize('diffEditorHasChanges', "差异编辑器是否有更改"));
	export const comparingMovedCode = new RawContextKey<boolean>('comparingMovedCode', false, nls.localize('comparingMovedCode', "是否选择移动的代码块进行比较"));
	export const accessibleDiffViewerVisible = new RawContextKey<boolean>('accessibleDiffViewerVisible', false, nls.localize('accessibleDiffViewerVisible', "可访问差异查看器是否可见"));
	export const diffEditorRenderSideBySideInlineBreakpointReached = new RawContextKey<boolean>('diffEditorRenderSideBySideInlineBreakpointReached', false, nls.localize('diffEditorRenderSideBySideInlineBreakpointReached', "是否已到达差异编辑器并排呈现内联断点"));
	export const diffEditorInlineMode = new RawContextKey<boolean>('diffEditorInlineMode', false, nls.localize('diffEditorInlineMode', "内联模式是否处于活动状态"));

	export const diffEditorOriginalWritable = new RawContextKey<boolean>('diffEditorOriginalWritable', false, nls.localize('diffEditorOriginalWritable', "修改项在差异编辑器是否可写"));
	export const diffEditorModifiedWritable = new RawContextKey<boolean>('diffEditorModifiedWritable', false, nls.localize('diffEditorModifiedWritable', "修改项在差异编辑器是否可写"));
	export const diffEditorOriginalUri = new RawContextKey<string>('diffEditorOriginalUri', '', nls.localize('diffEditorOriginalUri', "原始文档的 URI"));
	export const diffEditorModifiedUri = new RawContextKey<string>('diffEditorModifiedUri', '', nls.localize('diffEditorModifiedUri', "已修改的文档的 URI"));

	export const columnSelection = new RawContextKey<boolean>('editorColumnSelection', false, nls.localize('editorColumnSelection', "是否已启用 \"editor.columnSelection\""));
	export const writable = readOnly.toNegated();
	export const hasNonEmptySelection = new RawContextKey<boolean>('editorHasSelection', false, nls.localize('editorHasSelection', "编辑器是否已选定文本"));
	export const hasOnlyEmptySelection = hasNonEmptySelection.toNegated();
	export const hasMultipleSelections = new RawContextKey<boolean>('editorHasMultipleSelections', false, nls.localize('editorHasMultipleSelections', "编辑器是否有多个选择"));
	export const hasSingleSelection = hasMultipleSelections.toNegated();
	export const tabMovesFocus = new RawContextKey<boolean>('editorTabMovesFocus', false, nls.localize('editorTabMovesFocus', "\"Tab\" 是否将焦点移出编辑器"));
	export const tabDoesNotMoveFocus = tabMovesFocus.toNegated();
	export const isInEmbeddedEditor = new RawContextKey<boolean>('isInEmbeddedEditor', false, true);
	export const canUndo = new RawContextKey<boolean>('canUndo', false, true);
	export const canRedo = new RawContextKey<boolean>('canRedo', false, true);

	export const hoverVisible = new RawContextKey<boolean>('editorHoverVisible', false, nls.localize('editorHoverVisible', "编辑器软键盘是否可见"));
	export const hoverFocused = new RawContextKey<boolean>('editorHoverFocused', false, nls.localize('editorHoverFocused', "是否聚焦编辑器悬停"));

	export const stickyScrollFocused = new RawContextKey<boolean>('stickyScrollFocused', false, nls.localize('stickyScrollFocused', "是否聚焦粘性滚动"));
	export const stickyScrollVisible = new RawContextKey<boolean>('stickyScrollVisible', false, nls.localize('stickyScrollVisible', "粘性滚动是否可见"));

	export const standaloneColorPickerVisible = new RawContextKey<boolean>('standaloneColorPickerVisible', false, nls.localize('standaloneColorPickerVisible', "独立颜色选取器是否可见"));
	export const standaloneColorPickerFocused = new RawContextKey<boolean>('standaloneColorPickerFocused', false, nls.localize('standaloneColorPickerFocused', "独立颜色选取器是否聚焦"));

	export const isComposing = new RawContextKey<boolean>('isComposing', false, nls.localize('isComposing', "编辑器是否处于编辑模式"));

	/**
	 * A context key that is set when an editor is part of a larger editor, like notebooks or
	 * (future) a diff editor
	 */
	export const inCompositeEditor = new RawContextKey<boolean>('inCompositeEditor', undefined, nls.localize('inCompositeEditor', "该编辑器是否是更大的编辑器(例如笔记本)的一部分"));
	export const notInCompositeEditor = inCompositeEditor.toNegated();

	// -- mode context keys
	export const languageId = new RawContextKey<string>('editorLangId', '', nls.localize('editorLangId', "编辑器的语言标识符"));
	export const hasCompletionItemProvider = new RawContextKey<boolean>('editorHasCompletionItemProvider', false, nls.localize('editorHasCompletionItemProvider', "编辑器是否具有补全项提供程序"));
	export const hasCodeActionsProvider = new RawContextKey<boolean>('editorHasCodeActionsProvider', false, nls.localize('editorHasCodeActionsProvider', "编辑器是否具有代码操作提供程序"));
	export const hasCodeLensProvider = new RawContextKey<boolean>('editorHasCodeLensProvider', false, nls.localize('editorHasCodeLensProvider', "编辑器是否具有 CodeLens 提供程序"));
	export const hasDefinitionProvider = new RawContextKey<boolean>('editorHasDefinitionProvider', false, nls.localize('editorHasDefinitionProvider', "编辑器是否具有定义提供程序"));
	export const hasDeclarationProvider = new RawContextKey<boolean>('editorHasDeclarationProvider', false, nls.localize('editorHasDeclarationProvider', "编辑器是否具有声明提供程序"));
	export const hasImplementationProvider = new RawContextKey<boolean>('editorHasImplementationProvider', false, nls.localize('editorHasImplementationProvider', "编辑器是否具有实现提供程序"));
	export const hasTypeDefinitionProvider = new RawContextKey<boolean>('editorHasTypeDefinitionProvider', false, nls.localize('editorHasTypeDefinitionProvider', "编辑器是否具有类型定义提供程序"));
	export const hasHoverProvider = new RawContextKey<boolean>('editorHasHoverProvider', false, nls.localize('editorHasHoverProvider', "编辑器是否具有悬停提供程序"));
	export const hasDocumentHighlightProvider = new RawContextKey<boolean>('editorHasDocumentHighlightProvider', false, nls.localize('editorHasDocumentHighlightProvider', "编辑器是否具有文档突出显示提供程序"));
	export const hasDocumentSymbolProvider = new RawContextKey<boolean>('editorHasDocumentSymbolProvider', false, nls.localize('editorHasDocumentSymbolProvider', "编辑器是否具有文档符号提供程序"));
	export const hasReferenceProvider = new RawContextKey<boolean>('editorHasReferenceProvider', false, nls.localize('editorHasReferenceProvider', "编辑器是否具有引用提供程序"));
	export const hasRenameProvider = new RawContextKey<boolean>('editorHasRenameProvider', false, nls.localize('editorHasRenameProvider', "编辑器是否具有重命名提供程序"));
	export const hasSignatureHelpProvider = new RawContextKey<boolean>('editorHasSignatureHelpProvider', false, nls.localize('editorHasSignatureHelpProvider', "编辑器是否具有签名帮助提供程序"));
	export const hasInlayHintsProvider = new RawContextKey<boolean>('editorHasInlayHintsProvider', false, nls.localize('editorHasInlayHintsProvider', "编辑器是否具有内联提示提供程序"));

	// -- mode context keys: formatting
	export const hasDocumentFormattingProvider = new RawContextKey<boolean>('editorHasDocumentFormattingProvider', false, nls.localize('editorHasDocumentFormattingProvider', "编辑器是否具有文档格式设置提供程序"));
	export const hasDocumentSelectionFormattingProvider = new RawContextKey<boolean>('editorHasDocumentSelectionFormattingProvider', false, nls.localize('editorHasDocumentSelectionFormattingProvider', "编辑器是否具有文档选择格式设置提供程序"));
	export const hasMultipleDocumentFormattingProvider = new RawContextKey<boolean>('editorHasMultipleDocumentFormattingProvider', false, nls.localize('editorHasMultipleDocumentFormattingProvider', "编辑器是否具有多个文档格式设置提供程序"));
	export const hasMultipleDocumentSelectionFormattingProvider = new RawContextKey<boolean>('editorHasMultipleDocumentSelectionFormattingProvider', false, nls.localize('editorHasMultipleDocumentSelectionFormattingProvider', "编辑器是否有多个文档选择格式设置提供程序"));

	export const selectionHasDiagnostics = new RawContextKey<boolean>('editorSelectionHasDiagnostics', false, nls.localize('editorSelectionHasDiagnostics', "当前编辑器选区中是否存在任何诊断信息"));
}
