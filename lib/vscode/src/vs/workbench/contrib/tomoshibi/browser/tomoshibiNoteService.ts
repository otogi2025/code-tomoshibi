/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType, onDidRegisterWindow } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';

export interface INote {
	readonly id: string;
	text: string;
	updatedAt: number;
}

export const ITomoshibiNoteService = createDecorator<ITomoshibiNoteService>('tomoshibiNoteService');

export interface ITomoshibiNoteService {

	readonly _serviceBrand: undefined;

	/** Resolves once the first read has settled, whichever tier it came from. */
	readonly whenReady: Promise<void>;

	readonly notes: readonly INote[];

	/**
	 * Fires when the set of notes changes (added, removed, reloaded). It deliberately does NOT
	 * fire while text is being edited: the view rebuilds its DOM on this event, and rebuilding a
	 * textarea under the caret would drop the caret on every keystroke.
	 */
	readonly onDidChange: Event<void>;

	/** True when the notes live in a file on the server, false when they are device local. */
	readonly syncedToServer: boolean;

	/**
	 * The message of the most recent failed write, cleared by the next write that succeeds. A read
	 * failure has `readOnlyReason` and shows up in the view; a write failure used to be a line in
	 * the log and nothing else, while the title kept claiming the notes were on the server.
	 */
	readonly syncError: string | undefined;

	/**
	 * Fires when `syncError` changes. It is separate from `onDidChange` on purpose: that one makes
	 * the view rebuild every textarea, which would drop the caret in the middle of a sentence.
	 */
	readonly onDidChangeSyncState: Event<void>;

	/**
	 * Set when the notes could not be read for any reason other than "the file is not there yet".
	 * While it is set the service refuses to write, so a transient read failure can never blank
	 * the file out.
	 */
	readonly readOnlyReason: string | undefined;

	add(text?: string): string;
	update(id: string, text: string): void;
	remove(id: string): void;
}

const STORAGE_KEY = 'tomoshibi.notes.v1';
const SYNC_CONFIG_KEY = 'tomoshibi.notes.syncToServer';

/** Registered by the settings page, not here. */
const DEFAULT_SYNC_TO_SERVER = true;

const SAVE_DEBOUNCE_MS = 800;

interface IStoredNotes {
	readonly version: 1;
	readonly notes: INote[];
}

