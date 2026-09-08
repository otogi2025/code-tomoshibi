/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { $, addDisposableListener, append, clearNode, EventType, getActiveElement, isHTMLElement } from '../../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../../base/browser/keyboardEvent.js';
import { Emitter } from '../../../../../base/common/event.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IRemoteExplorerService, PORT_AUTO_FORWARD_SETTING } from '../../../../services/remote/common/remoteExplorerService.js';
import { Tunnel, TunnelCloseReason, TunnelSource } from '../../../../services/remote/common/tunnelModel.js';
import { IWorkbenchThemeService, ThemeSettingDefaults } from '../../../../services/themes/common/workbenchThemeService.js';
import { ITerminalProfileService } from '../../../terminal/common/terminal.js';
import { SettingsSection, isSettingsSection, settingsSections } from './tomoshibiSettingsInput.js';
import { buttonControl, monospaceValue, numberControl, optRow, readonlyTextControl, selectControl, switchControl } from './tomoshibiSettingsWidgets.js';
import './media/tomoshibiSettings.css';

const sectionTitles: Record<SettingsSection, string> = {
	ui: localize('tomoshibi.settings.section.ui', "外观"),
	term: localize('tomoshibi.settings.section.term', "终端"),
	ports: localize('tomoshibi.settings.section.ports', "端口转发"),
	clip: localize('tomoshibi.settings.section.clip', "剪贴板 / 便签"),
	upload: localize('tomoshibi.settings.section.upload', "上传"),
	perf: localize('tomoshibi.settings.section.perf', "性能监测"),
	acct: localize('tomoshibi.settings.section.acct', "账户"),
};

/**
 * Every configuration key a section shows. A change to one of them redraws that section, which
 * is how a value edited from the settings.json file, from another window, or by the row next to
 * it shows up here without a reload.
 */
const sectionKeys: Record<SettingsSection, readonly string[]> = {
	ui: ['workbench.colorTheme', 'terminal.integrated.fontSize', 'editor.fontSize', 'tomoshibi.scrollbar.thick', 'workbench.sideBar.location'],
	term: ['terminal.integrated.defaultProfile.linux', 'terminal.integrated.enablePersistentSessions', 'tomoshibi.terminal.shiftEnterNewline', 'tomoshibi.terminal.touchSelection'],
	ports: [PORT_AUTO_FORWARD_SETTING],
	clip: ['tomoshibi.clipboard.history.enabled', 'tomoshibi.clipboard.history.limit', 'tomoshibi.notes.syncToServer'],
	upload: ['tomoshibi.upload.insertPath'],
	perf: ['tomoshibi.performance.enabled', 'tomoshibi.performance.interval'],
	acct: [],
};

const dash = '—';

/** 窄版式的分界线：浮层自身宽度小于它就把导航变成顶部横条、每行控件换到标签下面。 */
const narrowWidth = 480;

/** Tab 圈焦点时算作「可以停」的标签，浮层里出现的就这几种。 */
const focusableTags = new Set(['BUTTON', 'SELECT', 'INPUT', 'A']);

/**
 * One line of the ports table. `tunnel` is what tells the two halves of the table apart: a row
 * that has one is forwarded and can be opened or stopped, a row without one is only a listening
 * port the candidate finder saw and can be forwarded.
 */
interface IPortRow {
	readonly port: number;
	readonly host: string;
	readonly process: string;
	readonly tunnel: Tunnel | undefined;
}

/**
 * Code-Tomoshibi 的设置：一层浮在工作台之上的模态弹窗。
 *
 * 以前它是编辑器区里的一个标签页（EditorInput + EditorPane），打开就会把终端挤窄、关掉也不
 * 还回来。现在整块 DOM 直接挂到 `ILayoutService.activeContainer` 上，编辑器区和面板布局全程
 * 不参与，所以终端宽度从开到关都不动。
 *
 * 它照旧不持有任何 model：每个分区在被选中的那一刻从服务里现读一遍值重建自己的行，因此没有
 * 需要同步的副本，一次重绘之间唯一保留的状态是页面的滚动位置。
 *
 * 文件名还叫 tomoshibiSettingsEditor.ts 是为了不把本次改动扩散到施工单给的可改文件清单之外，
 * 重命名留给后续。
 */
export class TomoshibiSettingsOverlay extends Disposable {

