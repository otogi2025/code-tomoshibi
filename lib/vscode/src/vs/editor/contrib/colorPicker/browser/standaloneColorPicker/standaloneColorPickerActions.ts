/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ICodeEditor } from '../../../../browser/editorBrowser.js';
import { EditorAction, EditorAction2, ServicesAccessor } from '../../../../browser/editorExtensions.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../../nls.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { EditorContextKeys } from '../../../../common/editorContextKeys.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { StandaloneColorPickerController } from './standaloneColorPickerController.js';

export class ShowOrFocusStandaloneColorPicker extends EditorAction2 {
	constructor() {
		super({
			id: 'editor.action.showOrFocusStandaloneColorPicker',
			title: {
				...localize2('showOrFocusStandaloneColorPicker', "显示或聚焦独立颜色选取器"),
				mnemonicTitle: localize({ key: 'mishowOrFocusStandaloneColorPicker', comment: ['&& denotes a mnemonic'] }, "显示或聚焦独立颜色选取器(&&S)"),
			},
			precondition: undefined,
			menu: [
				{ id: MenuId.CommandPalette },
			],
			metadata: {
				description: localize2('showOrFocusStandaloneColorPickerDescription', "显示或聚焦使用默认颜色提供程序的独立颜色选取器。它会显示 rgb/hsl/hex 颜色。"),
			}
		});
	}
	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StandaloneColorPickerController.get(editor)?.showOrFocus();
	}
}

export class HideStandaloneColorPicker extends EditorAction {
	constructor() {
		super({
			id: 'editor.action.hideColorPicker',
			label: localize2({
				key: 'hideColorPicker',
				comment: [
					'Action that hides the color picker'
				]
			}, "隐藏颜色选取器"),
			precondition: EditorContextKeys.standaloneColorPickerVisible.isEqualTo(true),
			kbOpts: {
				primary: KeyCode.Escape,
				weight: KeybindingWeight.EditorContrib
			},
			metadata: {
				description: localize2('hideColorPickerDescription', "隐藏独立颜色选取器。"),
			}
		});
	}
	public run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		StandaloneColorPickerController.get(editor)?.hide();
	}
}

export class InsertColorWithStandaloneColorPicker extends EditorAction {
	constructor() {
		super({
			id: 'editor.action.insertColorWithStandaloneColorPicker',
			label: localize2({
				key: 'insertColorWithStandaloneColorPicker',
				comment: [
					'Action that inserts color with standalone color picker'
				]
			}, "使用独立颜色选取器插入颜色"),
			precondition: EditorContextKeys.standaloneColorPickerFocused.isEqualTo(true),
			kbOpts: {
				primary: KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			},
			metadata: {
				description: localize2('insertColorWithStandaloneColorPickerDescription', "使用聚焦的独立颜色选取器插入 hex/rgb/hsl 颜色。"),
			}
		});
	}
	public run(_accessor: ServicesAccessor, editor: ICodeEditor): void {
		StandaloneColorPickerController.get(editor)?.insertColor();
	}
}
