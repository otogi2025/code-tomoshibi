/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { AsyncClipboardStrategy, CommentModeController, CommentsModel, EditorController, EditorModel, EditorView, GutterMarker, OffsetRange, Selection, StringEdit, StringValue, VsCodeV2CommentsView, findNodeOffsetById, taskCheckboxRange } from '@vscode/markdown-editor';
import { Disposable, autorun, observableValue } from '@vscode/markdown-editor/observables';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import '@vscode/markdown-editor/editor.css';
import '@vscode/markdown-editor/themes/vscode-default.css';
import '@vscode/markdown-editor/commentInput.css';
import '@vscode/markdown-editor/vscodeCommentWidgetV2.css';
import './markdownEditor.css';
import { WebviewSyntaxHighlighter } from './syntaxHighlighter';

interface VsCodeApi {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/**
 * The editor's view state, persisted as webview state (`getState`/`setState`) so
 * the scroll and cursor position are restored when the webview is reloaded or the
 * custom editor is re-created (e.g. after switching sessions and back).
 */
interface PersistedViewState {
	scrollTop?: number;
	selection?: { anchor: number; active: number };
}

class Editor extends Disposable {
	readonly model = new EditorModel();
	isUpdatingFromExtension = false;
	#isUpdatingComments = false;
	#mermaidCounter = 0;
	#initialized = false;
	#view: EditorView | undefined;
	#outlineSource = '';
	#outlineUpdate: number | undefined;

	readonly #comments = new CommentsModel();
	#commentsView: VsCodeV2CommentsView | undefined;
	/** Whether the workbench feedback store currently accepts new comments for this resource. */
	readonly #acceptsComments = observableValue<boolean>('acceptsComments', false);
	readonly #vscode = acquireVsCodeApi();
	readonly #syntaxHighlighter = new WebviewSyntaxHighlighter((message) => this.#vscode.postMessage(message));

