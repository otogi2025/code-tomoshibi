/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import { Action, IAction } from '../../../../base/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService, IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { INotificationService, IPromptChoice, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalInstance, ITerminalService, TerminalConnectionState } from './terminal.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { TerminalCommandId } from '../common/terminal.js';
import { TerminalSettingId, TerminalLocation, TitleEventSource } from '../../../../platform/terminal/common/terminal.js';
import { ActionViewItem, BaseActionViewItem, IBaseActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IActionViewItem } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { TerminalTabbedView } from './terminalTabbedView.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { DisposableMap, DisposableStore, dispose, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { createSessionGroup, getTerminalActionBarArgs } from './terminalMenus.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { TerminalCapability } from '../../../../platform/terminal/common/capabilities/capabilities.js';
import { Event } from '../../../../base/common/event.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { EventType as TouchEventType, GestureEvent } from '../../../../base/browser/touch.js';
import { ITomoshibiSessionGroup, ITomoshibiSessionService } from './tomoshibiSessionService.js';
import { chooseTomoshibiSessionGroup, closeTomoshibiSession, renameTomoshibiSession, setTomoshibiSessionPinned, TOMOSHIBI_SESSION_TREE_ACTION_ID } from './terminalActions.js';

export class TerminalViewPane extends ViewPane {
	private _parentDomElement: HTMLElement | undefined;
	private _terminalTabbedView?: TerminalTabbedView;
	get terminalTabbedView(): TerminalTabbedView | undefined { return this._terminalTabbedView; }
	private _isInitialized: boolean = false;
	/**
	 * Tracks an active promise of terminal creation requested by this component. This helps prevent
	 * double creation for example when toggling a terminal's visibility and focusing it.
	 */
	private _isTerminalBeingCreated: boolean = false;
	private readonly _newDropdown: MutableDisposable<DropdownWithPrimaryActionViewItem> = this._register(new MutableDisposable());
	private _viewShowing: IContextKey<boolean>;
	private readonly _activeSessionPinned: IContextKey<boolean>;
	private readonly _disposableStore = this._register(new DisposableStore());
	private readonly _actionDisposables: DisposableMap<string> = this._register(new DisposableMap());

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITomoshibiSessionService private readonly _sessionService: ITomoshibiSessionService,
	) {
		super(options, keybindingService, contextMenuService, _configurationService, _contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService);
		this._register(this._terminalService.onDidRegisterProcessSupport(() => {
			this._onDidChangeViewWelcomeState.fire();
		}));

		this._register(this._terminalService.onDidChangeInstances(() => {
			// If the first terminal is opened, hide the welcome view
			// and if the last one is closed, show it again
			if (this._hasWelcomeScreen() && this._terminalGroupService.instances.length <= 1) {
				this._onDidChangeViewWelcomeState.fire();
			}
			if (!this._parentDomElement) { return; }
			// If we do not have the tab view yet, create it now.
			if (!this._terminalTabbedView) {
				this._createTabsView();
			}
			this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
		}));
		// The dropdown lists the Session groups, so it has to be rebuilt whenever they change.
		this._register(this._sessionService.onDidChange(() => this._updateTabActionBar()));
		this._viewShowing = TerminalContextKeys.viewShowing.bindTo(this._contextKeyService);
		this._activeSessionPinned = TerminalContextKeys.tomoshibiActiveSessionPinned.bindTo(this._contextKeyService);
		const updateActiveSessionPinned = () => {
			const instance = this._terminalGroupService.activeInstance;
			this._activeSessionPinned.set(!!instance && this._sessionService.isPinned(instance));
		};
		this._register(this._terminalService.onDidChangeActiveInstance(updateActiveSessionPinned));
		this._register(this._sessionService.onDidChange(updateActiveSessionPinned));
		updateActiveSessionPinned();
		this._register(this.onDidChangeBodyVisibility(e => {
			if (e) {
				this._terminalTabbedView?.rerenderTabs();
			}
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (this._parentDomElement && (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled) || e.affectsConfiguration(TerminalSettingId.ShellIntegrationEnabled))) {
				this._updateForShellIntegration(this._parentDomElement);
			}
		}));
		const shellIntegrationDisposable = this._register(new MutableDisposable());
		shellIntegrationDisposable.value = this._terminalService.onAnyInstanceAddedCapabilityType(c => {
			if (c === TerminalCapability.CommandDetection && this._gutterDecorationsEnabled()) {
				this._parentDomElement?.classList.add('shell-integration');
				shellIntegrationDisposable.clear();
			}
		});
	}

	/**
	 * iPad 上点 ⌄ 不弹菜单、反而直接新建了一个 Session，病根在手势派发而不在这里的业务代码：
	 * base/browser/touch.ts 的 dispatchEvent 会把同一个 tap **逐个派发**给每一层注册过的祖先目标，
	 * 而每次 dispatchEvent 结束时浏览器都会清掉 stopPropagation 标志，所以上一层里调过的
	 * EventHelper.stop 拦不住下一次派发。+/⌄ 这个复合按钮的最外层容器由 BaseActionViewItem.render
	 * 注册成了 tap 目标，它的处理器跑的是 primary action（＝新建终端）：于是点 ⌄ 变成「展开菜单 ＋
	 * 新建终端」，而新建终端又会走 _updateTabActionBar 重建下拉、把刚展开的菜单一起销毁，肉眼看到的
	 * 就是「菜单没出来，多了一个 Session」；同理点 + 会连开两个终端。
	 * 左右两半各自都有更深一层的 tap 目标（.action-container 与 .dropdown-label）在处理这次点击，
	 * 最外层这一次派发纯属重复，捕获阶段掐掉即可：+ 只建一个终端，⌄ 只展开菜单。
	 */
	private _registerDropdownTapGuard(container: HTMLElement): void {
		const targetWindow = dom.getWindow(container);
		this._register(dom.addDisposableListener(targetWindow.document, TouchEventType.Tap, (event: GestureEvent) => {
			if (dom.isHTMLElement(event.target) && event.target.classList.contains('monaco-dropdown-with-primary')) {
				event.stopPropagation();
			}
		}, true));
	}

	private _updateForShellIntegration(container: HTMLElement) {
		container.classList.toggle('shell-integration', this._gutterDecorationsEnabled());
	}

	private _gutterDecorationsEnabled(): boolean {
		const decorationsEnabled = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
		return (decorationsEnabled === 'both' || decorationsEnabled === 'gutter') && this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled);
	}

	private _initializeTerminal(checkRestoredTerminals: boolean) {
		if (this.isBodyVisible() && this._terminalService.isProcessSupportRegistered && this._terminalService.connectionState === TerminalConnectionState.Connected) {
			const wasInitialized = this._isInitialized;
			this._isInitialized = true;

			let hideOnStartup: 'never' | 'whenEmpty' | 'always' = 'never';
			if (!wasInitialized) {
				hideOnStartup = this._configurationService.getValue(TerminalSettingId.HideOnStartup);
				if (hideOnStartup === 'always') {
					this._terminalGroupService.hidePanel();
				}
			}

			let shouldCreate = this._terminalGroupService.groups.length === 0;
			// When triggered just after reconnection, also check there are no groups that could be
			// getting restored currently
			if (checkRestoredTerminals) {
				shouldCreate &&= this._terminalService.restoredGroupCount === 0;
			}
			if (!shouldCreate) {
				return;
			}
			if (!wasInitialized) {
				switch (hideOnStartup) {
					case 'never':
						this._isTerminalBeingCreated = true;
						this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
						break;
					case 'whenEmpty':
						if (this._terminalService.restoredGroupCount === 0) {
							this._terminalGroupService.hidePanel();
						}
						break;
				}
				return;
			}

			if (!this._isTerminalBeingCreated) {
				this._isTerminalBeingCreated = true;
				this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		if (!this._parentDomElement) {
			this._updateForShellIntegration(container);
		}
		this._parentDomElement = container;
		this._parentDomElement.classList.add('integrated-terminal');
		this._registerDropdownTapGuard(container);
		if (!this.shouldShowWelcome()) {
			this._createTabsView();
		}

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TerminalSettingId.FontFamily) || e.affectsConfiguration('editor.fontFamily')) {
				if (!this._terminalConfigurationService.configFontIsMonospace()) {
					const choices: IPromptChoice[] = [{
						label: nls.localize('terminal.useMonospace', "使用 \"monospace\""),
						run: () => this.configurationService.updateValue(TerminalSettingId.FontFamily, 'monospace'),
					}];
					this._notificationService.prompt(Severity.Warning, nls.localize('terminal.monospaceOnly', "终端仅支持等宽字体。如果这是新安装的字体，请确保重新启动 VS Code。"), choices);
				}
			}
		}));
		this._register(this.onDidChangeBodyVisibility(async visible => {
			this._viewShowing.set(visible);
			if (visible) {
				if (this._hasWelcomeScreen()) {
					this._onDidChangeViewWelcomeState.fire();
				}
				this._initializeTerminal(false);
				// we don't know here whether or not it should be focused, so
				// defer focusing the panel to the focus() call
				// to prevent overriding preserveFocus for extensions
				this._terminalGroupService.showPanel(false);
			} else {
				for (const instance of this._terminalGroupService.instances) {
					instance.resetFocusContextKey();
				}
			}
			this._terminalGroupService.updateVisibility();
		}));
		this._register(this._terminalService.onDidChangeConnectionState(() => this._initializeTerminal(true)));
		this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
	}

	private _createTabsView(): void {
		if (!this._parentDomElement) {
			return;
		}
		this._terminalTabbedView = this._register(this.instantiationService.createInstance(TerminalTabbedView, this._parentDomElement));
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._terminalTabbedView?.layout(width, height);
	}

	override createActionViewItem(action: Action, options: IBaseActionViewItemOptions): IActionViewItem | undefined {
		switch (action.id) {
			case TerminalCommandId.Split: {
				// Split needs to be special cased to force splitting within the panel, not the editor
				const that = this;
				const store = new DisposableStore();
				const panelOnlySplitAction = store.add(new class extends Action {
					constructor() {
						super(action.id, action.label, action.class, action.enabled);
						this.checked = action.checked;
						this.tooltip = action.tooltip;
					}
					override async run() {
						const instance = that._terminalGroupService.activeInstance;
						if (instance) {
							const newInstance = await that._terminalService.createTerminal({ location: { parentTerminal: instance } });
							return newInstance?.focusWhenReady();
						}
						return;
					}
				});
				const item = store.add(new ActionViewItem(action, panelOnlySplitAction, { ...options, icon: true, label: false, keybinding: this._getKeybindingLabel(action) }));
				this._actionDisposables.set(action.id, store);
				return item;
			}
			case TerminalCommandId.SwitchTerminal: {
				const item = this._instantiationService.createInstance(SwitchTerminalActionViewItem, action);
				this._actionDisposables.set(action.id, item);
				return item;
			}
			case TOMOSHIBI_SESSION_TREE_ACTION_ID: {
				const item = this._instantiationService.createInstance(TomoshibiSessionTreeActionViewItem, action, options);
				this._actionDisposables.set(action.id, item);
				return item;
			}
			case TerminalCommandId.New: {
				if (action instanceof MenuItemAction) {
					this._disposableStore.clear();
					const actions = getTerminalActionBarArgs(TerminalLocation.Panel, this._terminalService, this._sessionService, undefined, this._disposableStore, () => this._newDropdown.value?.element);
					this._newDropdown.value = this._instantiationService.createInstance(DropdownWithPrimaryActionViewItem, action, actions.dropdownAction, actions.dropdownMenuActions, actions.className, {
						hoverDelegate: options.hoverDelegate,
						getKeyBinding: (action: IAction) => this._keybindingService.lookupKeybinding(action.id, this._contextKeyService)
					});
					this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
					return this._newDropdown.value;
				}
			}
		}
		return super.createActionViewItem(action, options);
	}

	private _getKeybindingLabel(action: IAction): string | undefined {
		return this._keybindingService.lookupKeybinding(action.id)?.getLabel() ?? undefined;
	}

	private _updateTabActionBar(): void {
		this._disposableStore.clear();
		const actions = getTerminalActionBarArgs(TerminalLocation.Panel, this._terminalService, this._sessionService, undefined, this._disposableStore, () => this._newDropdown.value?.element);
		this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
	}

	override focus() {
		super.focus();
		if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
			if (this._terminalGroupService.instances.length === 0 && !this._isTerminalBeingCreated) {
				this._isTerminalBeingCreated = true;
				this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
			}
			this._terminalGroupService.showPanel(true);
			return;
		}

		// If the terminal is waiting to reconnect to remote terminals, then there is no TerminalInstance yet that can
		// be focused. So wait for connection to finish, then focus.
		const previousActiveElement = this.element.ownerDocument.activeElement;
		if (previousActiveElement) {
			const listener = this._register(Event.once(this._terminalService.onDidChangeConnectionState)(() => {
				// Only focus the terminal if the activeElement has not changed since focus() was called
				if (previousActiveElement && dom.isActiveElement(previousActiveElement)) {
					this._terminalGroupService.showPanel(true);
				}
				this._store.delete(listener);
			}));
		}
	}

	private _hasWelcomeScreen(): boolean {
		return !this._terminalService.isProcessSupportRegistered;
	}

	override shouldShowWelcome(): boolean {
		return this._hasWelcomeScreen() && this._terminalService.instances.length === 0;
	}
}
const TOMOSHIBI_PILL_CLASS = 'tomoshibi-terminal-session-tab';
const TOMOSHIBI_WRAP_CLASS = 'tomoshibi-terminal-session-group-wrap';
const TOMOSHIBI_CHIP_CLASS = 'tomoshibi-terminal-session-chip';
const TOMOSHIBI_TREE_CLASS = 'tomoshibi-session-tree';
/** Touch long press that promotes a press into a drag. Shorter than a context menu press. */
const TOMOSHIBI_DRAG_LONG_PRESS_MS = 220;
/** A finger that travels this far before the timer fires is scrolling the strip, not dragging. */
const TOMOSHIBI_DRAG_SLOP_TOUCH = 8;
/** A mouse never waits: it starts dragging as soon as it clearly moves. */
const TOMOSHIBI_DRAG_SLOP_MOUSE = 6;
/** Suppresses the synthesized click that follows the pointer sequence of a drag. */
const TOMOSHIBI_DRAG_CLICK_GUARD_MS = 350;
/** Auto-scroll band at either end of the strip while dragging. */
const TOMOSHIBI_DRAG_EDGE_PX = 30;
const TOMOSHIBI_DRAG_EDGE_STEP_PX = 14;

