/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

export type MergeEditorLayoutKind = 'mixed' | 'columns';

export const ctxIsMergeEditor = new RawContextKey<boolean>('isMergeEditor', false, { type: 'boolean', description: localize('is', '编辑器是合并编辑器') });
export const ctxIsMergeResultEditor = new RawContextKey<boolean>('isMergeResultEditor', false, { type: 'boolean', description: localize('isr', '编辑器是合并编辑器的结果编辑器。') });
export const ctxMergeEditorLayout = new RawContextKey<MergeEditorLayoutKind>('mergeEditorLayout', 'mixed', { type: 'string', description: localize('editorLayout', '合并编辑器的布局模式') });
export const ctxMergeEditorShowBase = new RawContextKey<boolean>('mergeEditorShowBase', false, { type: 'boolean', description: localize('showBase', '如果合并编辑器显示基础版本') });
export const ctxMergeEditorShowBaseAtTop = new RawContextKey<boolean>('mergeEditorShowBaseAtTop', false, { type: 'boolean', description: localize('showBaseAtTop', '如果应在顶部显示基') });
export const ctxMergeEditorShowNonConflictingChanges = new RawContextKey<boolean>('mergeEditorShowNonConflictingChanges', false, { type: 'boolean', description: localize('showNonConflictingChanges', '如果合并编辑器显示不冲突的更改') });

export const ctxMergeBaseUri = new RawContextKey<string>('mergeEditorBaseUri', '', { type: 'string', description: localize('baseUri', '合并编辑器的基数的 URI') });
export const ctxMergeResultUri = new RawContextKey<string>('mergeEditorResultUri', '', { type: 'string', description: localize('resultUri', '合并编辑器结果的 URI') });

export interface MergeEditorContents {
	languageId: string;
	base: string;
	input1: string;
	input2: string;
	result: string;
	initialResult?: string;
}

export const StorageCloseWithConflicts = 'mergeEditorCloseWithConflicts';
