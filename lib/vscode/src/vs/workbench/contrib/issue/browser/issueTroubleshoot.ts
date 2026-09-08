/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionType } from '../../../../platform/extensions/common/extensions.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IWorkbenchIssueService } from '../common/issue.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IUserDataProfileImportExportService, IUserDataProfileManagementService, IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IExtensionBisectService } from '../../../services/extensionManagement/browser/extensionBisect.js';
import { INotificationHandle, INotificationService, IPromptChoice, NotificationPriority, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IUserDataProfile, IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { ServicesAccessor, createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import { RemoteNameContext } from '../../../common/contextkeys.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';

const ITroubleshootIssueService = createDecorator<ITroubleshootIssueService>('ITroubleshootIssueService');

interface ITroubleshootIssueService {
	_serviceBrand: undefined;
	isActive(): boolean;
	start(): Promise<void>;
	resume(): Promise<void>;
	stop(): Promise<void>;
}

enum TroubleshootStage {
	EXTENSIONS = 1,
	WORKBENCH,
}

type TroubleShootResult = 'good' | 'bad' | 'stop';

class TroubleShootState {

	static fromJSON(raw: string | undefined): TroubleShootState | undefined {
		if (!raw) {
			return undefined;
		}
		try {
			interface Raw extends TroubleShootState { }
			const data: Raw = JSON.parse(raw);
			if (
				(data.stage === TroubleshootStage.EXTENSIONS || data.stage === TroubleshootStage.WORKBENCH)
				&& typeof data.profile === 'string'
			) {
				return new TroubleShootState(data.stage, data.profile);
			}
		} catch { /* ignore */ }
		return undefined;
	}

	constructor(
		readonly stage: TroubleshootStage,
		readonly profile: string,
	) { }
}

class TroubleshootIssueService extends Disposable implements ITroubleshootIssueService {

	readonly _serviceBrand: undefined;

	static readonly storageKey = 'issueTroubleshootState';

	private notificationHandle: INotificationHandle | undefined;

	constructor(
		@IUserDataProfileService private readonly userDataProfileService: IUserDataProfileService,
		@IUserDataProfilesService private readonly userDataProfilesService: IUserDataProfilesService,
		@IUserDataProfileManagementService private readonly userDataProfileManagementService: IUserDataProfileManagementService,
		@IUserDataProfileImportExportService private readonly userDataProfileImportExportService: IUserDataProfileImportExportService,
		@IDialogService private readonly dialogService: IDialogService,
		@IExtensionBisectService private readonly extensionBisectService: IExtensionBisectService,
		@INotificationService private readonly notificationService: INotificationService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IWorkbenchIssueService private readonly issueService: IWorkbenchIssueService,
		@IProductService private readonly productService: IProductService,
		@IHostService private readonly hostService: IHostService,
		@IStorageService private readonly storageService: IStorageService,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super();
	}

	isActive(): boolean {
		return this.state !== undefined;
	}

	async start(): Promise<void> {
		if (this.isActive()) {
			throw new Error('invalid state');
		}

		const res = await this.dialogService.confirm({
			message: localize('troubleshoot issue', "排查问题"),
			detail: localize('detail.start', "问题疑难解答过程有助于确定问题的原因。问题可能是由配置不当、扩展或 {0} 本身引起的。\r\n\r\n在此过程中，窗口会不断重载。每次都必须确认是否仍看到此问题。", this.productService.nameLong),
			primaryButton: localize({ key: 'msg', comment: ['&& denotes a mnemonic'] }, "&&排查问题"),
			custom: true
		});

		if (!res.confirmed) {
			return;
		}

		const originalProfile = this.userDataProfileService.currentProfile;
		await this.userDataProfileImportExportService.createTroubleshootProfile();
		this.state = new TroubleShootState(TroubleshootStage.EXTENSIONS, originalProfile.id);
		await this.resume();
	}

	async resume(): Promise<void> {
		if (!this.isActive()) {
			return;
		}

		if (this.state?.stage === TroubleshootStage.EXTENSIONS && !this.extensionBisectService.isActive) {
			await this.reproduceIssueWithExtensionsDisabled();
		}

		if (this.state?.stage === TroubleshootStage.WORKBENCH) {
			await this.reproduceIssueWithEmptyProfile();
		}

		await this.stop();
	}

	async stop(): Promise<void> {
		if (!this.isActive()) {
			return;
		}

		if (this.notificationHandle) {
			this.notificationHandle.close();
			this.notificationHandle = undefined;
		}

		if (this.extensionBisectService.isActive) {
			await this.extensionBisectService.reset();
		}

		const profile = this.userDataProfilesService.profiles.find(p => p.id === this.state?.profile) ?? this.userDataProfilesService.defaultProfile;
		this.state = undefined;
		await this.userDataProfileManagementService.switchProfile(profile);
	}

	private async reproduceIssueWithExtensionsDisabled(): Promise<void> {
		if (!(await this.extensionManagementService.getInstalled(ExtensionType.User)).length) {
			this.state = new TroubleShootState(TroubleshootStage.WORKBENCH, this.state!.profile);
			return;
		}

		const result = await this.askToReproduceIssue(localize('profile.extensions.disabled', "问题疑难解答处于活动状态，并暂时禁用了所有已安装的扩展。检查是否仍可以重现问题，然后从这些选项中进行选择。"));
		if (result === 'good') {
			const profile = this.userDataProfilesService.profiles.find(p => p.id === this.state!.profile) ?? this.userDataProfilesService.defaultProfile;
			await this.reproduceIssueWithExtensionsBisect(profile);
		}
		if (result === 'bad') {
			this.state = new TroubleShootState(TroubleshootStage.WORKBENCH, this.state!.profile);
		}
		if (result === 'stop') {
			await this.stop();
		}
	}

	private async reproduceIssueWithEmptyProfile(): Promise<void> {
		await this.userDataProfileManagementService.createAndEnterTransientProfile();
		this.updateState(this.state);
		const result = await this.askToReproduceIssue(localize('empty.profile', "问题疑难解答处于活动状态，并且已将配置暂时重置为默认值。检查是否仍可以重现问题，然后从这些选项中进行选择。"));
		if (result === 'stop') {
			await this.stop();
		}
		if (result === 'good') {
			await this.askToReportIssue(localize('issue is with configuration', "问题疑难解答已确定此问题是由配置导致的。请使用“导出配置文件”命令导出配置来报告问题，并共享问题报告中的文件。"));
		}
		if (result === 'bad') {
			await this.askToReportIssue(localize('issue is in core', "问题疑难解答已确定该问题与{0}有关。", this.productService.nameLong));
		}
	}

	private async reproduceIssueWithExtensionsBisect(profile: IUserDataProfile): Promise<void> {
		await this.userDataProfileManagementService.switchProfile(profile);
		const extensions = (await this.extensionManagementService.getInstalled(ExtensionType.User)).filter(ext => this.extensionEnablementService.isEnabled(ext));
		await this.extensionBisectService.start(extensions);
		await this.hostService.reload();
	}

	private askToReproduceIssue(message: string): Promise<TroubleShootResult> {
		return new Promise((c, e) => {
			const goodPrompt: IPromptChoice = {
				label: localize('I cannot reproduce', "我无法重现"),
				run: () => c('good')
			};
			const badPrompt: IPromptChoice = {
				label: localize('This is Bad', "我可以重现"),
				run: () => c('bad')
			};
			const stop: IPromptChoice = {
				label: localize('Stop', "停止"),
				run: () => c('stop')
			};
			this.notificationHandle = this.notificationService.prompt(
				Severity.Info,
				message,
				[goodPrompt, badPrompt, stop],
				{ sticky: true, priority: NotificationPriority.URGENT }
			);
		});
	}

	private async askToReportIssue(message: string): Promise<void> {
		let isCheckedInInsiders = false;
		if (this.productService.quality === 'stable') {
			const res = await this.askToReproduceIssueWithInsiders();
			if (res === 'good') {
				await this.dialogService.prompt({
					type: Severity.Info,
					message: localize('troubleshoot issue', "排查问题"),
					detail: localize('use insiders', "这可能意味着问题已解决，将在即将发布的版本中可用。你可以安全地使用 {0} Insiders，直到新的稳定版本可用。", this.productService.nameLong),
					custom: true
				});
				return;
			}
			if (res === 'stop') {
				await this.stop();
				return;
			}
			if (res === 'bad') {
				isCheckedInInsiders = true;
			}
		}

		await this.issueService.openReporter({
			issueBody: `> ${message} ${isCheckedInInsiders ? `It is confirmed that the issue exists in ${this.productService.nameLong} Insiders` : ''}`,
		});
	}

	private async askToReproduceIssueWithInsiders(): Promise<TroubleShootResult | undefined> {
		const confirmRes = await this.dialogService.confirm({
			type: 'info',
			message: localize('troubleshoot issue', "排查问题"),
			primaryButton: localize('download insiders', "下载 {0} Insiders", this.productService.nameLong),
			cancelButton: localize('report anyway', "仍然报告问题"),
			detail: localize('ask to download insiders', "请尝试下载并重现 {0} Insiders 中的问题。", this.productService.nameLong),
			custom: {
				disableCloseAction: true,
			}
		});

		if (!confirmRes.confirmed) {
			return undefined;
		}

		const opened = await this.openerService.open(URI.parse('https://aka.ms/vscode-insiders'));
		if (!opened) {
			return undefined;
		}

		const res = await this.dialogService.prompt<TroubleShootResult>({
			type: 'info',
			message: localize('troubleshoot issue', "排查问题"),
			buttons: [{
				label: localize('good', "我无法重现"),
				run: () => 'good'
			}, {
				label: localize('bad', "我可以重现"),
				run: () => 'bad'
			}],
			cancelButton: {
				label: localize('stop', "停止"),
				run: () => 'stop'
			},
			detail: localize('ask to reproduce issue', "请尝试重现 {0} Insiders 中的问题，并确认问题是否存在。", this.productService.nameLong),
			custom: {
				disableCloseAction: true,
			}
		});

		return res.result;
	}

	private _state: TroubleShootState | undefined | null;
	get state(): TroubleShootState | undefined {
		if (this._state === undefined) {
			const raw = this.storageService.get(TroubleshootIssueService.storageKey, StorageScope.PROFILE);
			this._state = TroubleShootState.fromJSON(raw);
		}
		return this._state || undefined;
	}

	set state(state: TroubleShootState | undefined) {
		this._state = state ?? null;
		this.updateState(state);
	}

	private updateState(state: TroubleShootState | undefined) {
		if (state) {
			this.storageService.store(TroubleshootIssueService.storageKey, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.MACHINE);
		} else {
			this.storageService.remove(TroubleshootIssueService.storageKey, StorageScope.PROFILE);
		}
	}
}

class IssueTroubleshootUi extends Disposable {

	static ctxIsTroubleshootActive = new RawContextKey<boolean>('isIssueTroubleshootActive', false);

	constructor(
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@ITroubleshootIssueService private readonly troubleshootIssueService: ITroubleshootIssueService,
		@IStorageService storageService: IStorageService,
	) {
		super();
		this.updateContext();
		if (troubleshootIssueService.isActive()) {
			troubleshootIssueService.resume();
		}
		this._register(storageService.onDidChangeValue(StorageScope.PROFILE, TroubleshootIssueService.storageKey, this._store)(() => {
			this.updateContext();
		}));
	}

	private updateContext(): void {
		IssueTroubleshootUi.ctxIsTroubleshootActive.bindTo(this.contextKeyService).set(this.troubleshootIssueService.isActive());
	}

}

Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench).registerWorkbenchContribution(IssueTroubleshootUi, LifecyclePhase.Restored);

registerAction2(class TroubleshootIssueAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.troubleshootIssue.start',
			title: localize2('troubleshootIssue', '排查问题...'),
			category: Categories.Help,
			f1: true,
			precondition: ContextKeyExpr.and(IssueTroubleshootUi.ctxIsTroubleshootActive.negate(), RemoteNameContext.isEqualTo(''), IsWebContext.negate()),
		});
	}
	run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(ITroubleshootIssueService).start();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.troubleshootIssue.stop',
			title: localize2('title.stop', '停止排查问题'),
			category: Categories.Help,
			f1: true,
			precondition: IssueTroubleshootUi.ctxIsTroubleshootActive
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(ITroubleshootIssueService).stop();
	}
});


registerSingleton(ITroubleshootIssueService, TroubleshootIssueService, InstantiationType.Delayed);
