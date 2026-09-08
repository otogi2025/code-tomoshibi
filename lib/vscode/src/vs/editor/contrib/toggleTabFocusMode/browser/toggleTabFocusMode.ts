/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { TabFocus } from '../../../browser/config/tabFocus.js';
import * as nls from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';

export class ToggleTabFocusModeAction extends Action2 {

	public static readonly ID = 'editor.action.toggleTabFocusMode';

	constructor() {
		super({
			id: ToggleTabFocusModeAction.ID,
			title: nls.localize2({ key: 'toggle.tabMovesFocus', comment: ['Turn on/off use of tab key for moving focus around VS Code'] }, '切换 Tab 键移动焦点'),
			precondition: undefined,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyM,
				mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyM },
				weight: KeybindingWeight.EditorContrib
			},
			metadata: {
				description: nls.localize2('tabMovesFocusDescriptions', "确定 Tab 键是在工作台周围移动焦点，还是在当前编辑器中插入制表符。这也称为制表符补漏白、制表符导航或制表符焦点模式。"),
			},
			f1: true
		});
	}

	public run(): void {
		const oldValue = TabFocus.getTabFocusMode();
		const newValue = !oldValue;
		TabFocus.setTabFocusMode(newValue);
		if (newValue) {
			alert(nls.localize('toggle.tabMovesFocus.on', "Tab 键将移动到下一可聚焦的元素"));
		} else {
			alert(nls.localize('toggle.tabMovesFocus.off', "Tab 键将插入制表符"));
		}
	}
}

registerAction2(ToggleTabFocusModeAction);
