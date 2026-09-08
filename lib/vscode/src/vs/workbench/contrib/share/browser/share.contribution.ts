/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './share.css';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { WorkspaceFolderCountContext } from '../../../common/contextkeys.js';
import { Extensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { ShareProviderCountContext, ShareService } from './shareService.js';
import { IShareService } from '../common/share.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';

const targetMenus = [
	MenuId.EditorContextShare,
	MenuId.OpenEditorsContextShare,
	MenuId.EditorTitleContextShare,
	MenuId.MenubarShare,
	// MenuId.EditorLineNumberContext, // todo@joyceerhl add share
	MenuId.ExplorerContextShare
];

class ShareWorkbenchContribution extends Disposable {
	private static SHARE_ENABLED_SETTING = 'workbench.experimental.share.enabled';

	private _disposables: DisposableStore | undefined;

	constructor(
		@IShareService private readonly shareService: IShareService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		if (this.configurationService.getValue<boolean>(ShareWorkbenchContribution.SHARE_ENABLED_SETTING)) {
			this.registerActions();
		}
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(ShareWorkbenchContribution.SHARE_ENABLED_SETTING)) {
				const settingValue = this.configurationService.getValue<boolean>(ShareWorkbenchContribution.SHARE_ENABLED_SETTING);
				if (settingValue === true && this._disposables === undefined) {
					this.registerActions();
				} else if (settingValue === false && this._disposables !== undefined) {
					this._disposables?.clear();
					this._disposables = undefined;
				}
			}
		}));
	}

	override dispose(): void {
		super.dispose();
		this._disposables?.dispose();
	}

	private registerActions() {
		if (!this._disposables) {
			this._disposables = new DisposableStore();
		}

		this._disposables.add(
			registerAction2(class ShareAction extends Action2 {
				static readonly ID = 'workbench.action.share';
				static readonly LABEL = localize2('share', '共享...');

				constructor() {
					super({
						id: ShareAction.ID,
						title: ShareAction.LABEL,
						f1: true,
						icon: Codicon.linkExternal,
						precondition: ContextKeyExpr.and(ShareProviderCountContext.notEqualsTo(0), WorkspaceFolderCountContext.notEqualsTo(0)),
						keybinding: {
							weight: KeybindingWeight.WorkbenchContrib,
							primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.KeyS,
						},
						menu: [
							{ id: MenuId.CommandCenter, order: 3 }
						]
					});
				}

				override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {
					const shareService = accessor.get(IShareService);
					const activeEditor = accessor.get(IEditorService)?.activeEditor;
					const resourceUri = (activeEditor && EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY }))
						?? accessor.get(IWorkspaceContextService).getWorkspace().folders[0].uri;
					const clipboardService = accessor.get(IClipboardService);
					const dialogService = accessor.get(IDialogService);
					const urlService = accessor.get(IOpenerService);
					const progressService = accessor.get(IProgressService);
					const selection = accessor.get(ICodeEditorService).getActiveCodeEditor()?.getSelection() ?? undefined;

					const result = await progressService.withProgress({
						location: ProgressLocation.Window,
						detail: localize('generating link', '正在生成链接...')
					}, async () => shareService.provideShare({ resourceUri, selection }, CancellationToken.None));

					if (result) {
						const uriText = result.toString();
						const isResultText = typeof result === 'string';
						await clipboardService.writeText(uriText);

						dialogService.prompt(
							{
								type: Severity.Info,
								message: isResultText ? localize('shareTextSuccess', '已将文本复制到剪贴板') : localize('shareSuccess', '已将链接复制到剪贴板!'),
								custom: {
									icon: Codicon.check,
									markdownDetails: [{
										markdown: new MarkdownString(`<div aria-label='${uriText}'>${uriText}</div>`, { supportHtml: true }),
										classes: [isResultText ? 'share-dialog-input-text' : 'share-dialog-input-link']
									}]
								},
								cancelButton: localize('close', '关闭'),
								buttons: isResultText ? [] : [{ label: localize('open link', '打开链接'), run: () => { urlService.open(result, { openExternal: true }); } }]
							}
						);
					}
				}
			})
		);

		const actions = this.shareService.getShareActions();
		for (const menuId of targetMenus) {
			for (const action of actions) {
				// todo@joyceerhl avoid duplicates
				this._disposables.add(MenuRegistry.appendMenuItem(menuId, action));
			}
		}
	}
}

registerSingleton(IShareService, ShareService, InstantiationType.Delayed);
const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(ShareWorkbenchContribution, LifecyclePhase.Eventually);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	...workbenchConfigurationNodeBase,
	properties: {
		'workbench.experimental.share.enabled': {
			type: 'boolean',
			default: false,
			tags: ['experimental'],
			markdownDescription: localize('experimental.share.enabled', "控制当 {0} 为 {1} 时，是否在命令中心旁呈现“共享”操作。", '`#window.commandCenter#`', '`true`'),
			restricted: false,
		}
	}
});
