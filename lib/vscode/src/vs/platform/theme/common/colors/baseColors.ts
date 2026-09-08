/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color } from '../../../../base/common/color.js';
import { registerColor, transparent } from '../colorUtils.js';


export const foreground = registerColor('foreground',
	{ dark: '#CCCCCC', light: '#616161', hcDark: '#FFFFFF', hcLight: '#292929' },
	nls.localize('foreground', "整体前景色。此颜色仅在不被组件覆盖时适用。"));

export const strongForeground = registerColor('strongForeground',
	{ dark: '#FFFFFF', light: '#000000', hcDark: '#FFFFFF', hcLight: '#000000' },
	nls.localize('strongForeground', "对比度最高的前景色，适用于需要在各种背景下实现最大可读性的文本或图标。仅在未被组件覆盖时使用此颜色。"));

export const disabledForeground = registerColor('disabledForeground',
	{ dark: '#CCCCCC80', light: '#61616180', hcDark: '#A5A5A5', hcLight: '#7F7F7F' },
	nls.localize('disabledForeground', "已禁用元素的整体前景色。仅在未由组件替代时才能使用此颜色。"));

export const errorForeground = registerColor('errorForeground',
	{ dark: '#F48771', light: '#A1260D', hcDark: '#F48771', hcLight: '#B5200D' },
	nls.localize('errorForeground', "错误信息的整体前景色。此颜色仅在不被组件覆盖时适用。"));

export const descriptionForeground = registerColor('descriptionForeground',
	{ light: '#717171', dark: transparent(foreground, 0.7), hcDark: transparent(foreground, 0.7), hcLight: transparent(foreground, 0.7) },
	nls.localize('descriptionForeground', "提供其他信息的说明文本的前景色，例如标签文本。"));

export const iconForeground = registerColor('icon.foreground',
	{ dark: '#C5C5C5', light: '#424242', hcDark: '#FFFFFF', hcLight: '#292929' },
	nls.localize('iconForeground', "工作台中图标的默认颜色。"));

export const focusBorder = registerColor('focusBorder',
	{ dark: '#007FD4', light: '#0090F1', hcDark: '#F38518', hcLight: '#006BBD' },
	nls.localize('focusBorder', "焦点元素的整体边框颜色。此颜色仅在不被其他组件覆盖时适用。"));

export const contrastBorder = registerColor('contrastBorder',
	{ light: null, dark: null, hcDark: '#6FC3DF', hcLight: '#0F4A85' },
	nls.localize('contrastBorder', "在元素周围额外的一层边框，用来提高对比度从而区别其他元素。"));

export const activeContrastBorder = registerColor('contrastActiveBorder',
	{ light: null, dark: null, hcDark: focusBorder, hcLight: focusBorder },
	nls.localize('activeContrastBorder', "在活动元素周围额外的一层边框，用来提高对比度从而区别其他元素。"));

export const selectionBackground = registerColor('selection.background',
	null,
	nls.localize('selectionBackground', "工作台所选文本的背景颜色(例如输入字段或文本区域)。注意，本设置不适用于编辑器。"));


// ------ text link

export const textLinkForeground = registerColor('textLink.foreground',
	{ light: '#006AB1', dark: '#3794FF', hcDark: '#21A6FF', hcLight: '#0F4A85' },
	nls.localize('textLinkForeground', "文本中链接的前景色。"));

export const textLinkActiveForeground = registerColor('textLink.activeForeground',
	{ light: '#006AB1', dark: '#3794FF', hcDark: '#21A6FF', hcLight: '#0F4A85' },
	nls.localize('textLinkActiveForeground', "文本中链接在点击或鼠标悬停时的前景色 。"));

export const textSeparatorForeground = registerColor('textSeparator.foreground',
	{ light: '#0000002e', dark: '#ffffff2e', hcDark: Color.black, hcLight: '#292929' },
	nls.localize('textSeparatorForeground', "文字分隔符的颜色。"));


// ------ text preformat

export const textPreformatForeground = registerColor('textPreformat.foreground',
	{ light: '#A31515', dark: '#D7BA7D', hcDark: '#FFFFFF', hcLight: '#FFFFFF' },
	nls.localize('textPreformatForeground', "预格式化文本段的前景色。"));

export const textPreformatBackground = registerColor('textPreformat.background',
	{ light: '#0000001A', dark: '#FFFFFF1A', hcDark: null, hcLight: '#09345f' },
	nls.localize('textPreformatBackground', "预格式化文本段的背景色。"));
export const textPreformatBorder = registerColor('textPreformat.border',
	{ light: null, dark: null, hcDark: contrastBorder, hcLight: null },
	nls.localize('textPreformatBorder', "预格式化文本段的边框色。"));

// ------ text block quote

export const textBlockQuoteBackground = registerColor('textBlockQuote.background',
	{ light: '#f2f2f2', dark: '#222222', hcDark: null, hcLight: '#F2F2F2' },
	nls.localize('textBlockQuoteBackground', "文本中块引用的背景颜色。"));

export const textBlockQuoteBorder = registerColor('textBlockQuote.border',
	{ light: '#007acc80', dark: '#007acc80', hcDark: Color.white, hcLight: '#292929' },
	nls.localize('textBlockQuoteBorder', "文本中块引用的边框颜色。"));


// ------ text code block

export const textCodeBlockBackground = registerColor('textCodeBlock.background',
	{ light: '#dcdcdc66', dark: '#0a0a0a66', hcDark: Color.black, hcLight: '#F2F2F2' },
	nls.localize('textCodeBlockBackground', "文本中代码块的背景颜色。"));
