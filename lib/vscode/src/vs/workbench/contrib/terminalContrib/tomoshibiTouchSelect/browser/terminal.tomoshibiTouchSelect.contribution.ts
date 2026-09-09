/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './media/tomoshibiTouchSelect.css';
import type { Terminal as RawXtermTerminal } from '@xterm/xterm';
import * as dom from '../../../../../base/browser/dom.js';
import { disposableTimeout } from '../../../../../base/common/async.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable, type IDisposable } from '../../../../../base/common/lifecycle.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { ITomoshibiClipboardHistoryService } from '../../../../services/clipboard/common/tomoshibiClipboardHistory.js';
import type { ITerminalContribution, IXtermTerminal } from '../../../terminal/browser/terminal.js';
import { registerTerminalContribution, type ITerminalContributionContext } from '../../../terminal/browser/terminalExtensions.js';

/**
 * Registered by the settings page, not here. When the key is absent
 * `getValue` returns `undefined` and the feature defaults to on.
 */
const TomoshibiTouchSelectionSettingId = 'tomoshibi.terminal.touchSelection';

/** Word boundaries used by the long press "select the word under the finger" gesture. */
const WordSeparators = ' \t()[]{}<>"\'`,;';

/** The loupe renders the cells around the finger at 1.6x the terminal font size. */
const LoupeFontScale = 1.6;

const enum Constants {
	LongPressDelay = 420,
	MoveTolerance = 9,
	AutoScrollEdge = 24,
	AutoScrollInterval = 60,
	LoupeWidth = 140,
	LoupeHeight = 44,
	LoupeOffsetY = 64,
	LoupeRadius = 7,
	MenuGap = 12,
	EdgePadding = 4,
}

interface ICellPosition {
	readonly col: number;
	readonly row: number;
}

interface ISelectionOffsets {
	/** Inclusive start, `row * cols + col`. */
	readonly start: number;
	/** Exclusive end, `row * cols + col`. */
	readonly end: number;
}

interface ILongPress {
	readonly pointerId: number;
	readonly startX: number;
	readonly startY: number;
	readonly origin: ICellPosition;
	lastX: number;
	lastY: number;
	moved: boolean;
	fired: boolean;
	anchorStart: number;
	anchorEnd: number;
}

interface IHandleDrag {
	readonly pointerId: number;
	readonly which: 'start' | 'end';
	/** The offset of the handle that is *not* being dragged. */
	readonly anchorOffset: number;
	clientX: number;
	clientY: number;
}

/**
 * Apple style touch selection for the terminal: long press selects a word, two
 * draggable handles adjust the range, a loupe shows what is under the finger and
 * a pill menu offers copy / select line / select all / cancel.
 *
 * Mouse and trackpad input is untouched, only `touch` and `pen` pointers are handled.
 */
class TomoshibiTouchSelectContribution extends Disposable implements ITerminalContribution {
	static readonly ID = 'terminal.tomoshibiTouchSelect';

	private readonly _sessionStore = this._register(new MutableDisposable<DisposableStore>());
	private readonly _pressTimer = this._register(new MutableDisposable<IDisposable>());
	private readonly _autoScroll = this._register(new MutableDisposable<IDisposable>());
	private readonly _copyTimer = this._register(new MutableDisposable<IDisposable>());
	private readonly _historyPause = this._register(new MutableDisposable<IDisposable>());

	private _attachedRaw: RawXtermTerminal | undefined;
	private _raw: RawXtermTerminal | undefined;
	private _wrapper: HTMLElement | undefined;
	private _screen: HTMLElement | undefined;
	/** The `.monaco-workbench` element the workbench hover is rendered into. */
	private _hoverHost: HTMLElement | undefined;

	private _startHandle: HTMLElement | undefined;
	private _endHandle: HTMLElement | undefined;
	private _loupe: HTMLElement | undefined;
	private _loupeContent: HTMLElement | undefined;
	private _menu: HTMLElement | undefined;

