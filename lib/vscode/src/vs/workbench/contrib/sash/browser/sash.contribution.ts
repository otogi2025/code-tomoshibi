/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isIOS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { SashSettingsController } from './sash.js';

// Sash size contribution
registerWorkbenchContribution2(SashSettingsController.ID, SashSettingsController, WorkbenchPhase.AfterRestored);

// Sash size configuration contribution
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		...workbenchConfigurationNodeBase,
		properties: {
			'workbench.sash.size': {
				type: 'number',
				default: isIOS ? 20 : 4,
				minimum: 1,
				maximum: 20,
				description: localize('sashSize', "控制视图/编辑器之间拖动区域的反馈区域大小(以像素为单位)。如果你认为很难使用鼠标调整视图的大小，请将该值调大。")
			},
			'workbench.sash.hoverDelay': {
				type: 'number',
				default: 300,
				minimum: 0,
				maximum: 2000,
				description: localize('sashHoverDelay', "控制视图/编辑器之间拖动区域的悬停反馈延迟(以毫秒为单位)。")
			},
		}
	});
