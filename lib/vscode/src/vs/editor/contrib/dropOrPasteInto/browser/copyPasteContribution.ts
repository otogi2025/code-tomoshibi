/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { IJSONSchema, TypeFromJsonSchema } from '../../../../base/common/jsonSchema.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import * as nls from '../../../../nls.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ICodeEditor } from '../../../browser/editorBrowser.js';
import { EditorAction, EditorCommand, EditorContributionInstantiation, ServicesAccessor, registerEditorAction, registerEditorCommand, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { registerEditorFeature } from '../../../common/editorFeatures.js';
import { CopyPasteController, PastePreference, changePasteTypeCommandId, pasteWidgetVisibleCtx } from './copyPasteController.js';
import { DefaultPasteProvidersFeature, DefaultTextPasteOrDropEditProvider } from './defaultProviders.js';

export const pasteAsCommandId = 'editor.action.pasteAs';

registerEditorContribution(CopyPasteController.ID, CopyPasteController, EditorContributionInstantiation.Eager); // eager because it listens to events on the container dom node of the editor
registerEditorFeature(DefaultPasteProvidersFeature);

registerEditorCommand(new class extends EditorCommand {
	constructor() {
		super({
			id: changePasteTypeCommandId,
			precondition: pasteWidgetVisibleCtx,
			kbOpts: {
				weight: KeybindingWeight.EditorContrib,
				primary: KeyMod.CtrlCmd | KeyCode.Period,
			}
		});
	}

	public override runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		return CopyPasteController.get(editor)?.changePasteType();
	}
});

registerEditorCommand(new class extends EditorCommand {
	constructor() {
		super({
			id: 'editor.hidePasteWidget',
			precondition: pasteWidgetVisibleCtx,
			kbOpts: {
				weight: KeybindingWeight.EditorContrib,
				primary: KeyCode.Escape,
			}
		});
	}

	public override runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		CopyPasteController.get(editor)?.clearWidgets();
	}
});

registerEditorAction(class PasteAsAction extends EditorAction {
	private static readonly argsSchema = {
		oneOf: [
			{
				type: 'object',
				required: ['kind'],
				properties: {
					kind: {
						type: 'string',
						description: nls.localize('pasteAs.kind', "要尝试粘贴的粘贴编辑的类型。\r\n如果有多个此类编辑，编辑器将显示一个选取器。如果没有此类编辑，编辑器将显示错误消息。"),
					}
				},
			},
			{
				type: 'object',
				required: ['preferences'],
				properties: {
					preferences: {
						type: 'array',
						description: nls.localize('pasteAs.preferences', "要尝试应用的首选粘贴编辑类型列表。\r\n将应用与首选项匹配的第一个编辑。"),
						items: { type: 'string' }
					}
				},
			}
		]
	} as const satisfies IJSONSchema;

	constructor() {
		super({
			id: pasteAsCommandId,
			label: nls.localize2('pasteAs', "粘贴为..."),
			precondition: EditorContextKeys.writable,
			metadata: {
				description: 'Paste as',
				args: [{
					name: 'args',
					schema: PasteAsAction.argsSchema
				}]
			},
			canTriggerInlineEdits: true,
		});
	}

	public override run(_accessor: ServicesAccessor, editor: ICodeEditor, args?: TypeFromJsonSchema<typeof PasteAsAction.argsSchema>) {
		let preference: PastePreference | undefined;
		if (args) {
			if ('kind' in args) {
				preference = { only: new HierarchicalKind(args.kind) };
			} else if ('preferences' in args) {
				preference = { preferences: args.preferences.map(kind => new HierarchicalKind(kind)) };
			}
		}
		return CopyPasteController.get(editor)?.pasteAs(preference);
	}
});

registerEditorAction(class extends EditorAction {
	constructor() {
		super({
			id: 'editor.action.pasteAsText',
			label: nls.localize2('pasteAsText', "粘贴为文本"),
			precondition: EditorContextKeys.writable,
			canTriggerInlineEdits: true,
		});
	}

	public override run(_accessor: ServicesAccessor, editor: ICodeEditor) {
		return CopyPasteController.get(editor)?.pasteAs({ providerId: DefaultTextPasteOrDropEditProvider.id });
	}
});

export type PreferredPasteConfiguration = string;
