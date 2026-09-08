/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { OS, OperatingSystem } from '../../../base/common/platform.js';
import { ConfigurationScope, Extensions as ConfigExtensions, IConfigurationNode, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';

export const enum DispatchConfig {
	Code,
	KeyCode
}

export interface IKeyboardConfig {
	dispatch: DispatchConfig;
	mapAltGrToCtrlAlt: boolean;
}

export function readKeyboardConfig(configurationService: IConfigurationService): IKeyboardConfig {
	const keyboard = configurationService.getValue<{ dispatch: string; mapAltGrToCtrlAlt: boolean } | undefined>('keyboard');
	const dispatch = (keyboard?.dispatch === 'keyCode' ? DispatchConfig.KeyCode : DispatchConfig.Code);
	const mapAltGrToCtrlAlt = Boolean(keyboard?.mapAltGrToCtrlAlt);
	return { dispatch, mapAltGrToCtrlAlt };
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration);
const keyboardConfiguration: IConfigurationNode = {
	'id': 'keyboard',
	'order': 15,
	'type': 'object',
	'title': nls.localize('keyboardConfigurationTitle', "键盘"),
	'properties': {
		'keyboard.dispatch': {
			scope: ConfigurationScope.APPLICATION,
			type: 'string',
			enum: ['code', 'keyCode'],
			default: 'code',
			markdownDescription: nls.localize('dispatch', "控制按键的分派逻辑以使用 \"code\" (推荐) 或 \"keyCode\"。"),
			included: OS === OperatingSystem.Macintosh || OS === OperatingSystem.Linux
		},
		'keyboard.mapAltGrToCtrlAlt': {
			scope: ConfigurationScope.APPLICATION,
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('mapAltGrToCtrlAlt', "控制是否应将 AltGraph+ 修饰符视为 Ctrl+Alt+。"),
			included: OS === OperatingSystem.Windows
		}
	}
};

configurationRegistry.registerConfiguration(keyboardConfiguration);