const TOMOSHIBI_POPOVER_CLASS = 'tomoshibi-session-popover';

/** 自制浮层里的一行。`icon` 是 codicon 名（不带 `codicon-` 前缀），`description` 画在行尾。 */
export interface ITomoshibiPopoverChoice {
	readonly id: string;
	readonly label: string;
	readonly icon?: string;
	readonly description?: string;
	/** 当前就是这一项（例如正在用的 Session、已经在的分组），只影响样式。 */
	readonly current?: boolean;
}

/**
 * 浮层挂在 .monaco-workbench 上而不是 body：主题色全是定义在它身上的 CSS 变量，挂到 body 会取不到色
 * （拖拽克隆体 .tomoshibi-terminal-session-fly 当初也栽在这上面）。
 */
function tomoshibiPopoverHost(anchor: HTMLElement | undefined, targetWindow: Window): HTMLElement {
	const fromAnchor = anchor?.closest('.monaco-workbench');
	if (dom.isHTMLElement(fromAnchor)) {
		return fromAnchor;
	}
	// 一个按钮都拿不到时只剩按类名找这一条路。
	// eslint-disable-next-line no-restricted-syntax
	const workbench = targetWindow.document.querySelector('.monaco-workbench');
	return dom.isHTMLElement(workbench) ? workbench : targetWindow.document.body;
}

/**
 * 触发浮层的那个按钮。没传就退回面板标题栏：Session 相关的入口全长在这条标题栏上，从标题栏命令
 * 或命令面板进来时拿不到具体按钮，贴着标题栏下沿仍然是对的位置。
 */
function tomoshibiPopoverAnchor(anchor: HTMLElement | undefined, targetWindow: Window): HTMLElement | undefined {
	if (anchor?.isConnected) {
		return anchor;
	}
	// eslint-disable-next-line no-restricted-syntax
	const title = targetWindow.document.querySelector('.part.panel > .title');
	return dom.isHTMLElement(title) ? title : undefined;
}

/** 贴着触发按钮的下沿展开，右边缘永远对齐窗口右侧（设计要求：弹窗紧贴窗口右沿）。 */
function tomoshibiLayoutPopover(root: HTMLElement, anchor: HTMLElement | undefined, targetWindow: Window): void {
	const margin = 8;
	const gap = 4;
	const viewHeight = targetWindow.innerHeight;
	const rect = anchor?.getBoundingClientRect();
	const top = rect ? rect.bottom + gap : margin;
	const spaceBelow = viewHeight - top - margin;
	const spaceAbove = rect ? rect.top - gap - margin : 0;
	root.style.right = `${margin}px`;
	if (rect && spaceAbove > spaceBelow) {
		// 面板贴着屏幕下沿时下面根本没地方，往上开。
		root.style.bottom = `${viewHeight - rect.top + gap}px`;
		root.style.maxHeight = `${spaceAbove}px`;
	} else {
		root.style.top = `${top}px`;
		root.style.maxHeight = `${Math.max(160, spaceBelow)}px`;
	}
}

/**
 * Session 相关的所有询问都走这个自制浮层，⛔ 不再用 IQuickInputService：原生 quick input 是个带搜索框的
 * 居中大浮层，离触发它的按钮十万八千里，搜索框在 iPad 上还会把软键盘顶起来（2026-09-07 拍板换掉）。
 */
