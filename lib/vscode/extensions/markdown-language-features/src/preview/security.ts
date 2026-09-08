/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as vscode from 'vscode';
import { MarkdownPreviewManager } from './previewManager';


export const enum MarkdownPreviewSecurityLevel {
	Strict = 0,
	AllowInsecureContent = 1,
	AllowScriptsAndAllContent = 2,
	AllowInsecureLocalContent = 3
}

export interface ContentSecurityPolicyArbiter {
	getSecurityLevelForResource(resource: vscode.Uri): MarkdownPreviewSecurityLevel;

	setSecurityLevelForResource(resource: vscode.Uri, level: MarkdownPreviewSecurityLevel): Thenable<void>;

	shouldAllowSvgsForResource(resource: vscode.Uri): void;

	shouldDisableSecurityWarnings(): boolean;

	setShouldDisableSecurityWarning(shouldShow: boolean): Thenable<void>;
}

export class ExtensionContentSecurityPolicyArbiter implements ContentSecurityPolicyArbiter {
	readonly #old_trusted_workspace_key = 'trusted_preview_workspace:';
	readonly #security_level_key = 'preview_security_level:';
	readonly #should_disable_security_warning_key = 'preview_should_show_security_warning:';

	readonly #globalState: vscode.Memento;
	readonly #workspaceState: vscode.Memento;

	constructor(
		globalState: vscode.Memento,
		workspaceState: vscode.Memento
	) {
		this.#globalState = globalState;
		this.#workspaceState = workspaceState;
	}

	public getSecurityLevelForResource(resource: vscode.Uri): MarkdownPreviewSecurityLevel {
		// Use new security level setting first
		const level = this.#globalState.get<MarkdownPreviewSecurityLevel | undefined>(this.#security_level_key + this.#getRoot(resource), undefined);
		if (typeof level !== 'undefined') {
			return level;
		}

		// Fallback to old trusted workspace setting
		if (this.#globalState.get<boolean>(this.#old_trusted_workspace_key + this.#getRoot(resource), false)) {
			return MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent;
		}
		return MarkdownPreviewSecurityLevel.Strict;
	}

	public setSecurityLevelForResource(resource: vscode.Uri, level: MarkdownPreviewSecurityLevel): Thenable<void> {
		return this.#globalState.update(this.#security_level_key + this.#getRoot(resource), level);
	}

	public shouldAllowSvgsForResource(resource: vscode.Uri) {
		const securityLevel = this.getSecurityLevelForResource(resource);
		return securityLevel === MarkdownPreviewSecurityLevel.AllowInsecureContent || securityLevel === MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent;
	}

	public shouldDisableSecurityWarnings(): boolean {
		return this.#workspaceState.get<boolean>(this.#should_disable_security_warning_key, false);
	}

	public setShouldDisableSecurityWarning(disabled: boolean): Thenable<void> {
		return this.#workspaceState.update(this.#should_disable_security_warning_key, disabled);
	}

	#getRoot(resource: vscode.Uri): vscode.Uri {
		if (vscode.workspace.workspaceFolders) {
			const folderForResource = vscode.workspace.getWorkspaceFolder(resource);
			if (folderForResource) {
				return folderForResource.uri;
			}

			if (vscode.workspace.workspaceFolders.length) {
				return vscode.workspace.workspaceFolders[0].uri;
			}
		}

		return resource;
	}
}

export class PreviewSecuritySelector {

	readonly #cspArbiter: ContentSecurityPolicyArbiter;
	readonly #webviewManager: MarkdownPreviewManager;

	public constructor(
		cspArbiter: ContentSecurityPolicyArbiter,
		webviewManager: MarkdownPreviewManager
	) {
		this.#cspArbiter = cspArbiter;
		this.#webviewManager = webviewManager;
	}

	public async showSecuritySelectorForResource(resource: vscode.Uri): Promise<void> {
		interface PreviewSecurityPickItem extends vscode.QuickPickItem {
			readonly type: 'moreinfo' | 'toggle' | MarkdownPreviewSecurityLevel;
		}

		function markActiveWhen(when: boolean): string {
			return when ? '• ' : '';
		}

		const currentSecurityLevel = this.#cspArbiter.getSecurityLevelForResource(resource);
		const selection = await vscode.window.showQuickPick<PreviewSecurityPickItem>(
			[
				{
					type: MarkdownPreviewSecurityLevel.Strict,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.Strict) + vscode.l10n.t("严格"),
					description: vscode.l10n.t("仅载入安全内容"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowInsecureLocalContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowInsecureLocalContent) + vscode.l10n.t("允许不安全的本地内容"),
					description: vscode.l10n.t("允许通过 http 载入来自 localhost 的内容"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowInsecureContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowInsecureContent) + vscode.l10n.t("允许不安全内容"),
					description: vscode.l10n.t("允许通过 http 载入内容"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent) + vscode.l10n.t("禁用"),
					description: vscode.l10n.t("允许所有内容，执行所有脚本。不推荐"),
				}, {
					type: 'moreinfo',
					label: vscode.l10n.t("更多信息"),
					description: ''
				}, {
					type: 'toggle',
					label: this.#cspArbiter.shouldDisableSecurityWarnings()
						? vscode.l10n.t("在此工作区中启用预览安全警告")
						: vscode.l10n.t("在此工作区中取消预览安全警告"),
					description: vscode.l10n.t("不影响内容安全级别")
				},
			], {
			placeHolder: vscode.l10n.t("选择此工作区中 Markdown 预览的安全设置"),
		});
		if (!selection) {
			return;
		}

		if (selection.type === 'moreinfo') {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://go.microsoft.com/fwlink/?linkid=854414'));
			return;
		}

		if (selection.type === 'toggle') {
			this.#cspArbiter.setShouldDisableSecurityWarning(!this.#cspArbiter.shouldDisableSecurityWarnings());
			this.#webviewManager.refresh();
			return;
		} else {
			await this.#cspArbiter.setSecurityLevelForResource(resource, selection.type);
		}
		this.#webviewManager.refresh();
	}
}
