/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// allow-any-unicode-file
import './media/tomoshibiTerminalStatus.css';
import { mainWindow } from '../../../../base/browser/window.js';
import { toAction } from '../../../../base/common/actions.js';
import { timeout } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { tomoshibiLatestIcon, tomoshibiUploadIcon } from '../../tomoshibi/browser/tomoshibiIcons.js';
import { ITerminalGroupService, ITerminalService, TerminalConnectionState } from './terminal.js';

/**
 * `whenConnected` 最多等这么久。⛔ 不许裸 await 它：它是个只会 complete、永不 reject 的
 * DeferredPromise，重连链上任何一步挂住，整个产品就再也打不开终端，而且界面上什么都看不到
 * （启动遮罩 7 秒后照样自己摘掉，用户看到的是一个「加载完成」的空工作台）。
 * 取 12 秒是给分批恢复留的余量：组之间插了 350ms，每个实例的重放还有 5 秒上限
 * （terminalService.ts 的 REPLAY_COMPLETE_TIMEOUT_MS）。
 */
const WHEN_CONNECTED_TIMEOUT_MS = 12000;

/** Native Code-Tomoshibi controls. These replace the old extension and workbench.html proxies. */
export class TomoshibiTerminalStatusContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tomoshibiTerminalStatus';

	constructor(
		@IStatusbarService statusbarService: IStatusbarService,
		@ITerminalService terminalService: ITerminalService,
		@ITerminalGroupService terminalGroupService: ITerminalGroupService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
	) {
		super();
		// ⛔ 不许裸 `void`：这条链是「产品能不能打开终端」的唯一入口，异常被吞掉就等于静默白屏。
		this._restoreTerminalFirstLayout(terminalService, terminalGroupService).catch(error => {
			this._logService.error('[tomoshibi] failed to restore the first terminal layout', error);
			this._notificationService.notify({
				severity: Severity.Error,
				message: localize('tomoshibi.terminal.restoreFailed', "终端没能打开。点「重试」再试一次，或者刷新页面。"),
				actions: {
					primary: [toAction({
						id: 'tomoshibi.terminal.retryRestore',
						label: localize('tomoshibi.terminal.retry', "重试"),
						run: () => this._restoreTerminalFirstLayout(terminalService, terminalGroupService),
					})]
				}
			});
		});
		this._releaseBootMaskAfterFirstTerminalPaint(terminalService);

		// Esc is no longer a status bar item: it is the permanent key at the top-left corner
		// next to the compact menu (see ActivitybarPart.createTomoshibiEscapeKey).

		this._register(statusbarService.addEntry({
			name: localize('tomoshibi.status.latest.name', "回到终端最新输出"),
			text: `$(${tomoshibiLatestIcon.id}) ${localize('tomoshibi.status.latest.text', "回到最新")}`,
			ariaLabel: localize('tomoshibi.status.latest.ariaLabel', "回到当前终端最新输出"),
			tooltip: localize('tomoshibi.status.latest.tooltip', "滚动到当前终端的最新输出"),
			command: 'tomoshibi.scrollBottom',
			showInAllWindows: true,
		}, 'status.tomoshibi.latest', StatusbarAlignment.RIGHT, 895));

		this._register(statusbarService.addEntry({
			name: localize('tomoshibi.status.upload.name', "上传文件"),
			text: `$(${tomoshibiUploadIcon.id}) ${localize('tomoshibi.status.upload.text', "上传文件")}`,
			ariaLabel: localize('tomoshibi.status.upload.ariaLabel', "上传文件并把路径插入当前终端"),
			tooltip: localize('tomoshibi.status.upload.tooltip', "上传到当前终端目录，并把路径插入输入位置"),
			command: 'tomoshibi.upload',
			showInAllWindows: true,
		}, 'status.tomoshibi.upload', StatusbarAlignment.RIGHT, 890));

		this._register(statusbarService.addEntry({
			name: 'MADE BY ITSUKI',
			text: 'MADE BY ITSUKI',
			ariaLabel: localize('tomoshibi.status.logout.ariaLabel', "MADE BY ITSUKI，点击回到密码页"),
			tooltip: localize('tomoshibi.status.logout.tooltip', "回到密码页"),
			command: 'tomoshibi.logout',
			showInAllWindows: true,
		}, 'status.tomoshibi.logout', StatusbarAlignment.RIGHT, -Number.MAX_VALUE));
	}

	private async _restoreTerminalFirstLayout(terminalService: ITerminalService, terminalGroupService: ITerminalGroupService): Promise<void> {
		const connected = await Promise.race([
			terminalService.whenConnected.then(() => true),
			timeout(WHEN_CONNECTED_TIMEOUT_MS).then(() => false),
		]);
		if (!connected) {
			this._logService.warn(`[tomoshibi] terminal backend did not report connected within ${WHEN_CONNECTED_TIMEOUT_MS}ms, opening the panel anyway`);
		}

		// Persistent sessions have first refusal. Only create a shell when the
		// backend confirms there is nothing to reconnect, so refresh never closes
		// or duplicates an existing session.
		let instance = terminalGroupService.activeInstance ?? terminalGroupService.instances[0];
		if (!instance) {
			if (!connected && terminalService.restoredGroupCount > 0) {
				// ⛔ 超时兜底不许在这里另建终端：后端明明还在恢复 Session，抢在它前面建一个就变成
				// 「刷新一次多一个」。让恢复自己走完（terminalView 的兜底也只在 instances 为空时才建）。
				this._logService.warn('[tomoshibi] terminal restore still in flight, not creating a duplicate shell');
				return;
			}
			instance = await terminalService.createTerminal({ location: TerminalLocation.Panel });
		}
		terminalGroupService.setActiveInstance(instance);
		await terminalGroupService.showPanel(false);
	}

	/**
	 * The HTML owns only a static dark boot mask. Its release is driven by the real terminal
	 * lifecycle here, after the active xterm write queue drains, so startup no longer polls or
	 * repeatedly measures workbench DOM from an injected page script.
	 */
	private _releaseBootMaskAfterFirstTerminalPaint(terminalService: ITerminalService): void {
		const root = mainWindow.document.documentElement;
		if (!root.classList.contains('__tomoshibiBooting__')) {
			return;
		}
		let released = false;
		const release = () => {
			if (released) {
				return;
			}
			released = true;
			root.classList.add('__tomoshibiReady__');
			void timeout(180).then(() => root.classList.remove('__tomoshibiBooting__', '__tomoshibiReady__'));
		};
		const releaseWhenConnected = () => {
			if (terminalService.connectionState !== TerminalConnectionState.Connected) {
				return;
			}
			const raw = terminalService.activeInstance?.xterm?.raw;
			if (raw) {
				raw.write('', release);
			} else {
				mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(release));
			}
		};
		this._register(terminalService.onDidChangeConnectionState(releaseWhenConnected));
		releaseWhenConnected();
		void timeout(7000).then(release);
	}
}
