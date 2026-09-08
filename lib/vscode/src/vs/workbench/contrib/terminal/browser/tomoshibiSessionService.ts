/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as dom from '../../../../base/browser/dom.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import * as nls from '../../../../nls.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { ITerminalInstance, ITerminalService } from './terminal.js';

/**
 * A Session group is a first-class entity: it owns an identity, a name and a color, and it
 * survives having no members at all. Sessions only ever reference a group by id.
 */
export interface ITomoshibiSessionGroup {
	readonly id: string;
	name: string;
	color: string;
	collapsed: boolean;
}

export interface ITomoshibiSessionEntry {
	/** Id of the owning {@link ITomoshibiSessionGroup}, if any. */
	group?: string;
	/** User supplied Session name, overriding the process/OSC title. */
	title?: string;
	pinned?: boolean;
}

export interface ITomoshibiSessionModel {
	version: 2;
	/** Ordered; the strip and the tree render groups in this order. */
	groups: ITomoshibiSessionGroup[];
	sessions: { [sessionKey: string]: ITomoshibiSessionEntry };
}

/**
 * `waiting` is produced by the tomoshibiActivity terminal contribution, which watches the
 * screen for an agent question and calls {@link ITomoshibiSessionService.setWaiting}.
 */
export type TomoshibiSessionActivity = 'running' | 'waiting' | 'error' | 'done';

export const ITomoshibiSessionService = createDecorator<ITomoshibiSessionService>('tomoshibiSessionService');

export interface ITomoshibiSessionService {
	readonly _serviceBrand: undefined;

	/** Fires whenever the persisted model changes, from this window or from another one. */
	readonly onDidChange: Event<void>;
	/** Fires with the instance id whose activity state changed. */
	readonly onDidChangeActivity: Event<number>;

	readonly groups: readonly ITomoshibiSessionGroup[];

	/**
	 * The stable key a Session's metadata is filed under. Also performs the pty-reconnect key
	 * migration, so it must be called with a live instance rather than recomputed by callers.
	 */
	sessionKey(instance: ITerminalInstance): string;

	getTitle(instance: ITerminalInstance): string | undefined;
	setTitle(instance: ITerminalInstance, title: string | undefined): void;

	getGroupOf(instance: ITerminalInstance): ITomoshibiSessionGroup | undefined;
	setGroupOf(instance: ITerminalInstance, groupId: string | undefined): void;

	isPinned(instance: ITerminalInstance): boolean;
	setPinned(instance: ITerminalInstance, pinned: boolean): void;

	/** Drops every piece of metadata for a Session that is being closed for good. */
	forget(instance: ITerminalInstance): void;

	getGroupById(groupId: string): ITomoshibiSessionGroup | undefined;
	createGroup(name: string): ITomoshibiSessionGroup;
	renameGroup(groupId: string, name: string): void;
	deleteGroup(groupId: string): void;
	setCollapsed(groupId: string, collapsed: boolean): void;

	getActivity(instanceId: number): TomoshibiSessionActivity | undefined;

	/**
	 * Marks the Session filed under `key` as waiting for the user. Only ever downgrades a
	 * `running` Session to `waiting`; it is dropped again as soon as the Session stops running.
	 */
	setWaiting(key: string, waiting: boolean): void;
}

/** The first two are the shell's subtitle orange and university purple. */
export const TOMOSHIBI_SESSION_GROUP_COLORS: readonly string[] = ['#f2a154', '#b48cff', '#5fd38d', '#4da3ff', '#ff7a7a', '#ffd166'];

const MIRROR_STORAGE_KEY = 'tomoshibi.terminal.sessions.v2';
const V1_GROUPS_STORAGE_KEY = 'tomoshibi.terminal.sessionGroups.v1';
const V1_TITLES_STORAGE_KEY = 'tomoshibi.terminal.sessionTitles.v1';
const V1_PINNED_STORAGE_KEY = 'tomoshibi.terminal.pinnedSessions.v1';
const SAVE_DEBOUNCE_MS = 300;
const ACTIVITY_IDLE_MS = 12000;
/** Coalesce window for the activity sniffer: a screen-repaint storm runs the regex once per
 * window instead of once per data chunk. This is a throttle, not a debounce — see `_queueActivity`. */
