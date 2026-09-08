/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import * as Constants from '../common/constants.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';

//#region Actions
registerAction2(class ShowAllSymbolsAction extends Action2 {

	static readonly ID = 'workbench.action.showAllSymbols';
	static readonly LABEL = nls.localize('showTriggerActions', "转到工作区中的符号...");
	static readonly ALL_SYMBOLS_PREFIX = '#';

	constructor(
	) {
		super({
			id: Constants.SearchCommandIds.ShowAllSymbolsActionId,
			title: {
				...nls.localize2('showTriggerActions', "转到工作区中的符号..."),
				mnemonicTitle: nls.localize({ key: 'miGotoSymbolInWorkspace', comment: ['&& denotes a mnemonic'] }, "转到工作区中的符号(&&W)…"),
			},
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyT
			},
			menu: {
				id: MenuId.MenubarGoMenu,
				group: '3_global_nav',
				order: 2
			}
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(ShowAllSymbolsAction.ALL_SYMBOLS_PREFIX);
	}
});

//#endregion
