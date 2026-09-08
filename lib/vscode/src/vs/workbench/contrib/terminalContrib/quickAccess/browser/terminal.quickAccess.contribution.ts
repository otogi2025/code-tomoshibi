/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../../nls.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from '../../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { getQuickNavigateHandler } from '../../../../browser/quickaccess.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { TerminalQuickAccessProvider } from '../../../terminalContrib/quickAccess/browser/terminalQuickAccess.js';

const enum TerminalQuickAccessCommandId {
	QuickOpenTerm = 'workbench.action.quickOpenTerm',
}

const quickAccessRegistry = (Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess));
const inTerminalsPicker = 'inTerminalPicker';
quickAccessRegistry.registerQuickAccessProvider({
	ctor: TerminalQuickAccessProvider,
	prefix: TerminalQuickAccessProvider.PREFIX,
	contextKey: inTerminalsPicker,
	placeholder: nls.localize('tasksQuickAccessPlaceholder', "键入要打开的终端的名称。"),
	helpEntries: [{ description: nls.localize('tasksQuickAccessHelp', "显示所有已打开的终端"), commandId: TerminalQuickAccessCommandId.QuickOpenTerm }]
});
const quickAccessNavigateNextInTerminalPickerId = 'workbench.action.quickOpenNavigateNextInTerminalPicker';
CommandsRegistry.registerCommand({ id: quickAccessNavigateNextInTerminalPickerId, handler: getQuickNavigateHandler(quickAccessNavigateNextInTerminalPickerId, true) });
const quickAccessNavigatePreviousInTerminalPickerId = 'workbench.action.quickOpenNavigatePreviousInTerminalPicker';
CommandsRegistry.registerCommand({ id: quickAccessNavigatePreviousInTerminalPickerId, handler: getQuickNavigateHandler(quickAccessNavigatePreviousInTerminalPickerId, false) });

registerTerminalAction({
	id: TerminalQuickAccessCommandId.QuickOpenTerm,
	title: nls.localize2('quickAccessTerminal', '切换活动终端'),
	precondition: ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated),
	run: (c, accessor) => accessor.get(IQuickInputService).quickAccess.show(TerminalQuickAccessProvider.PREFIX)
});