	/** True while the current selection was made by touch, gates all of the UI. */
	private _touchOwned = false;
	private _press: ILongPress | undefined;
	private _drag: IHandleDrag | undefined;
	private _autoScrollDirection = 0;
	/** Idempotent lock for the hover suppression, mirrors the class on `_hoverHost`. */
	private _hoverSuppressed = false;

	constructor(
		_ctx: ITerminalContributionContext,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IHoverService private readonly _hoverService: IHoverService,
		@ILayoutService private readonly _layoutService: ILayoutService,
		@ITomoshibiClipboardHistoryService private readonly _clipboardHistoryService: ITomoshibiClipboardHistoryService,
	) {
		super();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TomoshibiTouchSelectionSettingId) && this._attachedRaw) {
				this._setup(this._attachedRaw);
			}
		}));
	}

	// `xtermOpen` rather than `xtermReady`: `raw.element` only exists once the
	// terminal has been attached to the DOM, which is what fires `xtermOpen`.
	// It can fire again when the terminal moves between the panel and the editor,
	// `_setup` is therefore idempotent.
	xtermOpen(xterm: IXtermTerminal & { raw: RawXtermTerminal }): void {
		this._attachedRaw = xterm.raw;
		this._setup(xterm.raw);
	}

	private _isEnabled(): boolean {
		return this._configurationService.getValue<boolean | undefined>(TomoshibiTouchSelectionSettingId) ?? true;
	}

	private _setup(raw: RawXtermTerminal): void {
		this._sessionStore.clear();
		this._raw = undefined;
		this._wrapper = undefined;
		this._screen = undefined;
		this._hoverHost = undefined;

		const element = raw.element;
		if (!this._isEnabled() || !element) {
			return;
		}
		const wrapper = element.closest<HTMLElement>('.terminal-wrapper');
		// The screen is nested inside a scrollable element in recent xterm builds and
		// xterm.js does not expose it, so it has to be looked up by class.
		// eslint-disable-next-line no-restricted-syntax
		const screen = element.querySelector<HTMLElement>('.xterm-screen');
		if (!wrapper || !screen) {
			return;
		}

		this._raw = raw;
		this._wrapper = wrapper;
		this._screen = screen;

		const store = new DisposableStore();
		this._sessionStore.value = store;
		const targetWindow = dom.getWindow(element);
		const targetDocument = targetWindow.document;
		// The same lookup `HoverService` uses to pick the container it renders into, so the class
		// always lands on an ancestor of the hover, auxiliary windows included.
		this._hoverHost = this._layoutService.getContainer(targetWindow);

		// Listen on the xterm root, not on `.xterm-screen`: `.xterm-viewport` is
		// absolutely positioned on top of the screen and swallows the events.
		store.add(dom.addDisposableListener(element, 'pointerdown', (e: PointerEvent) => this._onTerminalPointerDown(e), { capture: true, passive: true }));
		store.add(dom.addDisposableListener(targetDocument, 'pointerdown', (e: PointerEvent) => this._onDocumentPointerDown(e), { capture: true, passive: true }));
		store.add(dom.addDisposableListener(targetDocument, 'pointermove', (e: PointerEvent) => this._onPointerMove(e), { capture: true, passive: false }));
		store.add(dom.addDisposableListener(targetDocument, 'pointerup', (e: PointerEvent) => this._onPointerUp(e, false), { capture: true, passive: true }));
		store.add(dom.addDisposableListener(targetDocument, 'pointercancel', (e: PointerEvent) => this._onPointerUp(e, true), { capture: true, passive: true }));
		store.add(dom.addDisposableListener(element, 'contextmenu', (e: MouseEvent) => {
			if (this._touchOwned || this._press?.fired) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		}, true));

		store.add(raw.onSelectionChange(() => this._onSelectionChange()));
		store.add(raw.onScroll(() => this._layout()));
		store.add(raw.onResize(() => this._layout()));
		// Typing dismisses the whole thing, as it does on iOS. `onKey` and not `onData`:
		// `onData` carries everything that goes to the pty, the terminal's own replies
		// included -- focus reports, DA/CPR answers, mouse tracking -- so a full screen TUI
		// answering a query would tear the selection down with nobody having pressed a key.
		store.add(raw.onKey(() => this._dismiss(true)));
		store.add(toDisposable(() => this._teardownUi()));
	}

	// #region geometry

	private _screenRect(): DOMRect | undefined {
		const rect = this._screen?.getBoundingClientRect();
		if (!rect || rect.width < 2 || rect.height < 2) {
			return undefined;
		}
		return rect;
	}

	private _cellAt(clientX: number, clientY: number): ICellPosition | undefined {
		const raw = this._raw;
		const rect = this._screenRect();
		if (!raw || !rect) {
			return undefined;
		}
		const cols = Math.max(1, raw.cols);
		const rows = Math.max(1, raw.rows);
		const col = Math.max(0, Math.min(cols - 1, Math.floor((clientX - rect.left) * cols / rect.width)));
		const visibleRow = Math.max(0, Math.min(rows - 1, Math.floor((clientY - rect.top) * rows / rect.height)));
		return { col, row: raw.buffer.active.viewportY + visibleRow };
	}

	private _offsetOf(cell: ICellPosition): number {
		return cell.row * Math.max(1, this._raw?.cols ?? 1) + cell.col;
	}

	private _selectionOffsets(): ISelectionOffsets | undefined {
		const raw = this._raw;
		const position = raw?.getSelectionPosition();
		if (!raw || !position) {
			return undefined;
		}
		// `getSelectionPosition` returns 0 based columns and absolute buffer rows,
		// with an exclusive end column that can be equal to `cols`.
		const cols = Math.max(1, raw.cols);
		return {
			start: position.start.y * cols + Math.max(0, Math.min(position.start.x, cols)),
			end: position.end.y * cols + Math.max(0, Math.min(position.end.x, cols))
		};
	}

	private _applySelection(start: number, end: number): void {
		const raw = this._raw;
		if (!raw) {
			return;
		}
		const cols = Math.max(1, raw.cols);
		const from = Math.max(0, start);
		const to = Math.max(from + 1, end);
		raw.select(from % cols, Math.floor(from / cols), to - from);
	}

	private _wordAt(cell: ICellPosition): ISelectionOffsets {
		const raw = this._raw;
		const single = { start: this._offsetOf(cell), end: this._offsetOf(cell) + 1 };
		const line = raw?.buffer.active.getLine(cell.row);
		if (!raw || !line) {
			return single;
		}
		const cols = Math.max(1, raw.cols);
		const isSeparator = (x: number): boolean => {
			const bufferCell = line.getCell(x);
			if (!bufferCell) {
				return true;
			}
			// A zero width cell is the trailing half of a wide glyph, never a boundary.
			if (bufferCell.getWidth() === 0) {
				return false;
			}
			const chars = bufferCell.getChars();
			return chars === '' || WordSeparators.indexOf(chars) >= 0;
		};
		if (isSeparator(cell.col)) {
			return single;
		}
		let first = cell.col;
		while (first > 0 && !isSeparator(first - 1)) {
			first--;
		}
		let last = cell.col;
		while (last < cols - 1 && !isSeparator(last + 1)) {
			last++;
		}
		const base = cell.row * cols;
		return { start: base + first, end: base + last + 1 };
	}

	// #endregion

	// #region gestures

	private _onTerminalPointerDown(e: PointerEvent): void {
		if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
			// A mouse or trackpad takes over, hand the selection back to xterm.
			this._dismiss(false);
			return;
		}
		if (this._drag) {
			return;
		}
		const origin = this._cellAt(e.clientX, e.clientY);
		if (!origin) {
			return;
		}
		this._cancelPress();
		const press: ILongPress = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			origin,
			moved: false,
			fired: false,
			anchorStart: 0,
			anchorEnd: 0
		};
		this._press = press;
		this._pressTimer.value = disposableTimeout(() => {
			if (this._press !== press || press.moved) {
				return;
			}
			const word = this._wordAt(press.origin);
			press.fired = true;
			press.anchorStart = word.start;
			press.anchorEnd = word.end;
			this._setTouchOwned(true);
			this._wrapper?.classList.add('tomoshibi-touch-dragging');
			this._pauseHistory();
			this._suppressHover();
			this._applySelection(word.start, word.end);
			this._vibrate();
			this._layout();
			this._showLoupe(press.lastX, press.lastY, press.origin);
		}, Constants.LongPressDelay);
	}

	private _onDocumentPointerDown(e: PointerEvent): void {
		const target = e.target;
		if (dom.isHTMLElement(target) && target.closest('.tomoshibi-touch-menu, .tomoshibi-touch-handle')) {
			return;
		}
		if (this._menu || this._touchOwned) {
			this._dismiss(true);
		}
	}

	private _onPointerMove(e: PointerEvent): void {
		const drag = this._drag;
		if (drag) {
			if (e.pointerId !== drag.pointerId) {
				return;
			}
			if (e.cancelable) {
				e.preventDefault();
			}
			e.stopImmediatePropagation();
			drag.clientX = e.clientX;
			drag.clientY = e.clientY;
			this._updateDrag();
			this._updateAutoScroll(e.clientY);
			return;
		}

		const press = this._press;
		if (!press || e.pointerId !== press.pointerId) {
			return;
		}
		press.lastX = e.clientX;
		press.lastY = e.clientY;
		if (!press.fired) {
			// Below the tolerance the gesture is still a tap; above it, it is a
			// scroll and the long press has to give way.
			if (Math.abs(e.clientX - press.startX) > Constants.MoveTolerance || Math.abs(e.clientY - press.startY) > Constants.MoveTolerance) {
				press.moved = true;
				this._pressTimer.clear();
			}
			return;
		}
		if (e.cancelable) {
			e.preventDefault();
		}
		e.stopImmediatePropagation();
		const focus = this._cellAt(e.clientX, e.clientY);
		if (!focus) {
			return;
		}
		this._extendFrom(press.anchorStart, press.anchorEnd, this._offsetOf(focus));
		this._showLoupe(e.clientX, e.clientY, focus);
	}

	private _onPointerUp(e: PointerEvent, cancelled: boolean): void {
		const drag = this._drag;
		if (drag) {
			if (e.pointerId === drag.pointerId) {
				this._endDrag();
			}
			return;
		}
		const press = this._press;
		if (!press || e.pointerId !== press.pointerId) {
			return;
		}
		this._pressTimer.clear();
		this._press = undefined;
		this._hideLoupe();
		this._wrapper?.classList.remove('tomoshibi-touch-dragging');
		if (!press.fired) {
			this._resumeHistory(false);
			return;
		}
		if (cancelled) {
			this._dismiss(true); // resumes without recording, the selection is being thrown away
			return;
		}
		this._resumeHistory(true);
		this._layout();
		this._showMenu();
	}

	private _extendFrom(anchorStart: number, anchorEnd: number, focusOffset: number): void {
		if (focusOffset < anchorStart) {
			this._applySelection(focusOffset, anchorEnd);
		} else if (focusOffset >= anchorEnd) {
			this._applySelection(anchorStart, focusOffset + 1);
		} else {
			this._applySelection(anchorStart, anchorEnd);
		}
	}

	private _cancelPress(): void {
		this._pressTimer.clear();
		this._press = undefined;
	}

	/**
	 * The wrapper is only turned into a containing block while the touch UI is up,
	 * so the absolutely positioned terminal widgets keep the box they had before.
	 */
	private _setTouchOwned(value: boolean): void {
		this._touchOwned = value;
		this._wrapper?.classList.toggle('tomoshibi-touch-anchor', value);
	}

	private _vibrate(): void {
		const wrapper = this._wrapper;
		if (!wrapper) {
			return;
		}
		const nav = dom.getWindow(wrapper).navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
		nav.vibrate?.(10);
	}

	// #endregion

	// #region handle dragging

	private _onHandlePointerDown(e: PointerEvent, which: 'start' | 'end'): void {
		const selection = this._selectionOffsets();
		if (!selection) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		this._cancelPress();
		this._hideMenu();
		const handle = which === 'start' ? this._startHandle : this._endHandle;
		try {
			handle?.setPointerCapture(e.pointerId);
		} catch {
			// Capture is best effort, the document listeners still see the moves.
		}
		this._drag = {
			pointerId: e.pointerId,
			which,
			anchorOffset: which === 'start' ? selection.end : selection.start,
			clientX: e.clientX,
			clientY: e.clientY
		};
		this._wrapper?.classList.add('tomoshibi-touch-dragging');
		this._pauseHistory();
		this._suppressHover();
		this._updateDrag();
	}

	private _updateDrag(): void {
		const drag = this._drag;
		if (!drag) {
			return;
		}
		const cell = this._cellAt(drag.clientX, drag.clientY);
		if (!cell) {
			return;
		}
		const focus = this._offsetOf(cell);
		if (drag.which === 'start') {
			const end = drag.anchorOffset;
			this._applySelection(Math.min(focus, end - 1), end);
		} else {
			const start = drag.anchorOffset;
			this._applySelection(start, Math.max(focus + 1, start + 1));
		}
		this._showLoupe(drag.clientX, drag.clientY, cell);
		this._layout();
	}

	private _updateAutoScroll(clientY: number): void {
		const rect = this._screenRect();
		let direction = 0;
		if (rect) {
			if (clientY < rect.top + Constants.AutoScrollEdge) {
				direction = -1;
			} else if (clientY > rect.bottom - Constants.AutoScrollEdge) {
				direction = 1;
			}
		}
		if (direction === this._autoScrollDirection) {
			return;
		}
		this._autoScroll.clear();
		this._autoScrollDirection = direction;
		if (direction === 0) {
			return;
		}
		const wrapper = this._wrapper;
		if (!wrapper) {
			return;
		}
		const targetWindow = dom.getWindow(wrapper);
		const timer = targetWindow.setInterval(() => {
			this._raw?.scrollLines(direction);
			this._updateDrag();
		}, Constants.AutoScrollInterval);
		this._autoScroll.value = toDisposable(() => targetWindow.clearInterval(timer));
	}

	private _endDrag(): void {
		const drag = this._drag;
		this._drag = undefined;
		this._resumeHistory(true);
		this._autoScroll.clear();
		this._autoScrollDirection = 0;
		this._hideLoupe();
		this._wrapper?.classList.remove('tomoshibi-touch-dragging');
		if (drag) {
			const handle = drag.which === 'start' ? this._startHandle : this._endHandle;
			if (handle?.hasPointerCapture(drag.pointerId)) {
				handle.releasePointerCapture(drag.pointerId);
			}
		}
		this._layout();
		this._showMenu();
	}

	// #endregion

	// #region rendering

	private _onSelectionChange(): void {
		if (!this._touchOwned) {
			return;
		}
		if (!this._raw?.getSelectionPosition()) {
			// The only teardown that does not go through `_dismiss`: xterm dropped the selection
			// under us, so the touch UI goes with it and the hover has to be let back in.
			this._setTouchOwned(false);
			this._hideHandles();
			this._hideMenu();
			this._hideLoupe();
			this._releaseHover();
			return;
		}
		this._layout();
	}

	private _layout(): void {
		const raw = this._raw;
		const wrapper = this._wrapper;
		const rect = this._screenRect();
		const position = raw?.getSelectionPosition();
		if (!raw || !wrapper || !rect || !position || !this._touchOwned) {
			this._hideHandles();
			return;
		}
		const wrapperRect = wrapper.getBoundingClientRect();
		const cellWidth = rect.width / Math.max(1, raw.cols);
		const cellHeight = rect.height / Math.max(1, raw.rows);
		const viewportY = raw.buffer.active.viewportY;

		this._placeHandle(this._ensureHandle('start'), position.start.x, position.start.y, rect, wrapperRect, cellWidth, cellHeight, viewportY, raw.rows);
		this._placeHandle(this._ensureHandle('end'), position.end.x, position.end.y, rect, wrapperRect, cellWidth, cellHeight, viewportY, raw.rows);

		if (this._menu) {
			this._placeMenu(this._menu, rect, wrapperRect, cellWidth, cellHeight, viewportY);
		}
	}

	private _placeHandle(handle: HTMLElement, col: number, row: number, rect: DOMRect, wrapperRect: DOMRect, cellWidth: number, cellHeight: number, viewportY: number, rows: number): void {
		const visibleRow = row - viewportY;
		if (visibleRow < 0 || visibleRow >= rows) {
			handle.style.display = 'none';
			return;
		}
		handle.style.display = '';
		handle.style.left = `${rect.left - wrapperRect.left + col * cellWidth - 1}px`;
		handle.style.top = `${rect.top - wrapperRect.top + visibleRow * cellHeight}px`;
		handle.style.height = `${cellHeight}px`;
	}

	private _ensureHandle(which: 'start' | 'end'): HTMLElement {
		const wrapper = this._wrapper!;
		let handle = which === 'start' ? this._startHandle : this._endHandle;
		if (!handle) {
			const targetDocument = wrapper.ownerDocument;
			handle = targetDocument.createElement('div');
			handle.className = `tomoshibi-touch-handle is-${which}`;
			const dot = targetDocument.createElement('div');
			dot.className = 'tomoshibi-touch-handle-dot';
			handle.appendChild(dot);
			this._sessionStore.value?.add(dom.addDisposableListener(handle, 'pointerdown', (e: PointerEvent) => this._onHandlePointerDown(e, which), { capture: false, passive: false }));
			if (which === 'start') {
				this._startHandle = handle;
			} else {
				this._endHandle = handle;
			}
		}
		if (handle.parentElement !== wrapper) {
			wrapper.appendChild(handle);
		}
		return handle;
	}

	private _hideHandles(): void {
		this._startHandle?.remove();
		this._endHandle?.remove();
	}

	private _showLoupe(clientX: number, clientY: number, cell: ICellPosition): void {
		const raw = this._raw;
		const wrapper = this._wrapper;
		const rect = this._screenRect();
		if (!raw || !wrapper || !rect) {
			return;
		}
		const targetDocument = wrapper.ownerDocument;
		let loupe = this._loupe;
		let content = this._loupeContent;
		if (!loupe || !content) {
			loupe = targetDocument.createElement('div');
			loupe.className = 'tomoshibi-touch-loupe';
			content = targetDocument.createElement('div');
			content.className = 'tomoshibi-touch-loupe-content';
			loupe.appendChild(content);
			this._loupe = loupe;
			this._loupeContent = content;
		}
		if (loupe.parentElement !== wrapper) {
			wrapper.appendChild(loupe);
		}

		// The webgl renderer draws to a canvas that cannot be read back, so the
		// loupe re-renders the surrounding cells as text instead of magnifying pixels.
		dom.clearNode(content);
		const cols = Math.max(1, raw.cols);
		const line = raw.buffer.active.getLine(cell.row);
		const selection = this._selectionOffsets();
		const from = Math.max(0, cell.col - Constants.LoupeRadius);
		const to = Math.min(cols, cell.col + Constants.LoupeRadius + 1);
		for (let x = from; x < to; x++) {
			const bufferCell = line?.getCell(x);
			if (bufferCell && bufferCell.getWidth() === 0) {
				continue;
			}
			const chars = bufferCell?.getChars() ?? '';
			const span = targetDocument.createElement('span');
			span.textContent = chars === '' ? ' ' : chars;
			const offset = cell.row * cols + x;
			if (x === cell.col) {
				span.classList.add('is-target');
			} else if (selection && offset >= selection.start && offset < selection.end) {
				span.classList.add('is-selected');
			}
			content.appendChild(span);
		}
		loupe.style.fontSize = `${Math.round((raw.options.fontSize ?? 12) * LoupeFontScale)}px`;
		loupe.style.fontFamily = raw.options.fontFamily ?? '';

		const wrapperRect = wrapper.getBoundingClientRect();
		const left = clientX - wrapperRect.left - Constants.LoupeWidth / 2;
		const top = clientY - wrapperRect.top - Constants.LoupeOffsetY;
		loupe.style.left = `${this._clamp(left, wrapperRect.width, Constants.LoupeWidth)}px`;
		loupe.style.top = `${this._clamp(top, wrapperRect.height, Constants.LoupeHeight)}px`;
	}

	private _hideLoupe(): void {
		this._loupe?.remove();
	}

	private _clamp(value: number, available: number, size: number): number {
		const max = Math.max(Constants.EdgePadding, available - size - Constants.EdgePadding);
		return Math.max(Constants.EdgePadding, Math.min(value, max));
	}

	private _showMenu(): void {
		const raw = this._raw;
		const wrapper = this._wrapper;
		const rect = this._screenRect();
		if (!raw || !wrapper || !rect || !raw.getSelectionPosition()) {
			return;
		}
		this._hideMenu();
		const targetDocument = wrapper.ownerDocument;
		const menu = targetDocument.createElement('div');
		menu.className = 'tomoshibi-touch-menu';
		menu.setAttribute('role', 'toolbar');
		menu.setAttribute('aria-label', '终端选区');

		const addButton = (label: string, run: () => void) => {
			if (menu.childElementCount > 0) {
				const separator = targetDocument.createElement('span');
				separator.className = 'tomoshibi-touch-menu-separator';
				menu.appendChild(separator);
			}
			const button = targetDocument.createElement('button');
			button.type = 'button';
			button.textContent = label;
			button.addEventListener('pointerdown', event => {
				event.preventDefault();
				event.stopPropagation();
			});
			button.addEventListener('click', () => run());
			menu.appendChild(button);
		};

		addButton('复制', () => this._copySelection());
		addButton('选择整行', () => {
			const selection = raw.getSelectionPosition();
			if (selection) {
				raw.selectLines(selection.start.y, selection.end.y);
			}
			this._layout();
			this._showMenu();
		});
		addButton('全选', () => {
			raw.selectAll();
			this._layout();
			this._showMenu();
		});
		addButton('取消', () => this._dismiss(true));

		wrapper.appendChild(menu);
		this._menu = menu;
		const wrapperRect = wrapper.getBoundingClientRect();
		this._placeMenu(menu, rect, wrapperRect, rect.width / Math.max(1, raw.cols), rect.height / Math.max(1, raw.rows), raw.buffer.active.viewportY);
	}

	private _placeMenu(menu: HTMLElement, rect: DOMRect, wrapperRect: DOMRect, cellWidth: number, cellHeight: number, viewportY: number): void {
		const position = this._raw?.getSelectionPosition();
		if (!position) {
			return;
		}
		const menuRect = menu.getBoundingClientRect();
		const centerX = position.start.y === position.end.y
			? rect.left + (position.start.x + position.end.x) / 2 * cellWidth
			: rect.left + rect.width / 2;
		const above = rect.top + (position.start.y - viewportY) * cellHeight - wrapperRect.top - menuRect.height - Constants.MenuGap;
		const below = rect.top + (position.end.y - viewportY + 1) * cellHeight - wrapperRect.top + Constants.MenuGap;
		const top = above < Constants.EdgePadding ? below : above;
		menu.style.left = `${this._clamp(centerX - wrapperRect.left - menuRect.width / 2, wrapperRect.width, menuRect.width)}px`;
		menu.style.top = `${this._clamp(top, wrapperRect.height, menuRect.height)}px`;
	}

	private _hideMenu(): void {
		this._menu?.remove();
		this._menu = undefined;
	}

	private _copySelection(): void {
		const text = this._raw?.getSelection();
		this._hideMenu();
		if (!text) {
			this._dismiss(true);
			return;
		}
		// Safari only allows a clipboard write that originates from a user gesture.
		// `BrowserClipboardService` prepares a pending write from a `click` handler
		// on the workbench container, so the write has to happen after this click
		// has finished bubbling, not inside this listener.
		this._copyTimer.value = disposableTimeout(() => {
			this._clipboardService.writeText(text);
		}, 0);
		this._dismiss(true);
	}

	/**
	 * `terminal.integrated.copyOnSelection` writes the clipboard on every selection change, and a
	 * drag produces one of those per cell crossed. The clipboard has to keep up -- the user
	 * expects the newest range to be pasteable -- but the history only wants the range the finger
	 * came to rest on, so recording is held off for the length of the gesture.
	 */
	private _pauseHistory(): void {
		if (!this._historyPause.value) {
			this._historyPause.value = this._clipboardHistoryService.pauseRecording();
		}
	}

	/**
	 * The final range is recorded by hand rather than left to the next clipboard write: once the
	 * finger is up nothing changes the selection again, so there is no later write to ride on.
	 */
	private _resumeHistory(recordSelection: boolean): void {
		if (!this._historyPause.value) {
			return;
		}
		const text = recordSelection ? this._raw?.getSelection() : undefined;
		this._historyPause.clear();
		if (text) {
			this._clipboardHistoryService.record(text);
		}
	}

	/**
	 * The workbench hover is a child of the workbench container while the terminal panel is its own
	 * stacking context, so the hover paints over the handles and the menu whatever z-index they are
	 * given. It is therefore taken out of the paint by a class on the container for as long as the
	 * touch selection UI is up -- not just for the gesture: iPadOS Safari only synthesises its mouse
	 * events once the finger is off, which is exactly when the menu appears, so a suppression that
	 * ended with the gesture would let the hover cover the menu it was meant to protect. The hover
	 * has no touch guard of its own, so one can also be up before the long press fires: the class
	 * only stops it being painted, closing it has to be asked for.
	 */
	private _suppressHover(): void {
		if (this._hoverSuppressed) {
			return;
		}
		this._hoverSuppressed = true;
		this._hoverHost?.classList.add('tomoshibi-touch-suppress-hover');
		// `force`, otherwise a hover locked open by the alt key would survive the gesture.
		this._hoverService.hideHover(true);
	}

	/**
	 * Called from `_dismiss`, which every way out of the touch UI funnels through, plus the one
	 * teardown that does not (xterm dropping the selection). Disposal is covered too: the session
	 * store teardown runs `_teardownUi` -> `_dismiss`, and it runs before `_setup` repoints
	 * `_hoverHost`, so the class is never left behind on a container we have stopped tracking.
	 */
	private _releaseHover(): void {
		if (!this._hoverSuppressed) {
			return;
		}
		this._hoverSuppressed = false;
		this._hoverHost?.classList.remove('tomoshibi-touch-suppress-hover');
	}

	private _dismiss(clearSelection: boolean): void {
		this._cancelPress();
		// Every abandoned path lands here (pointercancel, a mouse taking over, teardown), so this
		// is what guarantees the hold is never left behind.
		this._resumeHistory(false);
		this._releaseHover();
		this._autoScroll.clear();
		this._autoScrollDirection = 0;
		this._drag = undefined;
		this._setTouchOwned(false);
		this._wrapper?.classList.remove('tomoshibi-touch-dragging');
		this._hideMenu();
		this._hideLoupe();
		this._hideHandles();
		if (clearSelection) {
			this._raw?.clearSelection();
		}
	}

	private _teardownUi(): void {
		this._dismiss(false);
		this._wrapper?.classList.remove('tomoshibi-touch-anchor');
		this._startHandle?.remove();
		this._endHandle?.remove();
		this._loupe?.remove();
		this._startHandle = undefined;
		this._endHandle = undefined;
		this._loupe = undefined;
		this._loupeContent = undefined;
	}

	// #endregion
}

registerTerminalContribution(TomoshibiTouchSelectContribution.ID, TomoshibiTouchSelectContribution);
