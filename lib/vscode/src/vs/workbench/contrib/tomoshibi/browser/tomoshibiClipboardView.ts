/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { $, addDisposableListener, append, clearNode, EventType, getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IClipboardHistoryEntry, ITomoshibiClipboardHistoryService } from '../../../services/clipboard/common/tomoshibiClipboardHistory.js';
import { TOMOSHIBI_INSERT_TEXT_COMMAND_ID } from './tomoshibiInsertText.js';

/** How long the clear button stays armed after the first tap. */
const CLEAR_ARM_MS = 3000;

const MINUTE = 60 * 1000;

/**
 * How often the "N minutes ago" column is recomputed while the view is on screen. The labels are
 * only otherwise written at render time, so with nothing new being copied every row keeps saying
 * whatever it said an hour ago. A minute is fine: the labels themselves have minute resolution.
 */
const TIME_REFRESH_MS = MINUTE;

export class TomoshibiClipboardView extends ViewPane {

	static readonly ID = 'workbench.view.tomoshibiClipboard.list';

	private _body: HTMLElement | undefined;
	private _list: HTMLElement | undefined;
	private _clearButton: HTMLButtonElement | undefined;

	private readonly _rowDisposables = this._register(new DisposableStore());

	private _clearArmed = false;
	private _clearTimer: ReturnType<typeof setTimeout> | undefined;

