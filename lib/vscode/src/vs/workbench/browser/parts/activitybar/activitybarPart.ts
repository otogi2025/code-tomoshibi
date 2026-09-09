/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './media/activitybarpart.css';
import './media/activityaction.css';
import { localize, localize2 } from '../../../../nls.js';
import { ActionsOrientation } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Part } from '../../part.js';
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position, FLOATING_PANEL_MARGIN } from '../../../services/layout/browser/layoutService.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ToggleSidebarPositionAction, ToggleSidebarVisibilityAction } from '../../actions/layoutActions.js';
import { IThemeService, IColorTheme, registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { ACTIVITY_BAR_BACKGROUND, ACTIVITY_BAR_BORDER, ACTIVITY_BAR_FOREGROUND, ACTIVITY_BAR_ACTIVE_BORDER, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_INACTIVE_FOREGROUND, ACTIVITY_BAR_ACTIVE_BACKGROUND, ACTIVITY_BAR_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_ACTIVE_FOCUS_BORDER } from '../../../common/theme.js';
import { activeContrastBorder, contrastBorder, focusBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { addDisposableListener, append, EventType, isAncestor, $, clearNode } from '../../../../base/browser/dom.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { CustomMenubarControl } from '../titlebar/menubarControl.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getMenuBarVisibility, MenuSettings } from '../../../../platform/window/common/window.js';
import { IAction, Separator, SubmenuAction, toAction } from '../../../../base/common/actions.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { HoverPosition } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { GestureEvent } from '../../../../base/browser/touch.js';
import { IPaneCompositePart } from '../paneCompositePart.js';
import { IPaneCompositeBarOptions, PaneCompositeBar } from '../paneCompositeBar.js';
import { GlobalCompositeBar } from '../globalCompositeBar.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Action2, IMenuService, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../common/contextkeys.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IViewDescriptorService, ViewContainerLocation, ViewContainerLocationToString } from '../../../common/views.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { SwitchCompositeViewAction } from '../compositeBarActions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

export class ActivitybarPart extends Part {

	static readonly ACTION_HEIGHT = 48;
	static readonly COMPACT_ACTION_HEIGHT = 28;

	static readonly ACTIVITYBAR_WIDTH = 48;
	static readonly COMPACT_ACTIVITYBAR_WIDTH = 36;

	/** Narrower dimensions used when the floating panels (Modern UI) experiment is enabled. */
	static readonly FLOATING_ACTION_HEIGHT = 36;
	static readonly FLOATING_ACTIVITYBAR_WIDTH = 36;
	static readonly FLOATING_COMPACT_ACTIVITYBAR_WIDTH = 28;

	/** Code-Tomoshibi: gap between the on-screen Esc / newline keys. */
	static readonly TOMOSHIBI_SOFT_KEY_GAP = 8;

	static readonly ICON_SIZE = 24;
	static readonly COMPACT_ICON_SIZE = 16;

	/**
	 * Gutter reserved on the left and bottom edges under the floating panels
	 * experiment so the activity bar aligns with the floating cards (it stays
	 * flush with the title bar, so no top gutter). Must match the margins applied
	 * in `part.css` under `.floating-panels`.
	 */
	static readonly FLOATING_MARGIN = FLOATING_PANEL_MARGIN;

	static readonly pinnedViewContainersKey = 'workbench.activity.pinnedViewlets2';
	static readonly placeholderViewContainersKey = 'workbench.activity.placeholderViewlets';
	static readonly viewContainersWorkspaceStateKey = 'workbench.activity.viewletsWorkspaceState';

	//#region IView

	get minimumWidth(): number { return this.baseWidth + this.floatingGutter; }
	get maximumWidth(): number { return this.baseWidth + this.floatingGutter; }
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;

	//#endregion

	/** The intrinsic activity bar width (excludes any floating gutter). */
	private get baseWidth(): number {
		if (this.layoutService.isFloatingPanelsEnabled()) {
			return this._isCompact ? ActivitybarPart.FLOATING_COMPACT_ACTIVITYBAR_WIDTH : ActivitybarPart.FLOATING_ACTIVITYBAR_WIDTH;
		}
		return this._isCompact ? ActivitybarPart.COMPACT_ACTIVITYBAR_WIDTH : ActivitybarPart.ACTIVITYBAR_WIDTH;
	}

	/** The action (item) height that drives visible item sizing and the composite bar overflow size. */
	private get actionHeight(): number {
		if (this._isCompact) {
			return ActivitybarPart.COMPACT_ACTION_HEIGHT;
		}
		return this.layoutService.isFloatingPanelsEnabled() ? ActivitybarPart.FLOATING_ACTION_HEIGHT : ActivitybarPart.ACTION_HEIGHT;
	}

	/** Extra space reserved around the part when the floating panels experiment is enabled. */
	private get floatingGutter(): number { return this.layoutService.isFloatingPanelsEnabled() ? ActivitybarPart.FLOATING_MARGIN : 0; }

	private readonly compositeBar = this._register(new MutableDisposable<PaneCompositeBar>());
	private content: HTMLElement | undefined;
	private readonly tomoshibiSoftKeys: HTMLButtonElement[] = [];
	private _isCompact: boolean;

	constructor(
		private readonly location: ViewContainerLocation,
		private readonly paneCompositePart: IPaneCompositePart,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(Parts.ACTIVITYBAR_PART, { hasTitle: false }, themeService, storageService, layoutService);

		this._isCompact = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_COMPACT) ?? false;

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_COMPACT)) {
				this._isCompact = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_COMPACT) ?? false;
				this.updateCompactStyle();
				this.recreateCompositeBar();
				this._onDidChange.fire(undefined); // Signal grid that size constraints changed
			}

			// Floating panels changes the reserved left/bottom gutter (and therefore
			// the fixed part width): signal the grid that the size constraint changed.
			if (e.affectsConfiguration(LayoutSettings.MODERN_UI)) {
				this.updateCompactStyle();
				this.recreateCompositeBar();
				this._onDidChange.fire(undefined);
			}
		}));
	}

	private updateCompactStyle(): void {
		if (this.element) {
			this.element.classList.toggle('compact', this._isCompact);
			// Mirrored on the workbench root for floatingPanels.css
			this.layoutService.mainContainer.classList.toggle('activitybar-compact', this._isCompact);
			this.element.style.setProperty('--activity-bar-width', `${this.baseWidth}px`);
			this.element.style.setProperty('--activity-bar-action-height', `${this.actionHeight}px`);
			this.element.style.setProperty('--activity-bar-icon-size', `${this._isCompact ? ActivitybarPart.COMPACT_ICON_SIZE : ActivitybarPart.ICON_SIZE}px`);
		}
	}

	private recreateCompositeBar(): void {
		if (!this.content || !this.compositeBar.value) {
			return;
		}

		this.compositeBar.clear();
		clearNode(this.content);
		this.compositeBar.value = this.createCompositeBar();
		this.compositeBar.value.create(this.content);

		if (this.dimension) {
			this.layout(this.dimension.width, this.dimension.height);
		}
	}

	private createCompositeBar(): PaneCompositeBar {
		const actionHeight = this.actionHeight;
		const iconSize = this._isCompact ? ActivitybarPart.COMPACT_ICON_SIZE : ActivitybarPart.ICON_SIZE;

		return this.instantiationService.createInstance(ActivityBarCompositeBar, this.location, {
			partContainerClass: 'activitybar',
			pinnedViewContainersKey: ActivitybarPart.pinnedViewContainersKey,
			placeholderViewContainersKey: ActivitybarPart.placeholderViewContainersKey,
			viewContainersWorkspaceStateKey: ActivitybarPart.viewContainersWorkspaceStateKey,
			orientation: ActionsOrientation.VERTICAL,
			icon: true,
			iconSize,
			activityHoverOptions: {
				position: () => this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT,
			},
			preventLoopNavigation: true,
			recomputeSizes: false,
			fillExtraContextMenuActions: (actions, e?: MouseEvent | GestureEvent) => { },
			compositeSize: 52,
			colors: (theme: IColorTheme) => ({
				activeForegroundColor: theme.getColor(ACTIVITY_BAR_FOREGROUND),
				inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_INACTIVE_FOREGROUND),
				activeBorderColor: theme.getColor(ACTIVITY_BAR_ACTIVE_BORDER),
				activeBackground: theme.getColor(ACTIVITY_BAR_ACTIVE_BACKGROUND),
				badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
				badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
				dragAndDropBorder: theme.getColor(ACTIVITY_BAR_DRAG_AND_DROP_BORDER),
				activeBackgroundColor: undefined, inactiveBackgroundColor: undefined, activeBorderBottomColor: undefined,
			}),
			// Code-Tomoshibi exposes only these four surfaces here: the two workspace
			// navigation ones plus clipboard history and scratch notes.
			// Git, debugging and extension services stay available through commands,
			// but do not register activity-bar actions or DOM.
			viewContainerFilter: id => id === 'workbench.view.explorer' || id === 'workbench.view.search' || id === 'workbench.view.tomoshibiClipboard' || id === 'workbench.view.tomoshibiNote',
			overflowActionSize: actionHeight,
		}, Parts.ACTIVITYBAR_PART, this.paneCompositePart, true);
	}

	protected override createContentArea(parent: HTMLElement): HTMLElement {
		this.element = parent;
		this.content = append(this.element, $('.content'));

		this.updateCompactStyle();

		if (this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
			this.show();
		}

		this.createTomoshibiSoftKeys();

		return this.content;
	}

	getPinnedPaneCompositeIds(): string[] {
		return this.compositeBar.value?.getPinnedPaneCompositeIds() ?? [];
	}

	getVisiblePaneCompositeIds(): string[] {
		return this.compositeBar.value?.getVisiblePaneCompositeIds() ?? [];
	}

	getPaneCompositeIds(): string[] {
		return this.compositeBar.value?.getPaneCompositeIds() ?? [];
	}

	focus(): void {
		this.compositeBar.value?.focus();
	}

	override updateStyles(): void {
		super.updateStyles();

		const container = assertReturnsDefined(this.getContainer());
		const background = this.getColor(ACTIVITY_BAR_BACKGROUND) || '';
		container.style.backgroundColor = background;

		const borderColor = this.getColor(ACTIVITY_BAR_BORDER) || this.getColor(contrastBorder) || '';
		container.classList.toggle('bordered', !!borderColor);
		container.style.borderColor = borderColor ? borderColor : '';
	}

	show(focus?: boolean): void {
		if (!this.content) {
			return;
		}

		if (!this.compositeBar.value) {
			this.compositeBar.value = this.createCompositeBar();
			this.compositeBar.value.create(this.content);

			if (this.dimension) {
				this.layout(this.dimension.width, this.dimension.height);
			}
		}

		if (focus) {
			this.focus();
		}
	}

	hide(): void {
		if (!this.compositeBar.value) {
			return;
		}

		this.compositeBar.clear();

		if (this.content) {
			clearNode(this.content);
		}
	}

	override layout(width: number, height: number): void {
		super.layout(width, height, 0, 0);
		this.layoutTomoshibiSoftKeys();

		if (!this.compositeBar.value) {
			return;
		}

		// When the floating panels experiment is enabled, reserve a gutter on the
		// left and bottom so the activity bar lines up with the floating cards (it
		// stays flush with the title bar, so no top gutter). The grid column is grown
		// by the same amount (see minimum/maximumWidth) and the matching margins are
		// applied in CSS (`.floating-panels .part.activitybar`).
		const gutter = this.floatingGutter;
		const contentWidth = Math.max(0, width - gutter);
		const contentHeight = Math.max(0, height - gutter);

		// Layout contents
		const contentAreaSize = super.layoutContents(contentWidth, contentHeight).contentSize;

		// Layout composite bar
		this.compositeBar.value.layout(contentWidth, contentAreaSize.height);
	}

	/**
	 * Code-Tomoshibi: permanent on-screen keys at the top-left corner, right of the compact menu.
	 * The part clips overflow, so the keys are appended to the workbench container and positioned
	 * from this part's rectangle on every layout.
	 *
	 * 这里只剩 Esc 一个软键：本产品面向外接物理键盘使用，换行按 Shift+回车 走键绑定就够了
	 * （tomoshibi.newline 命令还在，只是不再给它一个按钮）；Esc 留着是因为不少 iPad 外接
	 * 键盘根本没有 Esc 键。
	 */
	private createTomoshibiSoftKeys(): void {
		this.createTomoshibiSoftKey('Esc', localize('tomoshibi.escapeKey', "给当前终端发送 Esc"), 'tomoshibi.escape');
		this.layoutTomoshibiSoftKeys();
	}

	private createTomoshibiSoftKey(text: string, label: string, commandId: string): void {
		const key = append(this.layoutService.mainContainer, $('button.tomoshibi-soft-key', { type: 'button' }, text)) as HTMLButtonElement;
		key.title = label;
		key.setAttribute('aria-label', label);

		const send = (event: Event) => {
			// Swallow the gesture so the terminal keeps focus (and the iPad soft keyboard stays up).
			event.preventDefault();
			event.stopPropagation();
			void this.commandService.executeCommand(commandId);
		};

		// 一次手势只发一个 Esc，靠「哪个事件负责发」去重，不靠时间节流：原来 touchstart /
		// pointerdown / mousedown / click 四路共用一个 500ms 阈值，人连按两下（间隔通常
		// 200~400ms）的第二下会被一起吞掉，Claude Code 的「Esc Esc」在 iPad 上按不出来。
		// pointerdown 一路就涵盖触摸、手写笔和鼠标，是唯一会发送的路径。
		this._register(addDisposableListener(key, EventType.POINTER_DOWN, send));
		// touchstart 只负责 preventDefault：Safari 靠它才不会把焦点从终端挪走、不收起软键盘，
		// 也是它挡掉触摸合成出来的 mousedown / click（取消 pointerdown 挡不掉这些）。
		this._register(addDisposableListener(key, 'touchstart', (event: Event) => event.preventDefault(), { passive: false }));
		// 键盘激活（按钮获得焦点后按 Enter / 空格）到达时是一个背后没有指针的 click
		// （detail === 0）；指针产生的 click 上面已经处理过了，这里不能重复发。
		this._register(addDisposableListener(key, EventType.CLICK, (event: MouseEvent) => {
			if (event.detail === 0) {
				send(event);
			}
		}));
		this._register(toDisposable(() => key.remove()));

		this.tomoshibiSoftKeys.push(key);
	}

	private layoutTomoshibiSoftKeys(): void {
		if (!this.tomoshibiSoftKeys.length || !this.element) {
			return;
		}
		const root = this.layoutService.mainContainer.getBoundingClientRect();
		const bar = this.element.getBoundingClientRect();
		if (!bar.width || !bar.height) {
			return;
		}
		const top = Math.round(bar.top - root.top);
		const onRight = this.layoutService.getSideBarPosition() === Position.RIGHT;
		// Lay the keys out away from the activity bar, each one past the previous key's width.
		let offset = onRight ? Math.round(root.right - bar.left) : Math.round(bar.right - root.left);
		for (const key of this.tomoshibiSoftKeys) {
			key.style.top = `${top}px`;
			if (onRight) {
				key.style.left = '';
				key.style.right = `${offset}px`;
			} else {
				key.style.right = '';
				key.style.left = `${offset}px`;
			}
			offset += key.offsetWidth + ActivitybarPart.TOMOSHIBI_SOFT_KEY_GAP;
		}
	}

	toJSON(): object {
		return {
			type: Parts.ACTIVITYBAR_PART
		};
	}
}

