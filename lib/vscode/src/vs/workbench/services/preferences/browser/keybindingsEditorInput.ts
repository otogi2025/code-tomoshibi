/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { OS } from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import * as nls from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { KeybindingsEditorModel } from './keybindingsEditorModel.js';

export interface IKeybindingsEditorSearchOptions {
	searchValue: string;
	recordKeybindings: boolean;
	sortByPrecedence: boolean;
}

const KeybindingsEditorIcon = registerIcon('keybindings-editor-label-icon', Codicon.keyboard, nls.localize('keybindingsEditorLabelIcon', '键绑定编辑器标签的图标。'));

export class KeybindingsEditorInput extends EditorInput {

	static readonly ID: string = 'workbench.input.keybindings';
	readonly keybindingsModel: KeybindingsEditorModel;

	searchOptions: IKeybindingsEditorSearchOptions | null = null;

	readonly resource = undefined;

	constructor(@IInstantiationService instantiationService: IInstantiationService) {
		super();

		this.keybindingsModel = instantiationService.createInstance(KeybindingsEditorModel, OS);
	}

	override get typeId(): string {
		return KeybindingsEditorInput.ID;
	}

	override getName(): string {
		return nls.localize('keybindingsInputName', "键盘快捷方式");
	}

	override getIcon(): ThemeIcon {
		return KeybindingsEditorIcon;
	}

	override async resolve(): Promise<KeybindingsEditorModel> {
		return this.keybindingsModel;
	}

	override matches(otherInput: EditorInput | IUntypedEditorInput): boolean {
		return otherInput instanceof KeybindingsEditorInput;
	}

	override dispose(): void {
		this.keybindingsModel.dispose();

		super.dispose();
	}
}
