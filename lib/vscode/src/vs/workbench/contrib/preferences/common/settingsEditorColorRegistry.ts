/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Color, RGBA } from '../../../../base/common/color.js';
import { localize } from '../../../../nls.js';
import { editorWidgetBorder, focusBorder, inputBackground, inputBorder, inputForeground, listHoverBackground, registerColor, selectBackground, selectBorder, selectForeground, checkboxBackground, checkboxBorder, checkboxForeground, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { PANEL_BORDER } from '../../../common/theme.js';

// General setting colors
export const settingsHeaderForeground = registerColor('settings.headerForeground', { light: '#444444', dark: '#e7e7e7', hcDark: '#ffffff', hcLight: '#292929' }, localize('headerForeground', "节标题或活动标题的前景颜色。"));
export const settingsHeaderHoverForeground = registerColor('settings.settingsHeaderHoverForeground', transparent(settingsHeaderForeground, 0.7), localize('settingsHeaderHoverForeground', "节标题或悬停标题的前景色。"));
export const modifiedItemIndicator = registerColor('settings.modifiedItemIndicator', {
	light: new Color(new RGBA(102, 175, 224)),
	dark: new Color(new RGBA(12, 125, 157)),
	hcDark: new Color(new RGBA(0, 73, 122)),
	hcLight: new Color(new RGBA(102, 175, 224)),
}, localize('modifiedItemForeground', "修改后的设置指示器的颜色。"));
export const settingsHeaderBorder = registerColor('settings.headerBorder', PANEL_BORDER, localize('settingsHeaderBorder', "标头容器边框的颜色。"));
export const settingsSashBorder = registerColor('settings.sashBorder', PANEL_BORDER, localize('settingsSashBorder', "设置编辑器分割檢視窗扇边框的颜色。"));

// Enum control colors
export const settingsSelectBackground = registerColor(`settings.dropdownBackground`, selectBackground, localize('settingsDropdownBackground', "设置编辑器下拉列表背景色。"));
export const settingsSelectForeground = registerColor('settings.dropdownForeground', selectForeground, localize('settingsDropdownForeground', "设置编辑器下拉列表前景色。"));
export const settingsSelectBorder = registerColor('settings.dropdownBorder', selectBorder, localize('settingsDropdownBorder', "设置编辑器下拉列表边框。"));
export const settingsSelectListBorder = registerColor('settings.dropdownListBorder', editorWidgetBorder, localize('settingsDropdownListBorder', "设置编辑器下拉列表边框。这会将选项包围起来，并将选项与描述分开。"));

// Bool control colors
export const settingsCheckboxBackground = registerColor('settings.checkboxBackground', checkboxBackground, localize('settingsCheckboxBackground', "设置编辑器复选框背景。"));
export const settingsCheckboxForeground = registerColor('settings.checkboxForeground', checkboxForeground, localize('settingsCheckboxForeground', "设置编辑器复选框前景。"));
export const settingsCheckboxBorder = registerColor('settings.checkboxBorder', checkboxBorder, localize('settingsCheckboxBorder', "设置编辑器复选框边框。"));

// Text control colors
export const settingsTextInputBackground = registerColor('settings.textInputBackground', inputBackground, localize('textInputBoxBackground', "设置编辑器文本输入框背景。"));
export const settingsTextInputForeground = registerColor('settings.textInputForeground', inputForeground, localize('textInputBoxForeground', "设置编辑器文本输入框前景。"));
export const settingsTextInputBorder = registerColor('settings.textInputBorder', inputBorder, localize('textInputBoxBorder', "设置编辑器文本输入框边框。"));

// Number control colors
export const settingsNumberInputBackground = registerColor('settings.numberInputBackground', inputBackground, localize('numberInputBoxBackground', "设置编辑器编号输入框背景。"));
export const settingsNumberInputForeground = registerColor('settings.numberInputForeground', inputForeground, localize('numberInputBoxForeground', "设置编辑器编号输入框前景。"));
export const settingsNumberInputBorder = registerColor('settings.numberInputBorder', inputBorder, localize('numberInputBoxBorder', "设置编辑器编号输入框边框。"));

export const focusedRowBackground = registerColor('settings.focusedRowBackground', {
	dark: transparent(listHoverBackground, .6),
	light: transparent(listHoverBackground, .6),
	hcDark: null,
	hcLight: null,
}, localize('focusedRowBackground', "聚焦时设置行的背景色。"));

export const rowHoverBackground = registerColor('settings.rowHoverBackground', {
	dark: transparent(listHoverBackground, .3),
	light: transparent(listHoverBackground, .3),
	hcDark: null,
	hcLight: null
}, localize('settings.rowHoverBackground', "悬停时设置行的背景色。"));

export const focusedRowBorder = registerColor('settings.focusedRowBorder', focusBorder, localize('settings.focusedRowBorder', "将焦点放在行上时行的上边框和下边框的颜色。"));
