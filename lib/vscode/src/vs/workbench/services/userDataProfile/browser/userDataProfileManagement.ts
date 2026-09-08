/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { equals } from '../../../../base/common/objects.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataProfile, IUserDataProfileOptions, IUserDataProfilesService, IUserDataProfileUpdateOptions } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { isEmptyWorkspaceIdentifier, IWorkspaceContextService, toWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
import { CONFIG_NEW_WINDOW_PROFILE } from '../../../common/configuration.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { IHostService } from '../../host/browser/host.js';
import { DidChangeUserDataProfileEvent, IProfileTemplateInfo, IUserDataProfileManagementService, IUserDataProfileService } from '../common/userDataProfile.js';

export class UserDataProfileManagementService extends Disposable implements IUserDataProfileManagementService {
	readonly _serviceBrand: undefined;

	constructor(
		@IUserDataProfilesService private readonly userDataProfilesService: IUserDataProfilesService,
		@IUserDataProfileService private readonly userDataProfileService: IUserDataProfileService,
		@IHostService private readonly hostService: IHostService,
		@IDialogService private readonly dialogService: IDialogService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IProductService private readonly productService: IProductService,
		@IRequestService private readonly requestService: IRequestService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._register(userDataProfileService.onDidChangeCurrentProfile(e => this.onDidChangeCurrentProfile(e)));
		this._register(userDataProfilesService.onDidChangeProfiles(e => {
			if (e.removed.some(profile => profile.id === this.userDataProfileService.currentProfile.id)) {
				const profileToUse = this.getProfileToUseForCurrentWorkspace();
				this.switchProfile(profileToUse);
				this.changeCurrentProfile(profileToUse, localize('reload message when removed', "已删除当前配置文件。请重新加载以切换回默认配置文件"));
				return;
			}

			const updatedCurrentProfile = e.updated.find(p => this.userDataProfileService.currentProfile.id === p.id);
			if (updatedCurrentProfile) {
				const profileToUse = this.getProfileToUseForCurrentWorkspace();
				if (profileToUse?.id !== updatedCurrentProfile.id) {
					this.switchProfile(profileToUse);
					this.changeCurrentProfile(profileToUse, localize('reload message when switched', "当前工作区已从当前配置文件中移除。请重新加载以切换回更新后的配置文件"));
				} else {
					this.changeCurrentProfile(updatedCurrentProfile, localize('reload message when updated', "已更新当前配置文件。请重新加载以切换回更新的配置文件"));
				}
			}
		}));
	}

	private async onDidChangeCurrentProfile(e: DidChangeUserDataProfileEvent): Promise<void> {
		if (e.previous.isTransient) {
			await this.userDataProfilesService.cleanUpTransientProfiles();
		}
	}

	private getWorkspaceUri(): URI | undefined {
		const workspace = this.workspaceContextService.getWorkspace();
		return workspace.configuration ?? workspace.folders[0]?.uri;
	}

	private getProfileToUseForCurrentWorkspace(): IUserDataProfile {
		const workspaceUri = this.getWorkspaceUri();
		if (workspaceUri) {
			const profileForWorkspace = this.userDataProfilesService.profiles.find(profile => profile.workspaces?.some(ws => this.uriIdentityService.extUri.isEqual(ws, workspaceUri)));
			if (profileForWorkspace) {
				return profileForWorkspace;
			}
		} else {
			// If no workspace is open, use the current profile
			const currentProfile = this.userDataProfilesService.profiles.find(profile => profile.id === this.userDataProfileService.currentProfile.id);
			if (currentProfile) {
				return currentProfile;
			}
		}
		return this.getDefaultProfileToUse();
	}

	public getDefaultProfileToUse(): IUserDataProfile {
		const newWindowProfileConfigValue = this.configurationService.getValue(CONFIG_NEW_WINDOW_PROFILE);
		if (newWindowProfileConfigValue) {
			const newWindowProfile = this.userDataProfilesService.profiles.find(profile => profile.name === newWindowProfileConfigValue);
			if (newWindowProfile) {
				return newWindowProfile;
			}
		}
		return this.userDataProfilesService.defaultProfile;
	}

	async createProfile(name: string, options?: IUserDataProfileOptions): Promise<IUserDataProfile> {
		return this.userDataProfilesService.createNamedProfile(name, options);
	}

	async createAndEnterProfile(name: string, options?: IUserDataProfileOptions): Promise<IUserDataProfile> {
		const profile = await this.userDataProfilesService.createNamedProfile(name, options, toWorkspaceIdentifier(this.workspaceContextService.getWorkspace()));
		await this.changeCurrentProfile(profile);
		return profile;
	}

