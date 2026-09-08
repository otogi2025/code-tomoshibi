/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ICodeEditor } from '../../../browser/editorBrowser.js';
import { EditorAction, IActionOptions, registerEditorAction, ServicesAccessor } from '../../../browser/editorExtensions.js';
import { ICommand } from '../../../common/editorCommon.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { MoveCaretCommand } from './moveCaretCommand.js';
import * as nls from '../../../../nls.js';

class MoveCaretAction extends EditorAction {

	private readonly left: boolean;

	constructor(left: boolean, opts: IActionOptions) {
		super(opts);

		this.left = left;
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		if (!editor.hasModel()) {
			return;
		}

		const commands: ICommand[] = [];
		const selections = editor.getSelections();

		for (const selection of selections) {
			commands.push(new MoveCaretCommand(selection, this.left));
		}

		editor.pushUndoStop();
		editor.executeCommands(this.id, commands);
		editor.pushUndoStop();
	}
}

class MoveCaretLeftAction extends MoveCaretAction {
	constructor() {
		super(true, {
			id: 'editor.action.moveCarretLeftAction',
			label: nls.localize2('caret.moveLeft', "向左移动所选文本"),
			precondition: EditorContextKeys.writable
		});
	}
}

class MoveCaretRightAction extends MoveCaretAction {
	constructor() {
		super(false, {
			id: 'editor.action.moveCarretRightAction',
			label: nls.localize2('caret.moveRight', "向右移动所选文本"),
			precondition: EditorContextKeys.writable
		});
	}
}

registerEditorAction(MoveCaretLeftAction);
registerEditorAction(MoveCaretRightAction);
