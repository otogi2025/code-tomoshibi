/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// allow-any-unicode-file
import './media/tomoshibiTerminalStatus.css';
import { mainWindow } from '../../../../base/browser/window.js';
import { timeout } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { tomoshibiLatestIcon, tomoshibiUploadIcon } from '../../tomoshibi/browser/tomoshibiIcons.js';
import { ITerminalGroupService, ITerminalService, TerminalConnectionState } from './terminal.js';

/** Native Code-Tomoshibi controls. These replace the old extension and workbench.html proxies. */
export class TomoshibiTerminalStatusContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tomoshibiTerminalStatus';

	constructor(
		@IStatusbarService statusbarService: IStatusbarService,
		@ITerminalService terminalService: ITerminalService,
		@ITerminalGroupService terminalGroupService: ITerminalGroupService,
	) {
		super();
		void this._restoreTerminalFirstLayout(terminalService, terminalGroupService);
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
		await terminalService.whenConnected;

		// Persistent sessions have first refusal. Only create a shell when the
		// backend confirms there is nothing to reconnect, so refresh never closes
		// or duplicates an existing session.
		let instance = terminalGroupService.activeInstance ?? terminalGroupService.instances[0];
		if (!instance) {
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
