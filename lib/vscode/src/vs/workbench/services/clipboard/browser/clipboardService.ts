/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { BrowserClipboardService as BaseBrowserClipboardService } from '../../../../platform/clipboard/browser/clipboardService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { ITomoshibiClipboardHistoryService } from '../common/tomoshibiClipboardHistory.js';

// Registers the clipboard history singleton this file records into.
import './tomoshibiClipboardHistoryService.js';

export class BrowserClipboardService extends BaseBrowserClipboardService {

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILogService logService: ILogService,
		@ILayoutService layoutService: ILayoutService,
		@ITomoshibiClipboardHistoryService private readonly tomoshibiClipboardHistoryService: ITomoshibiClipboardHistoryService
	) {
		super(layoutService, logService);
	}

	override async writeText(text: string, type?: string): Promise<void> {
		this.logService.trace('BrowserClipboardService#writeText called with type:', type, ' with text.length:', text.length);
		if (type === undefined) {
			// Only the real system clipboard is worth remembering. A caller passing a type is using
			// the in-memory clipboard (custom mime types, and the test harness below).
			this.tomoshibiClipboardHistoryService.record(text);
		}
		if (!!this.environmentService.extensionTestsLocationURI && typeof type !== 'string') {
			type = 'vscode-tests'; // force in-memory clipboard for tests to avoid permission issues
		}
		this.logService.trace('BrowserClipboardService#super.writeText');
		return super.writeText(text, type);
	}

	override async readText(type?: string): Promise<string> {
		this.logService.trace('BrowserClipboardService#readText called with type:', type);
		if (!!this.environmentService.extensionTestsLocationURI && typeof type !== 'string') {
			type = 'vscode-tests'; // force in-memory clipboard for tests to avoid permission issues
		}

		if (type) {
			this.logService.trace('BrowserClipboardService#super.readText');
			return super.readText(type);
		}

		try {
			const readText = await getActiveWindow().navigator.clipboard.readText();
			this.logService.trace('BrowserClipboardService#readText with readText.length:', readText.length);
			return readText;
		} catch (error) {
			return new Promise<string>(resolve => {

				// Inform user about permissions problem (https://github.com/microsoft/vscode/issues/112089)
				const listener = new DisposableStore();
				const handle = this.notificationService.prompt(
					Severity.Error,
					localize('clipboardError', "无法从浏览器的剪贴板中读取。请确保你已授予此网站从剪贴板中读取的访问权限。"),
					[{
						label: localize('retry', "重试"),
						run: async () => {
							listener.dispose();
							resolve(await this.readText(type));
						}
					}, {
						label: localize('learnMore', "了解详细信息"),
						run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2151362')
					}],
					{
						sticky: true
					}
				);

				// Always resolve the promise once the notification closes
				listener.add(Event.once(handle.onDidClose)(() => resolve('')));
			});
		}
	}
}

registerSingleton(IClipboardService, BrowserClipboardService, InstantiationType.Delayed);
