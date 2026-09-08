/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { registerColor, transparent } from '../colorUtils.js';

// Import the colors we need
import { contrastBorder, activeContrastBorder, foreground } from './baseColors.js';
import { selectForeground, selectBackground } from './inputColors.js';
import { listActiveSelectionBackground, listActiveSelectionForeground } from './listColors.js';


export const menuBorder = registerColor('menu.border',
	{ dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('menuBorder', "菜单的边框颜色。"));

export const menuForeground = registerColor('menu.foreground',
	selectForeground,
	nls.localize('menuForeground', "菜单项的前景颜色。"));

export const menuBackground = registerColor('menu.background',
	selectBackground,
	nls.localize('menuBackground', "菜单项的背景颜色。"));

export const menuSelectionForeground = registerColor('menu.selectionForeground',
	listActiveSelectionForeground,
	nls.localize('menuSelectionForeground', "菜单中选定菜单项的前景色。"));

export const menuSelectionBackground = registerColor('menu.selectionBackground',
	listActiveSelectionBackground,
	nls.localize('menuSelectionBackground', "菜单中所选菜单项的背景色。"));

export const menuSelectionBorder = registerColor('menu.selectionBorder',
	{ dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('menuSelectionBorder', "菜单中所选菜单项的边框颜色。"));

export const menuSeparatorBackground = registerColor('menu.separatorBackground',
	{ dark: transparent(foreground, 0.2), light: transparent(foreground, 0.2), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('menuSeparatorBackground', "菜单中分隔线的颜色。"));
