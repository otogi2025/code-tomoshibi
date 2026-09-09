/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { Terminal as RawXtermTerminal } from '@xterm/xterm';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ITerminalContribution, IXtermTerminal } from '../../../terminal/browser/terminal.js';
import { registerTerminalContribution, type ITerminalContributionContext } from '../../../terminal/browser/terminalExtensions.js';
import { ITomoshibiSessionService } from '../../../terminal/browser/tomoshibiSessionService.js';
import { TOMOSHIBI_OPTION_LINE } from '../../../terminal/common/tomoshibiActivity.js';

/** Output has to settle for this long before the screen is inspected at all. */
const EVALUATE_DEBOUNCE_MS = 1200;
/** A bare `?`/`:` line only counts as a question once the screen has been this quiet. */
const QUIET_EVALUATE_MS = 5000;
/** How many rows up from the last non-blank row are inspected; see `_readTail`. */
const TAIL_LINE_COUNT = 14;

/** Matched case insensitively against each of the tail lines. */
const QUESTION_NEEDLES: readonly string[] = [
	'do you want to',
	'would you like to',
	'allow this',
	'approve',
	'确认',
	'是否允许',
	'请选择',
	'esc to cancel',
	'enter to confirm',
	'(y/n)',
	'[y/n]',
	'(yes/no)',
	'press enter',
	'continue?',
];

/**
 * Paints a Session yellow while its agent is sitting on a question. The heuristic is purely
 * local: the bottom of the xterm buffer is re-read whenever output stops for a moment, and any
 * fresh output or keystroke drops the flag again. Nothing is read from the agents themselves.
 */
class TomoshibiActivityContribution extends Disposable implements ITerminalContribution {
	static readonly ID = 'terminal.tomoshibiActivity';

	private _xterm: IXtermTerminal & { raw: RawXtermTerminal } | undefined;
	private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private _quietTimer: ReturnType<typeof setTimeout> | undefined;
	/** The key the flag was last filed under, so a pty-reconnect rename cannot strand it. */
	private _waitingKey: string | undefined;

	constructor(
		private readonly _ctx: ITerminalContributionContext,
		@ITomoshibiSessionService private readonly _sessionService: ITomoshibiSessionService,
	) {
		super();
	}

	xtermReady(xterm: IXtermTerminal & { raw: RawXtermTerminal }): void {
		this._xterm = xterm;
		this._register(xterm.raw.onWriteParsed(() => {
			// Anything the process prints answers the previous question by definition.
			this._setWaiting(false);
			this._schedule();
		}));
		// Typing into the terminal is the user answering.
		this._register(xterm.raw.onData(() => this._setWaiting(false)));
	}

	private _schedule(): void {
		this._clearTimers();
		this._debounceTimer = setTimeout(() => {
			this._debounceTimer = undefined;
			this._evaluate(false);
		}, EVALUATE_DEBOUNCE_MS);
		this._quietTimer = setTimeout(() => {
			this._quietTimer = undefined;
			this._evaluate(true);
		}, QUIET_EVALUATE_MS);
	}

	private _clearTimers(): void {
		if (this._debounceTimer !== undefined) {
			clearTimeout(this._debounceTimer);
			this._debounceTimer = undefined;
		}
		if (this._quietTimer !== undefined) {
			clearTimeout(this._quietTimer);
			this._quietTimer = undefined;
		}
	}

	private _evaluate(quiet: boolean): void {
		const xterm = this._xterm;
		if (!xterm) {
			return;
		}
		// A Session that is not running a command is at a shell prompt, which never counts.
		const activity = this._sessionService.getActivity(this._ctx.instance.instanceId);
		if (activity !== 'running' && activity !== 'waiting') {
			this._setWaiting(false);
			return;
		}
		// 硬信号，压在正则前面：没有前台子进程就是停在 shell 提示符上，屏幕上剩的选项行只是上一轮的
		// 回显。`hasChildProcesses` 由 pty 宿主的 childProcessMonitor 读 /proc 喂上来（terminal.ts:890），
		// 不靠猜屏幕内容。正则这边只负责在「确实有东西在跑」的前提下分「在跑」还是「在等」。
		if (!this._ctx.instance.hasChildProcesses) {
			this._setWaiting(false);
			return;
		}
		if (this._isQuestion(this._readTail(xterm.raw), quiet)) {
			this._setWaiting(true);
		}
	}

	private _readTail(raw: RawXtermTerminal): string[] {
		const buffer = raw.buffer.active;
		const lines: string[] = [];
		// `buffer.length` counts every viewport row, including the blank ones below the cursor,
		// so on a tall screen the last N rows are empty while the prompt sits higher up. The
		// tail therefore ends at the last row that has anything on it, starting from the cursor.
		//
		// ⛔ 不能就把尾巴截在光标行：codex 的登录页（光标在第 15 行、「1. Sign in with ChatGPT」在第
		// 19 行、「Press enter to continue」在第 31 行）和 Claude Code 的信任目录确认框（光标停在
		// 「❯ No, exit」，「Enter to confirm · Esc to cancel」在它下面）都把提问画在光标下方，
		// 截在光标行就一个 needle 都命中不了。备用屏幕的全屏 TUI 只是这件事的一个特例。
		const cursorRow = buffer.baseY + buffer.cursorY;
		let end = cursorRow + 1;
		for (let y = buffer.baseY + raw.rows - 1; y > cursorRow; y--) {
			const line = buffer.getLine(y);
			if (line && line.translateToString(true).trim()) {
				end = y + 1;
				break;
			}
		}
		for (let y = Math.max(0, end - TAIL_LINE_COUNT); y < end; y++) {
			const line = buffer.getLine(y);
			if (line) {
				lines.push(line.translateToString(true));
			}
		}
		return lines;
	}

	private _isQuestion(lines: string[], quiet: boolean): boolean {
		for (const line of lines) {
			if (TOMOSHIBI_OPTION_LINE.test(line)) {
				return true;
			}
			const lower = line.toLowerCase();
			for (const needle of QUESTION_NEEDLES) {
				if (lower.includes(needle)) {
					return true;
				}
			}
		}
		if (!quiet) {
			return false;
		}
		// The literal last row is usually blank (the cursor sits below the agent's box), so the
		// trailing punctuation rule is applied to the last row that has anything on it.
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i].trimEnd();
			if (!line) {
				continue;
			}
			return /[?？:]$/.test(line);
		}
		return false;
	}

	private _setWaiting(waiting: boolean): void {
		if (!waiting && this._waitingKey === undefined) {
			return;
		}
		const key = this._sessionService.sessionKey(this._ctx.instance);
		if (this._waitingKey !== undefined && this._waitingKey !== key) {
			this._sessionService.setWaiting(this._waitingKey, false);
		}
		this._waitingKey = waiting ? key : undefined;
		this._sessionService.setWaiting(key, waiting);
	}

	override dispose(): void {
		this._clearTimers();
		if (this._waitingKey !== undefined) {
			this._sessionService.setWaiting(this._waitingKey, false);
			this._waitingKey = undefined;
		}
		super.dispose();
	}
}

registerTerminalContribution(TomoshibiActivityContribution.ID, TomoshibiActivityContribution);
