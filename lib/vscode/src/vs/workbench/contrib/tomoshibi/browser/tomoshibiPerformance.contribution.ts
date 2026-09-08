/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { $, addDisposableListener, append, clearNode, EventType, getWindow } from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Gesture, EventType as TouchEventType } from '../../../../base/browser/touch.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { AnchorAlignment, AnchorAxisAlignment, AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { registerWorkbenchContribution2, type IWorkbenchContribution, WorkbenchPhase } from '../../../common/contributions.js';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { tomoshibiLatencyIcon } from './tomoshibiIcons.js';
import './media/tomoshibiPerformance.css';

/** Code-server serves this; it is deliberately not the shared production gate. */
const performanceUrl = '/_tomoshibi/performance';

/** 基础那一发只读三个 /proc 文件，半秒一次的代价可以忽略，所以默认就贴着实时走。 */
const defaultPollInterval = 500;

/**
 * 下限保护：配置项被填成 50 这种极小值就是每秒二十次请求，每一次服务端都要读 /proc 并算速率
 * 差分，VPS 扛不住，所以无论配置写多少都不快过这个值。
 */
const minPollInterval = 250;

/**
 * 弹层里的进程列表要走 detail=1，那一发会遍历整个 /proc、对每个进程各读一次文件，比基础采样
 * 贵两个量级，所以它单独一个定时器、保持两秒一次，不跟着基础数据提速。
 */
const detailPollInterval = 2000;

/** Both keys are declared by the settings page (contrib/tomoshibi/browser/settings). */
const enabledSettingKey = 'tomoshibi.performance.enabled';
const intervalSettingKey = 'tomoshibi.performance.interval';

/** Full scale of the download and upload bars in the popover. */
const networkBarFullScaleBytesPerSecond = 2 * 1024 * 1024;

/** Full scale of the latency bar in the popover. */
const latencyBarFullScaleMs = 200;

/**
 * A single outlier request would otherwise make the stopwatch jump, so a median smooths it.
 * 间隔缩到 500ms 之后 5 个样本只覆盖 2.5 秒，中位数会跳得厉害；9 个样本约 4.5 秒，观感跟
 * 提速之前接近。
 */
const latencySampleCount = 9;

/** One touch on an iPad fires both a tap and a click; the second one within this window is dropped. */
const activationDedupeMs = 400;

/** Reopening is blocked for this long after a close, so the second tap on the button closes it. */
const reopenBlockMs = 300;

const dash = '—';

interface IPerformanceProcess {
	readonly name: string;
	readonly cpuPercent: number;
}

interface IPerformanceSnapshot {
	readonly hostname: string | null;
	readonly cpuCores: number | null;
	readonly cpuPercent: number | null;
	readonly memoryUsedBytes: number | null;
	readonly memoryTotalBytes: number | null;
	readonly swapUsedBytes: number | null;
	readonly swapTotalBytes: number | null;
	readonly diskUsedBytes: number | null;
	readonly diskTotalBytes: number | null;
	readonly downloadBytesPerSecond: number | null;
	readonly uploadBytesPerSecond: number | null;
	readonly sampledAt: number;
	readonly top: IPerformanceProcess[];
}

interface IDetailRow {
	readonly fill: HTMLElement;
	readonly value: HTMLElement;
}

function toFiniteOrNull(value: unknown): number | null {
	return typeof value === 'number' && isFinite(value) ? value : null;
}

/** `1.8G` / `860M`, the way the shell writes absolute sizes. */
function formatBytesShort(bytes: number | null): string {
	if (bytes === null) {
		return dash;
	}
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, '')}G`;
	}
	if (bytes >= 1024 * 1024) {
		return `${Math.round(bytes / (1024 * 1024))}M`;
	}
	return `${Math.round(bytes / 1024)}K`;
}

/** `115K` for the status bar line: no unit suffix, no per-second. */
function formatRateShort(bytesPerSecond: number | null): string {
	if (bytesPerSecond === null) {
		return dash;
	}
	if (bytesPerSecond < 1000) {
		return `${Math.round(bytesPerSecond)}B`;
	}
	if (bytesPerSecond < 1024 * 1024) {
		return `${Math.round(bytesPerSecond / 1024)}K`;
	}
	return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)}M`;
}

