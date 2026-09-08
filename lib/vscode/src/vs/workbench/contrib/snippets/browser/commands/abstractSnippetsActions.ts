/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { EditorAction2 } from '../../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../../nls.js';
import { Action2, IAction2Options } from '../../../../../platform/actions/common/actions.js';

const defaultOptions = {
	category: localize2('snippets', "代码片段"),
} as const;

export abstract class SnippetsAction extends Action2 {

	constructor(desc: Readonly<IAction2Options>) {
		super({ ...defaultOptions, ...desc });
	}
}

export abstract class SnippetEditorAction extends EditorAction2 {

	constructor(desc: Readonly<IAction2Options>) {
		super({ ...defaultOptions, ...desc });
	}
}
