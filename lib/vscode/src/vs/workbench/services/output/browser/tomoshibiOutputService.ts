/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { LogLevel } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, ILogEntry, IOutputChannel, IOutputChannelDescriptor, IOutputChannelRegistry, IOutputService, IOutputViewFilters } from '../common/output.js';

/**
 * tomoshibi: the OUTPUT panel is removed from codet, but `IOutputService` is still injected by
 * ~20 call sites (tasks, logs, telemetry, chat, sessions). Deleting the implementation without a
 * replacement makes every one of those throw `[UNKNOWN service outputService]` at startup.
 *
 * This stub keeps those call sites alive. Channels can still be registered — the registry lives in
 * `../common/output.ts` and is untouched — but there is no view to render them into, so each
 * channel keeps only a short tail of what was appended to it and `showChannel` hands that tail
 * back through a notification.
 */

/** Per channel. A few KB is enough to carry the last error out of a failed task. */
const channelTailLimit = 8 * 1024;

/** How many of the tail's lines a single notification carries; more than this is unreadable. */
const noticeLineLimit = 10;

class NoOpOutputChannel implements IOutputChannel {

	readonly label: string;
	readonly uri: URI;

	private _tail = '';

	constructor(readonly id: string) {
		this.label = id;
		this.uri = URI.from({ scheme: Schemas.outputChannel, path: id });
	}

	getLogEntries(): readonly ILogEntry[] {
		return [];
	}

	append(output: string): void {
		// No view to render into, but throwing all of it away leaves the "show output" button on
		// a failed task with nothing to show. Keep the tail, bounded.
		this._tail = (this._tail + output).slice(-channelTailLimit);
	}

	clear(): void {
		this._tail = '';
	}

	replace(output: string): void {
		this._tail = output.slice(-channelTailLimit);
	}

	/** The last few non-empty lines, which is all a notification has room for. */
	tail(): string {
		return this._tail
			.split('\n')
			.map(line => line.trimEnd())
			.filter(line => line.length > 0)
			.slice(-noticeLineLimit)
			.join(' · ');
	}

	update(): void {
		// discarded
	}

	dispose(): void {
		// nothing to release
	}
}

class NoOpOutputViewFilters implements IOutputViewFilters {

	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange: Event<void> = this._onDidChange.event;

	text = '';
	readonly includePatterns: string[] = [];
	readonly excludePatterns: string[] = [];
	trace = true;
	debug = true;
	info = true;
	warning = true;
	error = true;
	categories = '';

	toggleCategory(_category: string): void {
		// no view to filter
	}

	hasCategory(_category: string): boolean {
		return false;
	}
}

export class TomoshibiOutputService extends Disposable implements IOutputService {

	declare readonly _serviceBrand: undefined;

	readonly filters: IOutputViewFilters = new NoOpOutputViewFilters();

	private readonly _onActiveOutputChannel = this._register(new Emitter<string>());
	readonly onActiveOutputChannel: Event<string> = this._onActiveOutputChannel.event;

	/**
	 * Cached so that repeated `getChannel(id)` calls return the same object — `abstractTaskService`
	 * reads `.id` off the result and compares it across calls.
	 */
	private readonly channels = new Map<string, NoOpOutputChannel>();

	/**
	 * Descriptor lookups are forwarded to the real registry, which is still alive. This keeps
	 * `!descriptor` checks in callers honest instead of always reporting "channel missing".
	 */
	private get registry(): IOutputChannelRegistry {
		return Registry.as<IOutputChannelRegistry>(Extensions.OutputChannels);
	}

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	getChannel(id: string): IOutputChannel | undefined {
		// Never undefined: `abstractTaskService.ts` dereferences this with a non-null assertion.
		let channel = this.channels.get(id);
		if (!channel) {
			channel = new NoOpOutputChannel(id);
			this.channels.set(id, channel);
		}
		return channel;
	}

	getChannelDescriptor(id: string): IOutputChannelDescriptor | undefined {
		return this.registry.getChannel(id);
	}

	/**
	 * Deliberately empty, unlike the single-id lookup above. The two callers of this list turn
	 * every entry into a UI affordance that this build cannot honour: `viewQuickAccess.ts` puts
	 * each channel into the "Open View" picker with `showChannel` as its accept handler, and
	 * `logsActions.ts` builds the log-level picker out of it (that one already filters on
	 * `canSetLogLevel`, which is false here, so it stays empty either way). Everything still
	 * registers channels -- loggers, extensions, tasks -- and every one of those entries would
	 * do nothing when picked.
	 */
	getChannelDescriptors(): IOutputChannelDescriptor[] {
		return [];
	}

	getActiveChannel(): IOutputChannel | undefined {
		return undefined;
	}

	/**
	 * There is no view to reveal, but every caller reaching this point is asking on the user's
	 * behalf -- the "show output" button on the task-failure prompt, the "show task log" command.
	 * Doing nothing silently is what put the failure reason out of reach, so hand back the tail
	 * the channel kept, as a sticky notification (an Info one would time out before it is read).
	 *
	 * Nothing appended, nothing to hand back: log channels write to files rather than through
	 * `append`, so their entries stay silent. Saying so would need a string of our own, and this
	 * folder is not in `build/lib/i18n.resources.json`, so `nls` cannot be imported here.
	 *
	 * Must not throw: callers await this on task failure paths.
	 */
	async showChannel(id: string, _preserveFocus?: boolean): Promise<void> {
		const tail = this.channels.get(id)?.tail();
		if (!tail) {
			return;
		}
		this.notificationService.notify({
			severity: Severity.Info,
			source: this.registry.getChannel(id)?.label ?? id,
			sticky: true,
			message: tail,
		});
	}

	registerCompoundLogChannel(_channels: IOutputChannelDescriptor[]): string {
		return '';
	}

	async saveOutputAs(): Promise<void> {
		// Nothing is buffered, so there is nothing to save.
	}

	canSetLogLevel(_channel: IOutputChannelDescriptor): boolean {
		return false;
	}

	getLogLevel(_channel: IOutputChannelDescriptor): LogLevel | undefined {
		return undefined;
	}

	setLogLevel(_channel: IOutputChannelDescriptor, _logLevel: LogLevel): void {
		// no-op
	}
}

registerSingleton(IOutputService, TomoshibiOutputService, InstantiationType.Delayed);
