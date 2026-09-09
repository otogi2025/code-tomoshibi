/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as dom from '../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { registerWorkbenchContribution2, type IWorkbenchContribution, WorkbenchPhase } from '../../../common/contributions.js';
import './media/tomoshibiWatchdog.css';

const localStatusUrl = '/_gate/watchdog/status';
const localHeartbeatUrl = '/_gate/watchdog/heartbeat';
const localCancelUrl = '/_gate/watchdog/cancel';
const externalTokenUrl = '/_gate/watchdog/external-token';
const externalBaseUrl = '/_watchdog-la';
const pollInterval = 5000;
const heartbeatInterval = 15000;

/**
 * 一路连着失败时它自己的重试间隔的上限。⛔ 没故障时的 5 秒稳态间隔不动：看门狗要在终端失控时
 * 快速弹窗，把稳态调大等于削它的本职功能；该省的是「打不通还照 5 秒硬打」那部分。
 */
const maxSourceRetryInterval = 60000;

/**
 * 「确认并关闭」压下的那把去重键最多活这么久。清空它本来只有一个时机（一次所有端点都成功、
 * 且都报 inactive 的轮询），标签页在后台那一拍没轮询、或者故障窗口首尾相接，这个时机就整场
 * 都碰不到，看门狗对同一类故障从此哑掉。加个失效时间当兜底。
 */
const dismissTtl = 10 * 60 * 1000;

type WatchdogSource = 'tokyo' | 'la';

interface IWatchdogStatus {
	readonly active: boolean;
	readonly incidentId?: string;
	readonly phase?: string;
	readonly title?: string;
	readonly message?: string;
	readonly reason?: string;
	readonly summary?: string;
	readonly cancellable?: boolean;
	readonly deadline?: number;
	readonly updatedAt?: number;
	readonly source?: WatchdogSource;
}

interface IExternalTokenResponse {
	readonly token?: string;
}