function openTomoshibiPopover<T>(anchor: HTMLElement | undefined, render: (root: HTMLElement, store: DisposableStore, finish: (value: T | undefined) => void) => void): Promise<T | undefined> {
	const targetWindow = anchor ? dom.getWindow(anchor) : dom.getActiveWindow();
	const resolvedAnchor = tomoshibiPopoverAnchor(anchor, targetWindow);
	const root = dom.append(tomoshibiPopoverHost(resolvedAnchor, targetWindow), dom.$(`.${TOMOSHIBI_POPOVER_CLASS}`));
	const store = new DisposableStore();
	// 关掉之后把焦点还回原处，否则外接键盘会失去落点、终端收不到按键。
	const previous = targetWindow.document.activeElement;
	return new Promise<T | undefined>(resolve => {
		let settled = false;
		const finish = (value: T | undefined) => {
			if (settled) {
				return;
			}
			settled = true;
			store.dispose();
			root.remove();
			if (dom.isHTMLElement(previous) && previous.isConnected) {
				previous.focus();
			}
			resolve(value);
		};
		render(root, store, finish);
		tomoshibiLayoutPopover(root, resolvedAnchor, targetWindow);
		store.add(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_DOWN, event => {
			const target = event.target;
			if (dom.isHTMLElement(target) && (target.closest(`.${TOMOSHIBI_POPOVER_CLASS}`) || resolvedAnchor?.contains(target))) {
				return;
			}
			finish(undefined);
		}, true));
		store.add(dom.addDisposableListener(targetWindow.document, dom.EventType.KEY_DOWN, event => {
			if (event.key === 'Escape') {
				dom.EventHelper.stop(event, true);
				finish(undefined);
			}
		}, true));
	});
}

/**
 * 选择型浮层：一列可点的行，⛔ 没有搜索框。每行最小 44px 高、整行可点，外接键盘用上下键走、回车选。
 * 返回选中项的 id，取消返回 undefined。
 */
export function pickTomoshibiChoice(anchor: HTMLElement | undefined, title: string, choices: readonly ITomoshibiPopoverChoice[]): Promise<string | undefined> {
	return openTomoshibiPopover<string>(anchor, (root, store, finish) => {
		dom.append(root, dom.$('.tomoshibi-session-popover-title')).textContent = title;
		const list = dom.append(root, dom.$('.tomoshibi-session-popover-list'));
		const rows: HTMLButtonElement[] = [];
		for (const choice of choices) {
			const row = dom.append(list, dom.$('button.tomoshibi-session-popover-row')) as HTMLButtonElement;
			row.type = 'button';
			row.classList.toggle('is-current', !!choice.current);
			const icon = dom.append(row, dom.$('span.tomoshibi-session-popover-icon'));
			if (choice.icon) {
				icon.classList.add('codicon', `codicon-${choice.icon}`);
			}
			dom.append(row, dom.$('span.tomoshibi-session-popover-label')).textContent = choice.label;
			if (choice.description) {
				dom.append(row, dom.$('span.tomoshibi-session-popover-description')).textContent = choice.description;
			}
			store.add(dom.addDisposableListener(row, dom.EventType.CLICK, event => {
				dom.EventHelper.stop(event, true);
				finish(choice.id);
			}));
			rows.push(row);
		}
		store.add(dom.addDisposableListener(list, dom.EventType.KEY_DOWN, event => {
			if (rows.length === 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
				return;
			}
			dom.EventHelper.stop(event, true);
			const current = rows.findIndex(row => row === list.ownerDocument.activeElement);
			const next = current + (event.key === 'ArrowDown' ? 1 : -1);
			rows[(next + rows.length) % rows.length].focus();
		}));
		rows[0]?.focus();
	});
}

/**
 * 输入型浮层：标题 + 单行输入框 + 「确定」「取消」。回车确定、Esc 取消（用户是外接物理键盘，
 * 键盘这条路必须走得通）。返回输入的原文，取消返回 undefined。
 */
export function promptTomoshibiInput(anchor: HTMLElement | undefined, title: string, options?: { readonly value?: string; readonly placeholder?: string }): Promise<string | undefined> {
	return openTomoshibiPopover<string>(anchor, (root, store, finish) => {
		dom.append(root, dom.$('.tomoshibi-session-popover-title')).textContent = title;
		const input = dom.append(root, dom.$('input.tomoshibi-session-popover-input')) as HTMLInputElement;
		input.type = 'text';
		input.value = options?.value ?? '';
		input.placeholder = options?.placeholder ?? '';
		const buttons = dom.append(root, dom.$('.tomoshibi-session-popover-buttons'));
		const cancel = dom.append(buttons, dom.$('button.tomoshibi-session-popover-button')) as HTMLButtonElement;
		cancel.type = 'button';
		cancel.textContent = nls.localize('tomoshibi.session.popover.cancel', "取消");
		const confirm = dom.append(buttons, dom.$('button.tomoshibi-session-popover-button.is-primary')) as HTMLButtonElement;
		confirm.type = 'button';
		confirm.textContent = nls.localize('tomoshibi.session.popover.confirm', "确定");
		store.add(dom.addDisposableListener(cancel, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			finish(undefined);
		}));
		store.add(dom.addDisposableListener(confirm, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			finish(input.value);
		}));
		store.add(dom.addDisposableListener(input, dom.EventType.KEY_DOWN, event => {
			if (event.key === 'Enter') {
				dom.EventHelper.stop(event, true);
				finish(input.value);
			}
		}));
		input.focus();
		input.select();
	});
}

interface ITomoshibiPill {
	readonly element: HTMLButtonElement;
	readonly label: HTMLElement;
	readonly status: HTMLElement;
	readonly disposables: DisposableStore;
	instanceId: number | undefined;
}

interface ITomoshibiGroupWrap {
	readonly element: HTMLElement;
	readonly chip: HTMLButtonElement;
	readonly chipLabel: HTMLElement;
	readonly chipCount: HTMLElement;
	readonly disposables: DisposableStore;
}

/** One Session as the strip lays it out: its metadata key, its instance and its group. */
interface ITomoshibiSlot {
	readonly key: string;
	readonly instance: ITerminalInstance;
	readonly group: ITomoshibiSessionGroup | undefined;
}

/** A pointer that is down on the strip but has not yet become a tap or a drag. */
interface ITomoshibiPress {
	readonly pointerId: number;
	/** Set when the pointer went down on a Session pill. */
	readonly key?: string;
	/** Set when it went down on a group chip instead. */
	readonly groupId?: string;
	readonly x: number;
	readonly y: number;
	readonly touch: boolean;
	moved: boolean;
	timer?: ReturnType<typeof setTimeout>;
}

/** The Session ordering a drop asks for, before it is written back to the two services. */
interface ITomoshibiPlacement {
	readonly key: string;
	readonly groupId: string | undefined;
}

/**
 * Everything the shared Session actions need. The strip and the Session tree pass different
 * refresh callbacks but must otherwise offer exactly the same menu.
 */
interface ITomoshibiSessionActionHost {
	readonly sessionService: ITomoshibiSessionService;
	readonly terminalService: ITerminalService;
	readonly groupService: ITerminalGroupService;
	/** 自制浮层贴着谁展开。拿不到具体按钮时返回 undefined，浮层会退回面板标题栏。 */
	getAnchor(): HTMLElement | undefined;
	refresh(): void;
}

/** The Session pills directly inside a strip container, in the order the DOM holds them. */
function tomoshibiPillChildren(parent: HTMLElement): HTMLElement[] {
	return ([...parent.children] as HTMLElement[]).filter(child => child.classList.contains(TOMOSHIBI_PILL_CLASS));
}

/** Sets `children` as the exact child list of `parent`, moving rather than recreating nodes. */
function tomoshibiReconcileChildren(parent: HTMLElement, children: readonly HTMLElement[]): void {
	let next: ChildNode | null = parent.firstChild;
	for (const child of children) {
		if (next === child) {
			next = child.nextSibling;
			continue;
		}
		parent.insertBefore(child, next);
	}
	while (next) {
		const node = next;
		next = next.nextSibling;
		parent.removeChild(node);
	}
}

function activateTomoshibiSession(instance: ITerminalInstance, groupService: ITerminalGroupService): void {
	const group = groupService.getGroupForInstance(instance);
	if (!group) {
		return;
	}
	groupService.activeGroup = group;
	groupService.setActiveInstance(instance);
	void groupService.showPanel(true);
}

/**
 * The four states the strip and the tree paint (spec requirement 5-19):
 * running = green dot, waiting for the user (question / permission prompt) = yellow dot,
 * genuinely broken = red dot, finished = green check.
 */
type TomoshibiSessionState = 'running' | 'waiting' | 'error' | 'complete';

function tomoshibiSessionStatusClass(instance: ITerminalInstance, sessionService: ITomoshibiSessionService): TomoshibiSessionState {
	const activity = sessionService.getActivity(instance.instanceId);
	if (activity === 'running' || activity === 'waiting' || activity === 'error') {
		return activity;
	}
	// `undefined` means the service does not track this instance; fall back to the terminal's own signals.
	// A warning-level terminal status is commonly just Shell Integration setup and must not paint
	// every healthy Session as broken.
	const exited = instance.exitReason !== undefined;
	const primaryStatus = instance.statusList.primary;
	const hasError = exited || !!primaryStatus && primaryStatus.severity >= Severity.Error;
	return hasError ? 'error' : 'complete';
}

