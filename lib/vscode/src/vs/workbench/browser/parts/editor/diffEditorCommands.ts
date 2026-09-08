/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { KeyChord, KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ActiveCompareEditorCanSwapContext, ActiveCustomEditorDiffCanToggleLayoutContext, TextCompareEditorActiveContext, TextCompareEditorVisibleContext } from '../../../common/contextkeys.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { FocusTextDiffEditorMode, IDiffEditorCommandsService } from './diffEditorCommandsService.js';

export const TOGGLE_DIFF_SIDE_BY_SIDE = 'toggle.diff.renderSideBySide';
export const GOTO_NEXT_CHANGE = 'workbench.action.compareEditor.nextChange';
export const GOTO_PREVIOUS_CHANGE = 'workbench.action.compareEditor.previousChange';
export const DIFF_FOCUS_PRIMARY_SIDE = 'workbench.action.compareEditor.focusPrimarySide';
export const DIFF_FOCUS_SECONDARY_SIDE = 'workbench.action.compareEditor.focusSecondarySide';
export const DIFF_FOCUS_OTHER_SIDE = 'workbench.action.compareEditor.focusOtherSide';
export const DIFF_OPEN_SIDE = 'workbench.action.compareEditor.openSide';
export const TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE = 'toggle.diff.ignoreTrimWhitespace';
export const DIFF_SWAP_SIDES = 'workbench.action.compareEditor.swapSides';

export function registerDiffEditorCommands(): void {
	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: DIFF_OPEN_SIDE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: EditorContextKeys.inDiffEditor,
		primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.KeyO),
		handler: accessor => accessor.get(IDiffEditorCommandsService).openActiveDiffSide()
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: DIFF_OPEN_SIDE,
			title: localize2('compare.openSide', '打开活动差异侧边栏'),
		}
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: GOTO_NEXT_CHANGE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: TextCompareEditorVisibleContext,
		primary: KeyMod.Alt | KeyCode.F5,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).navigateInDiffEditor(args, true)
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: GOTO_NEXT_CHANGE,
			title: localize2('compare.nextChange', '转到下一个更改'),
		}
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: GOTO_PREVIOUS_CHANGE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: TextCompareEditorVisibleContext,
		primary: KeyMod.Alt | KeyMod.Shift | KeyCode.F5,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).navigateInDiffEditor(args, false)
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: GOTO_PREVIOUS_CHANGE,
			title: localize2('compare.previousChange', '转到上一个更改'),
		}
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: TOGGLE_DIFF_SIDE_BY_SIDE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).toggleRenderSideBySide(args)
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: DIFF_FOCUS_PRIMARY_SIDE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).focusInDiffEditor(args, FocusTextDiffEditorMode.Modified)
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: DIFF_FOCUS_SECONDARY_SIDE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).focusInDiffEditor(args, FocusTextDiffEditorMode.Original)
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: DIFF_FOCUS_OTHER_SIDE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).focusInDiffEditor(args, FocusTextDiffEditorMode.Toggle)
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).toggleDiffIgnoreTrimWhitespace(args)
	});

	KeybindingsRegistry.registerCommandAndKeybindingRule({
		id: DIFF_SWAP_SIDES,
		weight: KeybindingWeight.WorkbenchContrib,
		when: undefined,
		primary: undefined,
		handler: (accessor, ...args) => accessor.get(IDiffEditorCommandsService).swapDiffSides(args)
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: TOGGLE_DIFF_SIDE_BY_SIDE,
			title: localize2('toggleInlineView', "切换内联视图"),
			category: localize('compare', "比较")
		},
		when: ContextKeyExpr.or(TextCompareEditorActiveContext, ActiveCustomEditorDiffCanToggleLayoutContext)
	});

	MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
		command: {
			id: DIFF_SWAP_SIDES,
			title: localize2('swapDiffSides', "切换编辑器左右端"),
			category: localize('compare', "比较")
		},
		when: ContextKeyExpr.and(TextCompareEditorActiveContext, ActiveCompareEditorCanSwapContext)
	});
}
