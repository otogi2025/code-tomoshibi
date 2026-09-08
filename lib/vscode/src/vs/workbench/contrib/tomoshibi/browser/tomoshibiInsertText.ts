/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { ITerminalGroupService, ITerminalService } from '../../terminal/browser/terminal.js';

/**
 * Puts text into the active Session without running it.
 *
 * This is the single door the clipboard history view and the notes view use to reach the
 * terminal, which is what keeps those two views free of any terminal import.
 */
export const TOMOSHIBI_INSERT_TEXT_COMMAND_ID = 'tomoshibi.insertText';

CommandsRegistry.registerCommand(TOMOSHIBI_INSERT_TEXT_COMMAND_ID, async (accessor: ServicesAccessor, text: unknown) => {
	if (typeof text !== 'string' || !text.length) {
		return;
	}

	const terminalService = accessor.get(ITerminalService);
	const groupService = accessor.get(ITerminalGroupService);

	const instance = groupService.activeInstance ?? await terminalService.createTerminal({ location: TerminalLocation.Panel });
	groupService.setActiveInstance(instance);

	// shouldExecute false so nothing runs on its own, bracketed paste true so a multi line
	// snippet arrives as one paste instead of as one command per line.
	await instance.sendText(text, false, true);

	await groupService.showPanel(true);
});
