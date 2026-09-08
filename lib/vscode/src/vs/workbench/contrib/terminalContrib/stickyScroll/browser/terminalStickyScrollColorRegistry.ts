/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../../nls.js';
import { registerColor } from '../../../../../platform/theme/common/colorUtils.js';

export const terminalStickyScrollBackground = registerColor('terminalStickyScroll.background', null, localize('terminalStickyScroll.background', '终端中粘滞滚动覆盖的背景色。'));

export const terminalStickyScrollHoverBackground = registerColor('terminalStickyScrollHover.background', {
	dark: '#2A2D2E',
	light: '#F0F0F0',
	hcDark: '#E48B39',
	hcLight: '#0f4a85'
}, localize('terminalStickyScrollHover.background', '悬停时终端中粘滞滚动覆盖的背景色。'));

registerColor('terminalStickyScroll.border', {
	dark: null,
	light: null,
	hcDark: '#6fc3df',
	hcLight: '#0f4a85'
}, localize('terminalStickyScroll.border', '终端中粘滞滚动覆盖层的边框。'));