	/** The `.m` cell of every rendered row, so the timer can rewrite them without a full rebuild. */
	private readonly _timeCells: { readonly element: HTMLElement; readonly createdAt: number }[] = [];
	private _timeTimer: number | undefined;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ITomoshibiClipboardHistoryService private readonly _historyService: ITomoshibiClipboardHistoryService,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this._historyService.onDidChange(() => this._render()));
		// Nothing needs to be accurate while the sidebar is showing something else.
		this._register(this.onDidChangeBodyVisibility(visible => this._updateTimeTimer(visible)));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this._body = append(container, $('.tomoshibi-pane-body.tomoshibi-clipboard-view'));
		this._list = append(this._body, $('.tomoshibi-clip-list'));

		const row = append(this._body, $('.tomoshibi-rowbtn'));

		const pasteButton = append(row, $<HTMLButtonElement>('button'));
		pasteButton.textContent = '粘贴到终端';
		pasteButton.title = '把这台设备剪贴板里的内容插入当前 Session';
		this._register(addDisposableListener(pasteButton, EventType.CLICK, () => this._pasteFromDevice()));

		this._clearButton = append(row, $<HTMLButtonElement>('button'));
		this._clearButton.textContent = '清空';
		this._register(addDisposableListener(this._clearButton, EventType.CLICK, () => this._onClearClicked()));

		this._register({
			dispose: () => {
				if (this._clearTimer !== undefined) {
					clearTimeout(this._clearTimer);
					this._clearTimer = undefined;
				}
				this._stopTimeTimer();
			}
		});

		this._render();
		this._updateTimeTimer(this.isBodyVisible());
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this._body) {
			this._body.style.height = `${height}px`;
		}
	}

	/**
	 * Reads the device clipboard and puts it in the terminal.
	 *
	 * The read has to be the very first thing this handler does. Safari on iPad only honours a
	 * clipboard read while the user activation of the tap is still live, and that activation is
	 * consumed by the first await, so nothing may be awaited before `readText` is called.
	 */
	private _pasteFromDevice(): void {
		const pending = this._clipboardService.readText();
		void pending.then(text => {
			if (text) {
				return this._commandService.executeCommand(TOMOSHIBI_INSERT_TEXT_COMMAND_ID, text);
			}
			return undefined;
		}, () => undefined);
	}

	private _onClearClicked(): void {
		const button = this._clearButton;
		if (!button) {
			return;
		}

		if (this._clearArmed) {
			this._disarmClear();
			this._historyService.clear();
			return;
		}

		// Two taps rather than a modal: a confirmation dialog on an iPad costs more than the
		// mistake it prevents, but a single stray tap must not wipe the history either.
		this._clearArmed = true;
		button.textContent = '再点一次清空';
		this._clearTimer = setTimeout(() => this._disarmClear(), CLEAR_ARM_MS);
	}

	private _disarmClear(): void {
		if (this._clearTimer !== undefined) {
			clearTimeout(this._clearTimer);
			this._clearTimer = undefined;
		}
		this._clearArmed = false;
		if (this._clearButton) {
			this._clearButton.textContent = '清空';
		}
	}

	private _updateTimeTimer(visible: boolean): void {
		if (!visible) {
			this._stopTimeTimer();
			return;
		}
		// Coming back into view is exactly when the labels are most stale, so catch up first.
		this._refreshTimes();
		if (this._timeTimer === undefined) {
			// getWindow rather than the global: the view can live in an auxiliary window.
			this._timeTimer = getWindow(this._list).setInterval(() => this._refreshTimes(), TIME_REFRESH_MS);
		}
	}

	private _stopTimeTimer(): void {
		if (this._timeTimer !== undefined) {
			getWindow(this._list).clearInterval(this._timeTimer);
			this._timeTimer = undefined;
		}
	}

	private _refreshTimes(): void {
		const now = Date.now();
		for (const cell of this._timeCells) {
			cell.element.textContent = relativeTime(cell.createdAt, now);
		}
	}

	private _render(): void {
		const list = this._list;
		if (!list) {
			return;
		}

		this.updateTitleDescription(`最近 ${this._historyService.limit} 条 · 本设备`);

		const scrollTop = list.scrollTop;
		this._rowDisposables.clear();
		this._timeCells.length = 0;
		clearNode(list);

		const entries = this._historyService.history;
		if (!entries.length) {
			const empty = append(list, $('.tomoshibi-placeholder'));
			empty.textContent = '复制内容后会自动出现在这里';
			return;
		}

		// At most a couple of hundred rows, so plain DOM beats pulling in a virtual list.
		for (const entry of entries) {
			this._renderRow(list, entry);
		}

		list.scrollTop = scrollTop;
	}

	private _renderRow(list: HTMLElement, entry: IClipboardHistoryEntry): void {
		const row = append(list, $('.tomoshibi-clip'));

		const text = append(row, $('.t'));
		text.textContent = entry.text;

		const time = append(row, $('.m'));
		time.textContent = relativeTime(entry.createdAt, Date.now());
		// The relative label cannot tell yesterday 14:30 from today 14:30; the tooltip can.
		time.title = new Date(entry.createdAt).toLocaleString();
		this._timeCells.push({ element: time, createdAt: entry.createdAt });

		const copyButton = append(row, $<HTMLButtonElement>('button.b'));
		copyButton.textContent = '⧉';
		copyButton.title = '复制';

		// Tapping the row inserts, which is the action users reach for on the iPad; the small
		// button is the rarer "put it back on the system clipboard".
		this._rowDisposables.add(addDisposableListener(row, EventType.CLICK, () => {
			void this._commandService.executeCommand(TOMOSHIBI_INSERT_TEXT_COMMAND_ID, entry.text);
		}));
		this._rowDisposables.add(addDisposableListener(copyButton, EventType.CLICK, e => {
			e.stopPropagation();
			void this._clipboardService.writeText(entry.text);
		}));
	}
}

/** Matches the shell: just now, N minutes ago, today's clock, yesterday, then a date. */
export function relativeTime(timestamp: number, now: number): string {
	const delta = now - timestamp;
	if (delta < MINUTE) {
		return '刚刚';
	}
	if (delta < 60 * MINUTE) {
		return `${Math.floor(delta / MINUTE)} 分钟前`;
	}

	const date = new Date(timestamp);
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	if (timestamp >= startOfToday.getTime()) {
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	const startOfYesterday = startOfToday.getTime() - 24 * 60 * MINUTE;
	if (timestamp >= startOfYesterday) {
		return '昨天';
	}

	return `${date.getMonth() + 1}-${date.getDate()}`;
}

function pad(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}
