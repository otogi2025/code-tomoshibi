/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { METERED_CONNECTION_SETTING_KEY, MeteredConnectionSettingValue } from '../../../../platform/meteredConnection/common/meteredConnection.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { MeteredConnectionStatusContribution } from './meteredConnectionStatus.js';

import '../../../../platform/meteredConnection/common/meteredConnection.config.contribution.js';

registerWorkbenchContribution2(MeteredConnectionStatusContribution.ID, MeteredConnectionStatusContribution, WorkbenchPhase.AfterRestored);

registerAction2(class ConfigureMeteredConnectionAction extends Action2 {

	static readonly ID = 'workbench.action.configureMeteredConnection';

	constructor() {
		super({
			id: ConfigureMeteredConnectionAction.ID,
			title: localize2('configureMeteredConnection', '配置按流量计费的连接'),
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const configurationService = accessor.get(IConfigurationService);

		const currentValue = configurationService.getValue<MeteredConnectionSettingValue>(METERED_CONNECTION_SETTING_KEY);

		const picks: (IQuickPickItem & { value: MeteredConnectionSettingValue })[] = [
			{
				value: 'auto',
				label: localize('meteredConnection.auto', "自动"),
				description: localize('meteredConnection.auto.description', "自动检测按流量计费的连接"),
				picked: currentValue === 'auto'
			},
			{
				value: 'on',
				label: localize('meteredConnection.on', "开"),
				description: localize('meteredConnection.on.description', "始终将连接视为按流量计费"),
				picked: currentValue === 'on'
			},
			{
				value: 'off',
				label: localize('meteredConnection.off', "关"),
				description: localize('meteredConnection.off.description', "切勿将连接视为按流量计费"),
				picked: currentValue === 'off'
			}
		];

		const pick = await quickInputService.pick(picks, {
			placeHolder: localize('meteredConnection.placeholder', "选择按流量计费的连接模式"),
			activeItem: picks.find(p => p.picked)
		});

		if (pick) {
			await configurationService.updateValue(METERED_CONNECTION_SETTING_KEY, pick.value);
		}
	}
});