/** The finished state swaps the dot for a check so green-running and green-done stay distinguishable. */
function tomoshibiSessionStatusClassName(state: TomoshibiSessionState): string {
	const glyph = state === 'complete' ? 'codicon-check' : 'codicon-circle-large-filled';
	return `codicon ${glyph} tomoshibi-terminal-session-status is-${state}`;
}

function tomoshibiSessionStatusText(instance: ITerminalInstance, state: TomoshibiSessionState): string {
	if (instance.exitReason !== undefined) {
		return '进程已结束';
	}
	switch (state) {
		case 'error': return instance.statusList.primary?.tooltip ?? '连接或进程异常';
		case 'waiting': return '等待你回应';
		case 'running': return '正在运行';
		default: return '已完成';
	}
}

/**
 * 把标题里的 emoji 类字符滤掉。Claude Code 会通过终端标题转义序列往标题里写一个 ✳（U+2733），
 * iPad 上它被当成 emoji 渲染成绿底白星那么大一块，把后面的名字整个挤出胶囊。
 *
 * ⛔ 只滤显示不滤数据：sessionService 里存的标题、instance.title、悬停提示（title 属性）和
 * aria-label 一律保持原文——过滤是为了排版，不是为了改数据，用户还得能从悬停提示里看到终端
 * 报上来的真实标题。只有胶囊上那一行 textContent 用过滤后的版本。
 *
 * ⛔ 规则保守：只滤 Unicode 的 Extended_Pictographic 一类，外加变体选择符 U+FE0F、围绕键帽
 * U+20E3 和零宽连接符 U+200D（去掉图形之后它们会变成孤儿）。CJK、全角标点、` · ` 分隔符
 * （U+00B7，不在 Extended_Pictographic 里）一概不动。滤完把连续空白压成一个空格并 trim。
 */
