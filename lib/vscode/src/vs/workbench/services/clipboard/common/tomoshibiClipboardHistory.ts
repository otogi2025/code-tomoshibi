/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Code-Tomoshibi keeps a short clipboard history so an iPad user can paste something they
 * copied a few minutes ago without switching apps.
 *
 * The service lives in the services layer rather than in `contrib/tomoshibi` on purpose: the
 * capture point is `services/clipboard/browser/clipboardService.ts`, and the layering rules in
 * eslint.config.js forbid the services layer from importing anything under `contrib`.
 *
 * The history is device local by design. It is mirrored into PROFILE storage (the browser's
 * IndexedDB) and never written to a file on the server, because copied text can be sensitive
 * and must not be persisted outside the device that captured it.
 */
export interface IClipboardHistoryEntry {
	readonly id: string;
	readonly text: string;
	readonly createdAt: number;
}

export const ITomoshibiClipboardHistoryService = createDecorator<ITomoshibiClipboardHistoryService>('tomoshibiClipboardHistoryService');

export interface ITomoshibiClipboardHistoryService {

	readonly _serviceBrand: undefined;

	/** Newest first. */
	readonly history: readonly IClipboardHistoryEntry[];

	/** The effective entry cap, already clamped to the supported range. */
	readonly limit: number;

	readonly onDidChange: Event<void>;

	/**
	 * Offers a piece of freshly copied text to the history. Everything the history refuses to
	 * keep (the feature being off, empty text, a duplicate, something that looks like a secret)
	 * is dropped here rather than at the call sites, so every capture point stays a one liner.
	 */
	record(text: string): void;

	/**
	 * Suppresses `record` until the returned disposable is disposed, so a gesture that rewrites
	 * the clipboard on every frame (a terminal drag selection with `copyOnSelection` on) leaves
	 * one entry rather than one per frame. The clipboard itself keeps being written, only the
	 * history looks away. Reference counted, so overlapping holders nest safely.
	 */
	pauseRecording(): IDisposable;

	remove(id: string): void;

	clear(): void;
}
