/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* This is the code-server integration shim, not workbench code: it runs once on the main
 * window's startup path and talks to an embedding parent frame over `window` / `parent`, so
 * the multi-window (`mainWindow` / `targetWindow`) rules do not apply to it. Kept verbatim
 * from upstream code-server apart from deliberate Code-Tomoshibi removals. */
/* eslint-disable no-restricted-globals, no-restricted-syntax, local/code-no-in-operator, local/code-no-unexternalized-strings, @typescript-eslint/no-explicit-any */

import { Disposable } from "../../base/common/lifecycle.js";
import { localize } from '../../nls.js';
import { MenuId, MenuRegistry } from '../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../platform/commands/common/commands.js';
import { ILogService } from '../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../platform/notification/common/notification.js';
import { IProductService } from '../../platform/product/common/productService.js';

export class CodeServerClient extends Disposable {
	static LOGOUT_COMMAND_ID = 'code-server.logout';

	constructor(
		@ILogService private logService: ILogService,
		@INotificationService private notificationService: INotificationService,
		@IProductService private productService: IProductService,
	) {
		super();
	}

	async startup(): Promise<void> {
		// Emit ready events
		const event = new CustomEvent('ide-ready');
		window.dispatchEvent(event);

		if (parent) {
			// Tell the parent loading has completed.
			parent.postMessage({ event: 'loaded' }, '*');

			// Proxy or stop proxing events as requested by the parent.
			const listeners = new Map<string, (event: Event) => void>();

			window.addEventListener('message', parentEvent => {
				const eventName = parentEvent.data.bind || parentEvent.data.unbind;
				if (eventName) {
					const oldListener = listeners.get(eventName);
					if (oldListener) {
						document.removeEventListener(eventName, oldListener);
					}
				}

				if (parentEvent.data.bind && parentEvent.data.prop) {
					const listener = (event: Event) => {
						parent?.postMessage(
							{
								event: parentEvent.data.event,
								[parentEvent.data.prop]: event[parentEvent.data.prop as keyof Event],
							},
							window.location.origin,
						);
					};
					listeners.set(parentEvent.data.bind, listener);
					document.addEventListener(parentEvent.data.bind, listener);
				}
			});
		}

		if (!window.isSecureContext) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize(
					'insecureContext',
					"{0} is being accessed in an insecure context. Web views, the clipboard, and other functionality may not work as expected.",
					'code-server',
				),
				actions: {
					primary: [
						{
							id: 'understand',
							label: localize('confirmInsecure', "I understand"),
							tooltip: '',
							class: undefined,
							enabled: true,
							checked: true,
							run: () => {
								return Promise.resolve();
							},
						},
					],
				},
			});
		}

		if (this.productService.logoutEndpoint) {
			this.addLogoutCommand(this.productService.logoutEndpoint);
		}

		if (this.productService.serviceWorker) {
			await this.registerServiceWorker(this.productService.serviceWorker);
		}
	}

	private addLogoutCommand(logoutEndpoint: string) {
		CommandsRegistry.registerCommand(CodeServerClient.LOGOUT_COMMAND_ID, () => {
			const logoutUrl = new URL(logoutEndpoint, window.location.href);
			// Cookies must be set with absolute paths and must use the same path to
			// be unset (we set it on the root) so send the relative root and the
			// current href so the backend can derive the absolute path to the root.
			logoutUrl.searchParams.set('base', this.productService.rootEndpoint || ".");
			logoutUrl.searchParams.set('href', window.location.href);
			window.location.assign(logoutUrl);
		});

		for (const menuId of [MenuId.CommandPalette, MenuId.MenubarHomeMenu]) {
			MenuRegistry.appendMenuItem(menuId, {
				command: {
					id: CodeServerClient.LOGOUT_COMMAND_ID,
					title: localize('logout', "Sign out of {0}", 'code-server'),
				},
			});
		}
	}

	private async registerServiceWorker(serviceWorker: { path: string; scope: string }) {
		if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
			try {
				await navigator.serviceWorker.register(serviceWorker.path, {
					scope: serviceWorker.scope,
				});
				this.logService.info('[Service Worker] registered');
			} catch (error: any) {
				this.logService.error('[Service Worker] registration', error as Error);
			}
		}
	}
}
