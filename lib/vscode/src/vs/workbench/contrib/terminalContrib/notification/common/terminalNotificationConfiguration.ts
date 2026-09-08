/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const enum TerminalOscNotificationsSettingId {
	EnableNotifications = 'terminal.integrated.enableNotifications',
}

export const terminalOscNotificationsConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalOscNotificationsSettingId.EnableNotifications]: {
		description: localize('terminal.integrated.enableNotifications', "控制是否显示通过 OSC 99 从终端发送的通知。它使用产品内置通知，而非桌面通知。不支持声音、图标和筛选功能。"),
		type: 'boolean',
		default: true
	},
};
