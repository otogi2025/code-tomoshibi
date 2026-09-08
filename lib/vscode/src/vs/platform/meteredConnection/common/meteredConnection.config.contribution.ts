/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../nls.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'network',
	order: 14,
	title: localize('networkConfigurationTitle', "网络"),
	type: 'object',
	properties: {
		'network.meteredConnection': {
			type: 'string',
			enum: ['auto', 'on', 'off'],
			enumDescriptions: [
				localize('meteredConnection.auto', "使用操作系统的网络状态自动检测按流量计费的连接。"),
				localize('meteredConnection.on', "始终将网络连接视为按流量计费。自动更新和下载将推迟。"),
				localize('meteredConnection.off', "切勿将网络连接视为按流量计费。")
			],
			default: 'auto',
			scope: ConfigurationScope.APPLICATION,
			description: localize('meteredConnection', "控制是否应将当前网络连接视为按流量计费。按流量计费时，将推迟自动更新、扩展下载和其他后台网络活动，以减少数据使用量。"),
			tags: ['usesOnlineServices']
		}
	}
});
