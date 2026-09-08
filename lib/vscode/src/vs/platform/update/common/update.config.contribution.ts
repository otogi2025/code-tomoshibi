/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isWeb, isWindows } from '../../../base/common/platform.js';
import { PolicyCategory } from '../../../base/common/policy.js';
import { localize } from '../../../nls.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'update',
	order: 15,
	title: localize('updateConfigurationTitle', "更新"),
	type: 'object',
	properties: {
		'update.mode': {
			type: 'string',
			enum: ['none', 'manual', 'start', 'default'],
			default: 'default',
			scope: ConfigurationScope.APPLICATION,
			description: localize('updateMode', "配置是否接收自动更新。更新是从 Microsoft 联机服务获取的。"),
			tags: ['usesOnlineServices'],
			enumDescriptions: [
				localize('none', "禁用更新。"),
				localize('manual', "禁用自动后台更新检查。如果手动检查更新，更新将可用。"),
				localize('start', "仅在启动时检查更新。禁用自动后台更新检查。"),
				localize('default', "启用自动更新检查。代码将定期自动检查更新。")
			],
			policy: {
				name: 'UpdateMode',
				category: PolicyCategory.Update,
				minimumVersion: '1.67',
				localization: {
					description: { key: 'updateMode', value: localize('updateMode', "配置是否接收自动更新。更新是从 Microsoft 联机服务获取的。"), },
					enumDescriptions: [
						{
							key: 'none',
							value: localize('none', "禁用更新。"),
						},
						{
							key: 'manual',
							value: localize('manual', "禁用自动后台更新检查。如果手动检查更新，更新将可用。"),
						},
						{
							key: 'start',
							value: localize('start', "仅在启动时检查更新。禁用自动后台更新检查。"),
						},
						{
							key: 'default',
							value: localize('default', "启用自动更新检查。代码将定期自动检查更新。"),
						}
					]
				},
			}
		},
		'update.channel': {
			type: 'string',
			default: 'default',
			scope: ConfigurationScope.APPLICATION,
			description: localize('updateMode', "配置是否接收自动更新。更新是从 Microsoft 联机服务获取的。"),
			deprecationMessage: localize('deprecated', "此设置已弃用，请改用“{0}”。", 'update.mode')
		},
		'update.enableWindowsBackgroundUpdates': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			title: localize('enableWindowsBackgroundUpdatesTitle', "启用后台更新"),
			description: localize('enableWindowsBackgroundUpdates', "启用在后台下载和安装新的 VS Code 版本。"),
			included: isWindows && !isWeb
		},
		'update.showReleaseNotes': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('showReleaseNotes', "在更新后显示发行说明。发行说明将从 Microsoft 联机服务中获取。"),
			tags: ['usesOnlineServices'],
			agentsWindow: { default: false, readOnly: true },
		},
		'update.showPostInstallInfo': {
			type: 'boolean',
			default: false,
			experiment: { mode: 'auto' },
			scope: ConfigurationScope.APPLICATION,
			description: localize('showPostInstallInfo', "在标题栏中显示安装后更新提示，而非打开发行说明编辑器。"),
			tags: ['usesOnlineServices']
		},
		'update.titleBar': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize('updateTitleBar', "在标题栏显示更新指示器。"),
			included: !isWeb
		}
	}
});