export class ActivityBarCompositeBar extends PaneCompositeBar {

	private element: HTMLElement | undefined;

	private readonly menuBar = this._register(new MutableDisposable<CustomMenubarControl>());
	private menuBarContainer: HTMLElement | undefined;
	private compositeBarContainer: HTMLElement | undefined;
	private tomoshibiLauncherContainer: HTMLElement | undefined;
	private readonly globalCompositeBar: GlobalCompositeBar | undefined;

	private readonly keyboardNavigationDisposables = this._register(new DisposableStore());

	constructor(
		location: ViewContainerLocation,
		options: IPaneCompositeBarOptions,
		part: Parts,
		paneCompositePart: IPaneCompositePart,
		showGlobalActivities: boolean,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IViewsService viewService: IViewsService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IMenuService private readonly menuService: IMenuService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(location,
			{
				...options,
				fillExtraContextMenuActions: (actions, e) => {
					options.fillExtraContextMenuActions(actions, e);
					this.fillContextMenuActions(actions, e);
				}
			}, part, paneCompositePart, instantiationService, storageService, extensionService, viewDescriptorService, viewService, contextKeyService, environmentService, layoutService);

		if (showGlobalActivities) {
			this.globalCompositeBar = this._register(instantiationService.createInstance(GlobalCompositeBar, () => this.getContextMenuActions(), (theme: IColorTheme) => this.options.colors(theme), this.options.activityHoverOptions));
		}

		// Register for configuration changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(MenuSettings.MenuBarVisibility)) {
				if (getMenuBarVisibility(this.configurationService) === 'compact') {
					this.installMenubar();
				} else {
					this.uninstallMenubar();
				}
			}
		}));
	}

	private fillContextMenuActions(actions: IAction[], e?: MouseEvent | GestureEvent) {
		// Menu
		const menuBarVisibility = getMenuBarVisibility(this.configurationService);
		if (menuBarVisibility === 'compact' || menuBarVisibility === 'hidden' || menuBarVisibility === 'toggle') {
			actions.unshift(...[toAction({ id: 'toggleMenuVisibility', label: localize('menu', "菜单"), checked: menuBarVisibility === 'compact', run: () => this.configurationService.updateValue(MenuSettings.MenuBarVisibility, menuBarVisibility === 'compact' ? 'toggle' : 'compact') }), new Separator()]);
		}

		if (menuBarVisibility === 'compact' && this.menuBarContainer && e?.target) {
			if (isAncestor(e.target as Node, this.menuBarContainer)) {
				actions.unshift(...[toAction({ id: 'hideCompactMenu', label: localize('hideMenu', "隐藏菜单"), run: () => this.configurationService.updateValue(MenuSettings.MenuBarVisibility, 'toggle') }), new Separator()]);
			}
		}

		// Global Composite Bar
		if (this.globalCompositeBar) {
			actions.push(new Separator());
			actions.push(...this.globalCompositeBar.getContextMenuActions());
		}
		actions.push(new Separator());
		actions.push(...this.getActivityBarContextMenuActions());
	}

	private uninstallMenubar() {
		if (this.menuBar.value) {
			this.menuBar.value = undefined;
		}

		if (this.menuBarContainer) {
			this.menuBarContainer.remove();
			this.menuBarContainer = undefined;
		}
	}

	private installMenubar() {
		if (this.menuBar.value) {
			return; // prevent menu bar from installing twice #110720
		}

		this.menuBarContainer = $('.menubar');

		const content = assertReturnsDefined(this.element);
		content.prepend(this.menuBarContainer);

		// Menubar: install a custom menu bar depending on configuration
		this.menuBar.value = this.instantiationService.createInstance(CustomMenubarControl);
		this.menuBar.value.create(this.menuBarContainer);

	}

	private registerKeyboardNavigationListeners(): void {
		this.keyboardNavigationDisposables.clear();

		// Up/Down or Left/Right arrow on compact menu
		if (this.menuBarContainer) {
			this.keyboardNavigationDisposables.add(addDisposableListener(this.menuBarContainer, EventType.KEY_DOWN, e => {
				const kbEvent = new StandardKeyboardEvent(e);
				if (kbEvent.equals(KeyCode.DownArrow) || kbEvent.equals(KeyCode.RightArrow)) {
					this.focus();
				}
			}));
		}

		// Up/Down on Activity Icons
		if (this.compositeBarContainer) {
			this.keyboardNavigationDisposables.add(addDisposableListener(this.compositeBarContainer, EventType.KEY_DOWN, e => {
				const kbEvent = new StandardKeyboardEvent(e);
				if (kbEvent.equals(KeyCode.DownArrow) || kbEvent.equals(KeyCode.RightArrow)) {
					this.globalCompositeBar?.focus();
				} else if (kbEvent.equals(KeyCode.UpArrow) || kbEvent.equals(KeyCode.LeftArrow)) {
					this.menuBar.value?.toggleFocus();
				}
			}));
		}

		// Up arrow on global icons
		if (this.globalCompositeBar) {
			this.keyboardNavigationDisposables.add(addDisposableListener(this.globalCompositeBar.element, EventType.KEY_DOWN, e => {
				const kbEvent = new StandardKeyboardEvent(e);
				if (kbEvent.equals(KeyCode.UpArrow) || kbEvent.equals(KeyCode.LeftArrow)) {
					this.focus(this.getVisiblePaneCompositeIds().length - 1);
				}
			}));
		}
	}

	override create(parent: HTMLElement): HTMLElement {
		this.element = parent;

		// Install menubar if compact
		if (getMenuBarVisibility(this.configurationService) === 'compact') {
			this.installMenubar();
		}

		// View Containers action bar
		this.compositeBarContainer = super.create(this.element);
		this.createTomoshibiLaunchers();

		// Global action bar
		if (this.globalCompositeBar) {
			this.globalCompositeBar.create(this.element);
		}

		// Keyboard Navigation
		this.registerKeyboardNavigationListeners();

		return this.compositeBarContainer;
	}

	private createTomoshibiLaunchers(): void {
		this.tomoshibiLauncherContainer?.remove();
		this.tomoshibiLauncherContainer = append(this.element!, $('.tomoshibi-activity-launchers'));
		const launchers = [
			{ command: 'workbench.action.terminal.toggleTerminal', icon: 'terminal', label: localize('tomoshibi.activity.terminal', "终端") },
		];
		for (const launcher of launchers) {
			const button = append(this.tomoshibiLauncherContainer, $('button.tomoshibi-activity-launcher')) as HTMLButtonElement;
			button.type = 'button';
			button.title = launcher.label;
			button.setAttribute('aria-label', launcher.label);
			append(button, $(`span.codicon.codicon-${launcher.icon}`));
			this._register(addDisposableListener(button, EventType.CLICK, event => {
				event.preventDefault();
				event.stopPropagation();
				void this.commandService.executeCommand(launcher.command);
			}));
		}
	}

	override layout(width: number, height: number): void {
		if (this.menuBarContainer) {
			if (this.options.orientation === ActionsOrientation.VERTICAL) {
				height -= this.menuBarContainer.clientHeight;
			} else {
				width -= this.menuBarContainer.clientWidth;
			}
		}
		if (this.globalCompositeBar) {
			if (this.options.orientation === ActionsOrientation.VERTICAL) {
				height -= (this.globalCompositeBar.size() * this.options.overflowActionSize);
			} else {
				width -= this.globalCompositeBar.element.clientWidth;
			}
		}
		if (this.tomoshibiLauncherContainer) {
			if (this.options.orientation === ActionsOrientation.VERTICAL) {
				height -= this.tomoshibiLauncherContainer.clientHeight;
			} else {
				width -= this.tomoshibiLauncherContainer.clientWidth;
			}
		}
		super.layout(width, height);
	}

	getActivityBarContextMenuActions(): IAction[] {
		const activityBarPositionMenu = this.menuService.getMenuActions(MenuId.ActivityBarPositionMenu, this.contextKeyService, { shouldForwardArgs: true, renderShortTitle: true });
		const positionActions = getContextMenuActions(activityBarPositionMenu).secondary;
		const actions: IAction[] = [
			new SubmenuAction('workbench.action.activityBar.position', localize('activity bar position', "活动栏位置"), positionActions),
		];

		// Show size submenu only when activity bar is in default position
		const activityBarPosition = this.configurationService.getValue<string>(LayoutSettings.ACTIVITY_BAR_LOCATION);
		if (activityBarPosition === ActivityBarPosition.DEFAULT) {
			const isCompact = this.configurationService.getValue<boolean>(LayoutSettings.ACTIVITY_BAR_COMPACT) ?? false;
			const sizeActions = [
				toAction({ id: 'workbench.action.activityBar.size.default', label: localize('activityBarSizeDefault', "默认"), checked: !isCompact, run: () => this.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_COMPACT, false) }),
				toAction({ id: 'workbench.action.activityBar.size.compact', label: localize('activityBarSizeCompact', "紧凑"), checked: isCompact, run: () => this.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_COMPACT, true) }),
			];
			actions.push(new SubmenuAction('workbench.action.activityBar.size', localize('activity bar size', "活动栏大小"), sizeActions));
		}

		actions.push(toAction({ id: ToggleSidebarPositionAction.ID, label: ToggleSidebarPositionAction.getLabel(this.layoutService), run: () => this.instantiationService.invokeFunction(accessor => new ToggleSidebarPositionAction().run(accessor)) }));

		if (this.part === Parts.SIDEBAR_PART) {
			actions.push(toAction({ id: ToggleSidebarVisibilityAction.ID, label: ToggleSidebarVisibilityAction.LABEL, run: () => this.instantiationService.invokeFunction(accessor => new ToggleSidebarVisibilityAction().run(accessor)) }));
		}

		return actions;
	}

}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.activityBarLocation.default',
			title: {
				...localize2('positionActivityBarDefault', '活动栏移到侧边'),
				mnemonicTitle: localize({ key: 'miDefaultActivityBar', comment: ['&& denotes a mnemonic'] }, "默认"),
			},
			shortTitle: localize('default', "默认"),
			category: Categories.View,
			toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT),
			menu: [{
				id: MenuId.ActivityBarPositionMenu,
				order: 1
			}, {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.and(ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT), IsSessionsWindowContext.negate()),
			}]
		});
	}
	run(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.DEFAULT);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.activityBarLocation.top',
			title: {
				...localize2('positionActivityBarTop', '活动栏移到顶部'),
				mnemonicTitle: localize({ key: 'miTopActivityBar', comment: ['&& denotes a mnemonic'] }, "顶部"),
			},
			shortTitle: localize('top', "顶部"),
			category: Categories.View,
			toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.TOP),
			menu: [{
				id: MenuId.ActivityBarPositionMenu,
				order: 2
			}, {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.and(ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.TOP), IsSessionsWindowContext.negate()),
			}]
		});
	}
	run(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.TOP);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.activityBarLocation.bottom',
			title: {
				...localize2('positionActivityBarBottom', '活动栏移到底部'),
				mnemonicTitle: localize({ key: 'miBottomActivityBar', comment: ['&& denotes a mnemonic'] }, "底部"),
			},
			shortTitle: localize('bottom', "底部"),
			category: Categories.View,
			toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.BOTTOM),
			menu: [{
				id: MenuId.ActivityBarPositionMenu,
				order: 3
			}, {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.and(ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.BOTTOM), IsSessionsWindowContext.negate()),
			}]
		});
	}
	run(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.BOTTOM);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.activityBarLocation.hide',
			title: {
				...localize2('hideActivityBar', '隐藏活动栏'),
				mnemonicTitle: localize({ key: 'miHideActivityBar', comment: ['&& denotes a mnemonic'] }, "隐藏"),
			},
			shortTitle: localize('hide', "隐藏"),
			category: Categories.View,
			toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.HIDDEN),
			menu: [{
				id: MenuId.ActivityBarPositionMenu,
				order: 4
			}, {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.and(ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.HIDDEN), IsSessionsWindowContext.negate()),
			}]
		});
	}
	run(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.HIDDEN);
	}
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.ActivityBarPositionMenu,
	title: localize('positionActivituBar', "活动栏位置"),
	group: '3_workbench_layout_move',
	order: 2,
	when: IsSessionsWindowContext.negate()
});

