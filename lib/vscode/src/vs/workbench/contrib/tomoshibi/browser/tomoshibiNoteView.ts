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

export class TomoshibiNoteView extends ViewPane {

	static readonly ID = 'workbench.view.tomoshibiNote.list';

	private _body: HTMLElement | undefined;
	private _list: HTMLElement | undefined;
	private _buttonRow: HTMLElement | undefined;

	private readonly _rowDisposables = this._register(new DisposableStore());
	private readonly _textAreas = new Map<string, HTMLTextAreaElement>();

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
			this._focusAfterRender = this._noteService.add('');
		}));

		const pasteButton = append(this._buttonRow, $<HTMLButtonElement>('button'));
		pasteButton.textContent = '粘贴当前便签到终端';
		this._register(addDisposableListener(pasteButton, EventType.CLICK, () => this._insertCurrentNote()));

		this._render();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this._body) {
			this._body.style.height = `${height}px`;
		}
		// A textarea measures as zero while it is not laid out, so the first real sizing pass
		// has to happen here rather than at render time.
		for (const textArea of this._textAreas.values()) {
			autoSize(textArea);
		}
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
		this._rowDisposables.clear();
		this._textAreas.clear();
		clearNode(list);

		const readOnlyReason = this._noteService.readOnlyReason;
		const notes = this._noteService.notes;

		// The button row is hidden in both non-editable states, so a read failure can never look
		// like "your notes are gone, here is a fresh one".
		const editable = this._ready && !readOnlyReason;
		if (this._buttonRow) {
			this._buttonRow.style.display = editable ? '' : 'none';
		}

		if (!this._ready) {
			this.updateTitleDescription(undefined);
			append(list, $('.tomoshibi-placeholder')).textContent = '正在读取…';
			return;
		}

		if (readOnlyReason) {
			this.updateTitleDescription('读取失败');
			append(list, $('.tomoshibi-placeholder')).textContent = `读取失败：${readOnlyReason}`;
			return;
		}

		this.updateTitleDescription(`${notes.length} 条 · ${this._noteService.syncedToServer ? '已同步到服务器' : '本设备'}`);

		for (const note of notes) {
			this._renderNote(list, note);
		}

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
		remove.title = '删除这条便签';

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
			if (this._currentId === note.id) {
				this._currentId = undefined;
			}
			this._noteService.remove(note.id);
		}));

		autoSize(textArea);
	}

	override dispose(): void {
		this._disposed = true;
		super.dispose();
	}
}

function autoSize(textArea: HTMLTextAreaElement): void {
	textArea.style.height = 'auto';
	if (textArea.scrollHeight) {
		textArea.style.height = `${textArea.scrollHeight}px`;
	} else {
		// Not laid out yet; the CSS min-height carries it until layoutBody runs.
		textArea.style.height = '';
	}
}
