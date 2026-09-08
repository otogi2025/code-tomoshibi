/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

	private _notes: INote[] = [];
	private _resource: URI | undefined;
	private _readOnlyReason: string | undefined;
	private readonly _saveScheduler: RunOnceScheduler;
	private readonly _whenReady: Promise<void>;

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

	private async _initialize(): Promise<void> {
		const syncToServer = this._configurationService.getValue<boolean>(SYNC_CONFIG_KEY) ?? DEFAULT_SYNC_TO_SERVER;
		if (syncToServer) {
			try {
				const environment = await this._remoteAgentService.getEnvironment();
				if (environment) {
					// Same directory the terminal Session state uses, so everything Code-Tomoshibi
					// keeps per server sits together and fileService creates the parents for us.
					this._resource = joinPath(environment.globalStorageHome, 'tomoshibi', 'notes.json');
				}
			} catch (error) {
				this._logService.error('[tomoshibi] failed to resolve the remote environment for notes', error);
			}
		}

		if (this._resource) {
			await this._loadFile(this._resource);
		} else {
			this._notes = this._reviveNotes(this._storageService.get(STORAGE_KEY, StorageScope.PROFILE));
		}

		this._onDidChange.fire();
	}

	private async _loadFile(resource: URI): Promise<void> {
		try {
			const content = await this._fileService.readFile(resource);
			this._notes = this._reviveNotes(content.value.toString());
		} catch (error) {
			if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				// First run against this server: no notes yet, and writing is fine.
				this._notes = [];
				return;
			}
			// The file is there but unreadable. Show the reason and never write, because writing
			// now would replace whatever is in the file with an empty list.
			this._logService.error('[tomoshibi] failed to read notes', error);
			this._notes = [];
			this._readOnlyReason = error instanceof Error ? error.message : String(error);
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
			return;
		}
		try {
			await this._fileService.writeFile(this._resource, VSBuffer.fromString(serialized));
		} catch (error) {
			this._logService.error('[tomoshibi] failed to persist notes', error);
		}
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