export class TomoshibiWatchdogContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tomoshibiWatchdog';

	private readonly _targetWindow: Window;
	private readonly _clientId: string;
	private readonly _root: HTMLElement;
	private readonly _card: HTMLElement;
	private readonly _title: HTMLElement;
	private readonly _message: HTMLElement;
	private readonly _reason: HTMLElement;
	private readonly _summary: HTMLElement;
	private readonly _countdown: HTMLElement;
	private readonly _notice: HTMLElement;
	private readonly _dismissButton: HTMLButtonElement;
	private readonly _cancelButton: HTMLButtonElement;
	private _current: IWatchdogStatus | undefined;
	private _dismissedAlertKey = '';
	private _dismissedAt = 0;
	private _dismissedSource: WatchdogSource | undefined;
	private _noticeKey = '';
	private _externalToken = '';
	private _countdownTimer = 0;
	private _pollTimer = 0;
	private _heartbeatTimer = 0;
	private readonly _sourceFailures = new Map<WatchdogSource, number>();
	private readonly _sourceNextAttempt = new Map<WatchdogSource, number>();
	private _cancelling = false;
	private _polling = false;
	private _tokenLoading = false;
	private _lastTokenAttempt = 0;

	constructor(@ILayoutService layoutService: ILayoutService) {
		super();
		this._targetWindow = dom.getWindow(layoutService.mainContainer);
		this._clientId = this._targetWindow.crypto.randomUUID?.() ?? `window-${Math.random().toString(36).slice(2)}`;

		this._root = dom.$('.tomoshibi-watchdog-alert');
		this._root.hidden = true;
		this._root.setAttribute('aria-hidden', 'true');

		this._card = dom.append(this._root, dom.$('section.tomoshibi-watchdog-card'));
		this._card.setAttribute('role', 'alertdialog');
		this._card.setAttribute('aria-live', 'assertive');
		this._card.setAttribute('aria-labelledby', 'tomoshibi-watchdog-title');

		const header = dom.append(this._card, dom.$('.tomoshibi-watchdog-head'));
		dom.append(header, dom.$('span.tomoshibi-watchdog-dot'));
		this._title = dom.append(header, dom.$('#tomoshibi-watchdog-title.tomoshibi-watchdog-title'));
		this._message = dom.append(this._card, dom.$('.tomoshibi-watchdog-message'));
		this._reason = dom.append(this._card, dom.$('.tomoshibi-watchdog-reason'));
		this._summary = dom.append(this._card, dom.$('.tomoshibi-watchdog-summary'));
		this._countdown = dom.append(this._card, dom.$('.tomoshibi-watchdog-countdown'));
		// 本地操作的回话单独一格。写进 _message 的话，5 秒后的下一次轮询就会拿服务端文案把它
		// 整段盖回去，「停止请求未送达」这行字最多活 5 秒。
		this._notice = dom.append(this._card, dom.$('.tomoshibi-watchdog-notice'));
		const actions = dom.append(this._card, dom.$('.tomoshibi-watchdog-actions'));
		this._dismissButton = dom.append(actions, dom.$<HTMLButtonElement>('button.tomoshibi-watchdog-dismiss'));
		this._dismissButton.type = 'button';
		this._dismissButton.textContent = localize('tomoshibiWatchdog.dismiss', "确认并关闭");
		this._cancelButton = dom.append(actions, dom.$<HTMLButtonElement>('button.tomoshibi-watchdog-cancel'));
		this._cancelButton.type = 'button';
		this._setCancelButtonLabel();

		layoutService.mainContainer.appendChild(this._root);
		this._register(toDisposable(() => this._root.remove()));
		this._register(dom.addDisposableListener(this._dismissButton, 'click', () => this._dismiss()));
		this._register(dom.addDisposableListener(this._cancelButton, 'click', () => void this._cancelRepair()));
		this._register(dom.addDisposableListener(this._targetWindow.document, 'visibilitychange', () => {
			const visible = this._targetWindow.document.visibilityState === 'visible';
			void this._heartbeat(visible);
			if (visible) {
				// 回到前台往往就是换了网，先把退避清掉给每一路一次立即重试的机会。
				this._sourceNextAttempt.clear();
				void this._poll();
			}
		}));
		this._register(dom.addDisposableListener(this._targetWindow, 'pagehide', () => void this._heartbeat(false)));
		this._register(toDisposable(() => this._clearTimers()));

		void this._start();
	}

	private async _start(): Promise<void> {
		await this._loadExternalToken();
		void this._poll();
		void this._heartbeat();
		this._pollTimer = this._targetWindow.setInterval(() => void this._poll(), pollInterval);
		this._heartbeatTimer = this._targetWindow.setInterval(() => void this._heartbeat(), heartbeatInterval);
	}

	private _clearTimers(): void {
		this._targetWindow.clearInterval(this._countdownTimer);
		this._targetWindow.clearInterval(this._pollTimer);
		this._targetWindow.clearInterval(this._heartbeatTimer);
	}

	private _show(value: IWatchdogStatus): void {
		if (this._dismissedAlertKey && Date.now() - this._dismissedAt > dismissTtl) {
			this._dismissedAlertKey = '';
			this._dismissedSource = undefined;
		}
		if (this._alertKey(value) === this._dismissedAlertKey) {
			this._hide();
			return;
		}
		this._current = value;
		const terminalPhase = value.phase === 'recovered' || value.phase === 'cancelled';
		this._root.hidden = false;
		this._root.setAttribute('aria-hidden', 'false');
		this._card.classList.toggle('is-ok', terminalPhase);
		this._title.textContent = value.title || localize('tomoshibiWatchdog.title', "Code-Tomoshibi 看门狗");
		this._message.textContent = value.message || localize('tomoshibiWatchdog.defaultMessage', "看门狗检测到异常。");
		this._reason.textContent = value.reason ? localize('tomoshibiWatchdog.reason', "检测原因：{0}", value.reason) : '';
		this._summary.textContent = value.summary || '';
		if (this._noticeKey && this._alertKey(value) !== this._noticeKey) {
			this._clearNotice();
		}
		this._cancelButton.hidden = value.cancellable !== true;
		this._syncCancelButton();
		this._updateCountdown();
		this._targetWindow.clearInterval(this._countdownTimer);
		this._countdownTimer = this._targetWindow.setInterval(() => this._updateCountdown(), 1000);
	}

	private _hide(): void {
		this._current = undefined;
		this._cancelling = false;
		this._clearNotice();
		this._targetWindow.clearInterval(this._countdownTimer);
		this._root.hidden = true;
		this._root.setAttribute('aria-hidden', 'true');
	}

	/**
	 * incidentId 必须进去。watchdog.sh 的 title 是每条代码路径写死的常量，source + phase +
	 * title 这三元组在同一类故障复发时必然重合，新故障会被当成用户关过的那一张直接吞掉。
	 * incidentId 是可选字段，缺失时退回原来的三元组。
	 */
	private _alertKey(value: IWatchdogStatus): string {
		return JSON.stringify([value.source ?? '', value.incidentId ?? '', value.phase ?? '', value.title ?? '']);
	}

	private _dismiss(): void {
		if (!this._current) {
			return;
		}
		this._dismissedAlertKey = this._alertKey(this._current);
		this._dismissedAt = Date.now();
		this._dismissedSource = this._current.source;
		this._hide();
	}

	/** 本次操作的回话，只由用户操作写、由 _hide 或换了另一张卡时清，轮询不碰它。 */
	private _setNotice(text: string, isError: boolean): void {
		if (!this._current) {
			// 卡片已经收掉了，这行字没有落脚的地方。
			this._clearNotice();
			return;
		}
		this._notice.textContent = text;
		this._notice.classList.toggle('is-error', isError);
		this._noticeKey = this._alertKey(this._current);
	}

	private _clearNotice(): void {
		this._notice.textContent = '';
		this._notice.classList.remove('is-error');
		this._noticeKey = '';
	}

	private _syncCancelButton(): void {
		this._cancelButton.disabled = this._cancelling;
		this._setCancelButtonLabel();
	}

	private _setCancelButtonLabel(): void {
		this._cancelButton.textContent = this._cancelling
			? localize('tomoshibiWatchdog.cancelling', "正在停止…")
			: localize('tomoshibiWatchdog.cancel', "停止本次修复并暂停 1 小时");
	}

	private _updateCountdown(): void {
		const deadline = Number(this._current?.deadline ?? 0);
		if (!deadline) {
			this._countdown.textContent = '';
			return;
		}
		const remaining = Math.max(0, deadline - Math.floor(Date.now() / 1000));
		this._countdown.textContent = remaining > 0
			? localize('tomoshibiWatchdog.countdown', "自动动作倒计时：{0}:{1}", Math.floor(remaining / 60), String(remaining % 60).padStart(2, '0'))
			: localize('tomoshibiWatchdog.nextStep', "正在进入下一步…");
	}

	private async _fetchBounded(url: string, options: RequestInit = {}, timeout = 4500): Promise<Response> {
		const controller = new AbortController();
		const timer = this._targetWindow.setTimeout(() => controller.abort(), timeout);
		try {
			return await this._targetWindow.fetch(url, { ...options, signal: controller.signal });
		} finally {
			this._targetWindow.clearTimeout(timer);
		}
	}

	private async _fetchJsonBounded<T>(url: string, options: RequestInit = {}, timeout = 4500): Promise<{ readonly response: Response; readonly value?: T }> {
		const response = await this._fetchBounded(url, options, timeout);
		return { response, value: response.ok ? await response.json() as T : undefined };
	}

	private async _readStatus(url: string, headers: HeadersInit, source: WatchdogSource): Promise<IWatchdogStatus | undefined> {
		const result = await this._fetchJsonBounded<IWatchdogStatus>(url, { credentials: 'same-origin', cache: 'no-store', headers }, 4000);
		if (!result.response.ok) {
			throw new Error(`HTTP ${result.response.status}`);
		}
		if (!result.value?.active) {
			return undefined;
		}
		return { ...result.value, source };
	}

	private _sourceReady(source: WatchdogSource): boolean {
		return Date.now() >= (this._sourceNextAttempt.get(source) ?? 0);
	}

	/**
	 * 打不通的那一路自己退避：第一次失败仍按 5 秒重试，之后 10 / 20 / 40 秒，60 秒封顶；成功
	 * 一次立刻复位。LA 那一路走东京 Caddy 反代到洛杉矶，502 或者两机 token 漂移导致的 401 可
	 * 以持续几小时，原来的写法会照着 12 次/分一直跨太平洋打下去。
	 */
	private _recordSourceResult(source: WatchdogSource, ok: boolean): void {
		if (ok) {
			this._sourceFailures.delete(source);
			this._sourceNextAttempt.delete(source);
			return;
		}
		const failures = (this._sourceFailures.get(source) ?? 0) + 1;
		this._sourceFailures.set(source, failures);
		if (failures > 1) {
			this._sourceNextAttempt.set(source, Date.now() + Math.min(maxSourceRetryInterval, pollInterval * Math.pow(2, failures - 1)));
		}
	}

	private async _loadExternalToken(): Promise<void> {
		if (this._tokenLoading || Date.now() - this._lastTokenAttempt < 15000) {
			return;
		}
		this._tokenLoading = true;
		this._lastTokenAttempt = Date.now();
		try {
			const result = await this._fetchJsonBounded<IExternalTokenResponse>(externalTokenUrl, { credentials: 'same-origin', cache: 'no-store' }, 4000);
			const token = String(result.value?.token ?? '');
			if (result.response.ok && /^[A-Fa-f0-9]{64}$/.test(token)) {
				this._externalToken = token;
			}
		} catch {
			// A local-only watchdog remains useful when the external endpoint is unavailable.
		} finally {
			this._tokenLoading = false;
		}
	}

	private async _poll(): Promise<void> {
		if (this._targetWindow.document.hidden) {
			return;
		}
		if (this._polling) {
			return;
		}
		this._polling = true;
		try {
			if (!this._externalToken) {
				await this._loadExternalToken();
			}
			const sources: WatchdogSource[] = [];
			const requests: Promise<IWatchdogStatus | undefined>[] = [];
			if (this._sourceReady('tokyo')) {
				sources.push('tokyo');
				requests.push(this._readStatus(localStatusUrl, {}, 'tokyo'));
			}
			if (this._externalToken && this._sourceReady('la')) {
				sources.push('la');
				requests.push(this._readStatus(`${externalBaseUrl}/status`, { 'X-Tomoshibi-Watchdog-Token': this._externalToken }, 'la'));
			}
			if (!requests.length) {
				// 两路都在退避里，这一拍什么也不问。
				return;
			}
			const settled = await Promise.allSettled(requests);
			settled.forEach((item, index) => this._recordSourceResult(sources[index], item.status === 'fulfilled'));
			const values = settled
				.filter((item): item is PromiseFulfilledResult<IWatchdogStatus | undefined> => item.status === 'fulfilled')
				.map(item => item.value)
				.filter((item): item is IWatchdogStatus => item !== undefined)
				.sort((first, second) => Number(second.updatedAt ?? 0) - Number(first.updatedAt ?? 0));
			if (values.length) {
				this._show(values[0]);
				return;
			}
			// 到这里说明这一轮里成功的那几路都报了 inactive。收卡的判据是「画出这张卡的那一路
			// 亲口说没事了」，不是「所有端点都成功」：LA 反代 502 或者两机 token 漂移时那一路
			// 会一直 reject，按原来的判据卡片再也不会自动消失，压下的去重键也永远清不掉。
			const answered = new Set(sources.filter((_source, index) => settled[index].status === 'fulfilled'));
			const cardSource = this._current?.source;
			if (cardSource === undefined || answered.has(cardSource)) {
				this._hide();
			}
			if (this._dismissedSource === undefined || answered.has(this._dismissedSource)) {
				this._dismissedAlertKey = '';
				this._dismissedSource = undefined;
			}
		} finally {
			this._polling = false;
		}
	}

	private async _heartbeat(forcedVisible?: boolean): Promise<void> {
		const visible = typeof forcedVisible === 'boolean' ? forcedVisible : this._targetWindow.document.visibilityState === 'visible';
		if (!visible && forcedVisible !== false) {
			return;
		}
		const body = JSON.stringify({ clientId: this._clientId, visible });
		const requests = [this._fetchBounded(localHeartbeatUrl, {
			method: 'POST', credentials: 'same-origin', keepalive: true,
			headers: { 'Content-Type': 'application/json' }, body
		}, 4000)];
		if (this._externalToken) {
			requests.push(this._fetchBounded(`${externalBaseUrl}/heartbeat`, {
				method: 'POST', credentials: 'same-origin', keepalive: true,
				headers: {
					'Content-Type': 'application/json',
					'X-Tomoshibi-Watchdog-Token': this._externalToken
				}, body
			}, 4000));
		}
		await Promise.allSettled(requests);
	}

	private async _cancelRepair(): Promise<void> {
		const current = this._current;
		if (!current?.incidentId || this._cancelling) {
			return;
		}
		this._cancelling = true;
		this._syncCancelButton();
		const external = current.source === 'la';
		try {
			const response = await this._fetchBounded(external ? `${externalBaseUrl}/cancel` : localCancelUrl, {
				method: 'POST',
				credentials: 'same-origin',
				headers: external ? {
					'Content-Type': 'application/json',
					'X-Tomoshibi-Watchdog-Token': this._externalToken
				} : { 'Content-Type': 'application/json' },
				body: JSON.stringify({ incidentId: current.incidentId })
			}, 5000);
			if (response.status === 409) {
				this._cancelling = false;
				this._syncCancelButton();
				await this._poll();
				this._setNotice(localize('tomoshibiWatchdog.cancelConflict', "故障阶段已经变化或当前动作不可取消；这里显示的是最新状态。"), true);
				return;
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			this._setNotice(localize('tomoshibiWatchdog.cancelSent', "已发送停止请求；看门狗会阻止后续步骤并暂停 1 小时，已经提交的单个系统动作可能继续完成。"), false);
		} catch (error) {
			// 这里不能再走 _show(current)：current 是发请求之前抓的，await 期间轮询可能已经拿到
			// 新状态，整份重画等于把卡片回滚到旧状态。要改的只有按钮。
			this._cancelling = false;
			this._syncCancelButton();
			const message = error instanceof Error ? error.message : String(error);
			this._setNotice(localize('tomoshibiWatchdog.cancelFailed', "停止请求未送达，请再试一次。错误：{0}", message), true);
		}
	}
}

// workbench.html 里还挂着一份独立的 <script src="/_gate/static/watchdog-ui.js">，它在工作台起不来时
// 照样会弹告警卡片。两份都在会弹两张一模一样的卡，所以读它压下的那把去重键：脚本已经接管就不注册
// 这个贡献点。脚本 404（本地预览、网关没起）时键不会被置上，贡献点照常接手。
if (!(globalThis as { __tomoshibiWatchdogUi?: boolean }).__tomoshibiWatchdogUi) {
	registerWorkbenchContribution2(TomoshibiWatchdogContribution.ID, TomoshibiWatchdogContribution, WorkbenchPhase.AfterRestored);
}
