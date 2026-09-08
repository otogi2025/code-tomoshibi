/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';
import { MdLinkOpener } from '../util/openDocumentLink';
import { getMarkdownLocalResourceRoots } from '../util/resources';
import { ChangedLineRange, MarkdownPreviewLineDiffProvider } from './lineDiff';

/**
 * Experimental hybrid (WYSIWYG) Markdown editor backed by the
 * `@vscode/markdown-editor` component. The {@link vscode.TextDocument} remains
 * the single source of truth, so native undo/redo, dirty state and hot-exit are
 * preserved.
 */
export class MarkdownEditorProvider extends Disposable implements vscode.CustomTextEditorProvider {

	public static readonly viewType = 'vscode.markdown.editor';

	/**
	 * Memento key under which the last chosen edit/read-only mode is remembered.
	 * The value is a single global default shared by every Markdown editor, so
	 * flipping the lock in one editor becomes the initial mode for the next.
	 */
	static readonly #readonlyStateKey = 'markdown.editor.readonly.v2';

	readonly #mediaRoot: vscode.Uri;
	readonly #extensionUri: vscode.Uri;
	readonly #globalState: vscode.Memento;
	readonly #linkOpener: MdLinkOpener;

	constructor(extensionUri: vscode.Uri, globalState: vscode.Memento, linkOpener: MdLinkOpener) {
		super();
		this.#extensionUri = extensionUri;
		this.#globalState = globalState;
		this.#linkOpener = linkOpener;
		this.#mediaRoot = vscode.Uri.joinPath(this.#extensionUri, 'markdown-editor-out');
	}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken,
	): Promise<void> {
		await this.#resolveEditor(document, webviewPanel, token);
	}

	public async resolveCustomTextEditorInlineDiff(
		documents: vscode.CustomEditorDiffDocuments<vscode.TextDocument>,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken,
	): Promise<void> {
		await this.#resolveEditor(documents.modified, webviewPanel, token, documents.original);
	}

	async #resolveEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken, originalDocument?: vscode.TextDocument): Promise<void> {
		if (!vscode.workspace.isTrusted) {
			const cancel = { title: vscode.l10n.t("取消"), isCloseAffordance: true };
			const openAnyway = { title: vscode.l10n.t("仍要打开") };
			const choice = await vscode.window.showWarningMessage(
				vscode.l10n.t("此 Markdown 文件位于不受信任的工作区中。仍要打开吗？"),
				{
					modal: true,
					detail: vscode.l10n.t("为了你的安全，请仅在信任此 Markdown 文件的来源时继续。"),
				},
				cancel,
				openAnyway,
			);
			if (choice !== openAnyway || token.isCancellationRequested) {
				webviewPanel.dispose();
				return;
			}
		}

		if (token.isCancellationRequested) {
			return;
		}
		const webview = webviewPanel.webview;
		this.#configureWebview(document.uri, webview);
		this.#wireSingle(document, webviewPanel, originalDocument);
	}

	#configureWebview(documentUri: vscode.Uri, webview: vscode.Webview): void {
		webview.options = {
			enableScripts: true,
			localResourceRoots: getMarkdownLocalResourceRoots(documentUri, [this.#mediaRoot], {
				includeWorkspaceResources: vscode.workspace.isTrusted,
			}),
		};
		webview.html = this.#getHtml(documentUri, webview);
	}

	#wireSingle(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, originalDocument?: vscode.TextDocument): void {
		const webview = webviewPanel.webview;
		let isUpdatingFromWebview = false;
		let editQueue = Promise.resolve();
		let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
		const scheduleAutoSave = () => {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = setTimeout(async () => {
				await editQueue;
				if (document.isDirty && await document.save()) {
					webview.postMessage({ type: 'status', text: '已自动保存' });
				}
			}, 900);
		};

		const onMessage = webview.onDidReceiveMessage(async (message) => {
			switch (message.type) {
				case 'ready': {
					webview.postMessage({ type: 'init', content: document.getText(), readonly: this.#globalState.get(MarkdownEditorProvider.#readonlyStateKey, false) });
					break;
				}
				case 'setReadonly': {
					// Remember the edit/read-only choice as the global default for the
					// next Markdown editor.
					await this.#globalState.update(MarkdownEditorProvider.#readonlyStateKey, !!message.readonly);
					break;
				}
				case 'history': {
					// The TextDocument owns undo/redo, so route the chord to the built-in
					// command; the active custom editor input scopes it to this resource's
					// history, shared with the Edit menu and Command Palette. Drain any
					// in-flight edit first and only act while this panel is active, so the
					// chord cannot race a pending edit or land on a different document.
					if (message.command === 'undo' || message.command === 'redo') {
						await editQueue;
						if (webviewPanel.active) {
							await vscode.commands.executeCommand(message.command);
						}
					}
					break;
				}
				case 'openLink': {
					await this.#linkOpener.openDocumentLink(message.href as string, document.uri);
					break;
				}
				case 'insertImage': {
					const picked = await vscode.window.showOpenDialog({
						canSelectMany: true,
						openLabel: '插入图片',
						filters: { '图片': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'] },
					});
					if (!picked?.length) {
						break;
					}
					const snippets = picked.map(uri => {
						const relative = relativeUriPath(document.uri, uri);
						const target = /[\s()]/.test(relative) ? `<${relative}>` : relative;
						const name = uri.path.slice(uri.path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
						return `![${name}](${target})`;
					}).join('\n\n');
					const imageEdit = new vscode.WorkspaceEdit();
					imageEdit.replace(document.uri, new vscode.Range(
						document.positionAt(message.start),
						document.positionAt(message.endExclusive),
					), snippets);
					isUpdatingFromWebview = true;
					try {
						await vscode.workspace.applyEdit(imageEdit);
					} finally {
						isUpdatingFromWebview = false;
					}
					webview.postMessage({ type: 'update', content: document.getText() });
					webview.postMessage({ type: 'status', text: '图片已插入' });
					scheduleAutoSave();
					break;
				}
				case 'edit': {
					editQueue = editQueue.then(async () => {
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(
								document.positionAt(message.start),
								document.positionAt(message.endExclusive),
							),
							message.text,
						);
						isUpdatingFromWebview = true;
						try {
							await vscode.workspace.applyEdit(edit);
						} finally {
							isUpdatingFromWebview = false;
						}
					});
					await editQueue;
					scheduleAutoSave();
					break;
				}
			}
		});

		const onDocumentChange = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() !== document.uri.toString() || isUpdatingFromWebview) {
				return;
			}
			webview.postMessage({ type: 'update', content: document.getText() });
		});
		const onDocumentSave = vscode.workspace.onDidSaveTextDocument((savedDocument) => {
			if (savedDocument.uri.toString() === document.uri.toString()) {
				webview.postMessage({ type: 'status', text: '已保存' });
			}
		});

		const highlight = this.#wireHighlight(webview);
		const quickDiff = originalDocument ? this.#wireDocumentDiff(originalDocument, document, webview) : undefined;
		const comments = this.#wireComments(document, webview);
		const onDidGrantWorkspaceTrust = vscode.workspace.onDidGrantWorkspaceTrust(() => {
			this.#configureWebview(document.uri, webview);
		});

		webviewPanel.onDidDispose(() => {
			clearTimeout(autoSaveTimer);
			onMessage.dispose();
			onDocumentChange.dispose();
			onDocumentSave.dispose();
			highlight.dispose();
			quickDiff?.dispose();
			comments.dispose();
			onDidGrantWorkspaceTrust.dispose();
		});
	}

	#wireDocumentDiff(originalDocument: vscode.TextDocument, modifiedDocument: vscode.TextDocument, webview: vscode.Webview): vscode.Disposable {
		const lineDiffProvider = new MarkdownPreviewLineDiffProvider(originalDocument, modifiedDocument);
		const postMarkers = async () => {
			const originalVersion = originalDocument.version;
			const modifiedVersion = modifiedDocument.version;
			const changes = await lineDiffProvider.getChangedLineRanges();
			if (originalVersion !== originalDocument.version || modifiedVersion !== modifiedDocument.version) {
				return;
			}
			webview.postMessage({ type: 'gutterMarkers', markers: lineRangesToGutterMarkers(modifiedDocument, changes) });
		};

		const onMessage = webview.onDidReceiveMessage(message => {
			if (message.type === 'ready') {
				void postMarkers();
			}
		});
		const onDocumentChange = vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.uri.toString() === originalDocument.uri.toString() || event.document.uri.toString() === modifiedDocument.uri.toString()) {
				void postMarkers();
			}
		});

		return vscode.Disposable.from(onMessage, onDocumentChange);
	}

	/**
	 * Bridges the workbench's agent/session comments (the same store the code
	 * editor renders its comments from) to the webview: existing comments are
	 * forwarded for rendering, and comments the user adds in the Markdown editor
	 * are written back to the shared store so they appear in the code editor too.
	 * Comment ranges are converted between {@link vscode.Range} and the source
	 * character offsets the webview works in.
	 */
	#wireComments(document: vscode.TextDocument, webview: vscode.Webview): vscode.Disposable {
		const commentsProvider = vscode.window.createAgentEditorComments(document.uri);
		let webviewReady = false;
		let revealedCommentId: string | undefined;

		const postComments = () => {
			const comments = commentsProvider.comments.map(comment => ({
				id: comment.id,
				start: document.offsetAt(comment.range.start),
				endExclusive: document.offsetAt(comment.range.end),
				body: comment.body,
				author: comment.author,
			}));
			webview.postMessage({ type: 'comments', comments, acceptsComments: commentsProvider.acceptsComments });
		};
		const postReveal = () => {
			if (webviewReady && revealedCommentId) {
				webview.postMessage({ type: 'revealComment', id: revealedCommentId });
			}
		};

		const onChange = commentsProvider.onDidChange(postComments);
		const onDidRevealComment = commentsProvider.onDidRevealComment(id => {
			revealedCommentId = id;
			postReveal();
		});
		const onMessage = webview.onDidReceiveMessage((message) => {
			if (message.type === 'ready') {
				webviewReady = true;
				postComments();
				postReveal();
			} else if (message.type === 'addComment') {
				const range = new vscode.Range(
					document.positionAt(message.start),
					document.positionAt(message.endExclusive),
				);
				commentsProvider.addComment(range, message.text);
			} else if (message.type === 'deleteComment') {
				commentsProvider.deleteComment(message.id);
			}
		});

		return vscode.Disposable.from(commentsProvider, onChange, onDidRevealComment, onMessage);
	}


	/**
	 * Proxies the webview's syntax highlighting requests to the
	 * `documentSyntaxHighlighting` proposed API, since the webview cannot call
	 * it directly. Also forwards theme changes so the webview can re-highlight.
	 */
	#wireHighlight(webview: vscode.Webview): vscode.Disposable {
		const onMessage = webview.onDidReceiveMessage(async (message) => {
			if (message.type !== 'highlight') {
				return;
			}
			const result = await vscode.languages.computeFullSyntaxHighlighting(message.source, message.languageId);
			webview.postMessage({
				type: 'highlightResult',
				requestId: message.requestId,
				tokens: result.tokens,
				colorMap: result.colorMap,
			});
		});

		const onThemeChange = vscode.languages.onDidChangeSyntaxHighlighting(() => {
			webview.postMessage({ type: 'highlightThemeChanged' });
		});

		return vscode.Disposable.from(onMessage, onThemeChange);
	}

	#getHtml(documentUri: vscode.Uri, webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.#mediaRoot, 'editor.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.#mediaRoot, 'editor.css'));
		const baseUri = webview.asWebviewUri(documentUri);
		const nonce = getNonce();

		const body = /* html */ `
	<div id="markdown-workbench">
		<div id="markdown-toolbar" role="toolbar" aria-label="Markdown 编辑工具">
			<div class="markdown-toolbar-scroll">
				<button type="button" data-command="undo" title="撤销">↶</button>
				<button type="button" data-command="redo" title="重做">↷</button>
				<button type="button" data-command="copy" title="复制所选文字">复制</button>
				<button type="button" data-command="paste" title="粘贴到光标位置">粘贴</button>
				<span class="markdown-toolbar-divider"></span>
				<select data-command="heading" aria-label="段落样式" title="段落样式">
					<option value="0">正文</option><option value="1">标题 1</option><option value="2">标题 2</option><option value="3">标题 3</option>
				</select>
				<button type="button" data-command="bold" class="is-bold" title="粗体">B</button>
				<button type="button" data-command="italic" class="is-italic" title="斜体">I</button>
				<button type="button" data-command="strike" class="is-strike" title="删除线">S</button>
				<button type="button" data-command="code" title="行内代码">&lt;/&gt;</button>
				<button type="button" data-command="link" title="插入链接">链接</button>
				<button type="button" data-command="image" title="从服务器文件中插入图片">图片</button>
				<span class="markdown-toolbar-divider"></span>
				<button type="button" data-command="bullet" title="项目列表">• 列表</button>
				<button type="button" data-command="ordered" title="编号列表">1. 列表</button>
				<button type="button" data-command="task" title="任务列表">☐ 任务</button>
				<span class="markdown-toolbar-divider"></span>
				<button type="button" data-command="table" title="插入三列表格">插入表格</button>
				<button type="button" data-command="row-after" title="在当前行下方添加">＋行</button>
				<button type="button" data-command="row-delete" title="删除当前行">－行</button>
				<button type="button" data-command="column-after" title="在当前列右侧添加">＋列</button>
				<button type="button" data-command="column-delete" title="删除当前列">－列</button>
			</div>
			<div class="markdown-toolbar-fixed">
				<span id="markdown-status" aria-live="polite"></span>
				<button type="button" data-command="outline" title="文档目录">目录</button>
				<button type="button" data-command="readonly" title="切换编辑或阅读模式">编辑 / 阅读</button>
			</div>
		</div>
		<div id="editor"></div>
		<aside id="markdown-outline" aria-label="文档目录">
			<div class="markdown-outline-header"><strong>文档目录</strong><button id="markdown-outline-close" type="button" title="关闭">×</button></div>
			<div class="markdown-outline-list"></div>
		</aside>
	</div>`;

		return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';" />
	<base href="${baseUri}" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Markdown Editor</title>
