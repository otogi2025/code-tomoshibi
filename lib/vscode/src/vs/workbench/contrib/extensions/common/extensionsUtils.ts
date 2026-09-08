/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from '../../../../base/common/actions.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { IExtensionManagementService, ILocalExtension, IExtensionIdentifier } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionsWorkbenchService } from './extensions.js';

export interface IExtensionStatus {
	identifier: IExtensionIdentifier;
	local: ILocalExtension;
	globallyEnabled: boolean;
}

export async function getInstalledExtensions(accessor: ServicesAccessor): Promise<IExtensionStatus[]> {
	const extensionService = accessor.get(IExtensionManagementService);
	const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
	const extensions = await extensionService.getInstalled();
	return extensions.map(extension => {
		return {
			identifier: extension.identifier,
			local: extension,
			globallyEnabled: extensionEnablementService.isEnabled(extension)
		};
	});
}

/**
 * Installs a single extension by id.
 *
 * Code-Tomoshibi: this used to live in `browser/extensionsActions.ts` (the extension marketplace action set,
 * which has been removed) and used to open the extension editor before installing. There is no marketplace UI
 * any more, so it installs directly and reports failures through a notification.
 */
export class InstallRecommendedExtensionAction extends Action {

	static readonly ID = 'workbench.extensions.action.installRecommendedExtension';
	static readonly LABEL = localize('installRecommendedExtension', "Install Recommended Extension");

	constructor(
		private readonly extensionId: string,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(InstallRecommendedExtensionAction.ID, InstallRecommendedExtensionAction.LABEL, undefined, false);
	}

	override async run(): Promise<void> {
		const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: 'install-recommendation' }, CancellationToken.None);
		if (!extension) {
			this.notificationService.error(localize('extensionNotFound', "Extension '{0}' was not found.", this.extensionId));
			return;
		}
		try {
			await this.extensionWorkbenchService.install(extension);
		} catch (err) {
			this.notificationService.error(localize('extensionInstallFailed', "Failed to install extension '{0}': {1}", this.extensionId, getErrorMessage(err)));
		}
	}
}
