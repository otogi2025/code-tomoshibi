/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { safeStringify } from '../../../../base/common/objects.js';
import * as nls from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';

type RunnableCommand = string | { command: string; args: any[] };

type CommandArgs = {
	commands: RunnableCommand[];
};

/** Runs several commands passed to it as an argument */
class RunCommands extends Action2 {

	constructor() {
		super({
			id: 'runCommands',
			title: nls.localize2('runCommands', "运行命令"),
			f1: false,
			metadata: {
				description: nls.localize('runCommands.description', "运行多个命令"),
				args: [
					{
						name: 'args',
						schema: {
							type: 'object',
							required: ['commands'],
							properties: {
								commands: {
									type: 'array',
									description: nls.localize('runCommands.commands', "要运行的命令"),
									items: {
										anyOf: [
											{
												$ref: 'vscode://schemas/keybindings#/definitions/commandNames'
											},
											{
												type: 'string',
											},
											{
												type: 'object',
												required: ['command'],
												properties: {
													command: {
														'anyOf': [
															{
																$ref: 'vscode://schemas/keybindings#/definitions/commandNames'
															},
															{
																type: 'string'
															},
														]
													}
												},
												$ref: 'vscode://schemas/keybindings#/definitions/commandsSchemas'
											}
										]
									}
								}
							}
						}
					}
				]
			}
		});
	}

	// dev decisions:
	// - this command takes a single argument-object because
	//	- keybinding definitions don't allow running commands with several arguments
	//  - and we want to be able to take on different other arguments in future, e.g., `runMode : 'serial' | 'concurrent'`
	async run(accessor: ServicesAccessor, args: unknown) {

		const notificationService = accessor.get(INotificationService);

		if (!this._isCommandArgs(args)) {
			notificationService.error(nls.localize('runCommands.invalidArgs', "\"runCommands\" 收到类型错误的参数。请查看传递给该命令的参数。"));
			return;
		}

		if (args.commands.length === 0) {
			notificationService.warn(nls.localize('runCommands.noCommandsToRun', "\"runCommands\" 尚未收到要运行的命令。忘记在 \"runCommands\" 参数中传递命令了吗?"));
			return;
		}

		const commandService = accessor.get(ICommandService);
		const logService = accessor.get(ILogService);

		let i = 0;
		try {
			for (; i < args.commands.length; ++i) {

				const cmd = args.commands[i];

				logService.debug(`runCommands: executing ${i}-th command: ${safeStringify(cmd)}`);

				await this._runCommand(commandService, cmd);

				logService.debug(`runCommands: executed ${i}-th command`);
			}
		} catch (err) {
			logService.debug(`runCommands: executing ${i}-th command resulted in an error: ${err instanceof Error ? err.message : safeStringify(err)}`);

			notificationService.error(err);
		}
	}

	private _isCommandArgs(args: unknown): args is CommandArgs {
		if (!args || typeof args !== 'object') {
			return false;
		}
		if (!('commands' in args) || !Array.isArray(args.commands)) {
			return false;
		}
		for (const cmd of args.commands) {
			if (typeof cmd === 'string') {
				continue;
			}
			if (typeof cmd === 'object' && typeof cmd.command === 'string') {
				continue;
			}
			return false;
		}
		return true;
	}

	private _runCommand(commandService: ICommandService, cmd: RunnableCommand) {
		let commandID: string, commandArgs;

		if (typeof cmd === 'string') {
			commandID = cmd;
		} else {
			commandID = cmd.command;
			commandArgs = cmd.args;
		}

		if (commandArgs === undefined) {
			return commandService.executeCommand(commandID);
		} else {
			if (Array.isArray(commandArgs)) {
				return commandService.executeCommand(commandID, ...commandArgs);
			} else {
				return commandService.executeCommand(commandID, commandArgs);
			}
		}
	}
}

registerAction2(RunCommands);