	constructor(host: HTMLElement) {
		super();

		mermaid.initialize({ startOnLoad: false, theme: 'default' });

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (this.#syntaxHighlighter.handleMessage(message)) {
				return;
			}
			switch (message.type) {
				case 'init': {
					if (!this.#initialized) {
						this.#initialized = true;
						this.#createView(host, !!message.readonly, message.content);
					}
					break;
				}
				case 'update': {
					// `replaceSourceText` (not `sourceText.set`) applies authoritative host
					// text: it maps the selection through the change and clears stale
					// pending-paragraph state, so the caret stays valid after an undo shrinks
					// the document. The guard stops this echoing back as a user edit.
					this.isUpdatingFromExtension = true;
					this.model.replaceSourceText(new StringValue(message.content));
					this.isUpdatingFromExtension = false;
					break;
				}
				case 'status': {
					this.#setStatus(message.text);
					break;
				}
				case 'gutterMarkers': {
					const markers: GutterMarker[] = message.markers.map((marker: { start: number; endExclusive: number; type: GutterMarker['type'] }) => ({
						range: OffsetRange.fromTo(marker.start, marker.endExclusive),
						type: marker.type,
					}));
					this.model.gutterMarkers.set(markers, undefined);
					break;
				}
				case 'comments': {
					this.#isUpdatingComments = true;
					this.#comments.set(message.comments.map((comment: { id: string; start: number; endExclusive: number; body: string; author?: string }) => ({
						id: comment.id,
						range: OffsetRange.fromTo(comment.start, comment.endExclusive),
						body: comment.body,
						author: comment.author,
					})));
					this.#isUpdatingComments = false;
					this.#acceptsComments.set(!!message.acceptsComments, undefined);
					break;
				}
				case 'revealComment': {
					this.#commentsView?.revealComment(message.id);
					break;
				}
			}
		});

		this.#vscode.postMessage({ type: 'ready' });
	}

	#createView(host: HTMLElement, readonly: boolean, content: string): void {
		const model = this.model;
		// The scroll + cursor position last persisted for this document, captured
		// before any listener below can overwrite it, so it survives the editor being
		// re-created (e.g. after a session switch).
		const savedViewState = this.#getViewState();

		// Start in the last globally chosen edit/read-only mode. The lock toggle in
		// the editor drives `readonlyMode` from here on; changes are persisted below.
		model.readonlyMode.set(readonly, undefined);

		const view = this._register(new EditorView(model, {
			classNames: ['md-theme-vscode-default'],
			syntaxHighlighter: this.#syntaxHighlighter,
			onOpenLink: (url) => {
				const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();
				if (scheme && scheme !== 'file') {
					return false;
				}
				this.#vscode.postMessage({ type: 'openLink', href: url });
				return undefined;
			},
			onToggleCheckbox: (item, newChecked) => {
				if (model.readonlyMode.get()) {
					return;
				}
				const doc = model.document.get();
				const itemOffset = findNodeOffsetById(doc, item);
				if (itemOffset === undefined) { return; }
				const range = taskCheckboxRange(item);
				if (!range) { return; }
				model.applyEdit(
					StringEdit.replace(
						range.delta(itemOffset),
						newChecked ? '[x]' : '[ ]'
					)
				);
			},
			renderCustomCodeBlock: (language, content) => {
				if (language !== 'mermaid') {
					return undefined;
				}
				const div = document.createElement('div');
				div.className = 'md-mermaid';
				const id = `mermaid-${this.#mermaidCounter++}`;
				mermaid
					.render(id, content)
					.then(({ svg }) => {
						div.innerHTML = svg;
					})
					.catch(() => {
						div.textContent = content;
					});
				return div;
			},
		}));
		this.#view = view;

		// Wire history chords (undo/redo) to the extension so they run against the
		// backing TextDocument's own undo stack. `record` is deliberately omitted:
		// the TextDocument owns the history, and a second local stack would drift
		// from the Edit menu, dirty state and hot exit.
		this._register(new EditorController(model, view, {
			// VS Code webviews consume the native clipboard events before this editor
			// sees them. Drive copy/cut/paste from Cmd/Ctrl+C/X/V through the browser's
			// async clipboard API instead; this is also the reliable path on iPadOS.
			clipboardStrategy: new AsyncClipboardStrategy(),
			historyStrategy: {
				undo: () => this.#vscode.postMessage({ type: 'history', command: 'undo' }),
				redo: () => this.#vscode.postMessage({ type: 'history', command: 'redo' }),
			},
		}));
		host.appendChild(view.element);
		this.#wireToolbar(document.getElementById('markdown-toolbar')!);
		this.#wireTableNavigation(view.element);

		// Render comments as the VS Code V2 markdown cards. The card colours come
		// from the webview's own `--vscode-*` theme variables; `theme` only picks
		// the light/dark token wrapper. `resolveLine` maps a comment's start offset
		// to a 1-based line for the card header.
		const isLight = document.body.classList.contains('vscode-light');
		this.#commentsView = this._register(new VsCodeV2CommentsView(this.#comments, view, {
			theme: isLight ? 'light' : 'dark',
			resolveLine: (offset) => model.sourceText.get().value.slice(0, offset).split('\n').length,
		}));
		// The comment input (the gdocs-style "add a comment" affordance) is only
		// useful when the workbench feedback store will actually accept the comment;
		// otherwise submitting is a no-op. Mount the controller only while the
		// resource is in scope for a session, and tear it down when it leaves scope.
		let commentController: CommentModeController | undefined;
		this._register(autorun((reader) => {
			const accepts = reader.readObservable(this.#acceptsComments);
			if (accepts && !commentController) {
				commentController = new CommentModeController(model, view, {
					onSubmit: ({ text, range }) => {
						this.#vscode.postMessage({ type: 'addComment', start: range.start, endExclusive: range.endExclusive, text });
					},
				});
			} else if (!accepts && commentController) {
				commentController.dispose();
				commentController = undefined;
			}
		}));
		this._register({ dispose: () => commentController?.dispose() });

		// The comment card's delete button mutates the local CommentsModel
		// directly. Mirror those removals back to the extension so the shared
		// store (and the code editor) stay in sync. Removals coming from an
		// extension-driven update set `#isUpdatingComments`, so they are not
		// echoed back.
		let knownCommentIds = new Set(this.#comments.comments.get().map(comment => comment.id));
		this._register(autorun((reader) => {
			const currentIds = new Set(reader.readObservable(this.#comments.comments).map(comment => comment.id));
			if (!this.#isUpdatingComments) {
				for (const id of knownCommentIds) {
					if (!currentIds.has(id)) {
						this.#vscode.postMessage({ type: 'deleteComment', id });
					}
				}
			}
			knownCommentIds = currentIds;
		}));

		// Load the document content, then restore the persisted cursor so it lands on
		// the same text. Offsets are clamped defensively in case the document shifted.
		model.sourceText.set(new StringValue(content), undefined);
		if (savedViewState.selection) {
			const max = content.length;
			const anchor = Math.min(savedViewState.selection.anchor, max);
			const active = Math.min(savedViewState.selection.active, max);
			model.selection.set(new Selection(anchor, active), undefined);
		}

		// Persist scroll as webview state (throttled to a frame). Registered after the
		// restore above so it never clobbers the values we are about to restore.
		let scrollSaveScheduled = false;
		const saveScroll = (): void => {
			scrollSaveScheduled = false;
			this.#patchViewState({ scrollTop: host.scrollTop });
		};
		const onScroll = (): void => {
			if (scrollSaveScheduled) { return; }
			scrollSaveScheduled = true;
			requestAnimationFrame(saveScroll);
		};
		host.addEventListener('scroll', onScroll, { passive: true });
		this._register({ dispose: () => host.removeEventListener('scroll', onScroll) });

		// Flush the latest scroll synchronously before the webview is hidden or torn
		// down, since the frame-throttled save above may not have run yet.
		const onHide = (): void => {
			if (document.visibilityState === 'hidden') {
				this.#patchViewState({ scrollTop: host.scrollTop });
			}
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', saveScroll);
		this._register({ dispose: () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', saveScroll); } });

		// Persist the cursor whenever it moves.
		this._register(autorun((reader) => {
			const sel = reader.readObservable(this.model.selection);
			this.#patchViewState({ selection: sel ? { anchor: sel.anchor, active: sel.active } : undefined });
		}));

		// Persist the edit/read-only mode as the global default whenever the lock
		// toggle flips it, so the next Markdown editor opens in the same mode. The
		// initial (restored) value is skipped so opening an editor doesn't re-write it.
		let firstReadonly = true;
		this._register(autorun((reader) => {
			const isReadonly = reader.readObservable(this.model.readonlyMode);
			if (!firstReadonly) {
				this.#vscode.postMessage({ type: 'setReadonly', readonly: isReadonly });
			}
			firstReadonly = false;
		}));

		// Forward user edits to the extension. Edits are ignored by the model while
		// read-only, so this is a no-op in that mode; keeping it always registered
		// means unlocking a read-only editor immediately resumes edit forwarding.
		let previousText = this.model.sourceText.get().value;
		this._register(autorun((reader) => {
			const text = reader.readObservable(this.model.sourceText).value;
			if (!this.isUpdatingFromExtension && text !== previousText) {
				this.#vscode.postMessage({ type: 'edit', ...computeTextEdit(previousText, text) });
			}
			previousText = text;
		}));

		// Restore scroll last: content height settles over a few frames (async parse,
		// syntax highlighting, mermaid), so re-apply until it sticks.
		// TODO@copilot: Consider using a more robust method for restoring scroll position, e.g. by waiting for the editor to stabilize
		this.#restoreScroll(host, savedViewState.scrollTop);
	}

	#wireToolbar(toolbar: HTMLElement): void {
		const onPointerDown = (event: PointerEvent): void => {
			// Keep the Markdown selection while a toolbar button is pressed. This is
			// especially important on iPad where moving focus to a button otherwise
			// collapses the selection before the click is delivered.
			if ((event.target as HTMLElement).closest('button')) {
				event.preventDefault();
			}
		};
		const onClick = (event: MouseEvent): void => {
			const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-command]');
			if (!button) {
				return;
			}
			this.#runToolbarCommand(button.dataset.command!);
		};
		const onChange = (event: Event): void => {
			const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-command="heading"]');
			if (select) {
				this.#setHeading(Number(select.value));
				select.value = '0';
			}
		};
		toolbar.addEventListener('pointerdown', onPointerDown);
		toolbar.addEventListener('click', onClick);
		toolbar.addEventListener('change', onChange);
		this._register({
			dispose: () => {
				toolbar.removeEventListener('pointerdown', onPointerDown);
				toolbar.removeEventListener('click', onClick);
				toolbar.removeEventListener('change', onChange);
			}
		});

		const outline = document.getElementById('markdown-outline')!;
		const closeOutline = (): void => outline.classList.remove('is-open');
		document.getElementById('markdown-outline-close')!.addEventListener('click', closeOutline);
		this._register(autorun((reader) => {
			this.#outlineSource = reader.readObservable(this.model.sourceText).value;
			if (!outline.classList.contains('is-open')) {
				return;
			}
			window.clearTimeout(this.#outlineUpdate);
			this.#outlineUpdate = window.setTimeout(() => this.#renderOutline(outline, this.#outlineSource), 180);
		}));
		this._register({ dispose: () => window.clearTimeout(this.#outlineUpdate) });
	}

	#runToolbarCommand(command: string): void {
		if (command !== 'readonly' && command !== 'outline' && command !== 'copy' && this.model.readonlyMode.get()) {
			this.model.readonlyMode.set(false, undefined);
		}
		switch (command) {
			case 'undo': this.#vscode.postMessage({ type: 'history', command: 'undo' }); break;
			case 'redo': this.#vscode.postMessage({ type: 'history', command: 'redo' }); break;
			case 'copy': void this.#copySelection(); break;
			case 'paste': void this.#pasteClipboard(); break;
			case 'bold': this.#wrapSelection('**', '**', '粗体文字'); break;
			case 'italic': this.#wrapSelection('*', '*', '斜体文字'); break;
			case 'strike': this.#wrapSelection('~~', '~~', '删除线文字'); break;
			case 'code': this.#wrapSelection('`', '`', '代码'); break;
			case 'link': this.#insertLink(); break;
			case 'image': this.#insertImage(); break;
			case 'bullet': this.#toggleLinePrefix('bullet'); break;
			case 'ordered': this.#toggleLinePrefix('ordered'); break;
			case 'task': this.#toggleLinePrefix('task'); break;
			case 'table': this.#insertTable(); break;
			case 'row-after': this.#editTable('row-after'); break;
			case 'row-delete': this.#editTable('row-delete'); break;
			case 'column-after': this.#editTable('column-after'); break;
			case 'column-delete': this.#editTable('column-delete'); break;
			case 'readonly': this.model.readonlyMode.set(!this.model.readonlyMode.get(), undefined); break;
			case 'outline': {
				const outline = document.getElementById('markdown-outline')!;
				outline.classList.toggle('is-open');
				if (outline.classList.contains('is-open')) {
					this.#renderOutline(outline, this.#outlineSource);
				}
				break;
			}
		}
		this.#view?.element.focus();
	}

	#selection(): Selection {
		return this.model.selection.get() ?? Selection.collapsed(this.model.sourceText.get().value.length);
	}

	async #copySelection(): Promise<void> {
		const selection = this.#selection();
		if (selection.isCollapsed) {
			this.#setStatus('请先选择文字');
			return;
		}
		try {
			await navigator.clipboard.writeText(selection.range.substring(this.model.sourceText.get().value));
			this.#setStatus('已复制');
		} catch {
			this.#setStatus('浏览器未授权剪贴板');
		}
	}

	async #pasteClipboard(): Promise<void> {
		try {
			const text = await navigator.clipboard.readText();
			if (!text) { return; }
			const selection = this.#selection();
			this.model.readonlyMode.set(false, undefined);
			this.model.applyEdit(
				StringEdit.replace(selection.range, text),
				Selection.collapsed(selection.range.start + text.length),
			);
			this.#setStatus('已粘贴');
			this.#view?.element.focus();
		} catch {
			this.#setStatus('浏览器未授权剪贴板');
		}
	}

	#wrapSelection(open: string, close: string, placeholder: string): void {
		const selection = this.#selection();
		const source = this.model.sourceText.get().value;
		const selected = selection.range.substring(source) || placeholder;
		const replacement = `${open}${selected}${close}`;
		const start = selection.range.start;
		this.model.applyEdit(
			StringEdit.replace(selection.range, replacement),
			new Selection(start + open.length, start + open.length + selected.length),
		);
	}

	#setHeading(level: number): void {
		const source = this.model.sourceText.get().value;
		const selection = this.#selection();
		const line = lineRangeAt(source, selection.active);
		const content = line.range.substring(source).replace(/^\s{0,3}#{1,6}\s+/, '');
		const prefix = level > 0 ? `${'#'.repeat(level)} ` : '';
		this.model.applyEdit(
			StringEdit.replace(line.range, prefix + content),
			Selection.collapsed(line.range.start + prefix.length + content.length),
		);
	}

	#toggleLinePrefix(kind: 'bullet' | 'ordered' | 'task'): void {
		const source = this.model.sourceText.get().value;
		const selection = this.#selection();
		const range = completeLineRange(source, selection.range.start, selection.range.endExclusive);
		const lines = range.substring(source).split('\n');
		const marker = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : '1. ';
		const markerPattern = kind === 'bullet'
			? /^\s*[-+*]\s+/
			: kind === 'task' ? /^\s*[-+*]\s+\[[ xX]\]\s+/ : /^\s*\d+[.)]\s+/;
		const remove = lines.filter(Boolean).every(line => markerPattern.test(line));
		let index = 1;
		const replacement = lines.map(line => {
			if (!line) { return line; }
			const clean = line.replace(markerPattern, '');
			if (remove) { return clean; }
			return kind === 'ordered' ? `${index++}. ${clean}` : marker + clean;
		}).join('\n');
		this.model.applyEdit(StringEdit.replace(range, replacement), new Selection(range.start, range.start + replacement.length));
	}

	#insertLink(): void {
		const selection = this.#selection();
		const source = this.model.sourceText.get().value;
		const label = selection.range.substring(source) || '链接文字';
		const replacement = `[${label}](https://)`;
		const urlStart = selection.range.start + label.length + 3;
		this.model.applyEdit(StringEdit.replace(selection.range, replacement), new Selection(urlStart, urlStart + 8));
	}

	#insertImage(): void {
		const selection = this.#selection();
		this.#vscode.postMessage({
			type: 'insertImage',
			start: selection.range.start,
			endExclusive: selection.range.endExclusive,
		});
	}

	#insertTable(): void {
		const selection = this.#selection();
		const source = this.model.sourceText.get().value;
		const before = selection.range.start > 0 && source[selection.range.start - 1] !== '\n' ? '\n\n' : '';
		const after = selection.range.endExclusive < source.length && source[selection.range.endExclusive] !== '\n' ? '\n\n' : '\n';
		const table = '| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |';
		const replacement = before + table + after;
		const firstCell = selection.range.start + before.length + 2;
		this.model.applyEdit(StringEdit.replace(selection.range, replacement), new Selection(firstCell, firstCell + 3));
	}

	#editTable(action: TableAction): void {
		const source = this.model.sourceText.get().value;
		const selection = this.#selection();
		const table = findMarkdownTable(source, selection.active);
		if (!table) {
			this.#setStatus('请先点进一个表格');
			return;
		}
		const rows = table.lines.map(parseTableRow);
		const column = tableColumnAt(table.lines[table.currentRow], selection.active - table.lineStarts[table.currentRow]);
		if (action === 'row-after') {
			const insertAt = Math.max(table.currentRow + 1, table.delimiterRow + 1);
			rows.splice(insertAt, 0, Array.from({ length: rows[0].length }, () => ''));
		} else if (action === 'row-delete') {
			if (table.currentRow === 0 || table.currentRow === table.delimiterRow) {
				this.#setStatus('表头不能删除');
				return;
			}
			rows.splice(table.currentRow, 1);
		} else if (action === 'column-after') {
			for (const row of rows) {
				row.splice(Math.min(column + 1, row.length), 0, row === rows[table.delimiterRow] ? '---' : '');
			}
		} else {
			if (rows[0].length <= 1) {
				this.#setStatus('至少保留一列');
				return;
			}
			for (const row of rows) {
				row.splice(Math.min(column, row.length - 1), 1);
			}
		}
		const replacement = rows.map((row, index) => formatTableRow(row, index === table.delimiterRow)).join('\n');
		this.model.applyEdit(StringEdit.replace(OffsetRange.fromTo(table.start, table.end), replacement), Selection.collapsed(table.start));
		this.#setStatus('表格已更新');
	}

	#renderOutline(outline: HTMLElement, source: string): void {
		const list = outline.querySelector<HTMLElement>('.markdown-outline-list')!;
		list.replaceChildren();
		const pattern = /^(#{1,6})\s+(.+)$/gm;
		for (const match of source.matchAll(pattern)) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'markdown-outline-item';
			button.style.setProperty('--outline-level', String(match[1].length - 1));
			button.textContent = match[2].replace(/\s+#+\s*$/, '');
			button.addEventListener('click', () => {
				const offset = (match.index ?? 0) + match[1].length + 1;
				this.model.selection.set(Selection.collapsed(offset), undefined);
				outline.classList.remove('is-open');
				this.#view?.element.focus();
			});
			list.appendChild(button);
		}
		if (!list.childElementCount) {
			const empty = document.createElement('div');
			empty.className = 'markdown-outline-empty';
			empty.textContent = '还没有标题';
			list.appendChild(empty);
		}
	}

	#setStatus(text: string): void {
		const status = document.getElementById('markdown-status');
		if (!status) { return; }
		status.textContent = text;
		window.setTimeout(() => { status.textContent = ''; }, 1800);
	}

	#wireTableNavigation(element: HTMLElement): void {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			const source = this.model.sourceText.get().value;
			const selection = this.#selection();
			const table = findMarkdownTable(source, selection.active);
			if (!table) {
				return;
			}
			const rows = table.lines.map(parseTableRow);
			const currentColumn = Math.min(
				tableColumnAt(table.lines[table.currentRow], selection.active - table.lineStarts[table.currentRow]),
				rows[table.currentRow].length - 1,
			);
			const editableRows = rows.map((_, index) => index).filter(index => index !== table.delimiterRow);
			const rowPosition = editableRows.indexOf(table.currentRow);
			if (rowPosition < 0) {
				return;
			}
			let targetRowPosition = rowPosition;
			let targetColumn = currentColumn + (event.shiftKey ? -1 : 1);
			if (targetColumn >= rows[table.currentRow].length) {
				targetColumn = 0;
				targetRowPosition++;
			} else if (targetColumn < 0) {
				targetRowPosition--;
				targetColumn = rows[table.currentRow].length - 1;
			}
			if (targetRowPosition < 0 || targetRowPosition >= editableRows.length) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			const targetRow = editableRows[targetRowPosition];
			const localOffset = tableCellContentOffset(table.lines[targetRow], targetColumn);
			this.model.selection.set(Selection.collapsed(table.lineStarts[targetRow] + localOffset), undefined);
		};
		element.addEventListener('keydown', onKeyDown, true);
		this._register({ dispose: () => element.removeEventListener('keydown', onKeyDown, true) });
	}

	#getViewState(): PersistedViewState {
		return (this.#vscode.getState() as PersistedViewState | undefined) ?? {};
	}

	#patchViewState(patch: PersistedViewState): void {
		this.#vscode.setState({ ...this.#getViewState(), ...patch });
	}

	#restoreScroll(host: HTMLElement, scrollTop: number | undefined): void {
		if (typeof scrollTop !== 'number' || scrollTop <= 0) {
			return;
		}
		let tries = 0;
		const apply = (): void => {
			host.scrollTop = scrollTop;
			if (++tries < 6 && Math.abs(host.scrollTop - scrollTop) > 1) {
				requestAnimationFrame(apply);
			}
		};
		requestAnimationFrame(apply);
	}
}

