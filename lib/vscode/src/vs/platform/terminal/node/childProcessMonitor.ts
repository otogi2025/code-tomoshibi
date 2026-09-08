/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import { parse } from '../../../base/common/path.js';
import { debounce, throttle } from '../../../base/common/decorators.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ProcessItem } from '../../../base/common/processes.js';
import { listProcesses } from '../../../base/node/ps.js';
import { ILogService } from '../../log/common/log.js';

const enum Constants {
	/**
	 * The amount of time to throttle checks when the process receives output.
	 */
	InactiveThrottleDuration = 5000,
	/**
	 * The amount of time to debounce check when the process receives input.
	 */
	ActiveDebounceDuration = 1000,
}

export const ignoreProcessNames: string[] = [];

/**
 * Checks whether a process has any (non-ignored) direct child processes without spawning `ps`.
 *
 * On Linux this reads `/proc` directly instead of exec-ing `ps` (which additionally shells out to
 * `cpuUsage.sh` and sleeps for a second) since terminals only need a yes/no answer, not the full
 * process tree with cpu/mem stats. Every other platform keeps using {@link listProcesses}.
 */
export async function hasChildProcesses(pid: number): Promise<boolean> {
	if (process.platform !== 'linux') {
		const processItem = await listProcesses(pid);
		return processContainsNonIgnoredChildren(processItem);
	}

	const childPids = await getLinuxChildPids(pid);
	for (const childPid of childPids) {
		let comm: string;
		try {
			comm = (await fs.readFile(`/proc/${childPid}/comm`, 'utf8')).trim();
		} catch {
			// The child may have exited between listing it and reading its name, skip it.
			continue;
		}
		if (ignoreProcessNames.indexOf(comm) === -1) {
			return true;
		}
	}
	return false;
}

/**
 * Gets the direct child pids of `pid` on Linux via `/proc/<pid>/task/<pid>/children`. Falls back to
 * scanning `/proc/*\/stat` for a matching `PPid` when the kernel doesn't expose `children` (requires
 * `CONFIG_PROC_CHILDREN`), matching the "direct children only" semantics {@link listProcesses} used.
 */
async function getLinuxChildPids(pid: number): Promise<number[]> {
	try {
		const childrenRaw = await fs.readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
		return childrenRaw.trim().split(/\s+/).filter(e => e.length > 0).map(e => parseInt(e, 10));
	} catch {
		return getLinuxChildPidsFallback(pid);
	}
}

async function getLinuxChildPidsFallback(pid: number): Promise<number[]> {
	const children: number[] = [];
	let entries: string[];
	try {
		entries = await fs.readdir('/proc');
	} catch {
		return children;
	}
	for (const entry of entries) {
		if (!/^[0-9]+$/.test(entry)) {
			continue;
		}
		try {
			const stat = await fs.readFile(`/proc/${entry}/stat`, 'utf8');
			// Format: `pid (comm) state ppid ...`. `comm` can itself contain spaces/parens, so
			// locate the last `)` and parse the fixed-position fields after it.
			const closeParenIndex = stat.lastIndexOf(')');
			if (closeParenIndex === -1) {
				continue;
			}
			const fields = stat.substring(closeParenIndex + 2).split(' ');
			const ppid = parseInt(fields[1], 10);
			if (ppid === pid) {
				children.push(parseInt(entry, 10));
			}
		} catch {
			// The process may have exited between readdir and read, skip it.
			continue;
		}
	}
	return children;
}

function processContainsNonIgnoredChildren(processItem: ProcessItem): boolean {
	// No child processes
	if (!processItem.children) {
		return false;
	}

	// A single child process, handle special cases
	if (processItem.children.length === 1) {
		const item = processItem.children[0];
		let cmd: string;
		if (item.cmd.startsWith(`"`)) {
			cmd = item.cmd.substring(1, item.cmd.indexOf(`"`, 1));
		} else {
			const spaceIndex = item.cmd.indexOf(` `);
			if (spaceIndex === -1) {
				cmd = item.cmd;
			} else {
				cmd = item.cmd.substring(0, spaceIndex);
			}
		}
		return ignoreProcessNames.indexOf(parse(cmd).name) === -1;
	}

	// Fallback, count child processes
	return processItem.children.length > 0;
}

/**
 * Monitors a process for child processes, checking at differing times depending on input and output
 * calls into the monitor.
 */
export class ChildProcessMonitor extends Disposable {
	private _hasChildProcesses: boolean = false;
	private set hasChildProcesses(value: boolean) {
		if (this._hasChildProcesses !== value) {
			this._hasChildProcesses = value;
			this._logService.debug('ChildProcessMonitor: Has child processes changed', value);
			this._onDidChangeHasChildProcesses.fire(value);
		}
	}
	/**
	 * Whether the process has child processes.
	 */
	get hasChildProcesses(): boolean { return this._hasChildProcesses; }

	private readonly _onDidChangeHasChildProcesses = this._register(new Emitter<boolean>());
	/**
	 * An event that fires when whether the process has child processes changes.
	 */
	readonly onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;

	constructor(
		private _pid: number,
		@ILogService private readonly _logService: ILogService
	) {
		super();
	}

	/**
	 * Updates the pid to monitor. This is needed when the pid is not available
	 * immediately after spawn (e.g. node-pty deferred conpty connection).
	 */
	setPid(pid: number): void {
		this._pid = pid;
	}

	/**
	 * Input was triggered on the process.
	 */
	handleInput() {
		this._refreshActive();
	}

	/**
	 * Output was triggered on the process.
	 */
	handleOutput() {
		this._refreshInactive();
	}

	@debounce(Constants.ActiveDebounceDuration)
	private async _refreshActive(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		try {
			this.hasChildProcesses = await hasChildProcesses(this._pid);
		} catch (e) {
			this._logService.debug('ChildProcessMonitor: Fetching process tree failed', e);
		}
	}

	@throttle(Constants.InactiveThrottleDuration)
	private _refreshInactive(): void {
		this._refreshActive();
	}
}
