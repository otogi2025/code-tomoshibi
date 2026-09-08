/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color, RGBA } from '../../../../base/common/color.js';
import { registerColor, oneOf } from '../colorUtils.js';

// Import the colors we need
import { editorWidgetBackground, editorWidgetForeground } from './editorColors.js';
import { listActiveSelectionBackground, listActiveSelectionForeground, listActiveSelectionIconForeground, listFocusHighlightForeground } from './listColors.js';


export const quickInputBackground = registerColor('quickInput.background',
	editorWidgetBackground,
	nls.localize('pickerBackground', "背景颜色快速选取器。快速选取器小部件是选取器(如命令调色板)的容器。"));

export const quickInputForeground = registerColor('quickInput.foreground',
	editorWidgetForeground,
	nls.localize('pickerForeground', "前景颜色快速选取器。快速选取器小部件是命令调色板等选取器的容器。"));

export const quickInputTitleBackground = registerColor('quickInputTitle.background',
	{ dark: new Color(new RGBA(255, 255, 255, 0.105)), light: new Color(new RGBA(0, 0, 0, 0.06)), hcDark: '#000000', hcLight: Color.white },
	nls.localize('pickerTitleBackground', "标题背景颜色快速选取器。快速选取器小部件是命令调色板等选取器的容器。"));

export const pickerGroupForeground = registerColor('pickerGroup.foreground',
	{ dark: '#3794FF', light: '#0066BF', hcDark: Color.white, hcLight: '#0F4A85' },
	nls.localize('pickerGroupForeground', "快速选取器分组标签的颜色。"));

export const pickerGroupBorder = registerColor('pickerGroup.border',
	{ dark: '#3F3F46', light: '#CCCEDB', hcDark: Color.white, hcLight: '#0F4A85' },
	nls.localize('pickerGroupBorder', "快速选取器分组边框的颜色。"));

export const _deprecatedQuickInputListFocusBackground = registerColor('quickInput.list.focusBackground',
	null, '', undefined,
	nls.localize('quickInput.list.focusBackground deprecation', "请改用 quickInputList.focusBackground"));

export const quickInputListFocusForeground = registerColor('quickInputList.focusForeground',
	listActiveSelectionForeground,
	nls.localize('quickInput.listFocusForeground', "焦点项目的快速选择器前景色。"));

export const quickInputListFocusIconForeground = registerColor('quickInputList.focusIconForeground',
	listActiveSelectionIconForeground,
	nls.localize('quickInput.listFocusIconForeground', "焦点项目的快速选取器图标前景色。"));

export const quickInputListFocusBackground = registerColor('quickInputList.focusBackground',
	{ dark: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), light: oneOf(_deprecatedQuickInputListFocusBackground, listActiveSelectionBackground), hcDark: null, hcLight: null },
	nls.localize('quickInput.listFocusBackground', "焦点项目的快速选择器背景色。"));

export const quickInputListFocusHighlightForeground = registerColor('quickInputList.focusHighlightForeground',
	listFocusHighlightForeground,
	nls.localize('quickInput.listFocusHighlightForeground', "焦点项上匹配高亮的快速选取器前景色。"));