type TableAction = 'row-after' | 'row-delete' | 'column-after' | 'column-delete';

function lineRangeAt(source: string, offset: number): { range: OffsetRange; start: number; end: number } {
	const start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
	const next = source.indexOf('\n', offset);
	const end = next < 0 ? source.length : next;
	return { range: OffsetRange.fromTo(start, end), start, end };
}

function completeLineRange(source: string, startOffset: number, endOffset: number): OffsetRange {
	const start = source.lastIndexOf('\n', Math.max(0, startOffset - 1)) + 1;
	const next = source.indexOf('\n', endOffset);
	return OffsetRange.fromTo(start, next < 0 ? source.length : next);
}

interface MarkdownTable {
	readonly start: number;
	readonly end: number;
	readonly lines: string[];
	readonly lineStarts: number[];
	readonly currentRow: number;
	readonly delimiterRow: number;
}

function findMarkdownTable(source: string, offset: number): MarkdownTable | undefined {
	const current = lineRangeAt(source, offset);
	const allLines = source.split('\n');
	let lineIndex = source.slice(0, current.start).split('\n').length - 1;
	if (!allLines[lineIndex]?.includes('|')) { return undefined; }
	let first = lineIndex;
	let last = lineIndex;
	while (first > 0 && allLines[first - 1].includes('|') && allLines[first - 1].trim()) { first--; }
	while (last + 1 < allLines.length && allLines[last + 1].includes('|') && allLines[last + 1].trim()) { last++; }
	const lines = allLines.slice(first, last + 1);
	const delimiterRow = lines.findIndex(isTableDelimiter);
	if (delimiterRow < 1) { return undefined; }
	const lineStarts: number[] = [];
	let start = 0;
	for (let i = 0; i < first; i++) { start += allLines[i].length + 1; }
	let cursor = start;
	for (const line of lines) { lineStarts.push(cursor); cursor += line.length + 1; }
	lineIndex -= first;
	return { start, end: cursor - 1, lines, lineStarts, currentRow: lineIndex, delimiterRow };
}