const ACTIVITY_COALESCE_MS = 150;

function createEmptyModel(): ITomoshibiSessionModel {
	return { version: 2, groups: [], sessions: {} };
}

function reviveModel(raw: string | undefined): ITomoshibiSessionModel | undefined {
	if (!raw) {
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (!parsed || typeof parsed !== 'object') {
		return undefined;
	}
	const candidate = parsed as Partial<ITomoshibiSessionModel>;
	if (candidate.version !== 2) {
		return undefined;
	}
	const model = createEmptyModel();
	const seenIds = new Set<string>();
	for (const group of Array.isArray(candidate.groups) ? candidate.groups : []) {
		if (!group || typeof group.id !== 'string' || !group.id || seenIds.has(group.id)) {
			continue;
		}
		seenIds.add(group.id);
		model.groups.push({
			id: group.id,
			name: typeof group.name === 'string' ? group.name : group.id,
			color: typeof group.color === 'string' && group.color ? group.color : TOMOSHIBI_SESSION_GROUP_COLORS[(model.groups.length) % TOMOSHIBI_SESSION_GROUP_COLORS.length],
			collapsed: group.collapsed === true,
		});
	}
	const sessions = candidate.sessions && typeof candidate.sessions === 'object' ? candidate.sessions : {};
	for (const [key, value] of Object.entries(sessions)) {
		if (!value || typeof value !== 'object') {
			continue;
		}
		const entry: ITomoshibiSessionEntry = {};
		const source = value as ITomoshibiSessionEntry;
		if (typeof source.group === 'string' && seenIds.has(source.group)) {
			entry.group = source.group;
		}
		if (typeof source.title === 'string' && source.title.trim()) {
			entry.title = source.title.trim();
		}
		if (source.pinned === true) {
			entry.pinned = true;
		}
		if (entry.group || entry.title || entry.pinned) {
			model.sessions[key] = entry;
		}
	}
	return model;
}

export class TomoshibiSessionService extends Disposable implements ITomoshibiSessionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _onDidChangeActivity = this._register(new Emitter<number>());
	readonly onDidChangeActivity: Event<number> = this._onDidChangeActivity.event;

	private _model: ITomoshibiSessionModel;
	private readonly _resource: URI;
	private readonly _saveScheduler: RunOnceScheduler;
	private readonly _storageListeners = this._register(new DisposableStore());

	/** Raw JSON last pushed into the storage mirror, used to ignore our own change events. */
	private _lastMirrorValue: string | undefined;
	/** Cleared once the server file has been read (or created); blocks writes on a read failure. */
	private _fileWritable = false;
	private _localChangeBeforeLoad = false;

	private readonly _sessionKeysByInstanceId = new Map<number, string>();
	private readonly _activityStates = new Map<number, { running: boolean; agentIdle: boolean; tail: string }>();
	private readonly _activityTimers = new Map<number, ReturnType<typeof setTimeout>>();
	/** Session keys whose agent is currently asking the user something. */
	private readonly _waitingKeys = new Set<string>();
	/** Raw data chunks accumulated per instance while a coalesce window is open. */
	private readonly _pendingActivityData = new Map<number, string>();
	/** The 150ms coalesce-window timer per instance; see `_queueActivity`. */
	private readonly _activityFlushTimers = new Map<number, ReturnType<typeof setTimeout>>();

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IStorageService private readonly _storageService: IStorageService,
		@IUserDataProfileService userDataProfileService: IUserDataProfileService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
	) {
		super();

		this._resource = joinPath(userDataProfileService.currentProfile.globalStorageHome, 'tomoshibi', 'sessions.json');
		// The storage mirror is device local (PROFILE lives in the browser's IndexedDB), so it can
		// only be trusted to paint the very first frame. The server file is the source of truth.
		this._lastMirrorValue = this._storageService.get(MIRROR_STORAGE_KEY, StorageScope.PROFILE);
		this._model = reviveModel(this._lastMirrorValue) ?? createEmptyModel();

		this._saveScheduler = this._register(new RunOnceScheduler(() => void this._writeFile(), SAVE_DEBOUNCE_MS));

		this._storageListeners.add(this._storageService.onDidChangeValue(StorageScope.PROFILE, MIRROR_STORAGE_KEY, this._storageListeners)(() => {
			const raw = this._storageService.get(MIRROR_STORAGE_KEY, StorageScope.PROFILE);
			if (raw === this._lastMirrorValue) {
				return;
			}
			this._lastMirrorValue = raw;
			this._model = reviveModel(raw) ?? this._model;
			this._onDidChange.fire();
		}));

		this._register(this._terminalService.onAnyInstanceData(({ instance, data }) => this._queueActivity(instance, data)));
		this._register(this._terminalService.onDidChangeInstances(() => this._pruneDeadInstances()));
		this._register({
			dispose: () => {
				for (const timer of this._activityTimers.values()) {
					clearTimeout(timer);
				}
				this._activityTimers.clear();
				this._activityStates.clear();
				for (const timer of this._activityFlushTimers.values()) {
					clearTimeout(timer);
				}
				this._activityFlushTimers.clear();
				this._pendingActivityData.clear();
			}
		});

		void this._load();
	}

	//#region persistence

	private async _load(): Promise<void> {
		let loaded: ITomoshibiSessionModel | undefined;
		try {
			const content = await this._fileService.readFile(this._resource);
			loaded = reviveModel(content.value.toString());
			this._fileWritable = true;
		} catch (error) {
			if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				// First run on this server: fold the three v1 keys into the v2 model, persist it,
				// and only then retire the v1 keys.
				const migrated = this._localChangeBeforeLoad ? undefined : this._migrateFromV1();
				this._model = migrated ?? this._model;
				this._fileWritable = true;
				await this._writeFile();
				for (const key of [V1_GROUPS_STORAGE_KEY, V1_TITLES_STORAGE_KEY, V1_PINNED_STORAGE_KEY]) {
					this._storageService.remove(key, StorageScope.PROFILE);
				}
				this._writeMirror();
				this._onDidChange.fire();
				return;
			}
			// The file exists but could not be read. Keep serving the device-local mirror and
			// never write back over a file we failed to understand.
			this._logService.error('[tomoshibi] failed to read terminal session state, falling back to the storage mirror', error);
			this._fileWritable = false;
			return;
		}
		if (this._localChangeBeforeLoad) {
			// A change was made before the read came back. The live model wins; push it out.
			this._saveScheduler.schedule();
			return;
		}
		if (loaded) {
			this._model = loaded;
			this._writeMirror();
			this._onDidChange.fire();
		}
	}

	private _migrateFromV1(): ITomoshibiSessionModel | undefined {
		const groupNames = this._readV1Map(V1_GROUPS_STORAGE_KEY);
		const titles = this._readV1Map(V1_TITLES_STORAGE_KEY);
		const pinned = new Set(this._readV1Array(V1_PINNED_STORAGE_KEY));
		if (!groupNames.size && !titles.size && !pinned.size) {
			return undefined;
		}
		const model = createEmptyModel();
		const groupsByName = new Map<string, ITomoshibiSessionGroup>();
		for (const name of groupNames.values()) {
			if (groupsByName.has(name)) {
				continue;
			}
			const group: ITomoshibiSessionGroup = {
				id: generateUuid(),
				name,
				color: TOMOSHIBI_SESSION_GROUP_COLORS[groupsByName.size % TOMOSHIBI_SESSION_GROUP_COLORS.length],
				collapsed: false,
			};
			groupsByName.set(name, group);
			model.groups.push(group);
		}
		for (const key of new Set([...groupNames.keys(), ...titles.keys(), ...pinned])) {
			const entry: ITomoshibiSessionEntry = {};
			const name = groupNames.get(key);
			const group = name ? groupsByName.get(name) : undefined;
			if (group) {
				entry.group = group.id;
			}
			const title = titles.get(key);
			if (title) {
				entry.title = title;
			}
			if (pinned.has(key)) {
				entry.pinned = true;
			}
			if (entry.group || entry.title || entry.pinned) {
				model.sessions[key] = entry;
			}
		}
		return model;
	}

	private _readV1Map(key: string): Map<string, string> {
		try {
			const value = JSON.parse(this._storageService.get(key, StorageScope.PROFILE, '{}')) as Record<string, unknown>;
			return new Map(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1].trim()));
		} catch {
			return new Map();
		}
	}

	private _readV1Array(key: string): string[] {
		try {
			const value = JSON.parse(this._storageService.get(key, StorageScope.PROFILE, '[]')) as unknown;
			return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
		} catch {
			return [];
		}
	}

	private _writeMirror(): void {
		this._lastMirrorValue = JSON.stringify(this._model);
		this._storageService.store(MIRROR_STORAGE_KEY, this._lastMirrorValue, StorageScope.PROFILE, StorageTarget.USER);
	}

	private async _writeFile(): Promise<void> {
		if (!this._fileWritable) {
			return;
		}
		try {
			await this._fileService.writeFile(this._resource, VSBuffer.fromString(JSON.stringify(this._model, undefined, '\t')));
		} catch (error) {
			this._logService.error('[tomoshibi] failed to persist terminal session state', error);
		}
	}

	private _save(): void {
		if (!this._fileWritable) {
			this._localChangeBeforeLoad = true;
		}
		this._writeMirror();
		this._saveScheduler.schedule();
		this._onDidChange.fire();
	}

	//#endregion

	//#region session keys

	sessionKey(instance: ITerminalInstance): string {
		const key = String(instance.persistentProcessId ?? instance.instanceId);
		const previousKey = this._sessionKeysByInstanceId.get(instance.instanceId);
		this._sessionKeysByInstanceId.set(instance.instanceId, key);
		if (previousKey && previousKey !== key) {
			this._migrateSessionKey(previousKey, key);
		}
		return key;
	}

	/**
	 * A freshly created Session has no persistent process id yet, so it is filed under its
	 * instance id and re-filed once the pty reports back. Metadata must follow.
	 */
	private _migrateSessionKey(previousKey: string, key: string): void {
		const previous = this._model.sessions[previousKey];
		if (!previous) {
			return;
		}
		delete this._model.sessions[previousKey];
		const existing = this._model.sessions[key];
		this._model.sessions[key] = {
			group: existing?.group ?? previous.group,
			title: existing?.title ?? previous.title,
			pinned: existing?.pinned ?? previous.pinned,
		};
		this._save();
	}

	private _entry(instance: ITerminalInstance): ITomoshibiSessionEntry | undefined {
		return this._model.sessions[this.sessionKey(instance)];
	}

	private _updateEntry(instance: ITerminalInstance, update: (entry: ITomoshibiSessionEntry) => void): void {
		const key = this.sessionKey(instance);
		const entry: ITomoshibiSessionEntry = { ...this._model.sessions[key] };
		update(entry);
		if (entry.group === undefined && entry.title === undefined && !entry.pinned) {
			delete this._model.sessions[key];
		} else {
			this._model.sessions[key] = entry;
		}
		this._save();
	}

	//#endregion

	//#region model

	get groups(): readonly ITomoshibiSessionGroup[] {
		return this._model.groups;
	}

	getGroupById(groupId: string): ITomoshibiSessionGroup | undefined {
		return this._model.groups.find(group => group.id === groupId);
	}

	getTitle(instance: ITerminalInstance): string | undefined {
		return this._entry(instance)?.title;
	}

	setTitle(instance: ITerminalInstance, title: string | undefined): void {
		const next = title?.trim() || undefined;
		if (this.getTitle(instance) === next) {
			return;
		}
		this._updateEntry(instance, entry => { entry.title = next; });
	}

	getGroupOf(instance: ITerminalInstance): ITomoshibiSessionGroup | undefined {
		const groupId = this._entry(instance)?.group;
		return groupId ? this.getGroupById(groupId) : undefined;
	}

	setGroupOf(instance: ITerminalInstance, groupId: string | undefined): void {
		const next = groupId && this.getGroupById(groupId) ? groupId : undefined;
		if (this._entry(instance)?.group === next) {
			return;
		}
		this._updateEntry(instance, entry => { entry.group = next; });
	}

	isPinned(instance: ITerminalInstance): boolean {
		return this._entry(instance)?.pinned === true;
	}

	setPinned(instance: ITerminalInstance, pinned: boolean): void {
		if (this.isPinned(instance) === pinned) {
			return;
		}
		this._updateEntry(instance, entry => { entry.pinned = pinned ? true : undefined; });
	}

	forget(instance: ITerminalInstance): void {
		const key = this.sessionKey(instance);
		if (!this._model.sessions[key]) {
			return;
		}
		delete this._model.sessions[key];
		this._save();
	}

	createGroup(name: string): ITomoshibiSessionGroup {
		const group: ITomoshibiSessionGroup = {
			id: generateUuid(),
			name,
			color: TOMOSHIBI_SESSION_GROUP_COLORS[this._model.groups.length % TOMOSHIBI_SESSION_GROUP_COLORS.length],
			collapsed: false,
		};
		this._model.groups.push(group);
		this._save();
		return group;
	}

	renameGroup(groupId: string, name: string): void {
		const group = this.getGroupById(groupId);
		if (!group || !name.trim() || group.name === name.trim()) {
			return;
		}
		group.name = name.trim();
		this._save();
	}

	deleteGroup(groupId: string): void {
		const index = this._model.groups.findIndex(group => group.id === groupId);
		if (index === -1) {
			return;
		}
		this._model.groups.splice(index, 1);
		for (const [key, entry] of Object.entries(this._model.sessions)) {
			if (entry.group !== groupId) {
				continue;
			}
			// Members of a deleted group fall back to being ungrouped, they are never closed.
			if (entry.title === undefined && !entry.pinned) {
				delete this._model.sessions[key];
			} else {
				this._model.sessions[key] = { title: entry.title, pinned: entry.pinned };
			}
		}
		this._save();
	}

	setCollapsed(groupId: string, collapsed: boolean): void {
		const group = this.getGroupById(groupId);
		if (!group || group.collapsed === collapsed) {
			return;
		}
		group.collapsed = collapsed;
		this._save();
	}

	//#endregion

	//#region activity

	getActivity(instanceId: number): TomoshibiSessionActivity | undefined {
		const instance = this._terminalService.getInstanceFromId(instanceId);
		if (!instance) {
			return undefined;
		}
		const primaryStatus = instance.statusList.primary;
		// The key is read from the cache rather than through `sessionKey()`, which has the
		// pty-reconnect migration as a side effect and must not run from a render path.
		const key = this._sessionKeysByInstanceId.get(instanceId);
		// A warning-level terminal status is commonly just Shell Integration setup and must not
		// paint every healthy Session yellow. Only a dead process or a real error counts.
		if (instance.exitReason !== undefined || (!!primaryStatus && primaryStatus.severity >= Severity.Error)) {
			if (key) {
				this._waitingKeys.delete(key);
			}
			return 'error';
		}
		// An open question is quiet by nature: the agent paints its prompt and then stops
		// writing, which is exactly what the 12s idle timer files under "done". So the waiting
		// flag outranks the running gate. It is cleared by user input, by the next evaluation
		// that no longer sees a prompt, by exit/error above and by the contribution's dispose
		// (see terminalContrib/tomoshibiActivity).
		if (key && this._waitingKeys.has(key)) {
			return 'waiting';
		}
		return this._activityStates.get(instanceId)?.running ? 'running' : 'done';
	}

	setWaiting(key: string, waiting: boolean): void {
		if (waiting === this._waitingKeys.has(key)) {
			return;
		}
		if (waiting) {
			this._waitingKeys.add(key);
		} else {
			this._waitingKeys.delete(key);
		}
		for (const [instanceId, sessionKey] of this._sessionKeysByInstanceId) {
			if (sessionKey === key) {
				this._onDidChangeActivity.fire(instanceId);
			}
		}
	}

	/**
	 * Throttles the activity sniffer to once per {@link ACTIVITY_COALESCE_MS}: a screen-repaint
	 * storm (e.g. a progress bar) fires `onAnyInstanceData` many times a second, and running the
	 * regex-based sniff on every single chunk is wasted work. Every chunk is appended to a
	 * per-instance buffer, losslessly, in arrival order; only the first chunk of an idle instance
	 * opens a window (`setTimeout`). Chunks that arrive while the window is open just extend the
	 * buffer and do not reschedule it — this is a throttle, not a debounce, so a terminal that
	 * never stops writing still gets sniffed every 150ms rather than being starved indefinitely.
	 * When the window elapses the whole buffered text is handed to the original `_recordActivity`
	 * in one call, which reproduces exactly what running it chunk-by-chunk would have observed
	 * (its ANSI stripping and tail slicing already tolerate arbitrary chunk boundaries).
	 */
	private _queueActivity(instance: ITerminalInstance, data: string): void {
		const instanceId = instance.instanceId;
		this._pendingActivityData.set(instanceId, (this._pendingActivityData.get(instanceId) ?? '') + data);
		if (this._activityFlushTimers.has(instanceId)) {
			return;
		}
		this._activityFlushTimers.set(instanceId, setTimeout(() => {
			this._activityFlushTimers.delete(instanceId);
			const buffered = this._pendingActivityData.get(instanceId);
			this._pendingActivityData.delete(instanceId);
			if (buffered) {
				this._recordActivity(instance, buffered);
			}
		}, ACTIVITY_COALESCE_MS));
	}

	private _recordActivity(instance: ITerminalInstance, data: string): void {
		const instanceId = instance.instanceId;
		const state = this._activityStates.get(instanceId) ?? { running: false, agentIdle: false, tail: '' };
		const wasRunning = state.running;
		const visible = String(data ?? '')
			.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
			.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '');
		if (!visible.trim()) {
			return;
		}
		state.tail = (state.tail + visible).slice(-2400);
		const lower = state.tail.toLowerCase();
		const completeAt = Math.max(
			lower.lastIndexOf('ask codex to do anything'),
			lower.lastIndexOf('worked for'),
			state.tail.lastIndexOf('\n❯'),
			state.tail.lastIndexOf('\r❯'),
		);
		const runningAt = Math.max(
			lower.lastIndexOf('working'),
			lower.lastIndexOf('esc to interrupt'),
			lower.lastIndexOf('thinking'),
		);
		state.agentIdle = completeAt >= 0 && completeAt > runningAt;
		state.running = !state.agentIdle;
		this._activityStates.set(instanceId, state);
		if (wasRunning && state.agentIdle) {
			this._notifyAgentComplete(instance);
		}
		const oldTimer = this._activityTimers.get(instanceId);
		if (oldTimer) {
			clearTimeout(oldTimer);
		}
		this._activityTimers.set(instanceId, setTimeout(() => {
			this._activityTimers.delete(instanceId);
			const current = this._activityStates.get(instanceId);
			if (current?.running) {
				current.running = false;
				this._onDidChangeActivity.fire(instanceId);
			}
		}, ACTIVITY_IDLE_MS));
		if (wasRunning !== state.running) {
			this._onDidChangeActivity.fire(instanceId);
		}
	}

	private _notifyAgentComplete(instance: ITerminalInstance): void {
		const title = this.getTitle(instance) || instance.title;
		const message = nls.localize('tomoshibi.agent.complete', "{0} 已完成", title);
		this._notificationService.info(message);

		const targetWindow = dom.getActiveWindow();
		if (targetWindow.document.visibilityState === 'hidden' && targetWindow.Notification?.permission === 'granted') {
			new targetWindow.Notification('Code-Tomoshibi', { body: message, tag: `tomoshibi-terminal-${instance.instanceId}` });
		}
	}

	private _pruneDeadInstances(): void {
		const live = new Set(this._terminalService.instances.map(instance => instance.instanceId));
		for (const instanceId of [...this._sessionKeysByInstanceId.keys()]) {
			if (live.has(instanceId)) {
				continue;
			}
			this._sessionKeysByInstanceId.delete(instanceId);
			const timer = this._activityTimers.get(instanceId);
			if (timer) {
				clearTimeout(timer);
			}
			this._activityTimers.delete(instanceId);
			this._activityStates.delete(instanceId);
			const flushTimer = this._activityFlushTimers.get(instanceId);
			if (flushTimer) {
				clearTimeout(flushTimer);
			}
			this._activityFlushTimers.delete(instanceId);
			this._pendingActivityData.delete(instanceId);
		}
	}

	//#endregion
}