	async createAndEnterTransientProfile(): Promise<IUserDataProfile> {
		const profile = await this.userDataProfilesService.createTransientProfile(toWorkspaceIdentifier(this.workspaceContextService.getWorkspace()));
		await this.changeCurrentProfile(profile);
		return profile;
	}

	async updateProfile(profile: IUserDataProfile, updateOptions: IUserDataProfileUpdateOptions): Promise<IUserDataProfile> {
		if (!this.userDataProfilesService.profiles.some(p => p.id === profile.id)) {
			throw new Error(`Profile ${profile.name} does not exist`);
		}
		if (profile.isDefault) {
			throw new Error(localize('cannotRenameDefaultProfile', "无法重命名默认配置文件"));
		}
		const updatedProfile = await this.userDataProfilesService.updateProfile(profile, updateOptions);
		return updatedProfile;
	}

	async removeProfile(profile: IUserDataProfile): Promise<void> {
		if (!this.userDataProfilesService.profiles.some(p => p.id === profile.id)) {
			throw new Error(`Profile ${profile.name} does not exist`);
		}
		if (profile.isDefault) {
			throw new Error(localize('cannotDeleteDefaultProfile', "无法删除默认配置文件。"));
		}
		await this.userDataProfilesService.removeProfile(profile);
	}

	async switchProfile(profile: IUserDataProfile): Promise<void> {
		if (!this.userDataProfilesService.profiles.some(p => p.id === profile.id)) {
			throw new Error(`Profile ${profile.name} does not exist`);
		}
		if (this.userDataProfileService.currentProfile.id === profile.id) {
			return;
		}
		const workspaceUri = this.getWorkspaceUri();
		if (workspaceUri && profile.workspaces?.some(ws => this.uriIdentityService.extUri.isEqual(ws, workspaceUri))) {
			return;
		}
		const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceContextService.getWorkspace());
		await this.userDataProfilesService.setProfileForWorkspace(workspaceIdentifier, profile);
		if (isEmptyWorkspaceIdentifier(workspaceIdentifier)) {
			await this.changeCurrentProfile(profile);
		}
	}

	async getBuiltinProfileTemplates(): Promise<IProfileTemplateInfo[]> {
		if (this.productService.profileTemplatesUrl) {
			try {
				const context = await this.requestService.request({ type: 'GET', url: this.productService.profileTemplatesUrl, callSite: 'userDataProfileManagement.getProfileTemplates' }, CancellationToken.None);
				if (context.res.statusCode === 200) {
					return (await asJson<IProfileTemplateInfo[]>(context)) || [];
				} else {
					this.logService.error('Could not get profile templates.', context.res.statusCode);
				}
			} catch (error) {
				this.logService.error(error);
			}
		}
		return [];
	}

	private async changeCurrentProfile(profile: IUserDataProfile, reloadMessage?: string): Promise<void> {
		const isRemoteWindow = !!this.environmentService.remoteAuthority;

		const shouldRestartExtensionHosts = this.userDataProfileService.currentProfile.id !== profile.id || !equals(this.userDataProfileService.currentProfile.useDefaultFlags, profile.useDefaultFlags);

		if (shouldRestartExtensionHosts) {
			if (!isRemoteWindow) {
				if (!(await this.extensionService.stopExtensionHosts(localize('switch profile', "正在切换到配置文件")))) {
					// If extension host did not stop, do not switch profile
					if (this.userDataProfilesService.profiles.some(p => p.id === this.userDataProfileService.currentProfile.id)) {
						await this.userDataProfilesService.setProfileForWorkspace(toWorkspaceIdentifier(this.workspaceContextService.getWorkspace()), this.userDataProfileService.currentProfile);
					}
					throw new CancellationError();
				}
			}
		}

		// In a remote window update current profile before reloading so that data is preserved from current profile if asked to preserve
		await this.userDataProfileService.updateCurrentProfile(profile);

		if (shouldRestartExtensionHosts) {
			if (isRemoteWindow) {
				const { confirmed } = await this.dialogService.confirm({
					message: reloadMessage ?? localize('reload message', "切换配置文件需要重新加载 VS Code。"),
					primaryButton: localize('reload button', "重载(&&R)"),
				});
				if (confirmed) {
					await this.hostService.reload();
				}
			} else {
				await this.extensionService.startExtensionHosts();
			}
		}
	}
}

registerSingleton(IUserDataProfileManagementService, UserDataProfileManagementService, InstantiationType.Eager /* Eager because it updates the current window profile by listening to profiles changes */);
