/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import '../../../../platform/update/common/update.config.contribution.js';
import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ProductContribution, UpdateContribution, CONTEXT_UPDATE_STATE, showReleaseNotesInEditor } from './update.js';
import { UpdateTitleBarContribution } from './updateTitleBarEntry.js';
import { PostUpdateWidgetContribution } from './postUpdateWidget.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import product from '../../../../platform/product/common/product.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { isWindows } from '../../../../base/common/platform.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { mnemonicButtonLabel } from '../../../../base/common/labels.js';
import { ShowCurrentReleaseNotesActionId, ShowCurrentReleaseNotesFromCurrentFileActionId } from '../common/update.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { URI } from '../../../../base/common/uri.js';

const workbench = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

workbench.registerWorkbenchContribution(ProductContribution, LifecyclePhase.Restored);
workbench.registerWorkbenchContribution(UpdateContribution, LifecyclePhase.Restored);
workbench.registerWorkbenchContribution(UpdateTitleBarContribution, LifecyclePhase.Restored);
workbench.registerWorkbenchContribution(PostUpdateWidgetContribution, LifecyclePhase.Restored);

// Release notes

export class ShowReleaseNotesAction extends Action2 {

	static readonly AVAILABLE = !!product.releaseNotesUrl;

	constructor() {
		super({
			id: ShowCurrentReleaseNotesActionId,
			title: {
				...localize2('showReleaseNotes', "显示发行说明"),
				mnemonicTitle: localize({ key: 'mshowReleaseNotes', comment: ['&& denotes a mnemonic'] }, "显示发行说明(&&R)"),
			},
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			menu: [{
				id: MenuId.MenubarHelpMenu,
				group: '1_welcome',
				order: 5,
			}]
		});
	}

	async run(accessor: ServicesAccessor, version?: string): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const productService = accessor.get(IProductService);
		const openerService = accessor.get(IOpenerService);
		const targetVersion = version ?? productService.version;

		try {
			await showReleaseNotesInEditor(instantiationService, targetVersion, false);
		} catch (err) {
			if (productService.releaseNotesUrl) {
				await openerService.open(URI.parse(productService.releaseNotesUrl));
			} else {
				throw new Error(localize('update.noReleaseNotesOnline', "此版本的 {0} 没有联机发行说明", productService.nameLong));
			}
		}
	}
}

export class ShowCurrentReleaseNotesFromCurrentFileAction extends Action2 {

	constructor() {
		super({
			id: ShowCurrentReleaseNotesFromCurrentFileActionId,
			title: {
				...localize2('showReleaseNotesCurrentFile', "将当前文件作为发行说明打开"),
				mnemonicTitle: localize({ key: 'mshowReleaseNotes', comment: ['&& denotes a mnemonic'] }, "显示发行说明(&&R)"),
			},
			category: localize2('developerCategory', "开发人员"),
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const instantiationService = accessor.get(IInstantiationService);
		const productService = accessor.get(IProductService);

		try {
			await showReleaseNotesInEditor(instantiationService, productService.version, true);
		} catch (err) {
			throw new Error(localize('releaseNotesFromFileNone', "无法将当前文件作为发行说明打开"));
		}
	}
}

if (ShowReleaseNotesAction.AVAILABLE) {
	registerAction2(ShowReleaseNotesAction);
}
registerAction2(ShowCurrentReleaseNotesFromCurrentFileAction);

// Update

export class CheckForUpdateAction extends Action2 {

	constructor() {
		super({
			id: 'update.checkForUpdate',
			title: localize2('checkForUpdates', '检查更新...'),
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			precondition: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Idle),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const updateService = accessor.get(IUpdateService);
		return updateService.checkForUpdates(true);
	}
}

class DownloadUpdateAction extends Action2 {
	constructor() {
		super({
			id: 'update.downloadUpdate',
			title: localize2('downloadUpdate', '下载更新'),
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			precondition: CONTEXT_UPDATE_STATE.isEqualTo(StateType.AvailableForDownload)
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IUpdateService).downloadUpdate(true);
	}
}

class InstallUpdateAction extends Action2 {
	constructor() {
		super({
			id: 'update.installUpdate',
			title: localize2('installUpdate', '安装更新'),
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			precondition: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Downloaded)
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IUpdateService).applyUpdate();
	}
}

class RestartToUpdateAction extends Action2 {
	constructor() {
		super({
			id: 'update.restartToUpdate',
			title: localize2('restartToUpdate', '重启以更新'),
			category: { value: product.nameShort, original: product.nameShort },
			f1: true,
			precondition: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Ready)
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IUpdateService).quitAndInstall();
	}
}

class DownloadAction extends Action2 {

	static readonly ID = 'workbench.action.download';
	static readonly AVAILABLE = !!product.downloadUrl;

	constructor() {
		super({
			id: DownloadAction.ID,
			title: localize2('openDownloadPage', "下载 {0}", product.nameLong),
			precondition: IsWebContext, // Only show when running in a web browser
			f1: true,
			menu: [{
				id: MenuId.StatusBarWindowIndicatorMenu,
				when: IsWebContext
			}]
		});
	}

	run(accessor: ServicesAccessor): void {
		const productService = accessor.get(IProductService);
		const openerService = accessor.get(IOpenerService);

		if (productService.downloadUrl) {
			openerService.open(URI.parse(productService.downloadUrl));
		}
	}
}

if (DownloadAction.AVAILABLE) {
	registerAction2(DownloadAction);
}
registerAction2(CheckForUpdateAction);
registerAction2(DownloadUpdateAction);
registerAction2(InstallUpdateAction);
registerAction2(RestartToUpdateAction);

if (isWindows) {
	class DeveloperApplyUpdateAction extends Action2 {
		constructor() {
			super({
				id: '_update.applyupdate',
				title: localize2('applyUpdate', '从文件应用更新...'),
				category: Categories.Developer,
				f1: true,
				precondition: CONTEXT_UPDATE_STATE.isEqualTo(StateType.Idle)
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			const updateService = accessor.get(IUpdateService);
			const fileDialogService = accessor.get(IFileDialogService);

			const updatePath = await fileDialogService.showOpenDialog({
				title: localize('pickUpdate', "从文件应用更新"),
				filters: [{ name: 'Setup', extensions: ['exe'] }],
				canSelectFiles: true,
				openLabel: mnemonicButtonLabel(localize({ key: 'updateButton', comment: ['&& denotes a mnemonic'] }, "更新(&&U)"))
			});

			if (!updatePath || !updatePath[0]) {
				return;
			}

			await updateService._applySpecificUpdate(updatePath[0].fsPath);
		}
	}

	registerAction2(DeveloperApplyUpdateAction);
}

registerAction2(class ShowUpdateInfoAction extends Action2 {
	constructor() {
		super({
			id: 'update.showUpdateInfo',
			title: localize2('showUpdateInfo', "显示更新信息"),
			category: Categories.Developer,
			f1: true,
			precondition: IsWebContext.negate(),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const quickInputService = accessor.get(IQuickInputService);
		const markdown = await quickInputService.input({ prompt: localize('showUpdateInfo.prompt', "输入要呈现的 Markdown，或包含 Markdown/按钮的 JSON (留空则从 URL 加载)") });
		if (markdown === undefined) {
			return; // cancelled
		}
		await commandService.executeCommand('_update.showUpdateInfo', markdown || undefined);
	}
});