</head>
<body>${body}
	<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function relativeUriPath(document: vscode.Uri, target: vscode.Uri): string {
	if (document.scheme !== target.scheme || document.authority !== target.authority) {
		return target.toString(true);
	}
	const from = document.path.slice(0, document.path.lastIndexOf('/')).split('/').filter(Boolean);
	const to = target.path.split('/').filter(Boolean);
	let shared = 0;
	while (shared < from.length && shared < to.length && from[shared] === to[shared]) {
		shared++;
	}
	return [...Array.from({ length: from.length - shared }, () => '..'), ...to.slice(shared)].join('/') || '.';
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

interface GutterMarkerMessage {
	readonly start: number;
	readonly endExclusive: number;
	readonly type: 'added' | 'modified' | 'deleted';
}

export function lineRangesToGutterMarkers(document: vscode.TextDocument, changes: readonly ChangedLineRange[]): GutterMarkerMessage[] {
	return changes.map(change => {
		if (change.modifiedRange.isEmpty) {
			const offset = document.offsetAt(change.modifiedRange.start);
			return { start: offset, endExclusive: offset, type: 'deleted' };
		}

		const start = document.offsetAt(change.modifiedRange.start);
		const endExclusive = document.offsetAt(document.lineAt(change.modifiedRange.end.line - 1).range.end);
		return {
			start,
			endExclusive,
			type: change.originalRange.isEmpty ? 'added' : 'modified',
		};
	});
}
