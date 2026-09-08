/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { hasWorkspaceFileExtension, IWorkspaceContextService, WorkbenchState, WORKSPACE_SUFFIX } from '../../../../platform/workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INeverShowAgainOptions, INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import { URI } from '../../../../base/common/uri.js';
import { isEqual, joinPath } from '../../../../base/common/resources.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { isVirtualWorkspace } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { ActiveEditorContext, IsSessionsWindowContext, ResourceContextKey, TemporaryWorkspaceContext } from '../../../common/contextkeys.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { TEXT_FILE_EDITOR_ID } from '../../files/common/files.js';
import './recentRemoteFolderPruner.js';

/**
 * A workbench contribution that will look for `.code-workspace` files in the root of the
 * workspace folder and open a notification to suggest to open one of the workspaces.
 */
export class WorkspacesFinderContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
		@IFileService private readonly fileService: IFileService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IHostService private readonly hostService: IHostService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		this.findWorkspaces();
	}

	private async findWorkspaces(): Promise<void> {
		const folder = this.contextService.getWorkspace().folders[0];
		if (!folder || this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER || isVirtualWorkspace(this.contextService.getWorkspace())) {
			return; // require a single (non virtual) root folder
		}

		const rootFileNames = (await this.fileService.resolve(folder.uri)).children?.map(child => child.name);
		if (Array.isArray(rootFileNames)) {
			const workspaceFiles = rootFileNames.filter(hasWorkspaceFileExtension);
			if (workspaceFiles.length > 0) {
				this.doHandleWorkspaceFiles(folder.uri, workspaceFiles);
			}
		}
	}

	private doHandleWorkspaceFiles(folder: URI, workspaces: string[]): void {
		const neverShowAgain: INeverShowAgainOptions = { id: 'workspaces.dontPromptToOpen', scope: NeverShowAgainScope.WORKSPACE, isSecondary: true };

		// Prompt to open one workspace
		if (workspaces.length === 1) {
			const workspaceFile = workspaces[0];

			this.notificationService.prompt(Severity.Info, localize(
				{
					key: 'foundWorkspace',
					comment: ['{Locked="]({1})"}']
				},
				"此文件夹包含工作区文件“{0}”，是否打开? [了解更多]({1})有关工作区文件的详细信息。",
				workspaceFile,
				'https://go.microsoft.com/fwlink/?linkid=2025315'
			), [{
				label: localize('openWorkspace', "打开工作区"),
				run: () => this.hostService.openWindow([{ workspaceUri: joinPath(folder, workspaceFile) }])
			}], {
				neverShowAgain,
				priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : NotificationPriority.OPTIONAL // https://github.com/microsoft/vscode/issues/125315
			});
		}

		// Prompt to select a workspace from many
		else if (workspaces.length > 1) {
			this.notificationService.prompt(Severity.Info, localize({
				key: 'foundWorkspaces',
				comment: ['{Locked="]({0})"}']
			}, "此文件夹包含多个工作区文件，是否打开? [了解更多]({0})有关工作区文件的详细信息。", 'https://go.microsoft.com/fwlink/?linkid=2025315'), [{
				label: localize('selectWorkspace', "选择工作区"),
				run: () => {
					this.quickInputService.pick(
						workspaces.map(workspace => ({ label: workspace } satisfies IQuickPickItem)),
						{ placeHolder: localize('selectToOpen', "选择要打开的工作区") }).then(pick => {
							if (pick) {
								this.hostService.openWindow([{ workspaceUri: joinPath(folder, pick.label) }]);
							}
						});
				}
			}], {
				neverShowAgain,
				priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : NotificationPriority.OPTIONAL // https://github.com/microsoft/vscode/issues/125315
			});
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspacesFinderContribution, LifecyclePhase.Eventually);

// Render "Open Workspace" button in *.code-workspace files

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.openWorkspaceFromEditor',
			title: localize2('openWorkspace', "打开工作区"),
			f1: false,
			menu: {
				id: MenuId.EditorContent,
				when: ContextKeyExpr.and(
					ResourceContextKey.Extension.isEqualTo(WORKSPACE_SUFFIX),
					ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID),
					TemporaryWorkspaceContext.toNegated(),
					IsSessionsWindowContext.toNegated()
				)
			}
		});
	}

	async run(accessor: ServicesAccessor, uri: URI): Promise<void> {
		const hostService = accessor.get(IHostService);
		const contextService = accessor.get(IWorkspaceContextService);
		const notificationService = accessor.get(INotificationService);

		if (contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
			const workspaceConfiguration = contextService.getWorkspace().configuration;
			if (workspaceConfiguration && isEqual(workspaceConfiguration, uri)) {
				notificationService.info(localize('alreadyOpen', "此工作区已打开。"));

				return; // workspace already opened
			}
		}

		return hostService.openWindow([{ workspaceUri: uri }]);
	}
});
