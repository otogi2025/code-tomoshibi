/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Orientation } from '../../../../base/browser/ui/splitview/splitview.js';
import * as dom from '../../../../base/browser/dom.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IMenu, IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService, TerminalConnectionState } from './terminal.js';
import { openContextMenu } from './terminalContextMenu.js';
import { getInstanceHoverInfo } from './terminalTooltip.js';

const $ = dom.$;

const enum CssClass {
	ViewIsVertical = 'terminal-side-view',
}

/**
 * Code-Tomoshibi's terminal canvas.
 *
 * The upstream implementation also constructs a second Session list on the left or right of the
 * terminal. Code-Tomoshibi owns Session navigation in the horizontal title-bar switcher, so that
 * duplicate tree, its sash, drag target and listeners are deliberately absent here. This is a
 * source-level removal: no hidden or off-screen tab list is created.
 */
export class TerminalTabbedView extends Disposable {
	private readonly _terminalContainer: HTMLElement;
	private readonly _instanceMenu: IMenu;
	private _cancelContextMenu = false;
	private _height = 0;
	private _width = 0;

	constructor(
		parentElement: HTMLElement,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IHoverService private readonly _hoverService: IHoverService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();

		const terminalOuterContainer = $('.terminal-outer-container');
		this._terminalContainer = $('.terminal-groups-container');
		terminalOuterContainer.appendChild(this._terminalContainer);
		parentElement.appendChild(terminalOuterContainer);

		this._terminalService.setContainers(parentElement, this._terminalContainer);
		this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
		this._attachEventListeners(parentElement);

		this._register(this._terminalGroupService.onDidChangePanelOrientation(orientation => {
			this._terminalContainer.classList.toggle(CssClass.ViewIsVertical, orientation === Orientation.VERTICAL);
		}));
		this._register(Event.any(this._terminalGroupService.onDidChangeInstances, this._terminalGroupService.onDidChangeGroups)(() => {
			this._layoutGroups();
		}));
	}

	/** Kept for callers shared with upstream; there is no duplicate tab tree to render. */
	rerenderTabs(): void { }

	layout(width: number, height: number): void {
		this._width = width;
		this._height = height;
		this._layoutGroups();
	}

	private _layoutGroups(): void {
		if (this._width <= 0 || this._height <= 0) {
			return;
		}
		for (const group of this._terminalGroupService.groups) {
			group.layout(this._width, this._height);
		}
	}

	private _attachEventListeners(parentElement: HTMLElement): void {
		this._register(dom.addDisposableListener(this._terminalContainer, dom.EventType.MOUSE_DOWN, async (event: MouseEvent) => {
			const terminal = this._terminalGroupService.activeInstance;
			if (terminal) {
				const result = await terminal.handleMouseEvent(event, this._instanceMenu);
				if (typeof result === 'object' && result.cancelContextMenu) {
					this._cancelContextMenu = true;
				}
			}
		}));
		this._register(dom.addDisposableListener(this._terminalContainer, dom.EventType.CONTEXT_MENU, (event: MouseEvent) => {
			const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
			if (rightClickBehavior === 'nothing' && !event.shiftKey) {
				this._cancelContextMenu = true;
			}
			this._terminalContainer.focus();
			if (!this._cancelContextMenu) {
				openContextMenu(dom.getWindow(this._terminalContainer), event, this._terminalGroupService.activeInstance, this._instanceMenu, this._contextMenuService);
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			this._cancelContextMenu = false;
		}));
		this._register(dom.addDisposableListener(this._terminalContainer.ownerDocument, dom.EventType.KEY_DOWN, (event: KeyboardEvent) => {
			this._terminalContainer.classList.toggle('alt-active', !!event.altKey);
		}));
		this._register(dom.addDisposableListener(this._terminalContainer.ownerDocument, dom.EventType.KEY_UP, (event: KeyboardEvent) => {
			this._terminalContainer.classList.toggle('alt-active', !!event.altKey);
		}));
		this._register(dom.addDisposableListener(parentElement, dom.EventType.KEY_UP, (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				// Esc belongs to the terminal and must not close the panel.
				event.stopPropagation();
			}
		}));
	}

	/** Editing the removed side list has no visual target. */
	setEditable(_isEditing: boolean): void { }

	/** Commands that used to focus the side list now focus the active Session itself. */
	focusTabs(): void {
		this.focus();
	}

	focus(): void {
		if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
			this._terminalGroupService.activeInstance?.focusWhenReady();
			return;
		}

		const previousActiveElement = this._terminalContainer.ownerDocument.activeElement;
		if (!previousActiveElement) {
			return;
		}
		const listener = this._register(Event.once(this._terminalService.onDidChangeConnectionState)(() => {
			if (dom.isActiveElement(previousActiveElement)) {
				this._terminalGroupService.activeInstance?.focusWhenReady();
			}
			this._store.delete(listener);
		}));
	}

	focusHover(): void {
		const instance = this._terminalGroupService.activeInstance;
		if (!instance) {
			return;
		}
		this._hoverService.showInstantHover({
			...getInstanceHoverInfo(instance, this._storageService),
			target: this._terminalContainer,
			trapFocus: true,
		}, true);
	}
}