export function stripTomoshibiPictographs(title: string): string {
	return title.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Chrome 式手风琴：同一时刻只展开一个分组，展开一个就把其余的收回成彩色胶囊。
 * 传 undefined 表示全部收起。这样 Session 栏永远只有一行——展开的那组把成员摊开，别的组
 * 只留胶囊和计数，⛔ 不会因为多开了几个组就往下多长一行。
 */
export function expandOnlyTomoshibiGroup(sessionService: ITomoshibiSessionService, groupId: string | undefined): void {
	for (const group of sessionService.groups) {
		// setCollapsed 自己会忽略没变化的写入，这里不必再判一次。
		sessionService.setCollapsed(group.id, group.id !== groupId);
	}
}

/** The Sessions the strip and the tree render, in terminal group order, empty groups skipped. */
function tomoshibiVisibleInstances(groupService: ITerminalGroupService): ITerminalInstance[] {
	const instances: ITerminalInstance[] = [];
	for (const group of groupService.groups) {
		if (group.terminalInstances.length === 0) {
			continue;
		}
		const instance = group.activeInstance;
		if (instance) {
			instances.push(instance);
		}
	}
	return instances;
}

async function openTomoshibiSessionManager(host: ITomoshibiSessionActionHost): Promise<void> {
	const activeInstance = host.groupService.activeInstance;
	const instances = tomoshibiVisibleInstances(host.groupService);
	const choices: ITomoshibiPopoverChoice[] = instances.map(instance => {
		const title = host.sessionService.getTitle(instance) || instance.title;
		const sessionGroup = host.sessionService.getGroupOf(instance)?.name;
		return {
			id: String(instance.instanceId),
			icon: instance === activeInstance ? 'check' : 'terminal',
			label: title,
			description: sessionGroup ? nls.localize('tomoshibi.session.manager.group', "分组：{0}", sessionGroup) : nls.localize('tomoshibi.session.manager.ungrouped', "未分组"),
			current: instance === activeInstance,
		};
	});
	const picked = await pickTomoshibiChoice(host.getAnchor(), nls.localize('tomoshibi.session.manager.pick', "选择一个 Session 进行切换或管理"), choices);
	const instance = picked === undefined ? undefined : instances.find(candidate => String(candidate.instanceId) === picked);
	if (!instance) {
		return;
	}
	activateTomoshibiSession(instance, host.groupService);
	host.refresh();
}

/**
 * The one Session menu. The strip's context menu and the Session tree's per-row overflow both
 * build it here so the two entry points can never drift apart.
 */
function createTomoshibiSessionActions(instance: ITerminalInstance, host: ITomoshibiSessionActionHost): Action[] {
	const pinned = host.sessionService.isPinned(instance);
	const sessionGroup = host.sessionService.getGroupOf(instance)?.name;
	return [
		new Action('tomoshibi.session.manager', nls.localize('tomoshibi.session.manager', "Session 管理中心"), undefined, true, () => openTomoshibiSessionManager(host)),
		new Action('tomoshibi.session.activate', nls.localize('tomoshibi.session.activate', "切换到此 Session"), undefined, true, async () => {
			activateTomoshibiSession(instance, host.groupService);
			host.refresh();
		}),
		new Action('tomoshibi.session.rename', nls.localize('tomoshibi.session.rename', "重命名"), undefined, true, async () => {
			await renameTomoshibiSession(instance, host.sessionService, host.getAnchor());
			host.refresh();
		}),
		new Action('tomoshibi.session.group', sessionGroup ? nls.localize('tomoshibi.session.group.change', "更改分组（{0}）", sessionGroup) : nls.localize('tomoshibi.session.group', "加入分组"), undefined, true, async () => {
			await chooseTomoshibiSessionGroup(instance, host.sessionService, host.getAnchor());
			host.refresh();
		}),
		new Action('tomoshibi.session.pin', pinned ? nls.localize('tomoshibi.session.unpin', "取消固定") : nls.localize('tomoshibi.session.pin', "固定到最前"), undefined, true, async () => {
			setTomoshibiSessionPinned(instance, !pinned, host.sessionService, host.groupService);
			host.refresh();
		}),
		new Action('tomoshibi.session.close', nls.localize('tomoshibi.session.close', "关闭 Session"), undefined, true, () => closeTomoshibiSession(instance, host.sessionService, host.terminalService, host.groupService)),
	];
}

/**
 * Code-Tomoshibi's first-class horizontal terminal switcher, laid out like Chrome's tab groups.
 *
 * This replaces the upstream select action itself. It is deliberately connected straight to
 * ITerminalGroupService: there is no hidden terminal list, synthetic change event, extension
 * command, or DOM mirror involved.
 */
class SwitchTerminalActionViewItem extends BaseActionViewItem {
	private _switcher: HTMLElement | undefined;
	private readonly _pills = new Map<string, ITomoshibiPill>();
	private readonly _wraps = new Map<string, ITomoshibiGroupWrap>();
	private _orderedKeys: string[] = [];
	private readonly _groupIdByKey = new Map<string, string | undefined>();
	private readonly _statusListeners = this._register(new DisposableMap<number>());
	private _lastActiveInstanceId: number | undefined;
	/** Set while a drop is being written back, so the reorder does not destroy its own pills. */
	private _suppressSync = false;
	private _suppressClickUntil = 0;
	private _press: ITomoshibiPress | undefined;
	private _drag: { pointerId: number; key: string; pill: HTMLElement; fly: HTMLElement; dx: number; dy: number; dropGroupId: string | undefined } | undefined;
	private _suppressedTouchClick: { instanceId: number; until: number } | undefined;

	constructor(
		action: IAction,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@ITomoshibiSessionService private readonly _sessionService: ITomoshibiSessionService,
		@ILayoutService private readonly _layoutService: ILayoutService,
	) {
		super(null, action);
		this._register(_sessionService.onDidChange(() => this._sync(), this));
		this._register(_sessionService.onDidChangeActivity(() => this._sync(), this));
		this._register(_terminalService.onDidChangeInstances(() => this._sync(), this));
		this._register(_terminalService.onDidChangeActiveInstance(() => this._sync(), this));
		this._register(_terminalService.onAnyInstanceTitleChange(instance => {
			// Keep the horizontal switcher and the real terminal rename command on one source of
			// truth. Process/OSC title changes must not overwrite a user name; API rename does.
			if (instance.titleSource === TitleEventSource.Api) {
				this._sessionService.setTitle(instance, instance.staticTitle?.trim() || undefined);
			}
			this._sync();
		}, this));
		this._register(_terminalService.onAnyInstancePrimaryStatusChange(() => this._sync(), this));
		this._register(_terminalGroupService.onDidChangeGroups(() => this._sync(), this));
		this._register(_terminalGroupService.onDidChangeActiveGroup(() => this._sync(), this));
		this._register(_terminalService.onDidChangeConnectionState(() => this._sync(), this));
		this._register(toDisposable(() => this._clear()));
	}

	private get _actionHost(): ITomoshibiSessionActionHost {
		return {
			sessionService: this._sessionService,
			terminalService: this._terminalService,
			groupService: this._terminalGroupService,
			getAnchor: () => this._switcher,
			refresh: () => this._sync(),
		};
	}

	override render(container: HTMLElement): void {
		this.element = container;
		container.classList.add('tomoshibi-terminal-session-item');
		container.setAttribute('role', 'presentation');
		const switcher = this._switcher = dom.append(container, dom.$('.tomoshibi-terminal-session-switcher'));
		switcher.setAttribute('role', 'tablist');
		switcher.setAttribute('aria-label', nls.localize('terminalSessions', "终端 Session 列表"));
		this._register(dom.addDisposableListener(switcher, dom.EventType.SCROLL, () => this._updateScrollAffordance()));
		// iOS only lets a drag work if touchmove is cancelled, but cancelling it before a drag has
		// started would kill the strip's own horizontal scrolling.
		this._register(dom.addDisposableListener(switcher, 'touchmove', (event: TouchEvent) => {
			if (this._drag) {
				event.preventDefault();
			}
		}, { passive: false }));
		this._installTouchCapture(dom.getWindow(container));
		this._sync();
	}

	/**
	 * The workbench's global touch gesture recognizer stops pointer events before they reach the
	 * action bar on iPad. Listen at the document capture phase so session switching and dragging
	 * remain real, deterministic terminal actions instead of depending on Safari's synthesized
	 * click.
	 */
	private _installTouchCapture(targetWindow: Window): void {
		const clearTimer = () => {
			if (this._press?.timer !== undefined) {
				clearTimeout(this._press.timer);
				this._press.timer = undefined;
			}
		};
		const reset = () => {
			clearTimer();
			this._press = undefined;
		};
		this._register(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_DOWN, event => {
			const target = event.target as HTMLElement | null;
			const chip = target?.closest?.(`.${TOMOSHIBI_CHIP_CLASS}`) as HTMLElement | null;
			const pill = chip ? null : target?.closest?.(`.${TOMOSHIBI_PILL_CLASS}`) as HTMLElement | null;
			const groupId = chip?.parentElement?.dataset.tomoshibiGroupId;
			const key = pill?.dataset.tomoshibiSessionKey;
			if (!groupId && (!key || !this._pills.has(key))) {
				return;
			}
			reset();
			const touch = event.pointerType !== 'mouse';
			const press: ITomoshibiPress = { pointerId: event.pointerId, key, groupId, x: event.clientX, y: event.clientY, touch, moved: false };
			this._press = press;
			if (touch && key) {
				press.timer = setTimeout(() => {
					if (this._press !== press || press.moved) {
						return;
					}
					press.timer = undefined;
					this._startDrag(key, press.pointerId, press.x, press.y);
				}, TOMOSHIBI_DRAG_LONG_PRESS_MS);
			}
		}, true));
		this._register(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_MOVE, event => {
			if (this._drag) {
				if (event.pointerId === this._drag.pointerId) {
					this._moveDrag(event.clientX, event.clientY);
				}
				return;
			}
			const press = this._press;
			if (!press || event.pointerId !== press.pointerId) {
				return;
			}
			const dx = Math.abs(event.clientX - press.x);
			const dy = Math.abs(event.clientY - press.y);
			if (press.touch) {
				if (dx > TOMOSHIBI_DRAG_SLOP_TOUCH || dy > TOMOSHIBI_DRAG_SLOP_TOUCH) {
					press.moved = true;
					reset();
				}
				return;
			}
			const key = press.key;
			if (key && (dx > TOMOSHIBI_DRAG_SLOP_MOUSE || dy > TOMOSHIBI_DRAG_SLOP_MOUSE)) {
				const pointerId = press.pointerId;
				reset();
				this._startDrag(key, pointerId, event.clientX, event.clientY);
			}
		}, true));
		this._register(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_UP, event => {
			if (this._drag) {
				if (event.pointerId === this._drag.pointerId) {
					dom.EventHelper.stop(event, true);
					this._endDrag();
				}
				return;
			}
			const press = this._press;
			if (!press || event.pointerId !== press.pointerId) {
				return;
			}
			reset();
			// The mouse path is left to the real click listeners on the elements themselves.
			if (!press.touch || press.moved) {
				return;
			}
			dom.EventHelper.stop(event, true);
			if (press.groupId) {
				this._suppressClickUntil = Date.now() + TOMOSHIBI_DRAG_CLICK_GUARD_MS;
				this._toggleGroup(press.groupId);
				return;
			}
			const instanceId = press.key !== undefined ? this._pills.get(press.key)?.instanceId : undefined;
			if (instanceId === undefined) {
				return;
			}
			// Safari may synthesize a click after pointerup. The pointer path already performed the
			// action, so suppress exactly that follow-up click instead of activating the Session
			// twice and forcing two terminal layouts.
			this._suppressedTouchClick = { instanceId, until: Date.now() + 800 };
			this._activate(instanceId);
		}, true));
		this._register(dom.addDisposableListener(targetWindow.document, 'pointercancel', event => {
			if (this._drag && event.pointerId === this._drag.pointerId) {
				this._endDrag();
				return;
			}
			if (this._press && event.pointerId === this._press.pointerId) {
				reset();
			}
		}, true));
		this._register(toDisposable(reset));
	}

	override focus(): void {
		this._activePill()?.element.focus();
	}

	override setFocusable(focusable: boolean): void {
		const active = this._activePill()?.element;
		if (active) {
			active.tabIndex = focusable ? 0 : -1;
		}
	}

	private _activePill(): ITomoshibiPill | undefined {
		const activeInstanceId = this._terminalGroupService.activeInstance?.instanceId;
		if (activeInstanceId === undefined) {
			return undefined;
		}
		for (const pill of this._pills.values()) {
			if (pill.instanceId === activeInstanceId) {
				return pill;
			}
		}
		return undefined;
	}

	private _activate(instanceId: number): void {
		const instance = this._terminalService.getInstanceFromId(instanceId);
		if (!instance) {
			return;
		}
		activateTomoshibiSession(instance, this._terminalGroupService);
		this._sync();
	}

	private _toggleGroup(groupId: string): void {
		const group = this._sessionService.getGroupById(groupId);
		if (group) {
			// 展开这一组就收起其余各组；再点一次已经展开的组则全部收起。
			expandOnlyTomoshibiGroup(this._sessionService, group.collapsed ? groupId : undefined);
		}
	}

	//#region drag and drop

	private _startDrag(key: string, pointerId: number, x: number, y: number): void {
		const pill = this._pills.get(key);
		if (!pill || !this._switcher || this._drag) {
			return;
		}
		this._press = undefined;
		const element = pill.element;
		const rect = element.getBoundingClientRect();
		const fly = element.cloneNode(true) as HTMLElement;
		fly.classList.add('tomoshibi-terminal-session-fly');
		fly.classList.remove('is-ghost');
		fly.style.left = `${rect.left}px`;
		fly.style.top = `${rect.top}px`;
		fly.style.width = `${rect.width}px`;
		fly.style.height = `${rect.height}px`;
		// The theme variables live on .monaco-workbench, so a clone parented to the body would
		// render unstyled.
		this._layoutService.activeContainer.appendChild(fly);
		element.classList.add('is-ghost');
		this._switcher.classList.add('is-dragging');
		this._drag = { pointerId, key, pill: element, fly, dx: x - rect.left, dy: y - rect.top, dropGroupId: undefined };
	}

	private _moveDrag(x: number, y: number): void {
		const drag = this._drag;
		const switcher = this._switcher;
		if (!drag || !switcher) {
			return;
		}
		drag.fly.style.left = `${x - drag.dx}px`;
		drag.fly.style.top = `${y - drag.dy}px`;
		const stripRect = switcher.getBoundingClientRect();
		if (x < stripRect.left + TOMOSHIBI_DRAG_EDGE_PX) {
			switcher.scrollLeft -= TOMOSHIBI_DRAG_EDGE_STEP_PX;
		} else if (x > stripRect.right - TOMOSHIBI_DRAG_EDGE_PX) {
			switcher.scrollLeft += TOMOSHIBI_DRAG_EDGE_STEP_PX;
		}
		let over: ITomoshibiGroupWrap | undefined;
		let overGroupId: string | undefined;
		for (const [groupId, wrap] of this._wraps) {
			if (!this._sessionService.getGroupById(groupId)?.collapsed) {
				continue;
			}
			const rect = wrap.element.getBoundingClientRect();
			if (x >= rect.left && x <= rect.right && y >= stripRect.top - 26 && y <= stripRect.bottom + 26) {
				over = wrap;
				overGroupId = groupId;
			}
		}
		for (const wrap of this._wraps.values()) {
			wrap.chip.classList.toggle('is-drop-target', wrap === over);
		}
		drag.dropGroupId = overGroupId;
		if (over) {
			return;
		}
		this._placeGhost(x);
	}

	/** Moves the dragged pill itself through the DOM so the drop point is what the eye sees. */
	private _placeGhost(x: number): void {
		const drag = this._drag;
		const switcher = this._switcher;
		if (!drag || !switcher) {
			return;
		}
		let container: HTMLElement = switcher;
		for (const [groupId, wrap] of this._wraps) {
			if (this._sessionService.getGroupById(groupId)?.collapsed !== false) {
				continue;
			}
			const rect = wrap.element.getBoundingClientRect();
			if (x >= rect.left && x <= rect.right) {
				container = wrap.element;
			}
		}
		const siblings = ([...container.children] as HTMLElement[]).filter(node => {
			if (node === drag.pill) {
				return false;
			}
			if (node.classList.contains(TOMOSHIBI_PILL_CLASS)) {
				return true;
			}
			return container === switcher && node.classList.contains(TOMOSHIBI_WRAP_CLASS);
		});
		let before: HTMLElement | undefined;
		for (const sibling of siblings) {
			const rect = sibling.getBoundingClientRect();
			if (x < rect.left + rect.width / 2) {
				before = sibling;
				break;
			}
		}
		if (before) {
			container.insertBefore(drag.pill, before);
		} else {
			container.appendChild(drag.pill);
		}
	}

	private _endDrag(): void {
		const drag = this._drag;
		const switcher = this._switcher;
		if (!drag || !switcher) {
			return;
		}
		this._drag = undefined;
		drag.fly.remove();
		drag.pill.classList.remove('is-ghost');
		switcher.classList.remove('is-dragging');
		for (const wrap of this._wraps.values()) {
			wrap.chip.classList.remove('is-drop-target');
		}
		this._suppressClickUntil = Date.now() + TOMOSHIBI_DRAG_CLICK_GUARD_MS;
		this._applyPlacements(drag.dropGroupId ? this._placementsForCollapsedDrop(drag.key, drag.dropGroupId) : this._placementsFromDom());
	}

	/** A drop on a collapsed chip files the Session at the end of that group. */
	private _placementsForCollapsedDrop(key: string, groupId: string): ITomoshibiPlacement[] {
		const placements: ITomoshibiPlacement[] = this._orderedKeys
			.filter(candidate => candidate !== key)
			.map(candidate => ({ key: candidate, groupId: this._groupIdByKey.get(candidate) }));
		let insertAt = placements.length;
		for (let index = 0; index < placements.length; index++) {
			if (placements[index].groupId === groupId) {
				insertAt = index + 1;
			}
		}
		placements.splice(insertAt, 0, { key, groupId });
		return placements;
	}

	/** Reads the order and grouping the user just built with their finger straight off the DOM. */
	private _placementsFromDom(): ITomoshibiPlacement[] {
		const switcher = this._switcher;
		if (!switcher) {
			return [];
		}
		const nodes = [...switcher.children] as HTMLElement[];
		const rendered = new Set<string>();
		for (const node of nodes) {
			if (node.classList.contains(TOMOSHIBI_WRAP_CLASS)) {
				for (const child of tomoshibiPillChildren(node)) {
					const key = child.dataset.tomoshibiSessionKey;
					if (key) {
						rendered.add(key);
					}
				}
			} else if (node.classList.contains(TOMOSHIBI_PILL_CLASS)) {
				const key = node.dataset.tomoshibiSessionKey;
				if (key) {
					rendered.add(key);
				}
			}
		}
		const placements: ITomoshibiPlacement[] = [];
		const seen = new Set<string>();
		const push = (key: string, groupId: string | undefined) => {
			if (!seen.has(key)) {
				seen.add(key);
				placements.push({ key, groupId });
			}
		};
		for (const node of nodes) {
			if (node.classList.contains(TOMOSHIBI_WRAP_CLASS)) {
				const groupId = node.dataset.tomoshibiGroupId;
				for (const child of tomoshibiPillChildren(node)) {
					const key = child.dataset.tomoshibiSessionKey;
					if (key) {
						push(key, groupId);
					}
				}
				// A collapsed group renders no pills at all; its members keep their membership and
				// their place rather than silently escaping the group.
				for (const key of this._orderedKeys) {
					if (!rendered.has(key) && this._groupIdByKey.get(key) === groupId) {
						push(key, groupId);
					}
				}
			} else if (node.classList.contains(TOMOSHIBI_PILL_CLASS)) {
				const key = node.dataset.tomoshibiSessionKey;
				if (key) {
					push(key, undefined);
				}
			}
		}
		for (const key of this._orderedKeys) {
			push(key, this._groupIdByKey.get(key));
		}
		return placements;
	}

	private _applyPlacements(placements: readonly ITomoshibiPlacement[]): void {
		// ⛔ 整个写回过程从第一行起就静默，不只是后半段。setGroupOf 的 _save() 会 fire onDidChange、
		// moveGroupToEnd 每次都 fire onDidChangeInstances，两者都会同步打回 _sync()，而中途重画会
		// 拆掉这个循环正在排序的那批胶囊。原来 _suppressSync 只包住 moveGroupToEnd 那一段，前面每改
		// 一个分组归属就白重画一次。
		this._suppressSync = true;
		try {
			const instances = new Map<string, ITerminalInstance>();
			for (const instance of tomoshibiVisibleInstances(this._terminalGroupService)) {
				instances.set(this._sessionService.sessionKey(instance), instance);
			}
			for (const placement of placements) {
				const instance = instances.get(placement.key);
				if (instance && this._sessionService.getGroupOf(instance)?.id !== placement.groupId) {
					this._sessionService.setGroupOf(instance, placement.groupId);
				}
			}
			// ⛔ 只挪真正需要挪的那几个。每一次 moveGroupToEnd 都会 fire onDidChangeInstances，连锁
			// 两轮全分组 relayout（TerminalTabbedView._layoutGroups 与 TerminalViewPane 那次带强制
			// 回流的 layoutBody）外加一次未去抖的 setTerminalLayoutInfo 远端往返；8 个 Session 无条件
			// 挪 8 次，松手时要顿挫几十毫秒。
			// moveGroupToEnd 只能把一个 Session 挪到末尾，所以「不用挪的」必然是目标顺序的一段前缀，
			// 且这段前缀要在当前顺序里按序出现。贪心取最长的这样的前缀，其余的按目标顺序依次挪到末尾，
			// 结果与逐个 moveGroupToEnd 完全一致，调用次数降到最少（顺序没变时降到 0 次）。
			const target = placements.map(placement => placement.key).filter(key => instances.has(key));
			let settled = 0;
			for (const key of this._orderedKeys) {
				if (key === target[settled]) {
					settled++;
				}
			}
			for (let index = settled; index < target.length; index++) {
				this._terminalGroupService.moveGroupToEnd(instances.get(target[index])!);
			}
		} finally {
			this._suppressSync = false;
		}
		this._sync();
	}

	//#endregion

	private _openManagement(instanceId: number): void {
		const instance = this._terminalService.getInstanceFromId(instanceId);
		const pill = instance ? this._pills.get(this._sessionService.sessionKey(instance)) : undefined;
		if (!instance || !pill) {
			return;
		}
		const actions = createTomoshibiSessionActions(instance, this._actionHost);
		this._contextMenuService.showContextMenu({
			getAnchor: () => pill.element,
			getActions: () => actions,
			onHide: () => dispose(actions),
		});
	}

	private _clear(): void {
		for (const pill of this._pills.values()) {
			pill.disposables.dispose();
			pill.element.remove();
		}
		this._pills.clear();
		for (const wrap of this._wraps.values()) {
			wrap.disposables.dispose();
			wrap.element.remove();
		}
		this._wraps.clear();
	}

	private _createPill(key: string): ITomoshibiPill {
		const element = dom.$(`button.${TOMOSHIBI_PILL_CLASS}`) as HTMLButtonElement;
		element.type = 'button';
		element.setAttribute('role', 'tab');
		element.dataset.tomoshibiSessionKey = key;
		const status = dom.append(element, dom.$('span.codicon.codicon-circle-large-filled.tomoshibi-terminal-session-status'));
		const label = dom.append(element, dom.$('span.tomoshibi-terminal-session-label'));
		const disposables = new DisposableStore();
		const pill: ITomoshibiPill = { element, label, status, instanceId: undefined, disposables };
		disposables.add(dom.addDisposableListener(element, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			if (Date.now() <= this._suppressClickUntil || pill.instanceId === undefined) {
				return;
			}
			if (this._suppressedTouchClick?.instanceId === pill.instanceId && Date.now() <= this._suppressedTouchClick.until) {
				this._suppressedTouchClick = undefined;
				return;
			}
			this._activate(pill.instanceId);
		}));
		disposables.add(dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, event => {
			dom.EventHelper.stop(event, true);
			if (pill.instanceId !== undefined) {
				this._openManagement(pill.instanceId);
			}
		}));
		disposables.add(dom.addDisposableListener(element, dom.EventType.KEY_DOWN, event => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
				return;
			}
			dom.EventHelper.stop(event, true);
			const count = this._orderedKeys.length;
			const index = this._orderedKeys.indexOf(key);
			if (count === 0 || index === -1) {
				return;
			}
			const direction = event.key === 'ArrowLeft' ? -1 : 1;
			const target = this._pills.get(this._orderedKeys[(index + direction + count) % count]);
			if (target?.instanceId !== undefined) {
				this._activate(target.instanceId);
				target.element.focus();
			}
		}));
		this._pills.set(key, pill);
		return pill;
	}

	private _createWrap(groupId: string): ITomoshibiGroupWrap {
		const element = dom.$(`.${TOMOSHIBI_WRAP_CLASS}`);
		element.dataset.tomoshibiGroupId = groupId;
		const chip = dom.append(element, dom.$(`button.${TOMOSHIBI_CHIP_CLASS}`)) as HTMLButtonElement;
		chip.type = 'button';
		const chipLabel = dom.append(chip, dom.$('span.tomoshibi-terminal-session-chip-label'));
		const chipCount = dom.append(chip, dom.$('span.tomoshibi-terminal-session-chip-count'));
		const disposables = new DisposableStore();
		disposables.add(dom.addDisposableListener(chip, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			if (Date.now() <= this._suppressClickUntil) {
				return;
			}
			this._toggleGroup(groupId);
		}));
		const wrap: ITomoshibiGroupWrap = { element, chip, chipLabel, chipCount, disposables };
		this._wraps.set(groupId, wrap);
		return wrap;
	}

	private _updatePill(pill: ITomoshibiPill, slot: ITomoshibiSlot, activeInstanceId: number | undefined): void {
		const instance = slot.instance;
		pill.instanceId = instance.instanceId;
		const title = this._sessionService.getTitle(instance) || instance.title;
		pill.label.textContent = stripTomoshibiPictographs(title);
		const state = tomoshibiSessionStatusClass(instance, this._sessionService);
		const stateText = tomoshibiSessionStatusText(instance, state);
		pill.status.className = tomoshibiSessionStatusClassName(state);
		const pinned = this._sessionService.isPinned(instance);
		const groupName = slot.group?.name;
		const active = instance.instanceId === activeInstanceId;
		pill.element.title = `${groupName ? `${groupName} · ` : ''}${title} · ${stateText}${pinned ? '（已固定）' : '（长按拖动）'}`;
		pill.element.setAttribute('aria-label', `${groupName ? `分组 ${groupName}，` : ''}${title}，${stateText}`);
		pill.element.classList.toggle('is-pinned', pinned);
		pill.element.classList.toggle('is-active', active);
		pill.element.setAttribute('aria-selected', active ? 'true' : 'false');
		pill.element.tabIndex = active ? 0 : -1;
	}

	private _sync(): void {
		const switcher = this._switcher;
		// ⛔ 拖拽进行中一次都不许重画。落点是靠 _placeGhost 把真实胶囊直接搬到目标位置来表达的，
		// _endDrag 又用 _placementsFromDom 从 DOM 反读顺序；而挂在 _sync 上的那批事件里，标题变化、
		// 主状态变化、活动变化、子进程变化都由后台终端自己触发，跟手指无关。中途跑一次 reconcile 就
		// 会把拖着的胶囊按模型顺序搬回原位，松手时读到的是回滚后的 DOM，排序静默丢失。
		// 被跳过的那次刷新由 _endDrag 兜住：它先把 _drag 清空，再走 _applyPlacements，末尾必有一次
		// _sync()。setTitle 之类的写入不受影响，挡住的只是重画。
		if (!switcher || this._suppressSync || this._drag) {
			return;
		}
		// During staged reconnection the active Session is created first. Keep that first useful
		// frame stable while hidden background Sessions attach, then publish the complete strip
		// once the terminal service reports Connected.
		if (this._terminalService.connectionState === TerminalConnectionState.Connecting && this._pills.size > 0) {
			this._syncActiveState();
			return;
		}
		const scrollLeft = switcher.scrollLeft;
		const slots: ITomoshibiSlot[] = tomoshibiVisibleInstances(this._terminalGroupService).map(instance => ({
			key: this._sessionService.sessionKey(instance),
			instance,
			group: this._sessionService.getGroupOf(instance),
		}));

		const liveKeys = new Set(slots.map(slot => slot.key));
		for (const [key, pill] of [...this._pills]) {
			if (!liveKeys.has(key)) {
				pill.disposables.dispose();
				pill.element.remove();
				this._pills.delete(key);
			}
		}
		// A group with no live member is kept by the service but never drawn on the strip.
		const liveGroupIds = new Set<string>();
		for (const slot of slots) {
			if (slot.group) {
				liveGroupIds.add(slot.group.id);
			}
		}
		for (const [groupId, wrap] of [...this._wraps]) {
			if (!liveGroupIds.has(groupId)) {
				wrap.disposables.dispose();
				wrap.element.remove();
				this._wraps.delete(groupId);
			}
		}

		const liveInstanceIds = new Set(this._terminalGroupService.instances.map(instance => instance.instanceId));
		for (const instance of this._terminalGroupService.instances) {
			if (!this._statusListeners.has(instance.instanceId)) {
				this._statusListeners.set(instance.instanceId, instance.onDidChangeHasChildProcesses(() => this._sync()));
			}
		}
		for (const instanceId of [...this._statusListeners.keys()]) {
			if (!liveInstanceIds.has(instanceId)) {
				this._statusListeners.deleteAndDispose(instanceId);
			}
		}

		this._orderedKeys = slots.map(slot => slot.key);
		this._groupIdByKey.clear();
		for (const slot of slots) {
			this._groupIdByKey.set(slot.key, slot.group?.id);
		}

		const activeInstanceId = this._terminalGroupService.activeInstance?.instanceId;
		for (const slot of slots) {
			this._updatePill(this._pills.get(slot.key) ?? this._createPill(slot.key), slot, activeInstanceId);
		}

		const topLevel: HTMLElement[] = [];
		const placedGroups = new Set<string>();
		for (const slot of slots) {
			const group = slot.group;
			if (!group) {
				topLevel.push(this._pills.get(slot.key)!.element);
				continue;
			}
			if (placedGroups.has(group.id)) {
				continue;
			}
			placedGroups.add(group.id);
			const wrap = this._wraps.get(group.id) ?? this._createWrap(group.id);
			const members = slots.filter(candidate => candidate.group?.id === group.id);
			wrap.element.style.setProperty('--tomoshibi-group-color', group.color);
			wrap.element.classList.toggle('is-collapsed', group.collapsed);
			wrap.chipLabel.textContent = group.name;
			wrap.chipCount.textContent = String(members.length);
			// The count is Chrome's collapsed-group affordance; expanded, the pills already show it.
			wrap.chipCount.classList.toggle('is-hidden', !group.collapsed);
			wrap.chip.title = group.collapsed
				? nls.localize('tomoshibi.session.group.expand', "展开分组：{0}", group.name)
				: nls.localize('tomoshibi.session.group.collapse', "折叠分组：{0}", group.name);
			wrap.chip.setAttribute('aria-expanded', group.collapsed ? 'false' : 'true');
			const children: HTMLElement[] = [wrap.chip];
			if (!group.collapsed) {
				for (const member of members) {
					children.push(this._pills.get(member.key)!.element);
				}
			}
			tomoshibiReconcileChildren(wrap.element, children);
			topLevel.push(wrap.element);
		}
		tomoshibiReconcileChildren(switcher, topLevel);
		switcher.scrollLeft = scrollLeft;

		if (activeInstanceId !== this._lastActiveInstanceId) {
			// 先记下来再动，免得下面 setCollapsed 触发的那次重入 _sync 又走进这个分支。
			this._lastActiveInstanceId = activeInstanceId;
			const activeGroup = this._terminalGroupService.activeInstance ? this._sessionService.getGroupOf(this._terminalGroupService.activeInstance) : undefined;
			if (activeGroup?.collapsed) {
				// 手风琴规则下切过去的 Session 可能正藏在折叠起来的那一组里，把它那组顶上来，
				// 否则条上完全看不出自己待在哪儿。重入的 _sync 会把胶囊重新画好。
				expandOnlyTomoshibiGroup(this._sessionService, activeGroup.id);
			}
			this._activePill()?.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
		this._updateScrollAffordance();
	}

	private _syncActiveState(): void {
		const activeInstanceId = this._terminalGroupService.activeInstance?.instanceId;
		for (const pill of this._pills.values()) {
			const active = pill.instanceId === activeInstanceId;
			pill.element.classList.toggle('is-active', active);
			pill.element.setAttribute('aria-selected', active ? 'true' : 'false');
			pill.element.tabIndex = active ? 0 : -1;
		}
	}

	/** The fade only appears on the edge that actually has more Sessions behind it. */
	private _updateScrollAffordance(): void {
		const switcher = this._switcher;
		if (!switcher) {
			return;
		}
		const max = switcher.scrollWidth - switcher.clientWidth;
		switcher.classList.toggle('can-scroll-left', switcher.scrollLeft > 1);
		switcher.classList.toggle('can-scroll-right', switcher.scrollLeft < max - 1);
	}
}

