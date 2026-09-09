/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { IActionViewItem } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IAction } from '../../../../base/common/actions.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { IMenu, IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalService, terminalEditorId } from './terminal.js';
import { TerminalEditorInput } from './terminalEditorInput.js';
import { getTerminalActionBarArgs } from './terminalMenus.js';
import { TerminalCommandId } from '../common/terminal.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ITomoshibiSessionService } from './tomoshibiSessionService.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { openContextMenu } from './terminalContextMenu.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IBaseActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';

export class TerminalEditor extends EditorPane {

	private _editorInstanceElement: HTMLElement | undefined;
	private _overflowGuardElement: HTMLElement | undefined;

	private _editorInput?: TerminalEditorInput = undefined;

	private _lastDimension?: dom.Dimension;

	private readonly _instanceMenu: IMenu;

	private _cancelContextMenu: boolean = false;

	private readonly _newDropdown: MutableDisposable<DropdownWithPrimaryActionViewItem> = this._register(new MutableDisposable());

	private readonly _sessionDisposables = this._register(new DisposableStore());

	private readonly _disposableStore = this._register(new DisposableStore());

	/** 上一次用来搭新建下拉的分组签名，见 _updateTabActionBar。 */
	private _tabActionBarGroups: string | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ITerminalEditorService private readonly _terminalEditorService: ITerminalEditorService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IMenuService menuService: IMenuService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@ITomoshibiSessionService private readonly _sessionService: ITomoshibiSessionService,
		@IWorkbenchLayoutService private readonly _workbenchLayoutService: IWorkbenchLayoutService
	) {
		super(terminalEditorId, group, telemetryService, themeService, storageService);
		this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
		// The dropdown lists the Session groups, so it has to be rebuilt whenever they change.
		this._register(this._sessionService.onDidChange(() => this._updateTabActionBar()));
	}

	override async setInput(newInput: TerminalEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken) {
		this._editorInput?.terminalInstance?.detachFromElement();
		this._editorInput = newInput;
		await super.setInput(newInput, options, context, token);
		this._editorInput.terminalInstance?.attachToElement(this._overflowGuardElement!);
		if (this._lastDimension) {
			this.layout(this._lastDimension);
		}
		this._editorInput.terminalInstance?.setVisible(this.isVisible() && this._workbenchLayoutService.isVisible(Parts.EDITOR_PART, this.window));
		if (this._editorInput.terminalInstance) {
			// since the editor does not monitor focus changes, for ex. between the terminal
			// panel and the editors, this is needed so that the active instance gets set
			// when focus changes between them.
			this._sessionDisposables.add(this._editorInput.terminalInstance.onDidFocus(() => this._setActiveInstance()));
			this._editorInput.setCopyLaunchConfig(this._editorInput.terminalInstance.shellLaunchConfig);
		}
	}

	override clearInput(): void {
		super.clearInput();
		this._sessionDisposables.clear();
		if (this._overflowGuardElement && this._editorInput?.terminalInstance?.domElement.parentElement === this._overflowGuardElement) {
			this._editorInput.terminalInstance?.detachFromElement();
		}
		this._editorInput = undefined;
	}

	private _setActiveInstance(): void {
		if (!this._editorInput?.terminalInstance) {
			return;
		}
		this._terminalEditorService.setActiveInstance(this._editorInput.terminalInstance);
	}

	override focus() {
		super.focus();

		this._editorInput?.terminalInstance?.focus(true);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected createEditor(parent: HTMLElement): void {
		this._editorInstanceElement = parent;
		this._overflowGuardElement = dom.$('.terminal-overflow-guard.terminal-editor');
		this._editorInstanceElement.appendChild(this._overflowGuardElement);
		this._registerListeners();
	}

	private _registerListeners(): void {
		if (!this._editorInstanceElement) {
			return;
		}
		this._register(dom.addDisposableListener(this._editorInstanceElement, 'mousedown', async (event: MouseEvent) => {
			const terminal = this._terminalEditorService.activeInstance;
			if (this._terminalEditorService.instances.length > 0 && terminal) {
				const result = await terminal.handleMouseEvent(event, this._instanceMenu);
				if (typeof result === 'object' && result.cancelContextMenu) {
					this._cancelContextMenu = true;
				}
			}
		}));
		this._register(dom.addDisposableListener(this._editorInstanceElement, 'contextmenu', (event: MouseEvent) => {
			const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
			if (rightClickBehavior === 'nothing' && !event.shiftKey) {
				event.preventDefault();
				event.stopImmediatePropagation();
				this._cancelContextMenu = false;
				return;
			}
			else
				if (!this._cancelContextMenu && rightClickBehavior !== 'copyPaste' && rightClickBehavior !== 'paste') {
					if (!this._cancelContextMenu) {
						openContextMenu(this.window, event, this._editorInput?.terminalInstance, this._instanceMenu, this._contextMenuService);
					}
					event.preventDefault();
					event.stopImmediatePropagation();
					this._cancelContextMenu = false;
				}
		}));
	}

	/** 新建下拉的全部内容只取决于分组的 id 和名字（terminalMenus.ts 的 getTerminalActionBarArgs）。 */
	private _sessionGroupSignature(): string {
		return this._sessionService.groups.map(group => `${group.id}:${group.name}`).join('\n');
	}

	private _updateTabActionBar(): void {
		// onDidChange 是 sessionService._save() 统一 fire 的：改标题、置顶、换分组、折叠/展开都会来一次，
		// 而这个下拉只列分组。分组的 id 和名字没变就什么都不做。
		const signature = this._sessionGroupSignature();
		if (signature === this._tabActionBarGroups) {
			return;
		}
		this._tabActionBarGroups = signature;
		this._disposableStore.clear();
		const actions = getTerminalActionBarArgs(TerminalLocation.Editor, this._terminalService, this._sessionService, this._quickInputService, this._disposableStore);
		this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
	}

	layout(dimension: dom.Dimension): void {
		const instance = this._editorInput?.terminalInstance;
		if (instance) {
			instance.attachToElement(this._overflowGuardElement!);
			instance.layout(dimension);
		}
		this._lastDimension = dimension;
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);
		this._editorInput?.terminalInstance?.setVisible(visible && this._workbenchLayoutService.isVisible(Parts.EDITOR_PART, this.window));
	}

	override getActionViewItem(action: IAction, options: IBaseActionViewItemOptions): IActionViewItem | undefined {
		switch (action.id) {
			case TerminalCommandId.CreateTerminalEditorSameGroup: {
				if (action instanceof MenuItemAction) {
					const location = { viewColumn: ACTIVE_GROUP };
					this._disposableStore.clear();
					this._tabActionBarGroups = this._sessionGroupSignature();
					const actions = getTerminalActionBarArgs(location, this._terminalService, this._sessionService, this._quickInputService, this._disposableStore);
					this._newDropdown.value = this._instantiationService.createInstance(DropdownWithPrimaryActionViewItem, action, actions.dropdownAction, actions.dropdownMenuActions, actions.className, { hoverDelegate: options.hoverDelegate });
					this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
					return this._newDropdown.value;
				}
			}
		}
		return super.getActionViewItem(action, options);
	}
}
