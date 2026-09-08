/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, onDidRegisterWindow } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, toDisposable, type IDisposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IClipboardHistoryEntry, ITomoshibiClipboardHistoryService } from '../common/tomoshibiClipboardHistory.js';

const STORAGE_KEY = 'tomoshibi.clipboard.v1';

const ENABLED_CONFIG_KEY = 'tomoshibi.clipboard.history.enabled';
const LIMIT_CONFIG_KEY = 'tomoshibi.clipboard.history.limit';

/** The two configuration keys are registered by the settings page, not here. */
const DEFAULT_ENABLED = true;
const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 10;
const MAX_LIMIT = 200;

/** A single entry never grows past this; a pasted log file would otherwise fill the storage. */
const MAX_ENTRY_LENGTH = 8000;

/** And the whole history never grows past this, whatever the entry cap says. */
const MAX_TOTAL_LENGTH = 64000;

/**
 * A terminal drag selection with `copyOnSelection` on rewrites the clipboard on every cell the
 * finger crosses, so one gesture used to leave a staircase of sixteen entries behind. Text that
 * is a prefix of the newest entry (or has it as a prefix) and lands within this window is taken
 * to be the same gesture and replaces that entry instead of adding one.
 */
const DRAG_COLLAPSE_WINDOW_MS = 1500;

/**
 * `k` is a prefix of every string, so a real copy of `k` followed within the window by an
 * unrelated paragraph would be folded away. Requiring the shorter of the two to carry at least
 * this many characters keeps single character copies on the ordinary path; two is enough because
 * the staircase only becomes noise once it has several steps, and its first step is still kept.
 */
const MIN_COLLAPSE_LENGTH = 2;