/**
 * The panel title bar's Session tree flyout. It is the only place that shows a Session's full name
 * without truncation, and on iPad it is the entry point to per-Session management.
 */
class TomoshibiSessionTreeActionViewItem extends ActionViewItem {
	private _openView: IOpenContextView | undefined;
	private _lastToggle = 0;

	constructor(
		action: IAction,
		options: IBaseActionViewItemOptions,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
		@IContextViewService private readonly _contextViewService: IContextViewService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,
		@ITomoshibiSessionService private readonly _sessionService: ITomoshibiSessionService,
	) {
		super(null, action, { ...options, icon: true, label: false });
		this._register(toDisposable(() => this._hide()));
	}

	private get _actionHost(): ITomoshibiSessionActionHost {
		return {
			sessionService: this._sessionService,
			terminalService: this._terminalService,
			groupService: this._terminalGroupService,
			getAnchor: () => this.element,
			refresh: () => { },
		};
	}

	override render(container: HTMLElement): void {
		super.render(container);
		container.classList.add('tomoshibi-session-tree-action');
		const targetWindow = dom.getWindow(container);
		// Same reason as the strip: the workbench gesture recognizer eats the action bar's clicks
		// on iPad, so the pointer path has to be able to open the flyout on its own.
		this._register(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_UP, event => {
			if (event.pointerType === 'mouse') {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (!target || !this.element?.contains(target)) {
				return;
			}
			dom.EventHelper.stop(event, true);
			this._toggle();
		}, true));
	}