function isTableDelimiter(line: string): boolean {
	const cells = parseTableRow(line);
	return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function parseTableRow(line: string): string[] {
	let value = line.trim();
	if (value.startsWith('|')) { value = value.slice(1); }
	if (value.endsWith('|') && !value.endsWith('\\|')) { value = value.slice(0, -1); }
	const cells: string[] = [];
	let current = '';
	let escaped = false;
	for (const char of value) {
		if (char === '|' && !escaped) {
			cells.push(current.trim()); current = ''; continue;
		}
		current += char;
		escaped = char === '\\' && !escaped;
		if (char !== '\\') { escaped = false; }
	}
	cells.push(current.trim());
	return cells;
}

function tableColumnAt(line: string, offset: number): number {
	let column = line.trimStart().startsWith('|') ? -1 : 0;
	let escaped = false;
	for (let i = 0; i < Math.min(offset, line.length); i++) {
		if (line[i] === '|' && !escaped) { column++; }
		escaped = line[i] === '\\' && !escaped;
		if (line[i] !== '\\') { escaped = false; }
	}
	return Math.max(0, column);
}

function tableCellContentOffset(line: string, targetColumn: number): number {
	const hasLeadingPipe = line.trimStart().startsWith('|');
	let column = hasLeadingPipe ? -1 : 0;
	let escaped = false;
	let start = line.length - line.trimStart().length;
	if (!hasLeadingPipe && targetColumn === 0) {
		while (start < line.length && line[start] === ' ') { start++; }
		return start;
	}
	for (let i = start; i < line.length; i++) {
		if (line[i] === '|' && !escaped) {
			column++;
			start = i + 1;
			if (column === targetColumn) {
				while (start < line.length && line[start] === ' ') { start++; }
				return start;
			}
		}
		escaped = line[i] === '\\' && !escaped;
		if (line[i] !== '\\') { escaped = false; }
	}
	return Math.min(start, line.length);
}

function formatTableRow(cells: string[], delimiter: boolean): string {
	return `| ${cells.map(cell => delimiter ? (/^:?-{3,}:?$/.test(cell) ? cell : '---') : cell).join(' | ')} |`;
}

function computeTextEdit(previousText: string, text: string): { start: number; endExclusive: number; text: string } {
	let start = 0;
	while (start < previousText.length && start < text.length && previousText.charCodeAt(start) === text.charCodeAt(start)) {
		start++;
	}

	let previousEnd = previousText.length;
	let end = text.length;
	while (previousEnd > start && end > start && previousText.charCodeAt(previousEnd - 1) === text.charCodeAt(end - 1)) {
		previousEnd--;
		end--;
	}

	return {
		start,
		endExclusive: previousEnd,
		text: text.slice(start, end),
	};
}

new Editor(document.getElementById('editor')!);
