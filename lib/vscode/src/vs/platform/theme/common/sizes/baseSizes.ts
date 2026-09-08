/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { registerSize, sizeForAllThemes } from '../sizeUtils.js';

// ------ Font Sizes

/** @deprecated Use {@link fontSizeBody1} instead. */
export const bodyFontSize = registerSize('bodyFontSize',
	sizeForAllThemes(13, 'px'),
	nls.localize('bodyFontSize', "基础字号。如果未由组件替代，则使用此大小。"),
	nls.localize('bodyFontSize.deprecated', "已弃用: 请改用 `fontSize.body1`。"));

/** @deprecated Use {@link fontSizeLabel1} instead. */
export const bodyFontSizeSmall = registerSize('bodyFontSize.small',
	sizeForAllThemes(12, 'px'),
	nls.localize('bodyFontSizeSmall', "辅助内容的小字号。"),
	nls.localize('bodyFontSizeSmall.deprecated', "已弃用: 请改用 `fontSize.label1`。"));

/** @deprecated Use {@link fontSizeBody2} instead. */
export const bodyFontSizeXSmall = registerSize('bodyFontSize.xSmall',
	sizeForAllThemes(11, 'px'),
	nls.localize('bodyFontSizeXSmall', "次要内容的超小字号。"),
	nls.localize('bodyFontSizeXSmall.deprecated', "已弃用: 请改用 `fontSize.body2`。"));

// ------ Font ramp
//
// A generic font-size ramp (headings, body and labels) mirroring the agents
// window ramp. "Strong" variants are NOT separate size tokens: reuse the
// matching size token paired with `fontWeight.semiBold` (600). Regular text
// pairs with `fontWeight.regular` (400).

export const fontSizeHeading1 = registerSize('fontSize.heading1',
	sizeForAllThemes(26, 'px'),
	nls.localize('fontSizeHeading1', "标题 1 字号(最大标题)。"));

export const fontSizeHeading2 = registerSize('fontSize.heading2',
	sizeForAllThemes(18, 'px'),
	nls.localize('fontSizeHeading2', "标题 2 字号(标题)。"));

export const fontSizeHeading3 = registerSize('fontSize.heading3',
	sizeForAllThemes(13, 'px'),
	nls.localize('fontSizeHeading3', "标题 3 字号(副标题)。"));

export const fontSizeBody1 = registerSize('fontSize.body1',
	sizeForAllThemes(13, 'px'),
	nls.localize('fontSizeBody1', "主要正文字号。"));

export const fontSizeBody2 = registerSize('fontSize.body2',
	sizeForAllThemes(11, 'px'),
	nls.localize('fontSizeBody2', "辅助正文字号。"));

export const fontSizeLabel1 = registerSize('fontSize.label1',
	sizeForAllThemes(12, 'px'),
	nls.localize('fontSizeLabel1', "标签 1 字号(分区标题、选项卡)。"));

export const fontSizeLabel2 = registerSize('fontSize.label2',
	sizeForAllThemes(11, 'px'),
	nls.localize('fontSizeLabel2', "标签 2 字号(元数据)。"));

export const fontSizeLabel3 = registerSize('fontSize.label3',
	sizeForAllThemes(10, 'px'),
	nls.localize('fontSizeLabel3', "标签 3 字号(徽章)。"));

// ------ Font weights
//
// A two-weight ramp (regular/semiBold). "Strong" emphasis reuses the matching
// font-size token paired with `fontWeight.semiBold`.

export const fontWeightRegular = registerSize('fontWeight.regular',
	sizeForAllThemes(400, ''),
	nls.localize('fontWeightRegular', "正文、标签和元数据的常规字体粗细(400)。"));

export const fontWeightSemiBold = registerSize('fontWeight.semiBold',
	sizeForAllThemes(600, ''),
	nls.localize('fontWeightSemiBold', "标题和重点强调的半粗字体粗细(600)。"));

export const codiconFontSize = registerSize('codiconFontSize',
	sizeForAllThemes(16, 'px'),
	nls.localize('codiconFontSize', "codicons 的基础字号。"));

export const codiconFontSizeCompact = registerSize('codiconFontSize.compact',
	sizeForAllThemes(12, 'px'),
	nls.localize('codiconFontSizeCompact', "condicons 的紧凑字号。"));

