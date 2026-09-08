/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color, RGBA } from '../../../../base/common/color.js';
import { registerColor, transparent } from '../colorUtils.js';

// Import the colors we need
import { editorFindMatchHighlight, editorInfoBorder, editorInfoForeground, editorSelectionBackground, editorSelectionHighlight, editorWarningBorder, editorWarningForeground } from './editorColors.js';
import { scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground } from './miscColors.js';


export const minimapFindMatch = registerColor('minimap.findMatchHighlight',
	editorFindMatchHighlight,
	nls.localize('minimapFindMatchHighlight', '用于查找匹配项的迷你地图标记颜色。'), true);

export const minimapSelectionOccurrenceHighlight = registerColor('minimap.selectionOccurrenceHighlight',
	editorSelectionHighlight,
	nls.localize('minimapSelectionOccurrenceHighlight', '用于重复编辑器选择的缩略图标记颜色。'), true);

export const minimapSelection = registerColor('minimap.selectionHighlight',
	editorSelectionBackground,
	nls.localize('minimapSelectionHighlight', '编辑器选区在迷你地图中对应的标记颜色。'), true);

export const minimapInfo = registerColor('minimap.infoHighlight',
	{ dark: editorInfoForeground, light: editorInfoForeground, hcDark: editorInfoBorder, hcLight: editorInfoBorder },
	nls.localize('minimapInfo', '信息的迷你地图标记颜色。'));

export const minimapWarning = registerColor('minimap.warningHighlight',
	{ dark: editorWarningForeground, light: editorWarningForeground, hcDark: editorWarningBorder, hcLight: editorWarningBorder },
	nls.localize('overviewRuleWarning', '用于警告的迷你地图标记颜色。'));

export const minimapError = registerColor('minimap.errorHighlight',
	{ dark: new Color(new RGBA(255, 18, 18, 0.7)), light: new Color(new RGBA(255, 18, 18, 0.7)), hcDark: new Color(new RGBA(255, 50, 50, 1)), hcLight: '#B5200D' },
	nls.localize('minimapError', '用于错误的迷你地图标记颜色。'));

export const minimapBackground = registerColor('minimap.background',
	null,
	nls.localize('minimapBackground', "迷你地图背景颜色。"));

export const minimapForegroundOpacity = registerColor('minimap.foregroundOpacity',
	Color.fromHex('#000f'),
	nls.localize('minimapForegroundOpacity', '在缩略图中呈现的前景元素的不透明度。例如，"#000000c0" 将呈现不透明度为 75% 的元素。'));

export const minimapSliderBackground = registerColor('minimapSlider.background',
	transparent(scrollbarSliderBackground, 0.5),
	nls.localize('minimapSliderBackground', "迷你地图滑块背景颜色。"));

export const minimapSliderHoverBackground = registerColor('minimapSlider.hoverBackground',
	transparent(scrollbarSliderHoverBackground, 0.5),
	nls.localize('minimapSliderHoverBackground', "悬停时，迷你地图滑块的背景颜色。"));

export const minimapSliderActiveBackground = registerColor('minimapSlider.activeBackground',
	transparent(scrollbarSliderActiveBackground, 0.5),
	nls.localize('minimapSliderActiveBackground', "单击时，迷你地图滑块的背景颜色。"));
