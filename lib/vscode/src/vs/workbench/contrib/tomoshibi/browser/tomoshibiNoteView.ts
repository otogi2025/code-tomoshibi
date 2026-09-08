/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { $, addDisposableListener, append, clearNode, EventType } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { INote, ITomoshibiNoteService } from './tomoshibiNoteService.js';
import { TOMOSHIBI_INSERT_TEXT_COMMAND_ID } from './tomoshibiInsertText.js';

/** How long the delete button stays armed after the first tap. */
const REMOVE_ARM_MS = 3000;

const REMOVE_TITLE = '删除这条便签';
const REMOVE_ARMED_TITLE = '再点一次删除';

export class TomoshibiNoteView extends ViewPane {

	static readonly ID = 'workbench.view.tomoshibiNote.list';

	private _body: HTMLElement | undefined;
	private _list: HTMLElement | undefined;
	private _buttonRow: HTMLElement | undefined;

	private readonly _rowDisposables = this._register(new DisposableStore());
	private readonly _textAreas = new Map<string, HTMLTextAreaElement>();
	private readonly _removeButtons = new Map<string, HTMLButtonElement>();

	/** The note whose delete button has been tapped once; a second tap on it removes the note. */
	private _armedRemoveId: string | undefined;
	private _removeTimer: ReturnType<typeof setTimeout> | undefined;

	private _ready = false;
	private _disposed = false;

	/** The note the caret is in; what "the current note" means for the paste button. */
	private _currentId: string | undefined;