MenuRegistry.appendMenuItem(MenuId.ViewContainerTitleContext, {
	submenu: MenuId.ActivityBarPositionMenu,
	title: localize('positionActivituBar', "活动栏位置"),
	when: ContextKeyExpr.or(
		ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.Sidebar)),
		ContextKeyExpr.equals('viewContainerLocation', ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))
	),
	group: '3_workbench_layout_move',
	order: 1
});

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.previousSideBarView',
			title: localize2('previousSideBarView', '上一个侧边栏视图'),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.Sidebar, -1);
	}
});

registerAction2(class extends SwitchCompositeViewAction {
	constructor() {
		super({
			id: 'workbench.action.nextSideBarView',
			title: localize2('nextSideBarView', '下一个侧边栏视图'),
			category: Categories.View,
			f1: true
		}, ViewContainerLocation.Sidebar, 1);
	}
});

registerAction2(
	class FocusActivityBarAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.focusActivityBar',
				title: localize2('focusActivityBar', '聚焦活动栏'),
				category: Categories.View,
				f1: true
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			layoutService.focusPart(Parts.ACTIVITYBAR_PART);
		}
	});

registerThemingParticipant((theme, collector) => {

	const activityBarActiveBorderColor = theme.getColor(ACTIVITY_BAR_ACTIVE_BORDER);
	if (activityBarActiveBorderColor) {
		collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .active-item-indicator:before {
				border-left-color: ${activityBarActiveBorderColor};
			}
		`);
	}

	const activityBarActiveFocusBorderColor = theme.getColor(ACTIVITY_BAR_ACTIVE_FOCUS_BORDER);
	if (activityBarActiveFocusBorderColor) {
		collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:focus::before {
				visibility: hidden;
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:focus .active-item-indicator:before {
				visibility: visible;
				border-left-color: ${activityBarActiveFocusBorderColor};
			}
		`);
	}

	const activityBarActiveBackgroundColor = theme.getColor(ACTIVITY_BAR_ACTIVE_BACKGROUND);
	if (activityBarActiveBackgroundColor) {
		collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .active-item-indicator {
				z-index: 0;
				background-color: ${activityBarActiveBackgroundColor};
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item .action-label::before{
				padding: 6px;
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.active .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.active:hover .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:hover .action-label::before {
				outline: 1px solid ${outline};
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:hover .action-label::before {
				outline: 1px dashed ${outline};
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:focus .active-item-indicator:before {
				border-left-color: ${outline};
			}
		`);
	}

	// Styling without outline color
	else {
		const focusBorderColor = theme.getColor(focusBorder);
		if (focusBorderColor) {
			collector.addRule(`
				.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:focus .active-item-indicator::before {
						border-left-color: ${focusBorderColor};
					}
				`);
		}
	}
});
