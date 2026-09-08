/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { isMacintosh } from '../../../../../base/common/platform.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const enum TerminalZoomCommandId {
	FontZoomIn = 'workbench.action.terminal.fontZoomIn',
	FontZoomOut = 'workbench.action.terminal.fontZoomOut',
	FontZoomReset = 'workbench.action.terminal.fontZoomReset',
}

export const enum TerminalZoomSettingId {
	MouseWheelZoom = 'terminal.integrated.mouseWheelZoom',
}

export const terminalZoomConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalZoomSettingId.MouseWheelZoom]: {
		markdownDescription: isMacintosh
			? localize('terminal.integrated.mouseWheelZoom.mac', "按住 Cmd 键并滚动鼠标滚轮时对终端字体大小进行缩放。")
			: localize('terminal.integrated.mouseWheelZoom', "按住 Ctrl 键并滚动鼠标滚轮时对终端字体大小进行缩放。"),
		type: 'boolean',
		default: false
	},
};
