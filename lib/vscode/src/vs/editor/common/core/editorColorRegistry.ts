/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';
import { Color, RGBA } from '../../../base/common/color.js';
import { activeContrastBorder, editorBackground, registerColor, editorWarningForeground, editorInfoForeground, editorWarningBorder, editorInfoBorder, contrastBorder, editorFindMatchHighlight, editorWarningBackground, editorErrorForeground, darken, lighten, transparent } from '../../../platform/theme/common/colorRegistry.js';
import { registerThemingParticipant } from '../../../platform/theme/common/themeService.js';

/**
 * Definition of the editor colors
 */
export const editorLineHighlight = registerColor('editor.lineHighlightBackground', null, nls.localize('lineHighlight', '光标所在行高亮内容的背景颜色。'));
export const editorInactiveLineHighlight = registerColor('editor.inactiveLineHighlightBackground', editorLineHighlight, nls.localize('inactiveLineHighlight', '编辑器未聚焦时，光标所在行的高亮背景色。'));
export const editorLineHighlightBorder = registerColor('editor.lineHighlightBorder', { dark: '#282828', light: '#eeeeee', hcDark: '#f38518', hcLight: contrastBorder }, nls.localize('lineHighlightBorderBox', '光标所在行四周边框的背景颜色。'));
export const editorRangeHighlight = registerColor('editor.rangeHighlightBackground', { dark: '#ffffff0b', light: '#fdff0033', hcDark: null, hcLight: null }, nls.localize('rangeHighlight', '背景颜色的高亮范围，喜欢通过快速打开和查找功能。颜色必须透明，以免隐藏下面的修饰效果。'), true);
export const editorRangeHighlightBorder = registerColor('editor.rangeHighlightBorder', { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('rangeHighlightBorder', '高亮区域边框的背景颜色。'));
export const editorSymbolHighlight = registerColor('editor.symbolHighlightBackground', { dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null }, nls.localize('symbolHighlight', '高亮显示符号的背景颜色，例如转到定义或转到下一个/上一个符号。颜色必须透明，以免隐藏下面的修饰效果。'), true);
export const editorSymbolHighlightBorder = registerColor('editor.symbolHighlightBorder', { dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('symbolHighlightBorder', '高亮显示符号周围的边框的背景颜色。'));

export const editorCursorForeground = registerColor('editorCursor.foreground', { dark: '#AEAFAD', light: Color.black, hcDark: Color.white, hcLight: '#0F4A85' }, nls.localize('caret', '编辑器光标颜色。'));
export const editorCursorBackground = registerColor('editorCursor.background', null, nls.localize('editorCursorBackground', '编辑器光标的背景色。可以自定义块型光标覆盖字符的颜色。'));
export const editorMultiCursorPrimaryForeground = registerColor('editorMultiCursor.primary.foreground', editorCursorForeground, nls.localize('editorMultiCursorPrimaryForeground', '存在多个游标时主要编辑器游标的颜色。'));
export const editorMultiCursorPrimaryBackground = registerColor('editorMultiCursor.primary.background', editorCursorBackground, nls.localize('editorMultiCursorPrimaryBackground', '存在多个游标时主要编辑器游标的背景色。允许自定义块游标重叠的字符的颜色。'));
export const editorMultiCursorSecondaryForeground = registerColor('editorMultiCursor.secondary.foreground', editorCursorForeground, nls.localize('editorMultiCursorSecondaryForeground', '存在多个游标时辅助编辑器游标的颜色。'));
export const editorMultiCursorSecondaryBackground = registerColor('editorMultiCursor.secondary.background', editorCursorBackground, nls.localize('editorMultiCursorSecondaryBackground', '存在多个游标时辅助编辑器游标的背景色。允许自定义块游标重叠的字符的颜色。'));
export const editorWhitespaces = registerColor('editorWhitespace.foreground', { dark: '#e3e4e229', light: '#33333333', hcDark: '#e3e4e229', hcLight: '#CCCCCC' }, nls.localize('editorWhitespaces', '编辑器中空白字符的颜色。'));
export const editorLineNumbers = registerColor('editorLineNumber.foreground', { dark: '#858585', light: '#237893', hcDark: Color.white, hcLight: '#292929' }, nls.localize('editorLineNumbers', '编辑器行号的颜色。'));

export const deprecatedEditorIndentGuides = registerColor('editorIndentGuide.background', editorWhitespaces, nls.localize('editorIndentGuides', '编辑器缩进参考线的颜色。'), false, nls.localize('deprecatedEditorIndentGuides', '“editorIndentGuide.background” 已弃用。请改用 “editorIndentGuide.background1”。'));
export const deprecatedEditorActiveIndentGuides = registerColor('editorIndentGuide.activeBackground', editorWhitespaces, nls.localize('editorActiveIndentGuide', '编辑器活动缩进参考线的颜色。'), false, nls.localize('deprecatedEditorActiveIndentGuide', '“editorIndentGuide.activeBackground” 已弃用。请改用 “editorIndentGuide.activeBackground1”。'));

export const editorIndentGuide1 = registerColor('editorIndentGuide.background1', deprecatedEditorIndentGuides, nls.localize('editorIndentGuides1', '编辑器缩进参考线 (1) 的颜色。'));
export const editorIndentGuide2 = registerColor('editorIndentGuide.background2', '#00000000', nls.localize('editorIndentGuides2', '编辑器缩进参考线 (2) 的颜色。'));
export const editorIndentGuide3 = registerColor('editorIndentGuide.background3', '#00000000', nls.localize('editorIndentGuides3', '编辑器缩进参考线 (3) 的颜色。'));
export const editorIndentGuide4 = registerColor('editorIndentGuide.background4', '#00000000', nls.localize('editorIndentGuides4', '编辑器缩进参考线 (4) 的颜色。'));
export const editorIndentGuide5 = registerColor('editorIndentGuide.background5', '#00000000', nls.localize('editorIndentGuides5', '编辑器缩进参考线 (5) 的颜色。'));
export const editorIndentGuide6 = registerColor('editorIndentGuide.background6', '#00000000', nls.localize('editorIndentGuides6', '编辑器缩进参考线 (6) 的颜色。'));

export const editorActiveIndentGuide1 = registerColor('editorIndentGuide.activeBackground1', deprecatedEditorActiveIndentGuides, nls.localize('editorActiveIndentGuide1', '编辑器活动缩进参考线 (1) 的颜色。'));
export const editorActiveIndentGuide2 = registerColor('editorIndentGuide.activeBackground2', '#00000000', nls.localize('editorActiveIndentGuide2', '编辑器活动缩进参考线 (2) 的颜色。'));
export const editorActiveIndentGuide3 = registerColor('editorIndentGuide.activeBackground3', '#00000000', nls.localize('editorActiveIndentGuide3', '编辑器活动缩进参考线 (3) 的颜色。'));
export const editorActiveIndentGuide4 = registerColor('editorIndentGuide.activeBackground4', '#00000000', nls.localize('editorActiveIndentGuide4', '编辑器活动缩进参考线 (4) 的颜色。'));
export const editorActiveIndentGuide5 = registerColor('editorIndentGuide.activeBackground5', '#00000000', nls.localize('editorActiveIndentGuide5', '编辑器活动缩进参考线 (5) 的颜色。'));
export const editorActiveIndentGuide6 = registerColor('editorIndentGuide.activeBackground6', '#00000000', nls.localize('editorActiveIndentGuide6', '编辑器活动缩进参考线 (6) 的颜色。'));

const deprecatedEditorActiveLineNumber = registerColor('editorActiveLineNumber.foreground', { dark: '#c6c6c6', light: '#0B216F', hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('editorActiveLineNumber', '编辑器活动行号的颜色'), false, nls.localize('deprecatedEditorActiveLineNumber', '"Id" 已被弃用，请改用 "editorLineNumber.activeForeground"。'));
export const editorActiveLineNumber = registerColor('editorLineNumber.activeForeground', deprecatedEditorActiveLineNumber, nls.localize('editorActiveLineNumber', '编辑器活动行号的颜色'));
export const editorDimmedLineNumber = registerColor('editorLineNumber.dimmedForeground', null, nls.localize('editorDimmedLineNumber', '将 editor.renderFinalNewline 设置为灰色时最终编辑器行的颜色。'));

export const editorRuler = registerColor('editorRuler.foreground', { dark: '#5A5A5A', light: Color.lightgrey, hcDark: Color.white, hcLight: '#292929' }, nls.localize('editorRuler', '编辑器标尺的颜色。'));

export const editorCodeLensForeground = registerColor('editorCodeLens.foreground', { dark: '#999999', light: '#919191', hcDark: '#999999', hcLight: '#292929' }, nls.localize('editorCodeLensForeground', '编辑器 CodeLens 的前景色'));

export const editorBracketMatchBackground = registerColor('editorBracketMatch.background', { dark: '#0064001a', light: '#0064001a', hcDark: '#0064001a', hcLight: '#0000' }, nls.localize('editorBracketMatchBackground', '匹配括号的背景色'));
export const editorBracketMatchBorder = registerColor('editorBracketMatch.border', { dark: '#888', light: '#B9B9B9', hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('editorBracketMatchBorder', '匹配括号外框的颜色'));
export const editorBracketMatchForeground = registerColor('editorBracketMatch.foreground', null, nls.localize('editorBracketMatchForeground', '匹配的括号的前景色'));

export const editorOverviewRulerBorder = registerColor('editorOverviewRuler.border', { dark: '#7f7f7f4d', light: '#7f7f7f4d', hcDark: '#7f7f7f4d', hcLight: '#666666' }, nls.localize('editorOverviewRulerBorder', '概览标尺边框的颜色。'));
export const editorOverviewRulerBackground = registerColor('editorOverviewRuler.background', null, nls.localize('editorOverviewRulerBackground', '编辑器概述标尺的背景色。'));

export const editorGutter = registerColor('editorGutter.background', editorBackground, nls.localize('editorGutter', '编辑器导航线的背景色。导航线包括边缘符号和行号。'));

export const editorUnnecessaryCodeBorder = registerColor('editorUnnecessaryCode.border', { dark: null, light: null, hcDark: Color.fromHex('#fff').transparent(0.8), hcLight: contrastBorder }, nls.localize('unnecessaryCodeBorder', '编辑器中不必要(未使用)的源代码的边框颜色。'));
export const editorUnnecessaryCodeOpacity = registerColor('editorUnnecessaryCode.opacity', { dark: Color.fromHex('#000a'), light: Color.fromHex('#0007'), hcDark: null, hcLight: null }, nls.localize('unnecessaryCodeOpacity', '非必须(未使用)代码的在编辑器中显示的不透明度。例如，"#000000c0" 将以 75% 的不透明度显示代码。对于高对比度主题，请使用 ”editorUnnecessaryCode.border“ 主题来为非必须代码添加下划线，以避免颜色淡化。'));

export const ghostTextBorder = registerColor('editorGhostText.border', { dark: null, light: null, hcDark: Color.fromHex('#fff').transparent(0.8), hcLight: Color.fromHex('#292929').transparent(0.8) }, nls.localize('editorGhostTextBorder', '编辑器中虚影文本的边框颜色。'));
export const ghostTextForeground = registerColor('editorGhostText.foreground', { dark: Color.fromHex('#ffffff56'), light: Color.fromHex('#0007'), hcDark: null, hcLight: null }, nls.localize('editorGhostTextForeground', '编辑器中虚影文本的前景色。'));
export const ghostTextBackground = registerColor('editorGhostText.background', null, nls.localize('editorGhostTextBackground', '编辑器中虚影文本的背景色。'));

const rulerRangeDefault = new Color(new RGBA(0, 122, 204, 0.6));
export const overviewRulerRangeHighlight = registerColor('editorOverviewRuler.rangeHighlightForeground', rulerRangeDefault, nls.localize('overviewRulerRangeHighlight', '用于突出显示范围的概述标尺标记颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);
export const overviewRulerError = registerColor('editorOverviewRuler.errorForeground', { dark: new Color(new RGBA(255, 18, 18, 0.7)), light: new Color(new RGBA(255, 18, 18, 0.7)), hcDark: new Color(new RGBA(255, 50, 50, 1)), hcLight: '#B5200D' }, nls.localize('overviewRuleError', '概览标尺中错误标记的颜色。'));
export const overviewRulerWarning = registerColor('editorOverviewRuler.warningForeground', { dark: editorWarningForeground, light: editorWarningForeground, hcDark: editorWarningBorder, hcLight: editorWarningBorder }, nls.localize('overviewRuleWarning', '概览标尺中警告标记的颜色。'));
export const overviewRulerInfo = registerColor('editorOverviewRuler.infoForeground', { dark: editorInfoForeground, light: editorInfoForeground, hcDark: editorInfoBorder, hcLight: editorInfoBorder }, nls.localize('overviewRuleInfo', '概览标尺中信息标记的颜色。'));

export const editorBracketHighlightingForeground1 = registerColor('editorBracketHighlight.foreground1', { dark: '#FFD700', light: '#0431FAFF', hcDark: '#FFD700', hcLight: '#0431FAFF' }, nls.localize('editorBracketHighlightForeground1', '括号的前景色(1)。需要启用括号对着色。'));
export const editorBracketHighlightingForeground2 = registerColor('editorBracketHighlight.foreground2', { dark: '#DA70D6', light: '#319331FF', hcDark: '#DA70D6', hcLight: '#319331FF' }, nls.localize('editorBracketHighlightForeground2', '括号的前景色(2)。需要启用括号对着色。'));
export const editorBracketHighlightingForeground3 = registerColor('editorBracketHighlight.foreground3', { dark: '#179FFF', light: '#7B3814FF', hcDark: '#87CEFA', hcLight: '#7B3814FF' }, nls.localize('editorBracketHighlightForeground3', '括号的前景色(3)。需要启用括号对着色。'));
export const editorBracketHighlightingForeground4 = registerColor('editorBracketHighlight.foreground4', '#00000000', nls.localize('editorBracketHighlightForeground4', '括号的前景色(4)。需要启用括号对着色。'));
export const editorBracketHighlightingForeground5 = registerColor('editorBracketHighlight.foreground5', '#00000000', nls.localize('editorBracketHighlightForeground5', '括号的前景色(5)。需要启用括号对着色。'));
export const editorBracketHighlightingForeground6 = registerColor('editorBracketHighlight.foreground6', '#00000000', nls.localize('editorBracketHighlightForeground6', '括号的前景色(6)。需要启用括号对着色。'));

export const editorBracketHighlightingUnexpectedBracketForeground = registerColor('editorBracketHighlight.unexpectedBracket.foreground', { dark: new Color(new RGBA(255, 18, 18, 0.8)), light: new Color(new RGBA(255, 18, 18, 0.8)), hcDark: new Color(new RGBA(255, 50, 50, 1)), hcLight: '#B5200D' }, nls.localize('editorBracketHighlightUnexpectedBracketForeground', '方括号出现意外的前景色。'));

export const editorBracketPairGuideBackground1 = registerColor('editorBracketPairGuide.background1', '#00000000', nls.localize('editorBracketPairGuide.background1', '非活动括号对指南的背景色(1)。需要启用括号对指南。'));
export const editorBracketPairGuideBackground2 = registerColor('editorBracketPairGuide.background2', '#00000000', nls.localize('editorBracketPairGuide.background2', '非活动括号对指南的背景色(2)。需要启用括号对指南。'));
export const editorBracketPairGuideBackground3 = registerColor('editorBracketPairGuide.background3', '#00000000', nls.localize('editorBracketPairGuide.background3', '非活动括号对指南的背景色(3)。需要启用括号对指南。'));
export const editorBracketPairGuideBackground4 = registerColor('editorBracketPairGuide.background4', '#00000000', nls.localize('editorBracketPairGuide.background4', '非活动括号对指南的背景色(4)。需要启用括号对指南。'));
export const editorBracketPairGuideBackground5 = registerColor('editorBracketPairGuide.background5', '#00000000', nls.localize('editorBracketPairGuide.background5', '非活动括号对指南的背景色(5)。需要启用括号对指南。'));
export const editorBracketPairGuideBackground6 = registerColor('editorBracketPairGuide.background6', '#00000000', nls.localize('editorBracketPairGuide.background6', '非活动括号对指南的背景色(6)。需要启用括号对指南。'));

export const editorBracketPairGuideActiveBackground1 = registerColor('editorBracketPairGuide.activeBackground1', '#00000000', nls.localize('editorBracketPairGuide.activeBackground1', '活动括号对指南的背景色(1)。需要启用括号对指南。'));
export const editorBracketPairGuideActiveBackground2 = registerColor('editorBracketPairGuide.activeBackground2', '#00000000', nls.localize('editorBracketPairGuide.activeBackground2', '活动括号对指南的背景色(2)。需要启用括号对指南。'));
export const editorBracketPairGuideActiveBackground3 = registerColor('editorBracketPairGuide.activeBackground3', '#00000000', nls.localize('editorBracketPairGuide.activeBackground3', '活动括号对指南的背景色(3)。需要启用括号对指南。'));
export const editorBracketPairGuideActiveBackground4 = registerColor('editorBracketPairGuide.activeBackground4', '#00000000', nls.localize('editorBracketPairGuide.activeBackground4', '活动括号对指南的背景色(4)。需要启用括号对指南。'));
export const editorBracketPairGuideActiveBackground5 = registerColor('editorBracketPairGuide.activeBackground5', '#00000000', nls.localize('editorBracketPairGuide.activeBackground5', '活动括号对指南的背景色(5)。需要启用括号对指南。'));
export const editorBracketPairGuideActiveBackground6 = registerColor('editorBracketPairGuide.activeBackground6', '#00000000', nls.localize('editorBracketPairGuide.activeBackground6', '活动括号对指南的背景色(6)。需要启用括号对指南。'));

export const editorUnicodeHighlightBorder = registerColor('editorUnicodeHighlight.border', editorWarningForeground, nls.localize('editorUnicodeHighlight.border', '用于突出显示 Unicode 字符的边框颜色。'));
export const editorUnicodeHighlightBackground = registerColor('editorUnicodeHighlight.background', editorWarningBackground, nls.localize('editorUnicodeHighlight.background', '用于突出显示 Unicode 字符的背景颜色。'));


// Diff / change indicator colors (editor gutter, minimap gutter, overview ruler)

export const editorGutterModifiedBackground = registerColor('editorGutter.modifiedBackground', {
	dark: '#1B81A8', light: '#2090D3', hcDark: '#1B81A8', hcLight: '#2090D3'
}, nls.localize('editorGutterModifiedBackground', "Editor gutter background color for lines that are modified."));

registerColor('editorGutter.modifiedSecondaryBackground',
	{ dark: darken(editorGutterModifiedBackground, 0.5), light: lighten(editorGutterModifiedBackground, 0.7), hcDark: '#1B81A8', hcLight: '#2090D3' },
	nls.localize('editorGutterModifiedSecondaryBackground', "Editor gutter secondary background color for lines that are modified."));

export const editorGutterAddedBackground = registerColor('editorGutter.addedBackground', {
	dark: '#487E02', light: '#48985D', hcDark: '#487E02', hcLight: '#48985D'
}, nls.localize('editorGutterAddedBackground', "Editor gutter background color for lines that are added."));

registerColor('editorGutter.addedSecondaryBackground',
	{ dark: darken(editorGutterAddedBackground, 0.5), light: lighten(editorGutterAddedBackground, 0.7), hcDark: '#487E02', hcLight: '#48985D' },
	nls.localize('editorGutterAddedSecondaryBackground', "Editor gutter secondary background color for lines that are added."));

export const editorGutterDeletedBackground = registerColor('editorGutter.deletedBackground',
	editorErrorForeground, nls.localize('editorGutterDeletedBackground', "Editor gutter background color for lines that are deleted."));

registerColor('editorGutter.deletedSecondaryBackground',
	{ dark: darken(editorGutterDeletedBackground, 0.4), light: lighten(editorGutterDeletedBackground, 0.3), hcDark: '#F48771', hcLight: '#B5200D' },
	nls.localize('editorGutterDeletedSecondaryBackground', "Editor gutter secondary background color for lines that are deleted."));

export const minimapGutterModifiedBackground = registerColor('minimapGutter.modifiedBackground',
	editorGutterModifiedBackground, nls.localize('minimapGutterModifiedBackground', "Minimap gutter background color for lines that are modified."));

export const minimapGutterAddedBackground = registerColor('minimapGutter.addedBackground',
	editorGutterAddedBackground, nls.localize('minimapGutterAddedBackground', "Minimap gutter background color for lines that are added."));

export const minimapGutterDeletedBackground = registerColor('minimapGutter.deletedBackground',
	editorGutterDeletedBackground, nls.localize('minimapGutterDeletedBackground', "Minimap gutter background color for lines that are deleted."));

export const overviewRulerModifiedForeground = registerColor('editorOverviewRuler.modifiedForeground',
	transparent(editorGutterModifiedBackground, 0.6), nls.localize('overviewRulerModifiedForeground', 'Overview ruler marker color for modified content.'));

export const overviewRulerAddedForeground = registerColor('editorOverviewRuler.addedForeground',
	transparent(editorGutterAddedBackground, 0.6), nls.localize('overviewRulerAddedForeground', 'Overview ruler marker color for added content.'));

export const overviewRulerDeletedForeground = registerColor('editorOverviewRuler.deletedForeground',
	transparent(editorGutterDeletedBackground, 0.6), nls.localize('overviewRulerDeletedForeground', 'Overview ruler marker color for deleted content.'));


// contains all color rules that used to defined in editor/browser/widget/editor.css
registerThemingParticipant((theme, collector) => {
	const background = theme.getColor(editorBackground);
	const lineHighlight = theme.getColor(editorLineHighlight);
	const imeBackground = (lineHighlight && !lineHighlight.isTransparent() ? lineHighlight : background);
	if (imeBackground) {
		collector.addRule(`.monaco-editor .inputarea.ime-input { background-color: ${imeBackground}; }`);
	}
});