	override onClick(event: dom.EventLike): void {
		dom.EventHelper.stop(event, true);
		this._toggle();
	}

	private _toggle(): void {
		const now = Date.now();
		// A tap arrives twice: once as the captured pointerup and once as Safari's synthesized
		// click. Without this guard the flyout would open and close again in the same gesture.
		if (now - this._lastToggle < 400) {
			return;
		}
		this._lastToggle = now;
		if (this._openView) {
			this._hide();
			return;
		}
		const anchor = this.element;
		if (!anchor) {
			return;
		}
		const targetWindow = dom.getWindow(anchor);
		this._openView = this._contextViewService.showContextView({
			// 纵向贴着按钮下沿，横向对齐窗口右边缘。拿按钮本身当锚点会把浮层吊在标题栏中间、
			// 右边空一大块，而设计要求是「紧贴着右边」，所以锚点换成窗口右沿的一个零宽点。
			getAnchor: () => {
				const rect = anchor.getBoundingClientRect();
				return { x: targetWindow.innerWidth - 8, y: rect.bottom + 2 };
			},
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.BELOW,
			render: container => this._renderTree(container, anchor),
			onHide: () => { this._openView = undefined; },
		});
	}

	private _hide(): void {
		if (this._openView) {
			this._openView = undefined;
			this._contextViewService.hideContextView();
		}
	}

