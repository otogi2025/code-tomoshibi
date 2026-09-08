/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';

const suppressedStorageKey = 'markdown.preview.renderedDiffWarning.suppressed';
const notificationShownStorageKey = 'markdown.preview.renderedDiffWarning.notificationShown';

export class RenderedDiffWarningManager extends Disposable {

	readonly #workspaceState: vscode.Memento;

	#statusBarItem: vscode.StatusBarItem | undefined;
	#hasActiveDiffPreview = false;

	readonly #showWarningCommandId = '_markdown.preview.showRenderedDiffWarning';

	constructor(workspaceState: vscode.Memento) {
		super();

		this.#workspaceState = workspaceState;

		this._register(vscode.commands.registerCommand(this.#showWarningCommandId, () => {
			void this.#showWarningNotification();
		}));
	}

	override dispose(): void {
		this.#statusBarItem?.dispose();
		this.#statusBarItem = undefined;
		super.dispose();
	}

	/**
	 * Set whether a diff preview is currently the active editor.
	 *
	 * Drives the visibility of the status bar warning and triggers the one-time
	 * notification the first time the user focuses a diff preview.
	 */
	public setActiveDiffPreview(active: boolean): void {
		if (this.#isSuppressed() || this.#hasActiveDiffPreview === active) {
			return;
		}

		this.#hasActiveDiffPreview = active;
		this.#updateStatusBar();

		if (active && !this.#workspaceState.get<boolean>(notificationShownStorageKey, false)) {
			void this.#workspaceState.update(notificationShownStorageKey, true);
			void this.#showWarningNotification();
		}
	}

	#updateStatusBar(): void {
		if (this.#isSuppressed() || !this.#hasActiveDiffPreview) {
			this.#statusBarItem?.dispose();
			this.#statusBarItem = undefined;
			return;
		}

		if (!this.#statusBarItem) {
			this.#statusBarItem = vscode.window.createStatusBarItem('markdown.renderedDiffWarning', vscode.StatusBarAlignment.Right, 100);
			this.#statusBarItem.name = vscode.l10n.t('呈现的 Markdown 差异警告');
			this.#statusBarItem.text = vscode.l10n.t('{0} 呈现差异', '$(warning)');
			this.#statusBarItem.tooltip = vscode.l10n.t('呈现的 Markdown 差异可能会隐藏重要更改。单击以了解详细信息。');
			this.#statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
			this.#statusBarItem.command = this.#showWarningCommandId;
		}
		this.#statusBarItem.show();
	}

	async #showWarningNotification(): Promise<void> {
		const dontShowAgain = vscode.l10n.t("不再显示");
		const selected = await vscode.window.showWarningMessage(
			vscode.l10n.t('呈现的 Markdown 差异可能会隐藏格式、空格、链接或 HTML 等重要更改。如需查看这些更改，请切换到文本差异。'),
			dontShowAgain,
		);
		if (selected === dontShowAgain) {
			await this.#workspaceState.update(suppressedStorageKey, true);
			this.#hasActiveDiffPreview = false;
			this.#updateStatusBar();
		}
	}

	#isSuppressed(): boolean {
		return this.#workspaceState.get<boolean>(suppressedStorageKey, false);
	}
}