/**
 * Text matching any of these never enters the history. The history is only device local, but it
 * still survives a reload, and a private key sitting in a sidebar list is one screen share away
 * from being public.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
	/-----BEGIN [A-Z ]*PRIVATE KEY-----/,
	/\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b\s*[:=]/i,
	/\bsk-[A-Za-z0-9]{12,}/,
	// The rules above only catch a secret that is copied together with its name. A token copied on
	// its own out of a .env file matches none of them, so the common shapes get their own line.
	/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/,
	/\bgithub_pat_[A-Za-z0-9_]{20,}/,
	/\bAKIA[0-9A-Z]{16}\b/,
	// A JWT: the first segment always starts with the base64url of `{"`.
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./
];

interface IStoredClipboardHistory {
	readonly version: 1;
	readonly history: IClipboardHistoryEntry[];
}

export class TomoshibiClipboardHistoryService extends Disposable implements ITomoshibiClipboardHistoryService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private _history: IClipboardHistoryEntry[];

	/** Reference counted rather than a flag: two gestures can overlap on a multi touch screen. */
	private _pauseCount = 0;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();

		this._history = this._load();
		// _trim() only ever ran from record() and from the limit's own change event, so a history
		// saved under a higher cap came back whole when the cap had been lowered while no workbench
		// was running (editing settings.json from a shell). The header then printed the new cap
		// while the list showed the old count, and the dropped entries stayed on disk.
		if (this._trim()) {
			this._save();
		}

		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (!e.affectsConfiguration(LIMIT_CONFIG_KEY)) {
				return;
			}
			// The cap is also part of what the view prints in its header, so the event fires even
			// when nothing had to be dropped.
			if (this._trim()) {
				this._save();
			}
			this._onDidChange.fire();
		}));

		// Copying with the iPad's own long press menu never reaches IClipboardService: WebKit
		// serves that menu itself and only emits the DOM event. Listening on the document is the
		// only way that path can be observed, and it has to be done per window because the
		// workbench can open auxiliary ones.
		this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
			disposables.add(addDisposableListener(window.document, 'copy', (e: ClipboardEvent) => this._recordFromDomEvent(window, e)));
			disposables.add(addDisposableListener(window.document, 'cut', (e: ClipboardEvent) => this._recordFromDomEvent(window, e)));
		}, { window: mainWindow, disposables: this._store }));
	}

	get history(): readonly IClipboardHistoryEntry[] {
		return this._history;
	}

	get limit(): number {
		const raw = this._configurationService.getValue<number>(LIMIT_CONFIG_KEY) ?? DEFAULT_LIMIT;
		if (typeof raw !== 'number' || !isFinite(raw)) {
			return DEFAULT_LIMIT;
		}
		return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(raw)));
	}

	private get _enabled(): boolean {
		return this._configurationService.getValue<boolean>(ENABLED_CONFIG_KEY) ?? DEFAULT_ENABLED;
	}

	record(text: string): void {
		if (!this._enabled || this._pauseCount > 0) {
			return;
		}

		const normalized = this._normalize(text);
		if (!normalized) {
			return;
		}
		if (SENSITIVE_PATTERNS.some(pattern => pattern.test(normalized))) {
			return;
		}

		const existing = this._history.findIndex(entry => entry.text === normalized);
		if (existing === 0) {
			return; // already the newest entry, nothing changes
		}

		const newest = this._history[0];
		if (newest && this._isSameDragGesture(newest, normalized)) {
			// The same gesture, one cell further along: overwrite the entry it already left.
			if (existing > 0) {
				this._history.splice(existing, 1); // index 0 is untouched, so `newest` stays valid
			}
			this._history[0] = { id: newest.id, text: normalized, createdAt: Date.now() };
			this._trim();
			this._save();
			this._onDidChange.fire();
			return;
		}

		if (existing > 0) {
			const [entry] = this._history.splice(existing, 1);
			this._history.unshift(entry);
		} else {
			this._history.unshift({ id: generateUuid(), text: normalized, createdAt: Date.now() });
		}

		this._trim();
		this._save();
		this._onDidChange.fire();
	}

	pauseRecording(): IDisposable {
		this._pauseCount++;
		let released = false;
		return toDisposable(() => {
			// Disposing twice must not drop somebody else's hold.
			if (released) {
				return;
			}
			released = true;
			this._pauseCount = Math.max(0, this._pauseCount - 1);
		});
	}

	remove(id: string): void {
		const index = this._history.findIndex(entry => entry.id === id);
		if (index === -1) {
			return;
		}
		this._history.splice(index, 1);
		this._save();
		this._onDidChange.fire();
	}

	clear(): void {
		if (!this._history.length) {
			return;
		}
		this._history = [];
		this._save();
		this._onDidChange.fire();
	}

	private _recordFromDomEvent(window: Window, e: ClipboardEvent): void {
		// The event fires before the clipboard is written, so `clipboardData` is what is about to
		// land there. A native menu copy leaves it empty and only the selection is available.
		const text = e.clipboardData?.getData('text/plain') || window.getSelection()?.toString() || '';
		this.record(text);
	}

	/**
	 * Whether `candidate` looks like the next frame of the drag that produced `newest`, rather
	 * than a copy of its own.
	 */
	private _isSameDragGesture(newest: IClipboardHistoryEntry, candidate: string): boolean {
		if (Date.now() - newest.createdAt > DRAG_COLLAPSE_WINDOW_MS) {
			return false;
		}
		if (Math.min(newest.text.length, candidate.length) < MIN_COLLAPSE_LENGTH) {
			return false;
		}
		return newest.text.startsWith(candidate) || candidate.startsWith(newest.text);
	}

	private _normalize(text: string): string {
		if (typeof text !== 'string') {
			return '';
		}
		const normalized = text.replace(/\r\n/g, '\n').trim();
		return normalized.length > MAX_ENTRY_LENGTH ? normalized.slice(0, MAX_ENTRY_LENGTH) : normalized;
	}

	/** Returns whether anything had to be dropped. */
	private _trim(): boolean {
		let changed = false;

		const limit = this.limit;
		if (this._history.length > limit) {
			this._history.length = limit;
			changed = true;
		}

		let total = 0;
		for (let i = 0; i < this._history.length; i++) {
			total += this._history[i].text.length;
			if (total > MAX_TOTAL_LENGTH) {
				// A single entry is capped well below the total, so the newest one always fits.
				this._history.length = Math.max(1, i);
				changed = true;
				break;
			}
		}

		return changed;
	}

	private _load(): IClipboardHistoryEntry[] {
		const raw = this._storageService.get(STORAGE_KEY, StorageScope.PROFILE);
		if (!raw) {
			return [];
		}
		try {
			const parsed = JSON.parse(raw) as IStoredClipboardHistory;
			if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.history)) {
				return [];
			}
			return parsed.history.filter((entry): entry is IClipboardHistoryEntry =>
				!!entry && typeof entry.id === 'string' && typeof entry.text === 'string' && typeof entry.createdAt === 'number');
		} catch {
			return [];
		}
	}

	private _save(): void {
		const stored: IStoredClipboardHistory = { version: 1, history: this._history };
		this._storageService.store(STORAGE_KEY, JSON.stringify(stored), StorageScope.PROFILE, StorageTarget.USER);
	}
}

registerSingleton(ITomoshibiClipboardHistoryService, TomoshibiClipboardHistoryService, InstantiationType.Delayed);
