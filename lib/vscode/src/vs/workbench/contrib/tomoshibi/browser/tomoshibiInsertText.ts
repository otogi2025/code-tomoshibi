/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { timeout } from '../../../../base/common/async.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { ITerminalInstance, ITerminalService } from '../../terminal/browser/terminal.js';

/**
 * Puts text into the active Session without running it.
 *
 * This is the single door the clipboard history view and the notes view use to reach the
 * terminal, which is what keeps those two views free of any terminal import.
 */
export const TOMOSHIBI_INSERT_TEXT_COMMAND_ID = 'tomoshibi.insertText';

/** 两次探测 bracketed paste 之间的间隔，以及总的等待上限。 */
const BRACKETED_PASTE_POLL_MS = 100;
const BRACKETED_PASTE_TIMEOUT_MS = 5000;

/**
 * 等 shell 打开 bracketed paste（`\x1b[?2004h`）。xterm 没有为 `modes` 提供事件，只能轮询。
 *
 * ⛔ 别改成「自己给文本包上 `\x1b[200~` / `\x1b[201~`」：shell 没开这个模式时那两个转义串不会被解析，
 * 会原样变成提示符上的垃圾字符，而中间的换行照样被当成回车逐行执行 —— 比不发还糟。
 */
async function waitForBracketedPasteMode(instance: ITerminalInstance): Promise<boolean> {
	const deadline = Date.now() + BRACKETED_PASTE_TIMEOUT_MS;
	while (!instance.isDisposed) {
		if (instance.xterm?.raw.modes.bracketedPasteMode) {
			return true;
		}
		if (Date.now() >= deadline) {
			return false;
		}
		await timeout(BRACKETED_PASTE_POLL_MS);
	}
	return false;
}

CommandsRegistry.registerCommand(TOMOSHIBI_INSERT_TEXT_COMMAND_ID, async (accessor: ServicesAccessor, text: unknown) => {
	if (typeof text !== 'string' || !text.length) {
		return;
	}

	const terminalService = accessor.get(ITerminalService);
	const notificationService = accessor.get(INotificationService);

	// 用 terminalService.activeInstance 而不是 groupService 的：后者是 activeGroup?.activeInstance，
	// 只看底部面板里的终端组。session 被移到编辑器区时它是 undefined，会白开一个新终端；面板里有
	// 一个、编辑器区那个正被聚焦的混合态下，它返回的还是面板里那个，文本会被静默送进另一个 session。
	const instance = terminalService.activeInstance ?? await terminalService.createTerminal({ location: TerminalLocation.Panel });

	// focusInstance 按 instance.target 分流（terminalService.ts:398-407）：面板里的走 showPanel，
	// 编辑器区的走 revealEditor。不能沿用 groupService.setActiveInstance + showPanel —— 对编辑器区的
	// 实例前者会抛「Terminal with ID x does not exist」，后者还会把面板盖到那个终端前面。
	// 先让它露面再等：新建的终端要先有容器才好起 xterm，下面还可能等上几秒，藏着等对用户是黑屏。
	await terminalService.focusInstance(instance);

	// `createTerminal()` 返回时 xterm 还卡在动态 import 里、pty 也还没起来（terminalInstance.ts:615-641），
	// 此刻 `sendText` 里那个同步的 `this.xterm?.raw.modes.bracketedPasteMode` 判断必然为假。
	await instance.xtermReadyPromise;
	await instance.processReady;

	// 单行文本没有「被逐行执行」的风险，pty 起来就可以发。多行文本必须等 shell 真的开了 bracketed paste，
	// 否则 sendText 会把每个 \n 换成 \r，前 N-1 行直接被 shell 执行掉。
	if (/\r|\n/.test(text) && !(await waitForBracketedPasteMode(instance))) {
		notificationService.warn(localize('tomoshibi.insertText.notReady', "终端还没准备好接收多行文本，等它打出提示符之后再插入一次。"));
		return;
	}

	// shouldExecute false so nothing runs on its own, bracketed paste true so a multi line
	// snippet arrives as one paste instead of as one command per line.
	await instance.sendText(text, false, true);
});
