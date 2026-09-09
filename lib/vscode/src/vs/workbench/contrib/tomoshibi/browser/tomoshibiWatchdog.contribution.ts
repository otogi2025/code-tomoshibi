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
	private readonly _dismissButton: HTMLButtonElement;
	private readonly _cancelButton: HTMLButtonElement;
	private _current: IWatchdogStatus | undefined;
	private _dismissedAlertKey = '';
	private _dismissedAt = 0;
	private _externalToken = '';
	private _countdownTimer = 0;
	private _pollTimer = 0;
	private _heartbeatTimer = 0;
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
		this._cancelButton.hidden = value.cancellable !== true;
		this._cancelButton.disabled = this._cancelling;
		this._setCancelButtonLabel();
		this._updateCountdown();
		this._targetWindow.clearInterval(this._countdownTimer);
		this._countdownTimer = this._targetWindow.setInterval(() => this._updateCountdown(), 1000);
	}

	private _hide(): void {
		this._current = undefined;
		this._cancelling = false;
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
		this._hide();
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
			const requests: Promise<IWatchdogStatus | undefined>[] = [this._readStatus(localStatusUrl, {}, 'tokyo')];
			if (this._externalToken) {
				requests.push(this._readStatus(`${externalBaseUrl}/status`, { 'X-Tomoshibi-Watchdog-Token': this._externalToken }, 'la'));
			}
			const settled = await Promise.allSettled(requests);
			const values = settled
				.filter((item): item is PromiseFulfilledResult<IWatchdogStatus | undefined> => item.status === 'fulfilled')
				.map(item => item.value)
				.filter((item): item is IWatchdogStatus => item !== undefined)
				.sort((first, second) => Number(second.updatedAt ?? 0) - Number(first.updatedAt ?? 0));
			if (values.length) {
				this._show(values[0]);
			} else if (settled.every(item => item.status === 'fulfilled')) {
				this._dismissedAlertKey = '';
				this._hide();
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
		this._show(current);
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
				await this._poll();
				this._message.textContent = localize('tomoshibiWatchdog.cancelConflict', "故障阶段已经变化或当前动作不可取消；这里显示的是最新状态。");
				return;
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			this._message.textContent = localize('tomoshibiWatchdog.cancelSent', "已发送停止请求；看门狗会阻止后续步骤并暂停 1 小时，已经提交的单个系统动作可能继续完成。");
		} catch (error) {
			this._cancelling = false;
			this._show(current);
			const message = error instanceof Error ? error.message : String(error);
			this._message.textContent = localize('tomoshibiWatchdog.cancelFailed', "停止请求未送达，请再试一次。错误：{0}", message);
		}
	}
}

registerWorkbenchContribution2(TomoshibiWatchdogContribution.ID, TomoshibiWatchdogContribution, WorkbenchPhase.AfterRestored);