	private _renderTree(container: HTMLElement, anchor: HTMLElement): IDisposable {
		const store = new DisposableStore();
		const root = dom.append(container, dom.$(`.${TOMOSHIBI_TREE_CLASS}`));
		const rows = store.add(new DisposableStore());
		const rerender = () => {
			const scrollTop = root.scrollTop;
			rows.clear();
			dom.clearNode(root);
			this._fill(root, rows);
			root.scrollTop = scrollTop;
		};
		rerender();
		store.add(this._sessionService.onDidChange(() => rerender()));
		store.add(this._sessionService.onDidChangeActivity(() => rerender()));
		store.add(this._terminalService.onDidChangeInstances(() => rerender()));
		store.add(this._terminalService.onDidChangeActiveInstance(() => rerender()));
		// The context view's own dismissal watches its container, which here is the whole
		// .monaco-workbench, so it never sees an "outside" click. The flyout dismisses itself.
		const targetWindow = dom.getWindow(anchor);
		store.add(dom.addDisposableListener(targetWindow.document, dom.EventType.POINTER_DOWN, event => {
			const target = event.target as HTMLElement | null;
			if (target && (target.closest(`.${TOMOSHIBI_TREE_CLASS}`) || anchor.contains(target))) {
				return;
			}
			this._hide();
		}, true));
		store.add(dom.addDisposableListener(targetWindow.document, dom.EventType.KEY_DOWN, event => {
			if (event.key === 'Escape') {
				dom.EventHelper.stop(event, true);
				this._hide();
			}
		}, true));
		return store;
	}

	private _fill(root: HTMLElement, store: DisposableStore): void {
		const instances = tomoshibiVisibleInstances(this._terminalGroupService);
		const activeInstanceId = this._terminalGroupService.activeInstance?.instanceId;

		const ungrouped = instances.filter(instance => !this._sessionService.getGroupOf(instance));
		// 空的分组下面本来就有 `members.length === 0` 跳过，未分组这一段必须同一个规矩：
		// 全部 Session 都归了组（或一个可见 Session 都没有）时，一条「未分组 0」的空标题占满
		// 约 29px 高，浮层在 iPad 上只有 70vh 可用，白挂一行还像是有内容没渲染出来。
		if (ungrouped.length > 0) {
			this._appendHeader(root, store, nls.localize('tomoshibi.session.tree.ungrouped', "未分组"), ungrouped.length, undefined);
			for (const instance of ungrouped) {
				this._appendRow(root, store, instance, activeInstanceId);
			}
		}
		for (const group of this._sessionService.groups) {
			const members = instances.filter(instance => this._sessionService.getGroupOf(instance)?.id === group.id);
			if (members.length === 0) {
				continue;
			}
			this._appendHeader(root, store, group.name, members.length, group);
			for (const instance of members) {
				this._appendRow(root, store, instance, activeInstanceId);
			}
		}

		dom.append(root, dom.$('.tomoshibi-session-tree-separator'));
		const newGroup = dom.append(root, dom.$('button.tomoshibi-session-tree-new')) as HTMLButtonElement;
		newGroup.type = 'button';
		newGroup.textContent = nls.localize('tomoshibi.session.tree.newGroup', "＋ 新建分组");
		store.add(dom.addDisposableListener(newGroup, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			this._hide();
			void createSessionGroup(TerminalLocation.Panel, this._terminalService, this._sessionService, this.element);
		}));
	}

	private _appendHeader(root: HTMLElement, store: DisposableStore, name: string, count: number, group: ITomoshibiSessionGroup | undefined): void {
		const header = dom.append(root, dom.$('.tomoshibi-session-tree-header'));
		if (group) {
			const dot = dom.append(header, dom.$('span.tomoshibi-session-tree-color'));
			dot.style.background = group.color;
		}
		dom.append(header, dom.$('span.tomoshibi-session-tree-name')).textContent = name;
		dom.append(header, dom.$('span.tomoshibi-session-tree-count')).textContent = String(count);
		if (!group) {
			return;
		}
		const more = dom.append(header, dom.$('span.tomoshibi-session-tree-more.codicon.codicon-ellipsis')) as HTMLElement;
		more.setAttribute('role', 'button');
		more.title = nls.localize('tomoshibi.session.tree.groupMenu', "分组操作");
		store.add(dom.addDisposableListener(more, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			this._openGroupMenu(more, group);
		}));
	}

	private _openGroupMenu(anchor: HTMLElement, group: ITomoshibiSessionGroup): void {
		const actions = [
			new Action('tomoshibi.session.tree.renameGroup', nls.localize('tomoshibi.session.tree.renameGroup', "重命名分组"), undefined, true, async () => {
				const name = (await promptTomoshibiInput(anchor, nls.localize('tomoshibi.session.tree.renameGroupPrompt', "输入分组名称"), { value: group.name }))?.trim();
				if (name) {
					this._sessionService.renameGroup(group.id, name);
				}
			}),
			new Action('tomoshibi.session.tree.deleteGroup', nls.localize('tomoshibi.session.tree.deleteGroup', "删除分组"), undefined, true, async () => {
				this._sessionService.deleteGroup(group.id);
			}),
		];
		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => actions,
			onHide: () => dispose(actions),
		});
	}

	private _appendRow(root: HTMLElement, store: DisposableStore, instance: ITerminalInstance, activeInstanceId: number | undefined): void {
		const row = dom.append(root, dom.$('button.tomoshibi-session-tree-item')) as HTMLButtonElement;
		row.type = 'button';
		const state = tomoshibiSessionStatusClass(instance, this._sessionService);
		const rowStatus = dom.append(row, dom.$('span'));
		rowStatus.className = tomoshibiSessionStatusClassName(state);
		const label = dom.append(row, dom.$('span.tomoshibi-session-tree-label'));
		// The whole point of the tree is that a Session name is never clipped here.
		label.textContent = this._sessionService.getTitle(instance) || instance.title;
		const active = instance.instanceId === activeInstanceId;
		row.classList.toggle('is-active', active);
		row.title = `${label.textContent} · ${tomoshibiSessionStatusText(instance, state)}`;
		store.add(dom.addDisposableListener(row, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			activateTomoshibiSession(instance, this._terminalGroupService);
			this._hide();
		}));
		const more = dom.append(row, dom.$('span.tomoshibi-session-tree-more.codicon.codicon-ellipsis')) as HTMLElement;
		more.setAttribute('role', 'button');
		more.title = nls.localize('tomoshibi.session.tree.rowMenu', "Session 操作");
		store.add(dom.addDisposableListener(more, dom.EventType.CLICK, event => {
			dom.EventHelper.stop(event, true);
			const actions = createTomoshibiSessionActions(instance, this._actionHost);
			this._contextMenuService.showContextMenu({
				getAnchor: () => more,
				getActions: () => actions,
				onHide: () => dispose(actions),
			});
		}));
	}
}