// ------ Corner Radii

export const cornerRadiusMedium = registerSize('cornerRadius.medium',
	sizeForAllThemes(6, 'px'),
	nls.localize('cornerRadiusMedium', "UI 元素的基础圆角半径。"));

export const cornerRadiusXSmall = registerSize('cornerRadius.xSmall',
	sizeForAllThemes(2, 'px'),
	nls.localize('cornerRadiusXSmall', "非常紧凑的 UI 元素的超小圆角半径。"));

export const cornerRadiusSmall = registerSize('cornerRadius.small',
	sizeForAllThemes(4, 'px'),
	nls.localize('cornerRadiusSmall', "紧凑 UI 元素的小圆角半径。"));

export const cornerRadiusLarge = registerSize('cornerRadius.large',
	sizeForAllThemes(8, 'px'),
	nls.localize('cornerRadiusLarge', "醒目 UI 元素的大圆角半径。"));

export const cornerRadiusXLarge = registerSize('cornerRadius.xLarge',
	sizeForAllThemes(12, 'px'),
	nls.localize('cornerRadiusXLarge', "突出显示的 UI 元素的超大圆角半径。"));

export const cornerRadiusCircle = registerSize('cornerRadius.circle',
	sizeForAllThemes(9999, 'px'),
	nls.localize('cornerRadiusCircle', "全圆角 UI 元素的圆形圆角半径。"));

// ------ Stroke Thickness

export const strokeThickness = registerSize('strokeThickness',
	sizeForAllThemes(1, 'px'),
	nls.localize('strokeThickness', "边框和轮廓的基本笔划粗细。"));

// ------ Spacing ramp
//
// A fixed ramp of spacing tokens used for padding, margins and gaps. Numeric tokens
// encode the value in tenths of a pixel (e.g. `size200` is 20px). `sizeNone`
// represents 0px, matching the design system's spacing ramp.

export const spacingNone = registerSize('spacing.sizeNone',
	sizeForAllThemes(0, 'px'),
	nls.localize('spacingNone', "无间距(0px)。"));

export const spacingSize20 = registerSize('spacing.size20',
	sizeForAllThemes(2, 'px'),
	nls.localize('spacingSize20', "间距为 2px。"));

export const spacingSize40 = registerSize('spacing.size40',
	sizeForAllThemes(4, 'px'),
	nls.localize('spacingSize40', "间距为 4px。"));

export const spacingSize60 = registerSize('spacing.size60',
	sizeForAllThemes(6, 'px'),
	nls.localize('spacingSize60', "间距为 6px。"));

export const spacingSize80 = registerSize('spacing.size80',
	sizeForAllThemes(8, 'px'),
	nls.localize('spacingSize80', "间距为 8px。"));

export const spacingSize100 = registerSize('spacing.size100',
	sizeForAllThemes(10, 'px'),
	nls.localize('spacingSize100', "间距为 10px。"));

export const spacingSize120 = registerSize('spacing.size120',
	sizeForAllThemes(12, 'px'),
	nls.localize('spacingSize120', "间距为 12px。"));

export const spacingSize160 = registerSize('spacing.size160',
	sizeForAllThemes(16, 'px'),
	nls.localize('spacingSize160', "间距为 16px。"));

export const spacingSize200 = registerSize('spacing.size200',
	sizeForAllThemes(20, 'px'),
	nls.localize('spacingSize200', "间距为 20px。"));

export const spacingSize240 = registerSize('spacing.size240',
	sizeForAllThemes(24, 'px'),
	nls.localize('spacingSize240', "间距为 24px。"));

export const spacingSize280 = registerSize('spacing.size280',
	sizeForAllThemes(28, 'px'),
	nls.localize('spacingSize280', "间距为 28px。"));

export const spacingSize320 = registerSize('spacing.size320',
	sizeForAllThemes(32, 'px'),
	nls.localize('spacingSize320', "间距为 32px。"));

export const spacingSize360 = registerSize('spacing.size360',
	sizeForAllThemes(36, 'px'),
	nls.localize('spacingSize360', "间距为 36px。"));

export const spacingSize400 = registerSize('spacing.size400',
	sizeForAllThemes(40, 'px'),
	nls.localize('spacingSize400', "间距为 40px。"));