	private readonly _scrim: HTMLElement;
	private readonly _root: HTMLElement;
	private readonly _pages: HTMLElement;
	private readonly _navButtons = new Map<SettingsSection, HTMLButtonElement>();
	private readonly _sectionElements = new Map<SettingsSection, HTMLElement>();
	private readonly _sectionStores = new Map<SettingsSection, DisposableStore>();

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private _current: SettingsSection = 'ui';
	private _closed = false;

	/** 打开前正在用的那个元素，多半是终端；关闭时焦点原样还回去。 */
	private readonly _previousFocus: HTMLElement | undefined;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IWorkbenchThemeService private readonly _workbenchThemeService: IWorkbenchThemeService,
		@ITerminalProfileService private readonly _terminalProfileService: ITerminalProfileService,
		@ICommandService private readonly _commandService: ICommandService,
		@IProductService private readonly _productService: IProductService,
		@IRemoteExplorerService private readonly _remoteExplorerService: IRemoteExplorerService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@ILayoutService private readonly _layoutService: ILayoutService,
	) {
		super();

		const active = getActiveElement();
		this._previousFocus = isHTMLElement(active) ? active : undefined;

		// 遮罩铺满工作台容器（.monaco-workbench 自己是 position: relative），弹窗在它里面居中。
		this._scrim = append(this._layoutService.activeContainer, $('.tomoshibi-settings-scrim'));
		this._register(toDisposable(() => this._scrim.remove()));

		this._root = append(this._scrim, $('.tomoshibi-settings'));
		this._root.setAttribute('role', 'dialog');
		this._root.setAttribute('aria-modal', 'true');
		this._root.setAttribute('aria-label', localize('tomoshibi.settings.dialogLabel', "设置"));
		// 浮层自己要可聚焦：戳到 h3、行标签、端口表格这些不可聚焦的东西时浏览器会把焦点打回
		// <body>，那之后键盘事件不再经过浮层。有了这个 tabIndex 才有地方把焦点收回来。
		this._root.tabIndex = -1;

		// 点遮罩空白处关闭；点到弹窗里的任何东西都不算。
		this._register(addDisposableListener(this._scrim, EventType.CLICK, event => {
			if (event.target === this._scrim) {
				this.close();
			}
		}));
		// 监听挂在整个工作台容器上而不是遮罩上：焦点掉回 <body> 时 keydown 根本不经过遮罩，
		// 挂在遮罩上的话 Escape 关不掉浮层、Tab 会走进遮罩背后的工作台。浮层开着时它是模态的，
		// 所以这里无条件处理。
		this._register(addDisposableListener(this._layoutService.activeContainer, EventType.KEY_DOWN, event => this._onKeyDown(event)));

		const header = append(this._root, $('.tomoshibi-settings-hd'));
		append(header, $('h2', undefined, localize('tomoshibi.settings.header', "设置")));
		const close = append(header, $<HTMLButtonElement>('button.tomoshibi-settings-x.codicon.codicon-close'));
		close.type = 'button';
		close.setAttribute('aria-label', localize('tomoshibi.settings.close', "关闭设置"));
		this._register(addDisposableListener(close, EventType.CLICK, event => {
			event.preventDefault();
			this.close();
		}));

		const body = append(this._root, $('.tomoshibi-settings-bd'));
		const nav = append(body, $('nav'));
		for (const section of settingsSections) {
			const button = append(nav, $<HTMLButtonElement>('button'));
			button.type = 'button';
			button.textContent = sectionTitles[section];
			this._register(addDisposableListener(button, EventType.CLICK, event => {
				event.preventDefault();
				this._select(section);
			}));
			this._navButtons.set(section, button);
		}

		this._pages = append(body, $('.tomoshibi-settings-pg'));
		for (const section of settingsSections) {
			const element = append(this._pages, $('section'));
			this._sectionElements.set(section, element);
			const store = this._register(new DisposableStore());
			this._sectionStores.set(section, store);
		}

		this._register(this._configurationService.onDidChangeConfiguration(event => {
			if (sectionKeys[this._current].some(key => event.affectsConfiguration(key))) {
				this._renderSection(this._current);
			}
		}));
		this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => {
			if (this._current === 'term') {
				this._renderSection('term');
			}
		}));

		// The ports table has no configuration key behind most of what it shows, so it follows the
		// tunnel model directly: a port forwarded or closed from anywhere (this table, an extension,
		// the automatic forwarder) redraws the section.
		const tunnelModel = this._remoteExplorerService.tunnelModel;
		const redrawPorts = () => {
			if (this._current === 'ports') {
				this._renderSection('ports');
			}
		};
		this._register(tunnelModel.onForwardPort(redrawPorts));
		this._register(tunnelModel.onClosePort(redrawPorts));
		this._register(tunnelModel.onPortName(redrawPorts));
		this._register(tunnelModel.onCandidatesChanged(redrawPorts));

		this._register(this._layoutService.onDidLayoutActiveContainer(() => this._updateNarrow()));

		// 只把导航的选中态摆好，不渲染任何分区：唯一的构造点紧接着就会调 show()，那一次才知道
		// 目标分区是哪一个。这里先渲一遍「外观」的话，从状态栏端口条目进来时它会被整段建完再丢掉。
		this._updateSelection();
	}

	/** 打开（或已经开着时切到某一页）。焦点进浮层，物理键盘从这里就能一路 Tab 下去。 */
	show(section?: SettingsSection): void {
		this._select(isSettingsSection(section) ? section : this._current);
		this._updateNarrow();
		this._navButtons.get(this._current)?.focus();
	}

	close(): void {
		if (this._closed) {
			return;
		}
		this._closed = true;
		const previousFocus = this._previousFocus;
		this._onDidClose.fire();
		this.dispose();
		// 焦点最后还，且只在那个元素还在文档里时还 —— 终端多半正开着，还回去才能接着打字。
		if (previousFocus?.isConnected) {
			previousFocus.focus();
		}
	}

	private _onKeyDown(event: KeyboardEvent): void {
		const keyboardEvent = new StandardKeyboardEvent(event);
		if (keyboardEvent.equals(KeyCode.Escape)) {
			// stopPropagation 是必须的：键绑定服务在 window 上按冒泡阶段听 keydown，不拦住的话
			// 这一次 Escape 会同时被工作台当成一次快捷键。
			event.preventDefault();
			event.stopPropagation();
			this.close();
			return;
		}
		if (keyboardEvent.keyCode !== KeyCode.Tab) {
			return;
		}
		// 模态浮层要把 Tab 圈在自己里面，否则焦点会跑到遮罩背后的工作台上，看不见却在响应按键。
		const focusable = this._focusable();
		if (focusable.length === 0) {
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = getActiveElement();
		if (!active || !this._root.contains(active)) {
			// 焦点已经掉到浮层外面（多半是 <body>）：默认的 Tab 会走进遮罩背后的工作台，先拉回来。
			event.preventDefault();
			(keyboardEvent.shiftKey ? last : first).focus();
			return;
		}
		if (keyboardEvent.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!keyboardEvent.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	/**
	 * 现走一遍 DOM 收可聚焦元素，不缓存：分区是随时重建的，缓存下来的一定过期。没被选中的分区
	 * 父级是 display: none，里面的控件 `offsetParent` 为 null，走到就跳过。
	 * 用手写遍历而不是 querySelectorAll，是因为仓库的 hygiene 明令禁止后者。
	 */
	private _focusable(): HTMLElement[] {
		const found: HTMLElement[] = [];
		const walk = (element: HTMLElement) => {
			const children = element.children;
			for (let index = 0; index < children.length; index++) {
				const child = children.item(index);
				if (!isHTMLElement(child) || child.offsetParent === null || child.hasAttribute('disabled')) {
					continue;
				}
				if (focusableTags.has(child.tagName)) {
					found.push(child);
				}
				walk(child);
			}
		};
		walk(this._root);
		return found;
	}

	/**
	 * 窄版式跟的是浮层自己的宽度而不是窗口宽度：浮层宽 min(720px, 92vw)，在 iPad 横屏上是 720px
	 * 走宽版，在窄屏上才落到 480 以下。
	 */
	private _updateNarrow(): void {
		this._root.classList.toggle('narrow', this._root.clientWidth < narrowWidth);
	}

	private _select(section: SettingsSection): void {
		// 点已经选中的那个导航标签（或再一次 show 到同一分区）不该把这段 DOM 拆了重搭：没提交的
		// 手动端口号、正在改的字号都会被清掉。分区还没建过时 hasChildNodes() 为假，照旧渲染。
		if (section === this._current && this._sectionElements.get(section)?.hasChildNodes()) {
			return;
		}
		this._current = section;
		this._updateSelection();
		this._renderSection(section);
	}

	private _updateSelection(): void {
		for (const section of settingsSections) {
			const selected = section === this._current;
			this._navButtons.get(section)?.classList.toggle('on', selected);
			this._navButtons.get(section)?.setAttribute('aria-pressed', String(selected));
			this._sectionElements.get(section)?.classList.toggle('on', selected);
		}
	}

	private _write(key: string, value: unknown): void {
		void this._configurationService.updateValue(key, value, ConfigurationTarget.USER);
	}

	private async _applyTheme(settingsId: string): Promise<void> {
		const themes = await this._workbenchThemeService.getColorThemes();
		const theme = themes.find(candidate => candidate.settingsId === settingsId);
		if (theme) {
			await this._workbenchThemeService.setColorTheme(theme.id, 'auto');
		}
	}

	/**
	 * Rebuilds one section from scratch. The page scroll position is restored afterwards so a
	 * value edited near the bottom of a long section does not jump the view back to the top.
	 */
	private _renderSection(section: SettingsSection): void {
		const container = this._sectionElements.get(section);
		const store = this._sectionStores.get(section);
		if (!container || !store) {
			return;
		}
		const scrollTop = this._pages.scrollTop;
		// 重建会把正持有焦点的那个控件从文档里删掉（按空格切一个开关、换一次主题都会走到这里），
		// 不还焦点的话它就落到 <body>，Escape 和 Tab 从此都不再经过浮层。
		const activeBefore = getActiveElement();
		const restoreFocus = !!activeBefore && this._root.contains(activeBefore);
		store.clear();
		clearNode(container);
		append(container, $('h3', undefined, sectionTitles[section]));

		switch (section) {
			case 'ui':
				this._renderUi(container, store);
				break;
			case 'term':
				this._renderTerm(container, store);
				break;
			case 'ports':
				this._renderPorts(container, store);
				break;
			case 'clip':
				this._renderClip(container, store);
				break;
			case 'upload':
				this._renderUpload(container, store);
				break;
			case 'perf':
				this._renderPerf(container, store);
				break;
			case 'acct':
				this._renderAcct(container, store);
				break;
		}

		this._pages.scrollTop = scrollTop;

		if (restoreFocus && activeBefore && !activeBefore.isConnected) {
			(this._navButtons.get(section) ?? this._root).focus();
		}
	}

	private _renderUi(container: HTMLElement, store: DisposableStore): void {
		append(container, optRow(
			localize('tomoshibi.settings.ui.theme', "主题"),
			localize('tomoshibi.settings.ui.themeSmall', "只留 Dark 2026 和 Light 2026 两个"),
			selectControl(store, [
				{ value: ThemeSettingDefaults.COLOR_THEME_DARK, label: ThemeSettingDefaults.COLOR_THEME_DARK },
				{ value: ThemeSettingDefaults.COLOR_THEME_LIGHT, label: ThemeSettingDefaults.COLOR_THEME_LIGHT },
			], () => this._configurationService.getValue<string>('workbench.colorTheme') ?? ThemeSettingDefaults.COLOR_THEME_DARK,
				value => void this._applyTheme(value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.ui.fontSize', "字号"),
			localize('tomoshibi.settings.ui.fontSizeSmall', "编辑器与终端一起"),
			numberControl(store, 10, 28, () => this._fontSize(), value => {
				this._write('terminal.integrated.fontSize', value);
				this._write('editor.fontSize', value);
			})
		));

		append(container, optRow(
			localize('tomoshibi.settings.ui.scrollbar', "滚动条粗细"),
			localize('tomoshibi.settings.ui.scrollbarSmall', "iPad 上手指能拖的宽度"),
			selectControl(store, [
				{ value: 'thin', label: localize('tomoshibi.settings.ui.scrollbarThin', "细（原版）") },
				{ value: 'thick', label: localize('tomoshibi.settings.ui.scrollbarThick', "粗（14px）") },
			], () => this._configurationService.getValue<boolean>('tomoshibi.scrollbar.thick') === false ? 'thin' : 'thick',
				value => this._write('tomoshibi.scrollbar.thick', value === 'thick'))
		));

		append(container, optRow(
			localize('tomoshibi.settings.ui.sideBar', "侧栏位置"),
			undefined,
			selectControl(store, [
				{ value: 'left', label: localize('tomoshibi.settings.ui.sideBarLeft', "左") },
				{ value: 'right', label: localize('tomoshibi.settings.ui.sideBarRight', "右") },
			], () => this._configurationService.getValue<string>('workbench.sideBar.location') === 'right' ? 'right' : 'left',
				value => this._write('workbench.sideBar.location', value))
		));
	}

	private _fontSize(): number {
		const terminalFontSize = this._configurationService.getValue<number>('terminal.integrated.fontSize');
		if (typeof terminalFontSize === 'number' && Number.isFinite(terminalFontSize)) {
			return terminalFontSize;
		}
		const editorFontSize = this._configurationService.getValue<number>('editor.fontSize');
		return typeof editorFontSize === 'number' && Number.isFinite(editorFontSize) ? editorFontSize : 14;
	}

	private _renderTerm(container: HTMLElement, store: DisposableStore): void {
		const profiles = this._terminalProfileService.availableProfiles;
		const currentProfile = this._configurationService.getValue<string>('terminal.integrated.defaultProfile.linux') ?? '';
		// The profile list arrives asynchronously after a reload. Until it does, showing the
		// stored name read-only is honest: a select with no options could only lose the value.
		// An unset value must not fall through to the first option: the shell then in use is the
		// detected default, so the first option says which one that is and writes nothing back.
		const detected = this._terminalProfileService.getDefaultProfileName();
		const autoLabel = detected
			? localize('tomoshibi.settings.term.shellAuto', "自动（{0}）", detected)
			: localize('tomoshibi.settings.term.shellAutoUnknown', "自动");
		const profileControl = profiles.length
			? selectControl(store, [{ value: '', label: autoLabel }, ...profiles.map(profile => ({ value: profile.profileName, label: profile.profileName }))],
				() => currentProfile,
				value => this._write('terminal.integrated.defaultProfile.linux', value || undefined))
			: readonlyTextControl(currentProfile || autoLabel);
		append(container, optRow(localize('tomoshibi.settings.term.shell', "默认 shell"), undefined, profileControl));

		append(container, optRow(
			localize('tomoshibi.settings.term.persistent', "刷新后自动重连 session"),
			localize('tomoshibi.settings.term.persistentSmall', "持久 session"),
			switchControl(store,
				() => this._configurationService.getValue<boolean>('terminal.integrated.enablePersistentSessions') !== false,
				value => this._write('terminal.integrated.enablePersistentSessions', value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.term.shiftEnter', "Shift+回车 = 换行"),
			undefined,
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.terminal.shiftEnterNewline') !== false,
				value => this._write('tomoshibi.terminal.shiftEnterNewline', value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.term.touchSelection', "长按选中出 Apple 式手柄"),
			localize('tomoshibi.settings.term.touchSelectionSmall', "关掉就没有手柄和放大镜"),
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.terminal.touchSelection') !== false,
				value => this._write('tomoshibi.terminal.touchSelection', value))
		));
	}

	/**
	 * The ports table, which is the whole reason the PORTS panel could go away. It owns no state:
	 * every draw reads the tunnel model, so a port forwarded from here, from an extension or by the
	 * automatic forwarder all land in the same list.
	 */
	private _renderPorts(container: HTMLElement, store: DisposableStore): void {
		append(container, $('p.tomoshibi-settings-note', undefined, localize('tomoshibi.settings.ports.note', "VPS 上监听的端口会自动出现在这里。打开「转发」后可以在 iPad 的浏览器里直接访问。")));

		append(container, optRow(
			localize('tomoshibi.settings.ports.auto', "自动发现并转发监听端口"),
			localize('tomoshibi.settings.ports.autoSmall', "关着时只显示手动转发过的"),
			switchControl(store,
				() => this._configurationService.getValue<boolean>(PORT_AUTO_FORWARD_SETTING) === true,
				value => this._write(PORT_AUTO_FORWARD_SETTING, value))
		));

		const table = append(container, $('table.tomoshibi-settings-ports'));
		const head = append(append(table, $('thead')), $('tr'));
		append(head, $('th', undefined, localize('tomoshibi.settings.ports.colPort', "端口")));
		append(head, $('th', undefined, localize('tomoshibi.settings.ports.colProcess', "进程")));
		append(head, $('th', undefined, localize('tomoshibi.settings.ports.colAddress', "访问地址")));
		append(head, $('th', undefined, localize('tomoshibi.settings.ports.colState', "转发")));
		append(head, $('th'));

		const body = append(table, $('tbody'));
		const rows = this._portRows();
		if (rows.length === 0) {
			const cell = append(append(body, $('tr')), $<HTMLTableCellElement>('td.tomoshibi-settings-empty', undefined,
				localize('tomoshibi.settings.ports.empty', "还没有发现监听中的端口。在下面手动填一个也可以。")));
			cell.colSpan = 5;
		}
		for (const row of rows) {
			this._appendPortRow(body, store, row);
		}

		const add = append(container, $('.tomoshibi-settings-add'));
		const input = append(add, $<HTMLInputElement>('input.tomoshibi-settings-number.tomoshibi-settings-portadd'));
		input.type = 'number';
		input.min = '1';
		input.max = '65535';
		input.placeholder = localize('tomoshibi.settings.ports.addPlaceholder', "手动添加端口，如 3000");
		const submit = () => {
			const port = Number.parseInt(input.value, 10);
			input.value = '';
			if (Number.isFinite(port) && port >= 1 && port <= 65535) {
				this._forward('localhost', port);
			}
		};
		store.add(addDisposableListener(input, EventType.KEY_DOWN, event => {
			if (new StandardKeyboardEvent(event).equals(KeyCode.Enter)) {
				event.preventDefault();
				submit();
			}
		}));
		append(add, buttonControl(store, localize('tomoshibi.settings.ports.add', "添加"), '.pri', submit));
	}

	/**
	 * Forwarded and detected tunnels first, then the ports the candidate finder saw that nobody has
	 * forwarded yet. Keyed by port alone: the same port on `localhost` and on `0.0.0.0` is one line
	 * to a person looking at the table.
	 */
	private _portRows(): IPortRow[] {
		const model = this._remoteExplorerService.tunnelModel;
		const rows = new Map<number, IPortRow>();
		for (const tunnel of [...model.forwarded.values(), ...model.detected.values()]) {
			if (!rows.has(tunnel.remotePort)) {
				rows.set(tunnel.remotePort, {
					port: tunnel.remotePort,
					host: tunnel.remoteHost,
					process: this._processName(tunnel.runningProcess, tunnel.pid),
					tunnel,
				});
			}
		}
		for (const candidate of model.candidates) {
			if (!rows.has(candidate.port)) {
				rows.set(candidate.port, {
					port: candidate.port,
					host: candidate.host,
					process: this._processName(candidate.detail, candidate.pid),
					tunnel: undefined,
				});
			}
		}
		return Array.from(rows.values()).sort((one, other) => one.port - other.port);
	}

	private _processName(runningProcess: string | undefined, pid: number | undefined): string {
		const name = runningProcess ?? (pid !== undefined ? this._remoteExplorerService.namedProcesses.get(pid) : undefined);
		// The candidate finder hands over /proc/<pid>/cmdline as read, with NUL between arguments.
		const cleaned = name?.replace(/\0/g, ' ').trim();
		return cleaned ? cleaned : dash;
	}

	private _appendPortRow(body: HTMLElement, store: DisposableStore, row: IPortRow): void {
		const line = append(body, $('tr'));
		append(line, $('td.tomoshibi-settings-mono', undefined, String(row.port)));

		const processCell = append(line, $('td.tomoshibi-settings-proc', undefined, row.process));
		processCell.title = row.process;

		const address = append(line, $('td.tomoshibi-settings-mono.tomoshibi-settings-addr'));
		const tunnel = row.tunnel;
		if (tunnel) {
			// The address is a real link so a long press on the iPad still offers "open in new tab";
			// the click handler routes through the opener service the ports panel used.
			const uri = tunnel.localUri;
			const link = append(address, $<HTMLAnchorElement>('a.tomoshibi-settings-link'));
			link.textContent = uri.toString(true);
			link.href = uri.toString(true);
			store.add(addDisposableListener(link, EventType.CLICK, event => {
				event.preventDefault();
				void this._openerService.open(uri);
			}));
		} else {
			address.textContent = dash;
			address.classList.add('none');
		}

		const state = append(line, $('td.tomoshibi-settings-state'));
		append(state, tunnel
			? $('span.tomoshibi-tag.ok', undefined, localize('tomoshibi.settings.ports.on', "已转发"))
			: $('span.tomoshibi-tag', undefined, localize('tomoshibi.settings.ports.off', "未转发")));

		const actions = append(line, $('td.tomoshibi-settings-act'));
		if (!tunnel) {
			append(actions, buttonControl(store, localize('tomoshibi.settings.ports.forward', "转发"), '', () => this._forward(row.host, row.port)));
		} else if (tunnel.closeable !== false) {
			// A tunnel the environment set up statically is not ours to close, so it gets no button.
			append(actions, buttonControl(store, localize('tomoshibi.settings.ports.stop', "停止"), '.dan', () => {
				void this._remoteExplorerService.close({ host: tunnel.remoteHost, port: tunnel.remotePort }, TunnelCloseReason.User);
			}));
		}
	}

	private _forward(host: string, port: number): void {
		void this._remoteExplorerService.forward({
			remote: { host, port },
			source: { source: TunnelSource.User, description: 'Code-Tomoshibi' },
		});
	}

	private _renderClip(container: HTMLElement, store: DisposableStore): void {
		append(container, optRow(
			localize('tomoshibi.settings.clip.history', "记录剪贴板历史"),
			localize('tomoshibi.settings.clip.historySmall', "只记这台设备在 Code-Tomoshibi 里复制的内容"),
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.clipboard.history.enabled') !== false,
				value => this._write('tomoshibi.clipboard.history.enabled', value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.clip.limit', "保留条数"),
			undefined,
			numberControl(store, 10, 200,
				() => this._configurationService.getValue<number>('tomoshibi.clipboard.history.limit') ?? 50,
				value => this._write('tomoshibi.clipboard.history.limit', value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.clip.notes', "便签同步到服务器"),
			localize('tomoshibi.settings.clip.notesSmall', "换设备也能看到"),
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.notes.syncToServer') !== false,
				value => this._write('tomoshibi.notes.syncToServer', value))
		));
	}

	private _renderUpload(container: HTMLElement, store: DisposableStore): void {
		const directorySmall = localize('tomoshibi.settings.upload.fixed', "目录在服务端固定");
		append(container, optRow(localize('tomoshibi.settings.upload.file', "文件上传到"), directorySmall, readonlyTextControl('~/上传')));
		append(container, optRow(localize('tomoshibi.settings.upload.image', "图片上传到"), directorySmall, readonlyTextControl('~/上传图片')));
		append(container, optRow(
			localize('tomoshibi.settings.upload.insertPath', "上传后把路径插进终端"),
			undefined,
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.upload.insertPath') !== false,
				value => this._write('tomoshibi.upload.insertPath', value))
		));
	}

	private _renderPerf(container: HTMLElement, store: DisposableStore): void {
		append(container, optRow(
			localize('tomoshibi.settings.perf.enabled', "状态栏显示 C / M / 下行 / 上行"),
			undefined,
			switchControl(store,
				() => this._configurationService.getValue<boolean>('tomoshibi.performance.enabled') !== false,
				value => this._write('tomoshibi.performance.enabled', value))
		));

		append(container, optRow(
			localize('tomoshibi.settings.perf.interval', "刷新间隔"),
			undefined,
			selectControl(store, [
				{ value: '250', label: localize('tomoshibi.settings.perf.interval250', "实时（0.25 秒）") },
				{ value: '500', label: localize('tomoshibi.settings.perf.interval500', "0.5 秒") },
				{ value: '1000', label: localize('tomoshibi.settings.perf.interval1', "1 秒") },
				{ value: '2000', label: localize('tomoshibi.settings.perf.interval2', "2 秒") },
				{ value: '5000', label: localize('tomoshibi.settings.perf.interval5', "5 秒") },
			], () => String(this._configurationService.getValue<number>('tomoshibi.performance.interval') ?? 500),
				value => this._write('tomoshibi.performance.interval', Number.parseInt(value, 10)))
		));
	}

	private _renderAcct(container: HTMLElement, store: DisposableStore): void {
		append(container, optRow(
			localize('tomoshibi.settings.acct.logout', "回到密码页"),
			localize('tomoshibi.settings.acct.logoutSmall', "等于点右下角 MADE BY ITSUKI"),
			buttonControl(store, localize('tomoshibi.settings.acct.logoutButton', "退出"), '', () => {
				void this._commandService.executeCommand('code-server.logout');
			})
		));

		append(container, optRow(
			localize('tomoshibi.settings.acct.version', "版本"),
			undefined,
			monospaceValue(this._productService.codeServerVersion ?? this._productService.version)
		));
	}
}
