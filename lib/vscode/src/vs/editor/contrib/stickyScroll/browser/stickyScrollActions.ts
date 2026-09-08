/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { KeyCode } from '../../../../base/common/keyCodes.js';
import { EditorAction2, ServicesAccessor } from '../../../browser/editorExtensions.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ICodeEditor } from '../../../browser/editorBrowser.js';
import { StickyScrollController } from './stickyScrollController.js';

export class ToggleStickyScroll extends EditorAction2 {

	constructor() {
		super({
			id: 'editor.action.toggleStickyScroll',
			title: {
				...localize2('toggleEditorStickyScroll', "切换编辑器粘滞滚动"),
				mnemonicTitle: localize({ key: 'mitoggleStickyScroll', comment: ['&& denotes a mnemonic'] }, "切换编辑器粘滞滚动"),
			},
			metadata: {
				description: localize2('toggleEditorStickyScroll.description', "切换/启用编辑器粘性滚动，该滚动显示视区顶部的嵌套范围"),
			},
			category: Categories.View,
			toggled: {
				condition: ContextKeyExpr.equals('config.editor.stickyScroll.enabled', true),
				title: localize('stickyScroll', "粘滞滚动"),
				mnemonicTitle: localize({ key: 'miStickyScroll', comment: ['&& denotes a mnemonic'] }, "粘滞滚动(&&S)"),
			},
			menu: [
				{ id: MenuId.CommandPalette },
				{ id: MenuId.MenubarAppearanceMenu, group: '4_editor', order: 3 },
				{ id: MenuId.StickyScrollContext }
			]
		});
	}

	async runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const newValue = !configurationService.getValue('editor.stickyScroll.enabled');
		const isFocused = StickyScrollController.get(editor)?.isFocused();
		configurationService.updateValue('editor.stickyScroll.enabled', newValue);
		if (isFocused) {
			editor.focus();
		}
	}
}

const weight = KeybindingWeight.EditorContrib;

export class FocusStickyScroll extends EditorAction2 {

	constructor() {
		super({
			id: 'editor.action.focusStickyScroll',
			title: {
				...localize2('focusStickyScroll', "焦点编辑器粘滞滚动"),
				mnemonicTitle: localize({ key: 'mifocusEditorStickyScroll', comment: ['&& denotes a mnemonic'] }, "焦点编辑器粘滞滚动(&&F)"),
			},
			precondition: ContextKeyExpr.and(ContextKeyExpr.has('config.editor.stickyScroll.enabled'), EditorContextKeys.stickyScrollVisible),
			menu: [
				{ id: MenuId.CommandPalette },
			]
		});
	}

	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StickyScrollController.get(editor)?.focus();
	}
}

export class SelectNextStickyScrollLine extends EditorAction2 {
	constructor() {
		super({
			id: 'editor.action.selectNextStickyScrollLine',
			title: localize2('selectNextStickyScrollLine.title', "选择下一个编辑器粘性滚动行"),
			precondition: EditorContextKeys.stickyScrollFocused.isEqualTo(true),
			keybinding: {
				weight,
				primary: KeyCode.DownArrow
			}
		});
	}

	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StickyScrollController.get(editor)?.focusNext();
	}
}

export class SelectPreviousStickyScrollLine extends EditorAction2 {
	constructor() {
		super({
			id: 'editor.action.selectPreviousStickyScrollLine',
			title: localize2('selectPreviousStickyScrollLine.title', "选择上一个粘性滚动行"),
			precondition: EditorContextKeys.stickyScrollFocused.isEqualTo(true),
			keybinding: {
				weight,
				primary: KeyCode.UpArrow
			}
		});
	}

	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StickyScrollController.get(editor)?.focusPrevious();
	}
}

export class GoToStickyScrollLine extends EditorAction2 {
	constructor() {
		super({
			id: 'editor.action.goToFocusedStickyScrollLine',
			title: localize2('goToFocusedStickyScrollLine.title', "转到聚焦的粘性滚动行"),
			precondition: EditorContextKeys.stickyScrollFocused.isEqualTo(true),
			keybinding: {
				weight,
				primary: KeyCode.Enter
			}
		});
	}

	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StickyScrollController.get(editor)?.goToFocused();
	}
}

export class SelectEditor extends EditorAction2 {

	constructor() {
		super({
			id: 'editor.action.selectEditor',
			title: localize2('selectEditor.title', "选择编辑器"),
			precondition: EditorContextKeys.stickyScrollFocused.isEqualTo(true),
			keybinding: {
				weight,
				primary: KeyCode.Escape
			}
		});
	}

	runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor) {
		StickyScrollController.get(editor)?.selectEditor();
	}
}
