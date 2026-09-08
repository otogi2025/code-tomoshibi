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
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, ILogEntry, IOutputChannel, IOutputChannelDescriptor, IOutputChannelRegistry, IOutputService, IOutputViewFilters } from '../common/output.js';

/**
 * tomoshibi: the OUTPUT panel is removed from codet, but `IOutputService` is still injected by
 * ~20 call sites (tasks, logs, telemetry, chat, sessions). Deleting the implementation without a
 * replacement makes every one of those throw `[UNKNOWN service outputService]` at startup.
 *
 * This stub keeps those call sites alive. Channels can still be registered — the registry lives in
 * `../common/output.ts` and is untouched — their content is simply discarded instead of rendered.
 */

class NoOpOutputChannel implements IOutputChannel {

	readonly label: string;
	readonly uri: URI;

	constructor(readonly id: string) {
		this.label = id;
		this.uri = URI.from({ scheme: Schemas.outputChannel, path: id });
	}

	getLogEntries(): readonly ILogEntry[] {
		return [];
	}

	append(_output: string): void {
		// discarded: no output view to render into
	}

	clear(): void {
		// discarded
	}

	replace(_output: string): void {
		// discarded
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
	private readonly channels = new Map<string, IOutputChannel>();

	/**
	 * Descriptor lookups are forwarded to the real registry, which is still alive. This keeps
	 * `!descriptor` checks in callers honest instead of always reporting "channel missing".
	 */
	private get registry(): IOutputChannelRegistry {
		return Registry.as<IOutputChannelRegistry>(Extensions.OutputChannels);
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

	getChannelDescriptors(): IOutputChannelDescriptor[] {
		return this.registry.getChannels();
	}

	getActiveChannel(): IOutputChannel | undefined {
		return undefined;
	}

	async showChannel(_id: string, _preserveFocus?: boolean): Promise<void> {
		// No output view to reveal. Must not throw: callers await this on task failure paths.
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