export class TomoshibiNoteService extends Disposable implements ITomoshibiNoteService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private readonly _onDidChangeSyncState = this._register(new Emitter<void>());
	readonly onDidChangeSyncState = this._onDidChangeSyncState.event;

	private _notes: INote[] = [];
	private _resource: URI | undefined;
	private _readOnlyReason: string | undefined;
	private _syncError: string | undefined;
	private readonly _saveScheduler: RunOnceScheduler;
	private readonly _whenReady: Promise<void>;

	/** Guards against two initialisations overlapping when the setting is flipped twice quickly. */
	private _generation = 0;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IStorageService private readonly _storageService: IStorageService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IRemoteAgentService private readonly _remoteAgentService: IRemoteAgentService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		this._saveScheduler = this._register(new RunOnceScheduler(() => void this._flush(), SAVE_DEBOUNCE_MS));
		this._whenReady = this._initialize();

		// The setting used to be read exactly once, at construction. Flipping it then did nothing
		// visible at all: the title kept saying the old thing and new notes kept going to the old
		// place, and only a reload made the notes appear to vanish.
		this._register(this._configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(SYNC_CONFIG_KEY)) {
				void this._reinitialize();
			}
		}));

		// Writing is debounced by 800ms, and on the iPad the tab is very often discarded inside
		// that window: Safari reclaims a backgrounded tab and the timer simply never runs, so the
		// last thing typed is silently lost. Waiting for shutdown is not an option either, because
		// the web lifecycle service does not support an async join (lifecycleService.ts:169-176).
		// Getting the write out while the page is still alive is the only thing that works.
		this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
			disposables.add(addDisposableListener(window.document, 'visibilitychange', () => {
				if (window.document.visibilityState === 'hidden') {
					this._saveScheduler.flush();
				}
			}));
			disposables.add(addDisposableListener(window, EventType.PAGE_HIDE, () => this._saveScheduler.flush()));
		}, { window: mainWindow, disposables: this._store }));
	}

	private async _reinitialize(): Promise<void> {
		// Whatever is still sitting on the debounce belongs to the old target, so it has to land
		// there before the target moves underneath it.
		if (this._saveScheduler.isScheduled()) {
			this._saveScheduler.cancel();
			await this._flush();
		}
		await this._initialize();
	}

	get whenReady(): Promise<void> {
		return this._whenReady;
	}

	get notes(): readonly INote[] {
		return this._notes;
	}

	get syncedToServer(): boolean {
		return !!this._resource;
	}

	get readOnlyReason(): string | undefined {
		return this._readOnlyReason;
	}

	get syncError(): string | undefined {
		return this._syncError;
	}

	private async _initialize(): Promise<void> {
		const generation = ++this._generation;
		const previous = this._notes;
		let resource: URI | undefined;

		const syncToServer = this._configurationService.getValue<boolean>(SYNC_CONFIG_KEY) ?? DEFAULT_SYNC_TO_SERVER;
		if (syncToServer) {
			try {
				const environment = await this._remoteAgentService.getEnvironment();
				if (environment) {
					// Same directory the terminal Session state uses, so everything Code-Tomoshibi
					// keeps per server sits together and fileService creates the parents for us.
					resource = joinPath(environment.globalStorageHome, 'tomoshibi', 'notes.json');
				}
			} catch (error) {
				this._logService.error('[tomoshibi] failed to resolve the remote environment for notes', error);
			}
		}

		const loaded = resource
			? await this._loadFile(resource)
			: { notes: this._reviveNotes(this._storageService.get(STORAGE_KEY, StorageScope.PROFILE)), readOnlyReason: undefined };

		if (generation !== this._generation) {
			// The setting was flipped again while this run was waiting; the later run owns the state.
			return;
		}

		this._resource = resource;
		this._readOnlyReason = loaded.readOnlyReason;
		this._notes = loaded.notes;
		// A failure against the old target says nothing about the new one.
		this._setSyncError(undefined);

		// The two tiers are separate stores, so switching between them would otherwise look like
		// "my notes are gone". Carry them across when the new side is still empty; when it already
		// has notes, leave both sides alone rather than merging blind.
		if (!this._notes.length && previous.length && !this._readOnlyReason) {
			this._notes = previous;
			this._save();
		}

		this._onDidChange.fire();
	}

	private async _loadFile(resource: URI): Promise<{ notes: INote[]; readOnlyReason: string | undefined }> {
		try {
			const content = await this._fileService.readFile(resource);
			return { notes: this._reviveNotes(content.value.toString()), readOnlyReason: undefined };
		} catch (error) {
			if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				// First run against this server: no notes yet, and writing is fine.
				return { notes: [], readOnlyReason: undefined };
			}
			// The file is there but unreadable. Show the reason and never write, because writing
			// now would replace whatever is in the file with an empty list.
			this._logService.error('[tomoshibi] failed to read notes', error);
			return { notes: [], readOnlyReason: error instanceof Error ? error.message : String(error) };
		}
	}

	add(text: string = ''): string {
		const note: INote = { id: generateUuid(), text, updatedAt: Date.now() };
		this._notes.push(note);
		this._save();
		this._onDidChange.fire();
		return note.id;
	}

	update(id: string, text: string): void {
		const note = this._notes.find(candidate => candidate.id === id);
		if (!note || note.text === text) {
			return;
		}
		note.text = text;
		note.updatedAt = Date.now();
		// No event on purpose, see onDidChange.
		this._save();
	}

	remove(id: string): void {
		const index = this._notes.findIndex(note => note.id === id);
		if (index === -1) {
			return;
		}
		this._notes.splice(index, 1);
		this._save();
		this._onDidChange.fire();
	}

	private _save(): void {
		if (this._readOnlyReason) {
			return;
		}
		this._saveScheduler.schedule();
	}

	private async _flush(): Promise<void> {
		if (this._readOnlyReason) {
			return;
		}
		const stored: IStoredNotes = { version: 1, notes: this._notes };
		const serialized = JSON.stringify(stored, undefined, '\t');
		if (!this._resource) {
			this._storageService.store(STORAGE_KEY, serialized, StorageScope.PROFILE, StorageTarget.USER);
			this._setSyncError(undefined);
			return;
		}
		try {
			await this._fileService.writeFile(this._resource, VSBuffer.fromString(serialized));
			this._setSyncError(undefined);
		} catch (error) {
			// Every write carries the whole list, so a one off failure heals itself on the next
			// edit. A failure that persists (disk full, permissions, a broken provider) does not,
			// and the view has to stop claiming everything is on the server.
			this._logService.error('[tomoshibi] failed to persist notes', error);
			this._setSyncError(error instanceof Error ? error.message : String(error));
		}
	}

	private _setSyncError(message: string | undefined): void {
		if (this._syncError === message) {
			return;
		}
		this._syncError = message;
		this._onDidChangeSyncState.fire();
	}

	private _reviveNotes(raw: string | undefined): INote[] {
		if (!raw) {
			return [];
		}
		try {
			const parsed = JSON.parse(raw) as IStoredNotes;
			if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.notes)) {
				return [];
			}
			return parsed.notes
				.filter((note): note is INote => !!note && typeof note.id === 'string' && typeof note.text === 'string')
				.map(note => ({ id: note.id, text: note.text, updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now() }));
		} catch (error) {
			this._logService.error('[tomoshibi] failed to parse notes', error);
			return [];
		}
	}
}

registerSingleton(ITomoshibiNoteService, TomoshibiNoteService, InstantiationType.Delayed);