/** `120 KB/s` for the popover, where there is room for the unit. */
function formatRateLong(bytesPerSecond: number | null): string {
	if (bytesPerSecond === null) {
		return dash;
	}
	if (bytesPerSecond < 1024) {
		return `${Math.round(bytesPerSecond)} B/s`;
	}
	if (bytesPerSecond < 1024 * 1024) {
		return `${Math.round(bytesPerSecond / 1024)} KB/s`;
	}
	return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatPercent(value: number | null): string {
	return value === null ? dash : `${Math.round(value)}%`;
}

function ratio(used: number | null, total: number | null): number {
	return used !== null && total !== null && total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
}

/**
 * Server performance in the bottom-left of the status bar: `C 12% M 1.8G ↓115K ↑8K ⏱41ms`,
 * with a popover carrying the full picture.
 *
 * The entry rides the status bar's `content` slot rather than `text`, which is the only way to
 * get two-tone labels and an icon into one item. That slot has consequences worth remembering:
 * `text` stays empty so the label container is hidden, which means `command` would never be
 * clickable and the click has to be wired onto the content element by hand; `accessor.update()`
 * never touches `content`, so refreshing means writing `textContent` through kept references;
 * and `showInAllWindows` must stay off, because a single DOM node cannot live in two windows.
 */
export class TomoshibiPerformanceContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tomoshibiPerformance';

	private readonly _root: HTMLButtonElement;
	private readonly _cpuValue: HTMLElement;
	private readonly _memoryValue: HTMLElement;
	private readonly _downloadValue: HTMLElement;
	private readonly _uploadValue: HTMLElement;
	private readonly _latencyValue: HTMLElement;

	private readonly _entry = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly _detailDisposables = this._register(new DisposableStore());
	private _detailRows: IDetailRow[] | undefined;
	private _detailHost: HTMLElement | undefined;
	private _detailProcesses: HTMLElement | undefined;
	private _detailTitle: HTMLElement | undefined;
	private _detailOpen = false;
	private _detailHiddenAt = 0;
	private _lastActivation = 0;

	private _snapshot: IPerformanceSnapshot | undefined;
	private _latencySamples: number[] = [];
	private _requestRunning = false;
	private _detailRequestRunning = false;
	private _timer = 0;
	private _detailTimer = 0;
	private _entryName = '';
	private _ariaLabel = '';

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();

		const ariaLabel = localize('tomoshibi.performance.ariaLabel', "服务器性能，点开看 CPU、内存、磁盘、网络和延迟");
		this._root = $<HTMLButtonElement>('button.tomoshibi-perf-status');
		this._root.type = 'button';
		this._root.title = localize('tomoshibi.performance.tooltip', "服务器性能，点开看详细");
		this._root.setAttribute('aria-label', ariaLabel);

		this._cpuValue = this._appendField('C');
		this._memoryValue = this._appendField('M');
		this._downloadValue = this._appendField('↓');
		this._uploadValue = this._appendField('↑');
		append(this._root, renderIcon(tomoshibiLatencyIcon));
		this._latencyValue = append(this._root, $('span.tomoshibi-perf-val', undefined, dash));

		this._entryName = localize('tomoshibi.performance.name', "服务器性能");
		this._ariaLabel = ariaLabel;

		this._register(addDisposableListener(this._root, EventType.CLICK, event => {
			event.preventDefault();
			event.stopPropagation();
			this._activate();
		}));
		this._register(Gesture.addTarget(this._root));
		this._register(addDisposableListener(this._root, TouchEventType.Tap, event => {
			event.preventDefault();
			event.stopPropagation();
			this._activate();
		}));

		this._render();
		this._register(toDisposable(() => this._stopTimer()));
		this._register(addDisposableListener(mainWindow.document, 'visibilitychange', () => this._refresh()));
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(enabledSettingKey) || event.affectsConfiguration(intervalSettingKey)) {
				this._applyEnablement();
			}
		}));
		this._applyEnablement();
	}

	private _appendField(key: string): HTMLElement {
		append(this._root, $('span.tomoshibi-perf-key', undefined, key));
		return append(this._root, $('span.tomoshibi-perf-val', undefined, dash));
	}

	private _enabled(): boolean {
		return this.configurationService.getValue<boolean>(enabledSettingKey) !== false;
	}

	private _pollInterval(): number {
		const value = this.configurationService.getValue<number>(intervalSettingKey);
		const interval = typeof value === 'number' && value > 0 ? value : defaultPollInterval;
		return Math.max(minPollInterval, interval);
	}

	/**
	 * Turning the readout off has to take the status bar entry away as well as the timer: a
	 * hidden-but-polling entry would keep hitting the server every couple of seconds for nothing.
	 */
	private _applyEnablement(): void {
		if (!this._enabled()) {
			this._stopTimer();
			this._entry.clear();
			if (this._detailOpen) {
				this.contextViewService.hideContextView();
			}
			return;
		}
		if (!this._entry.value) {
			this._entry.value = this.statusbarService.addEntry({
				name: this._entryName,
				text: '',
				ariaLabel: this._ariaLabel,
				content: this._root,
			}, 'status.tomoshibi.performance', StatusbarAlignment.LEFT, Number.MAX_VALUE);
		}
		this._startTimer();
	}

	// 标签页在后台时一律不发请求：间隔缩短之后这一条比原来更要紧，别让后台标签页烧电。
	private _refresh(): void {
		if (this._enabled() && !mainWindow.document.hidden) {
			void this._update(false);
		}
	}

	private _refreshDetail(): void {
		if (this._enabled() && this._detailOpen && !mainWindow.document.hidden) {
			void this._update(true);
		}
	}

	private _startTimer(): void {
		this._stopTimer();
		this._refresh();
		this._timer = mainWindow.setInterval(() => this._refresh(), this._pollInterval());
		if (this._detailOpen) {
			this._startDetailTimer();
		}
	}

	/** Only runs while the popover is open, and never at the basic interval. */
	private _startDetailTimer(): void {
		this._stopDetailTimer();
		this._detailTimer = mainWindow.setInterval(() => this._refreshDetail(), detailPollInterval);
	}

	private _stopTimer(): void {
		if (this._timer) {
			mainWindow.clearInterval(this._timer);
			this._timer = 0;
		}
		this._stopDetailTimer();
	}

	private _stopDetailTimer(): void {
		if (this._detailTimer) {
			mainWindow.clearInterval(this._detailTimer);
			this._detailTimer = 0;
		}
	}

	private async _update(detail: boolean): Promise<void> {
		if (detail ? this._detailRequestRunning : this._requestRunning) {
			return;
		}
		if (detail) {
			this._detailRequestRunning = true;
		} else {
			this._requestRunning = true;
		}
		const startedAt = mainWindow.performance.now();
		try {
			const url = detail ? `${performanceUrl}?detail=1` : performanceUrl;
			const response = await mainWindow.fetch(url, { cache: 'no-store', credentials: 'same-origin' });
			if (!response.ok) {
				return;
			}
			const value = await response.json() as Partial<IPerformanceSnapshot>;
			// A sample taken while the tab was in the background says nothing about the link, and
			// the detail request is inherently slower, so only the basic one feeds the stopwatch.
			if (!detail && !mainWindow.document.hidden) {
				this._pushLatency(mainWindow.performance.now() - startedAt);
			}
			// 基础那一发不带 top，直接写回去会把弹层里的进程列表刷空，所以留住上一份。这里要在
			// 响应回来的这一刻读，不能在发请求时就取：两条流水线并行，早取会把 detail 刚写进去
			// 的列表用旧值盖掉。
			const previousTop = this._snapshot?.top ?? [];
			this._snapshot = {
				hostname: typeof value.hostname === 'string' ? value.hostname : null,
				cpuCores: toFiniteOrNull(value.cpuCores),
				cpuPercent: toFiniteOrNull(value.cpuPercent),
				memoryUsedBytes: toFiniteOrNull(value.memoryUsedBytes),
				memoryTotalBytes: toFiniteOrNull(value.memoryTotalBytes),
				swapUsedBytes: toFiniteOrNull(value.swapUsedBytes),
				swapTotalBytes: toFiniteOrNull(value.swapTotalBytes),
				diskUsedBytes: toFiniteOrNull(value.diskUsedBytes),
				diskTotalBytes: toFiniteOrNull(value.diskTotalBytes),
				downloadBytesPerSecond: toFiniteOrNull(value.downloadBytesPerSecond),
				uploadBytesPerSecond: toFiniteOrNull(value.uploadBytesPerSecond),
				sampledAt: toFiniteOrNull(value.sampledAt) ?? Date.now(),
				top: Array.isArray(value.top) ? value.top.filter(item => typeof item?.name === 'string') : previousTop,
			};
			this._render();
		} catch {
			// Keep the last valid sample. A blip in the network should not blank the status bar.
		} finally {
			if (detail) {
				this._detailRequestRunning = false;
			} else {
				this._requestRunning = false;
			}
		}
	}

	private _pushLatency(value: number): void {
		this._latencySamples.push(value);
		if (this._latencySamples.length > latencySampleCount) {
			this._latencySamples.shift();
		}
	}

	private _latency(): number | null {
		if (!this._latencySamples.length) {
			return null;
		}
		const sorted = [...this._latencySamples].sort((first, second) => first - second);
		return sorted[Math.floor(sorted.length / 2)];
	}

	private _render(): void {
		const snapshot = this._snapshot;
		const latency = this._latency();
		this._cpuValue.textContent = formatPercent(snapshot?.cpuPercent ?? null);
		this._memoryValue.textContent = formatBytesShort(snapshot?.memoryUsedBytes ?? null);
		this._downloadValue.textContent = formatRateShort(snapshot?.downloadBytesPerSecond ?? null);
		this._uploadValue.textContent = formatRateShort(snapshot?.uploadBytesPerSecond ?? null);
		this._latencyValue.textContent = latency === null ? dash : `${Math.round(latency)}ms`;
		this._renderDetail();
	}

	private _renderDetail(): void {
		const rows = this._detailRows;
		if (!rows) {
			return;
		}
		const snapshot = this._snapshot;
		const latency = this._latency();

		if (this._detailTitle) {
			this._detailTitle.textContent = localize('tomoshibi.performance.detail.host', "VPS {0} · 每 {1} 秒刷新", snapshot?.hostname ?? dash, Math.round(this._pollInterval() / 1000));
		}

		const cores = snapshot?.cpuCores ?? null;
		this._setRow(rows[0], snapshot?.cpuPercent ?? 0, `${formatPercent(snapshot?.cpuPercent ?? null)} / ${cores === null ? dash : localize('tomoshibi.performance.detail.cores', "{0} 核", cores)}`);
		this._setRow(rows[1], ratio(snapshot?.memoryUsedBytes ?? null, snapshot?.memoryTotalBytes ?? null), `${formatBytesShort(snapshot?.memoryUsedBytes ?? null)} / ${formatBytesShort(snapshot?.memoryTotalBytes ?? null)}`);
		this._setRow(rows[2], ratio(snapshot?.swapUsedBytes ?? null, snapshot?.swapTotalBytes ?? null), `${formatBytesShort(snapshot?.swapUsedBytes ?? null)} / ${formatBytesShort(snapshot?.swapTotalBytes ?? null)}`);
		this._setRow(rows[3], ratio(snapshot?.diskUsedBytes ?? null, snapshot?.diskTotalBytes ?? null), `${formatBytesShort(snapshot?.diskUsedBytes ?? null)} / ${formatBytesShort(snapshot?.diskTotalBytes ?? null)}`);
		this._setRow(rows[4], ratio(snapshot?.downloadBytesPerSecond ?? null, networkBarFullScaleBytesPerSecond), formatRateLong(snapshot?.downloadBytesPerSecond ?? null));
		this._setRow(rows[5], ratio(snapshot?.uploadBytesPerSecond ?? null, networkBarFullScaleBytesPerSecond), formatRateLong(snapshot?.uploadBytesPerSecond ?? null));
		this._setRow(rows[6], ratio(latency, latencyBarFullScaleMs), latency === null ? dash : localize('tomoshibi.performance.detail.latency', "{0} ms", Math.round(latency)));

		const processes = this._detailProcesses;
		if (processes) {
			clearNode(processes);
			const top = snapshot?.top ?? [];
			if (!top.length) {
				append(processes, $('span', undefined, dash));
				append(processes, $('span.tomoshibi-perf-v', undefined, dash));
			}
			for (const item of top) {
				append(processes, $('span', undefined, item.name));
				append(processes, $('span.tomoshibi-perf-v', undefined, formatPercent(toFiniteOrNull(item.cpuPercent))));
			}
		}
	}

	private _setRow(row: IDetailRow | undefined, percent: number, text: string): void {
		if (!row) {
			return;
		}
		row.fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
		row.value.textContent = text;
	}

	private _activate(): void {
		const now = Date.now();
		// An iPad reports one touch as both a gesture tap and a click.
		if (now - this._lastActivation < activationDedupeMs) {
			return;
		}
		this._lastActivation = now;
		this._showDetail();
	}

	private _showDetail(): void {
		// The outside-click handler below fires before this click, so a second tap on the button
		// closes the popover instead of closing and immediately reopening it.
		if (Date.now() - this._detailHiddenAt < reopenBlockMs) {
			return;
		}
		this.contextViewService.showContextView({
			getAnchor: () => this._root,
			anchorAlignment: AnchorAlignment.LEFT,
			anchorAxisAlignment: AnchorAxisAlignment.VERTICAL,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const detail = append(container, $('.tomoshibi-perf-detail'));
				this._detailTitle = append(detail, $('h4'));

				const system = append(detail, $('.tomoshibi-perf-kv'));
				const rows: IDetailRow[] = [
					this._createRow(system, 'CPU', false),
					this._createRow(system, localize('tomoshibi.performance.detail.memory', "内存"), false),
					this._createRow(system, localize('tomoshibi.performance.detail.swap', "交换"), true),
					this._createRow(system, localize('tomoshibi.performance.detail.disk', "磁盘"), false),
				];

				append(detail, $('h4', undefined, localize('tomoshibi.performance.detail.network', "网络（到当前设备）")));
				const network = append(detail, $('.tomoshibi-perf-kv'));
				rows.push(this._createRow(network, localize('tomoshibi.performance.detail.download', "下载"), false));
				rows.push(this._createRow(network, localize('tomoshibi.performance.detail.upload', "上传"), false));
				rows.push(this._createRow(network, localize('tomoshibi.performance.detail.latencyLabel', "延迟"), false));

				append(detail, $('h4', undefined, localize('tomoshibi.performance.detail.busiest', "占 CPU 最多")));
				this._detailProcesses = append(detail, $('.tomoshibi-perf-kv.procs'));

				this._detailRows = rows;
				this._detailHost = detail;
				this._detailOpen = true;
				this._renderDetail();
				// The popover carries the top-process list, so refresh it right away with detail=1
				// and then keep it on its own slow timer.
				void this._update(true);
				this._startDetailTimer();

				// The context view's own capture-click only hides when the target sits outside its
				// container, and that container is the whole workbench -- so nothing inside the
				// window would ever close this. Watch the window instead.
				const targetWindow = getWindow(container);
				this._detailDisposables.add(addDisposableListener(targetWindow, EventType.POINTER_DOWN, (event: PointerEvent) => {
					const target = event.target;
					if (target instanceof Node && detail.contains(target)) {
						return;
					}
					this.contextViewService.hideContextView();
				}, true));

				return toDisposable(() => {
					this._detailDisposables.clear();
					this._detailRows = undefined;
					this._detailHost = undefined;
					this._detailProcesses = undefined;
					this._detailTitle = undefined;
					this._detailOpen = false;
					this._detailHiddenAt = Date.now();
					this._stopDetailTimer();
				});
			},
		});
	}

	private _createRow(parent: HTMLElement, label: string, warn: boolean): IDetailRow {
		append(parent, $('span', undefined, label));
		const bar = append(parent, $('.tomoshibi-perf-bar'));
		const fill = append(bar, warn ? $('i.warn') : $('i'));
		const value = append(parent, $('span.tomoshibi-perf-v', undefined, dash));
		return { fill, value };
	}

	override dispose(): void {
		if (this._detailHost) {
			this.contextViewService.hideContextView();
		}
		super.dispose();
	}
}

registerWorkbenchContribution2(TomoshibiPerformanceContribution.ID, TomoshibiPerformanceContribution, WorkbenchPhase.AfterRestored);
