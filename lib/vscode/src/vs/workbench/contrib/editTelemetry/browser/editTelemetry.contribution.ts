/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditTelemetryContribution } from './editTelemetryContribution.js';
import { EDIT_TELEMETRY_SETTING_ID, AI_STATS_SETTING_ID } from './settingIds.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { localize } from '../../../../nls.js';
import { EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR } from './settings.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAiEditTelemetryService } from './telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { AiEditTelemetryServiceImpl } from './telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.js';
import { IRandomService, RandomService } from './randomService.js';

registerWorkbenchContribution2('EditTelemetryContribution', EditTelemetryContribution, WorkbenchPhase.AfterRestored);

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'task',
	order: 100,
	title: localize('editTelemetry', "编辑遥测数据"),
	type: 'object',
	properties: {
		[EDIT_TELEMETRY_SETTING_ID]: {
			markdownDescription: localize('telemetry.editStats.enabled', "控制是否为编辑统计信息启用遥测(仅在启用常规遥测时发送统计信息)。"),
			type: 'boolean',
			default: true,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[AI_STATS_SETTING_ID]: {
			markdownDescription: localize('editor.aiStats.enabled', "控制是否在编辑器中启用 AI 统计功能。该仪表显示 5 分钟会话的平均 AI 速率，其中每个会话的速率计算方法是 AI 插入的字符数除以插入的字符总数。"),
			type: 'boolean',
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[EDIT_TELEMETRY_DETAILS_SETTING_ID]: {
			markdownDescription: localize('telemetry.editStats.detailed.enabled', "控制是否启用遥测以获得详细的编辑统计信息(仅在启用常规遥测时发送统计信息)。"),
			type: 'boolean',
			default: false,
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		[EDIT_TELEMETRY_SHOW_STATUS_BAR]: {
			markdownDescription: localize('telemetry.editStats.showStatusBar', "控制是否显示编辑遥测的状态栏。"),
			type: 'boolean',
			default: false,
			tags: ['experimental'],
		},
		[EDIT_TELEMETRY_SHOW_DECORATIONS]: {
			markdownDescription: localize('telemetry.editStats.showDecorations', "控制是否显示编辑遥测的装饰效果。"),
			type: 'boolean',
			default: false,
			tags: ['experimental'],
		},
	}
});

registerSingleton(IAiEditTelemetryService, AiEditTelemetryServiceImpl, InstantiationType.Delayed);
registerSingleton(IRandomService, RandomService, InstantiationType.Delayed);
