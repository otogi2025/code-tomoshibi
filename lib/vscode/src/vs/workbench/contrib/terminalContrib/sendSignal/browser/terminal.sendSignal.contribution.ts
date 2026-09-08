/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isWindows } from '../../../../../base/common/platform.js';
import { isObject, isString } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IQuickInputService, type QuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';

export const enum TerminalSendSignalCommandId {
	SendSignal = 'workbench.action.terminal.sendSignal',
}

function toOptionalString(obj: unknown): string | undefined {
	return isString(obj) ? obj : undefined;
}

const sendSignalString = localize2('sendSignal', "发送信号");
registerTerminalAction({
	id: TerminalSendSignalCommandId.SendSignal,
	title: sendSignalString,
	f1: !isWindows,
	metadata: {
		description: sendSignalString.value,
		args: [{
			name: 'args',
			schema: {
				type: 'object',
				required: ['signal'],
				properties: {
					signal: {
						description: localize('sendSignal.signal.desc', "要发送到终端进程的信号(例如，'SIGTERM'、'SIGINT'、'SIGKILL')"),
						type: 'string'
					}
				},
			}
		}]
	},
	run: async (c, accessor, args) => {
		const quickInputService = accessor.get(IQuickInputService);
		const instance = c.service.activeInstance;
		if (!instance) {
			return;
		}

		function isSignalArg(obj: unknown): obj is { signal: string } {
			return isObject(obj) && 'signal' in obj;
		}
		let signal = isSignalArg(args) ? toOptionalString(args.signal) : undefined;

		if (!signal) {
			const signalOptions: QuickPickItem[] = [
				{ label: 'SIGINT', description: localize('SIGINT', '中断进程(Ctrl+C)') },
				{ label: 'SIGTERM', description: localize('SIGTERM', '正常终止进程') },
				{ label: 'SIGKILL', description: localize('SIGKILL', '强制终止进程') },
				{ label: 'SIGSTOP', description: localize('SIGSTOP', '停止进程') },
				{ label: 'SIGCONT', description: localize('SIGCONT', '继续进程') },
				{ label: 'SIGHUP', description: localize('SIGHUP', '挂起') },
				{ label: 'SIGQUIT', description: localize('SIGQUIT', '退出进程') },
				{ label: 'SIGUSR1', description: localize('SIGUSR1', '用户定义的信号 1') },
				{ label: 'SIGUSR2', description: localize('SIGUSR2', '用户定义的信号 2') },
				{ type: 'separator' },
				{ label: localize('manualSignal', '手动输入信号') }
			];

			const selected = await quickInputService.pick(signalOptions, {
				placeHolder: localize('selectSignal', '选择要发送到终端进程的信号')
			});

			if (!selected) {
				return;
			}

			if (selected.label === localize('manualSignal', '手动输入信号')) {
				const inputSignal = await quickInputService.input({
					prompt: localize('enterSignal', '输入信号名称(例如，SIGTERM、SIGKILL)'),
				});

				if (!inputSignal) {
					return;
				}

				signal = inputSignal;
			} else {
				signal = selected.label;
			}
		}

		await instance.sendSignal(signal);
	}
});
