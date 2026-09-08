/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IWorkbenchContributionsRegistry, WorkbenchPhase, Extensions as WorkbenchExtensions, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ShowCandidateContribution } from './showCandidate.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { TunnelFactoryContribution } from './tunnelFactory.js';
import { RemoteAgentConnectionStatusListener, RemoteMarkers } from './remote.js';
import { AutomaticPortForwarding, ForwardedPortsView, PortRestore, TOGGLE_VIEW_ACTION_ID } from './remoteExplorer.js';
import { InitialRemoteConnectionHealthContribution } from './remoteConnectionHealth.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID } from '../../tomoshibi/browser/settings/tomoshibiSettingsInput.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

// The forwarded ports view is gone; the ports table is a section of the Code-Tomoshibi settings
// page. The command id is kept so the callers that still ask for it land somewhere sensible.
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: TOGGLE_VIEW_ACTION_ID,
			title: localize('remote.togglePortsView', "Toggle Forwarded Ports View"),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(ICommandService).executeCommand(TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID, 'ports');
	}
});

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
registerWorkbenchContribution2(ShowCandidateContribution.ID, ShowCandidateContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(TunnelFactoryContribution.ID, TunnelFactoryContribution, WorkbenchPhase.BlockRestore);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteAgentConnectionStatusListener, LifecyclePhase.Eventually);
// Remote commands/services remain available, but Code-Tomoshibi has no remote
// host indicator in its minimal status bar.
workbenchContributionsRegistry.registerWorkbenchContribution(ForwardedPortsView, LifecyclePhase.Restored);
workbenchContributionsRegistry.registerWorkbenchContribution(PortRestore, LifecyclePhase.Eventually);
workbenchContributionsRegistry.registerWorkbenchContribution(AutomaticPortForwarding, LifecyclePhase.Eventually);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteMarkers, LifecyclePhase.Eventually);
workbenchContributionsRegistry.registerWorkbenchContribution(InitialRemoteConnectionHealthContribution, LifecyclePhase.Restored);