	/** Set by add() so the freshly created note gets the caret once the rebuild is done. */
	private _focusAfterRender: string | undefined;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ITomoshibiNoteService private readonly _noteService: ITomoshibiNoteService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this._noteService.onDidChange(() => this._render()));
		// Only the title line depends on this, and rebuilding the notes would drop the caret.
		this._register(this._noteService.onDidChangeSyncState(() => this._updateTitle()));
		void this._noteService.whenReady.then(() => {
			if (this._disposed) {
				return;
			}
			this._ready = true;
			this._render();
		});
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this._body = append(container, $('.tomoshibi-pane-body.tomoshibi-note-view'));
		this._list = append(this._body, $('.tomoshibi-note-list'));

		this._buttonRow = append(this._body, $('.tomoshibi-rowbtn'));

		const addButton = append(this._buttonRow, $<HTMLButtonElement>('button'));
		addButton.textContent = '+ 新便签';
		this._register(addDisposableListener(addButton, EventType.CLICK, () => {
			// 求值顺序：add() 内部同步 fire onDidChange，那一遍 _render() 在 add() 返回之前就跑完了，
			// 所以写在赋值右边的 id 永远赶不上它 —— 新便签从来不聚焦（iPad 上软键盘不弹），而这个
			// id 留在字段里，被「下一次」渲染（第二次点「+」、或者点 ✕ 删一条）误消费，把光标和键盘
			// 拽到上一条便签上。先拿 id，再自己渲染一次。
			const id = this._noteService.add('');
			this._focusAfterRender = id;
			this._render();
		}));

		const pasteButton = append(this._buttonRow, $<HTMLButtonElement>('button'));
		pasteButton.textContent = '粘贴当前便签到终端';
		this._register(addDisposableListener(pasteButton, EventType.CLICK, () => this._insertCurrentNote()));

		this._register({
			dispose: () => {
				if (this._removeTimer !== undefined) {
					clearTimeout(this._removeTimer);
					this._removeTimer = undefined;
				}
			}
		});

		this._render();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this._body) {
			this._body.style.height = `${height}px`;
		}
		// A textarea measures as zero while it is not laid out, so the first real sizing pass
		// has to happen here rather than at render time.
		autoSizeAll(this._textAreas.values());
	}

	private _insertCurrentNote(): void {
		const notes = this._noteService.notes;
		const current = (this._currentId ? notes.find(note => note.id === this._currentId) : undefined) ?? notes[0];
		if (!current || !current.text) {
			return;
		}
		void this._commandService.executeCommand(TOMOSHIBI_INSERT_TEXT_COMMAND_ID, current.text);
	}

	private _render(): void {
		const list = this._list;
		if (!list) {
			return;
		}

		const scrollTop = list.scrollTop;
		this._disarmRemove();
		this._rowDisposables.clear();
		this._textAreas.clear();
		this._removeButtons.clear();
		clearNode(list);

		const readOnlyReason = this._noteService.readOnlyReason;
		const notes = this._noteService.notes;
		this._updateTitle();

		// The button row is hidden in both non-editable states, so a read failure can never look
		// like "your notes are gone, here is a fresh one".
		const editable = this._ready && !readOnlyReason;
		if (this._buttonRow) {
			this._buttonRow.style.display = editable ? '' : 'none';
		}

		if (!this._ready) {
			append(list, $('.tomoshibi-placeholder')).textContent = '正在读取…';
			return;
		}

		if (readOnlyReason) {
			append(list, $('.tomoshibi-placeholder')).textContent = `读取失败：${readOnlyReason}`;
			return;
		}

		for (const note of notes) {
			this._renderNote(list, note);
		}
		// After the whole list is in the document, not once per note: interleaving append with a
		// scrollHeight read forces a synchronous layout on every single note.
		autoSizeAll(this._textAreas.values());

		list.scrollTop = scrollTop;

		const focusId = this._focusAfterRender;
		this._focusAfterRender = undefined;
		if (focusId) {
			const textArea = this._textAreas.get(focusId);
			if (textArea) {
				this._currentId = focusId;
				textArea.focus();
			}
		}
	}

	/**
	 * 「已同步到服务器」以前只看配置里开没开同步，写盘一直失败也照样这么写。写失败现在会把它
	 * 换成「未同步」，用户至少知道现在敲的东西没进服务器。
	 */
	private _updateTitle(): void {
		if (!this._ready) {
			this.updateTitleDescription(undefined);
			return;
		}
		if (this._noteService.readOnlyReason) {
			this.updateTitleDescription('读取失败');
			return;
		}
		const count = this._noteService.notes.length;
		if (!this._noteService.syncedToServer) {
			this.updateTitleDescription(`${count} 条 · 本设备`);
			return;
		}
		this.updateTitleDescription(`${count} 条 · ${this._noteService.syncError ? '未同步' : '已同步到服务器'}`);
	}

	private _renderNote(list: HTMLElement, note: INote): void {
		const wrapper = append(list, $('.tomoshibi-note'));

		// A textarea, not contenteditable: the iOS Chinese keyboard drops characters mid
		// composition on contenteditable elements.
		const textArea = append(wrapper, $<HTMLTextAreaElement>('textarea'));
		textArea.value = note.text;
		textArea.rows = 1;
		textArea.spellcheck = false;
		this._textAreas.set(note.id, textArea);

		const remove = append(wrapper, $<HTMLButtonElement>('button.x'));
		remove.textContent = '✕';
		remove.title = REMOVE_TITLE;
		this._removeButtons.set(note.id, remove);

		this._rowDisposables.add(addDisposableListener(textArea, EventType.INPUT, () => {
			autoSize(textArea);
			// The service does not raise onDidChange for edits, so this cannot rebuild the DOM
			// under the caret.
			this._noteService.update(note.id, textArea.value);
		}));
		this._rowDisposables.add(addDisposableListener(textArea, EventType.FOCUS, () => {
			this._currentId = note.id;
		}));
		this._rowDisposables.add(addDisposableListener(remove, EventType.CLICK, () => {
			// Deleting a note is irreversible and there is no undo, so it gets the same two tap
			// shape the clipboard's clear button already uses. The button is also 28px and sits on
			// top of the textarea, which is exactly where a finger lands by accident.
			if (this._armedRemoveId !== note.id) {
				this._armRemove(note.id);
				return;
			}
			this._disarmRemove();
			if (this._currentId === note.id) {
				this._currentId = undefined;
			}
			this._noteService.remove(note.id);
		}));
	}

	private _armRemove(id: string): void {
		this._disarmRemove();
		const button = this._removeButtons.get(id);
		if (!button) {
			return;
		}
		this._armedRemoveId = id;
		button.classList.add('armed');
		button.title = REMOVE_ARMED_TITLE;
		this._removeTimer = setTimeout(() => this._disarmRemove(), REMOVE_ARM_MS);
	}

	private _disarmRemove(): void {
		if (this._removeTimer !== undefined) {
			clearTimeout(this._removeTimer);
			this._removeTimer = undefined;
		}
		const id = this._armedRemoveId;
		this._armedRemoveId = undefined;
		if (id === undefined) {
			return;
		}
		const button = this._removeButtons.get(id);
		if (button) {
			button.classList.remove('armed');
			button.title = REMOVE_TITLE;
		}
	}

	override dispose(): void {
		this._disposed = true;
		super.dispose();
	}
}

function autoSize(textArea: HTMLTextAreaElement): void {
	textArea.style.height = 'auto';
	applyAutoSize(textArea, textArea.scrollHeight);
}

/**
 * The same thing for a whole list, with the writes and the reads batched.
 *
 * Done one textarea at a time it is a write ("height: auto") followed immediately by a read
 * (scrollHeight), which forces the browser into a synchronous layout, once per note. Every drag of
 * the sidebar sash runs this for all of them. Setting every height first and only then reading
 * them all back collapses those N layouts into one.
 */
function autoSizeAll(textAreas: Iterable<HTMLTextAreaElement>): void {
	const all = Array.from(textAreas);
	for (const textArea of all) {
		textArea.style.height = 'auto';
	}
	const heights = all.map(textArea => textArea.scrollHeight);
	for (let index = 0; index < all.length; index++) {
		applyAutoSize(all[index], heights[index]);
	}
}

function applyAutoSize(textArea: HTMLTextAreaElement, scrollHeight: number): void {
	if (scrollHeight) {
		textArea.style.height = `${scrollHeight}px`;
	} else {
		// Not laid out yet; the CSS min-height carries it until layoutBody runs.
		textArea.style.height = '';
	}
}
