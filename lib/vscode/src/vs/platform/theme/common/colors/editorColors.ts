/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color, RGBA } from '../../../../base/common/color.js';
import { registerColor, transparent, lessProminent, darken, lighten } from '../colorUtils.js';

// Import the colors we need
import { foreground, contrastBorder, activeContrastBorder } from './baseColors.js';
import { scrollbarShadow, badgeBackground } from './miscColors.js';


// ----- editor

export const editorBackground = registerColor('editor.background',
	{ light: '#ffffff', dark: '#1E1E1E', hcDark: Color.black, hcLight: Color.white },
	nls.localize('editorBackground', "编辑器背景色。"));

export const editorForeground = registerColor('editor.foreground',
	{ light: '#333333', dark: '#BBBBBB', hcDark: Color.white, hcLight: foreground },
	nls.localize('editorForeground', "编辑器默认前景色。"));


export const editorStickyScrollBackground = registerColor('editorStickyScroll.background',
	editorBackground,
	nls.localize('editorStickyScrollBackground', "编辑器中粘滞滚动的背景色"));

export const editorStickyScrollGutterBackground = registerColor('editorStickyScrollGutter.background',
	editorBackground,
	nls.localize('editorStickyScrollGutterBackground', "编辑器中粘滞滚动的装订线部件的背景色"));

export const editorStickyScrollHoverBackground = registerColor('editorStickyScrollHover.background',
	{ dark: '#2A2D2E', light: '#F0F0F0', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
	nls.localize('editorStickyScrollHoverBackground', "在编辑器中悬停时粘滞滚动的背景色"));

export const editorStickyScrollBorder = registerColor('editorStickyScroll.border',
	{ dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('editorStickyScrollBorder', "编辑器中粘滞滚动的边框颜色"));

export const editorStickyScrollShadow = registerColor('editorStickyScroll.shadow',
	scrollbarShadow,
	nls.localize('editorStickyScrollShadow', " 编辑器中粘滞滚动的阴影颜色"));


export const editorWidgetBackground = registerColor('editorWidget.background',
	{ dark: '#252526', light: '#F3F3F3', hcDark: '#0C141F', hcLight: Color.white },
	nls.localize('editorWidgetBackground', '编辑器组件(如查找/替换)背景颜色。'));

export const editorWidgetForeground = registerColor('editorWidget.foreground',
	foreground,
	nls.localize('editorWidgetForeground', '编辑器小部件的前景色，如查找/替换。'));

export const editorWidgetBorder = registerColor('editorWidget.border',
	{ dark: transparent(editorWidgetForeground, 0.2), light: transparent(editorWidgetForeground, 0.2), hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('editorWidgetBorder', '编辑器小部件的边框颜色。此颜色仅在小部件有边框且不被小部件重写时适用。'));

export const editorWidgetResizeBorder = registerColor('editorWidget.resizeBorder',
	null,
	nls.localize('editorWidgetResizeBorder', "编辑器小部件大小调整条的边框颜色。此颜色仅在小部件有调整边框且不被小部件颜色覆盖时使用。"));


export const editorErrorBackground = registerColor('editorError.background',
	null,
	nls.localize('editorError.background', '编辑器中错误文本的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const editorErrorForeground = registerColor('editorError.foreground',
	{ dark: '#F14C4C', light: '#E51400', hcDark: '#F48771', hcLight: '#B5200D' },
	nls.localize('editorError.foreground', '编辑器中错误波浪线的前景色。'));

export const editorErrorBorder = registerColor('editorError.border',
	{ dark: null, light: null, hcDark: Color.fromHex('#E47777').transparent(0.8), hcLight: '#B5200D' },
	nls.localize('errorBorder', '如果设置，编辑器中错误的双下划线颜色。'));


export const editorWarningBackground = registerColor('editorWarning.background',
	null,
	nls.localize('editorWarning.background', '编辑器中警告文本的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const editorWarningForeground = registerColor('editorWarning.foreground',
	{ dark: '#CCA700', light: '#BF8803', hcDark: '#FFD370', hcLight: '#895503' },
	nls.localize('editorWarning.foreground', '编辑器中警告波浪线的前景色。'));

export const editorWarningBorder = registerColor('editorWarning.border',
	{ dark: null, light: null, hcDark: Color.fromHex('#FFCC00').transparent(0.8), hcLight: Color.fromHex('#FFCC00').transparent(0.8) },
	nls.localize('warningBorder', '如果设置，编辑器中警告的双下划线颜色。'));


export const editorInfoBackground = registerColor('editorInfo.background',
	null,
	nls.localize('editorInfo.background', '编辑器中信息文本的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const editorInfoForeground = registerColor('editorInfo.foreground',
	{ dark: '#59a4f9', light: '#0063d3', hcDark: '#59a4f9', hcLight: '#0063d3' },
	nls.localize('editorInfo.foreground', '编辑器中信息波浪线的前景色。'));

export const editorInfoBorder = registerColor('editorInfo.border',
	{ dark: null, light: null, hcDark: Color.fromHex('#59a4f9').transparent(0.8), hcLight: '#292929' },
	nls.localize('infoBorder', '如果设置，编辑器中信息的双下划线颜色。'));


export const editorHintForeground = registerColor('editorHint.foreground',
	{ dark: Color.fromHex('#eeeeee').transparent(0.7), light: '#6c6c6c', hcDark: null, hcLight: null },
	nls.localize('editorHint.foreground', '编辑器中提示波浪线的前景色。'));

export const editorHintBorder = registerColor('editorHint.border',
	{ dark: null, light: null, hcDark: Color.fromHex('#eeeeee').transparent(0.8), hcLight: '#292929' },
	nls.localize('hintBorder', '如果设置，编辑器中提示的双下划线颜色。'));


export const editorActiveLinkForeground = registerColor('editorLink.activeForeground',
	{ dark: '#4E94CE', light: Color.blue, hcDark: Color.cyan, hcLight: '#292929' },
	nls.localize('activeLinkForeground', '活动链接颜色。'));


// ----- editor selection

export const editorSelectionBackground = registerColor('editor.selectionBackground',
	{ light: '#ADD6FF', dark: '#264F78', hcDark: '#f3f518', hcLight: '#0F4A85' },
	nls.localize('editorSelectionBackground', "编辑器所选内容的颜色。"));

export const editorSelectionForeground = registerColor('editor.selectionForeground',
	{ light: null, dark: null, hcDark: '#000000', hcLight: Color.white },
	nls.localize('editorSelectionForeground', "用以彰显高对比度的所选文本的颜色。"));

export const editorInactiveSelection = registerColor('editor.inactiveSelectionBackground',
	{ light: transparent(editorSelectionBackground, 0.5), dark: transparent(editorSelectionBackground, 0.5), hcDark: transparent(editorSelectionBackground, 0.7), hcLight: transparent(editorSelectionBackground, 0.5) },
	nls.localize('editorInactiveSelection', "非活动编辑器中所选内容的颜色，颜色必须透明，以免隐藏下面的装饰效果。"), true);

export const editorSelectionHighlight = registerColor('editor.selectionHighlightBackground',
	{ light: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), dark: lessProminent(editorSelectionBackground, editorBackground, 0.3, 0.6), hcDark: null, hcLight: null },
	nls.localize('editorSelectionHighlight', '具有与所选项相关内容的区域的颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const editorSelectionHighlightBorder = registerColor('editor.selectionHighlightBorder',
	{ light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('editorSelectionHighlightBorder', "与所选项内容相同的区域的边框颜色。"));

export const editorCompositionBorder = registerColor('editor.compositionBorder',
	{ light: '#000000', dark: '#ffffff', hcLight: '#000000', hcDark: '#ffffff' },
	nls.localize('editorCompositionBorder', "输入法组合的边框颜色。"));


// ----- editor find

export const editorFindMatch = registerColor('editor.findMatchBackground',
	{ light: '#A8AC94', dark: '#515C6A', hcDark: null, hcLight: null },
	nls.localize('editorFindMatch', "当前搜索匹配项的颜色。"));

export const editorFindMatchForeground = registerColor('editor.findMatchForeground',
	null,
	nls.localize('editorFindMatchForeground', "当前搜索匹配项的文本颜色。"));

export const editorFindMatchHighlight = registerColor('editor.findMatchHighlightBackground',
	{ light: '#EA5C0055', dark: '#EA5C0055', hcDark: null, hcLight: null },
	nls.localize('findMatchHighlight', "其他搜索匹配项的颜色。颜色必须透明，以免隐藏下面的修饰效果。"), true);

export const editorFindMatchHighlightForeground = registerColor('editor.findMatchHighlightForeground',
	null,
	nls.localize('findMatchHighlightForeground', "其他搜索匹配项的前景色。"), true);

export const editorFindRangeHighlight = registerColor('editor.findRangeHighlightBackground',
	{ dark: '#3a3d4166', light: '#b4b4b44d', hcDark: null, hcLight: null },
	nls.localize('findRangeHighlight', "限制搜索范围的颜色。颜色必须透明，以免隐藏下面的修饰效果。"), true);

export const editorFindMatchBorder = registerColor('editor.findMatchBorder',
	{ light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('editorFindMatchBorder', "当前搜索匹配项的边框颜色。"));

export const editorFindMatchHighlightBorder = registerColor('editor.findMatchHighlightBorder',
	{ light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('findMatchHighlightBorder', "其他搜索匹配项的边框颜色。"));

export const editorFindRangeHighlightBorder = registerColor('editor.findRangeHighlightBorder',
	{ dark: null, light: null, hcDark: transparent(activeContrastBorder, 0.4), hcLight: transparent(activeContrastBorder, 0.4) },
	nls.localize('findRangeHighlightBorder', "限制搜索的范围的边框颜色。颜色必须透明，以免隐藏下面的修饰效果。"), true);


// ----- editor hover

export const editorHoverHighlight = registerColor('editor.hoverHighlightBackground',
	{ light: '#ADD6FF26', dark: '#264f7840', hcDark: '#ADD6FF26', hcLight: null },
	nls.localize('hoverHighlight', '在下面突出显示悬停的字词。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const editorHoverBackground = registerColor('editorHoverWidget.background',
	editorWidgetBackground,
	nls.localize('hoverBackground', '编辑器悬停提示的背景颜色。'));

export const editorHoverForeground = registerColor('editorHoverWidget.foreground',
	editorWidgetForeground,
	nls.localize('hoverForeground', '编辑器悬停的前景颜色。'));

export const editorHoverBorder = registerColor('editorHoverWidget.border',
	editorWidgetBorder,
	nls.localize('hoverBorder', '光标悬停时编辑器的边框颜色。'));

export const editorHoverStatusBarBackground = registerColor('editorHoverWidget.statusBarBackground',
	{ dark: lighten(editorHoverBackground, 0.2), light: darken(editorHoverBackground, 0.05), hcDark: editorWidgetBackground, hcLight: editorWidgetBackground },
	nls.localize('statusBarBackground', "编辑器悬停状态栏的背景色。"));


// ----- editor inlay hint

export const editorInlayHintForeground = registerColor('editorInlayHint.foreground',
	{ dark: '#969696', light: '#969696', hcDark: Color.white, hcLight: Color.black },
	nls.localize('editorInlayHintForeground', '内联提示的前景色'));

export const editorInlayHintBackground = registerColor('editorInlayHint.background',
	{ dark: transparent(badgeBackground, .10), light: transparent(badgeBackground, .10), hcDark: transparent(Color.white, .10), hcLight: transparent(badgeBackground, .10) },
	nls.localize('editorInlayHintBackground', '内联提示的背景色'));

export const editorInlayHintTypeForeground = registerColor('editorInlayHint.typeForeground',
	editorInlayHintForeground,
	nls.localize('editorInlayHintForegroundTypes', '类型内联提示的前景色'));

export const editorInlayHintTypeBackground = registerColor('editorInlayHint.typeBackground',
	editorInlayHintBackground,
	nls.localize('editorInlayHintBackgroundTypes', '类型内联提示的背景色'));

export const editorInlayHintParameterForeground = registerColor('editorInlayHint.parameterForeground',
	editorInlayHintForeground,
	nls.localize('editorInlayHintForegroundParameter', '参数内联提示的前景色'));

export const editorInlayHintParameterBackground = registerColor('editorInlayHint.parameterBackground',
	editorInlayHintBackground,
	nls.localize('editorInlayHintBackgroundParameter', '参数内联提示的背景色'));


// ----- editor lightbulb

export const editorLightBulbForeground = registerColor('editorLightBulb.foreground',
	{ dark: '#FFCC00', light: '#DDB100', hcDark: '#FFCC00', hcLight: '#007ACC' },
	nls.localize('editorLightBulbForeground', "用于灯泡操作图标的颜色。"));

export const editorLightBulbAutoFixForeground = registerColor('editorLightBulbAutoFix.foreground',
	{ dark: '#75BEFF', light: '#007ACC', hcDark: '#75BEFF', hcLight: '#007ACC' },
	nls.localize('editorLightBulbAutoFixForeground', "用于灯泡自动修复操作图标的颜色。"));

export const editorLightBulbAiForeground = registerColor('editorLightBulbAi.foreground',
	editorLightBulbForeground,
	nls.localize('editorLightBulbAiForeground', "用于灯泡 AI 图标的颜色。"));


// ----- editor snippet

export const snippetTabstopHighlightBackground = registerColor('editor.snippetTabstopHighlightBackground',
	{ dark: new Color(new RGBA(124, 124, 124, 0.3)), light: new Color(new RGBA(10, 50, 100, 0.2)), hcDark: new Color(new RGBA(124, 124, 124, 0.3)), hcLight: new Color(new RGBA(10, 50, 100, 0.2)) },
	nls.localize('snippetTabstopHighlightBackground', "代码片段 Tab 位的高亮背景色。"));

export const snippetTabstopHighlightBorder = registerColor('editor.snippetTabstopHighlightBorder',
	null,
	nls.localize('snippetTabstopHighlightBorder', "代码片段 Tab 位的高亮边框颜色。"));

export const snippetFinalTabstopHighlightBackground = registerColor('editor.snippetFinalTabstopHighlightBackground',
	null,
	nls.localize('snippetFinalTabstopHighlightBackground', "代码片段中最后的 Tab 位的高亮背景色。"));

export const snippetFinalTabstopHighlightBorder = registerColor('editor.snippetFinalTabstopHighlightBorder',
	{ dark: '#525252', light: new Color(new RGBA(10, 50, 100, 0.5)), hcDark: '#525252', hcLight: '#292929' },
	nls.localize('snippetFinalTabstopHighlightBorder', "代码片段中最后的制表位的高亮边框颜色。"));


// ----- diff editor

export const defaultInsertColor = new Color(new RGBA(155, 185, 85, .2));
export const defaultRemoveColor = new Color(new RGBA(255, 0, 0, .2));

export const diffInserted = registerColor('diffEditor.insertedTextBackground',
	{ dark: '#9ccc2c33', light: '#9ccc2c40', hcDark: null, hcLight: null },
	nls.localize('diffEditorInserted', '已插入的文本的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const diffRemoved = registerColor('diffEditor.removedTextBackground',
	{ dark: '#ff000033', light: '#ff000033', hcDark: null, hcLight: null },
	nls.localize('diffEditorRemoved', '已删除的文本的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);


export const diffInsertedLine = registerColor('diffEditor.insertedLineBackground',
	{ dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
	nls.localize('diffEditorInsertedLines', '已插入的行的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const diffRemovedLine = registerColor('diffEditor.removedLineBackground',
	{ dark: defaultRemoveColor, light: defaultRemoveColor, hcDark: null, hcLight: null },
	nls.localize('diffEditorRemovedLines', '已删除的行的背景色。颜色必须透明，以免隐藏下面的修饰效果。'), true);


export const diffInsertedLineGutter = registerColor('diffEditorGutter.insertedLineBackground',
	null,
	nls.localize('diffEditorInsertedLineGutter', '插入行的边距的背景色。'));

export const diffRemovedLineGutter = registerColor('diffEditorGutter.removedLineBackground',
	null,
	nls.localize('diffEditorRemovedLineGutter', '删除行的边距的背景色。'));


export const diffOverviewRulerInserted = registerColor('diffEditorOverview.insertedForeground',
	null,
	nls.localize('diffEditorOverviewInserted', '插入内容的差异概述标尺前景。'));

export const diffOverviewRulerRemoved = registerColor('diffEditorOverview.removedForeground',
	null,
	nls.localize('diffEditorOverviewRemoved', '删除内容的差异概述标尺前景。'));


export const diffInsertedOutline = registerColor('diffEditor.insertedTextBorder',
	{ dark: null, light: null, hcDark: '#33ff2eff', hcLight: '#374E06' },
	nls.localize('diffEditorInsertedOutline', '插入的文本的轮廓颜色。'));

export const diffRemovedOutline = registerColor('diffEditor.removedTextBorder',
	{ dark: null, light: null, hcDark: '#FF008F', hcLight: '#AD0707' },
	nls.localize('diffEditorRemovedOutline', '被删除文本的轮廓颜色。'));


export const diffBorder = registerColor('diffEditor.border',
	{ dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('diffEditorBorder', '两个文本编辑器之间的边框颜色。'));

export const diffDiagonalFill = registerColor('diffEditor.diagonalFill',
	{ dark: '#cccccc33', light: '#22222233', hcDark: null, hcLight: null },
	nls.localize('diffDiagonalFill', "差异编辑器的对角线填充颜色。对角线填充用于并排差异视图。"));


export const diffUnchangedRegionBackground = registerColor('diffEditor.unchangedRegionBackground',
	'sideBar.background',
	nls.localize('diffEditor.unchangedRegionBackground', "差异编辑器中未更改块的背景色。"));

export const diffUnchangedRegionForeground = registerColor('diffEditor.unchangedRegionForeground',
	'foreground',
	nls.localize('diffEditor.unchangedRegionForeground', "差异编辑器中未更改块的前景色。"));

export const diffUnchangedTextBackground = registerColor('diffEditor.unchangedCodeBackground',
	{ dark: '#74747429', light: '#b8b8b829', hcDark: null, hcLight: null },
	nls.localize('diffEditor.unchangedCodeBackground', "差异编辑器中未更改代码的背景色。"));


// ----- widget

export const widgetShadow = registerColor('widget.shadow',
	{ dark: transparent(Color.black, .36), light: transparent(Color.black, .16), hcDark: null, hcLight: null },
	nls.localize('widgetShadow', '编辑器内小组件(如查找/替换)的阴影颜色。'));

export const widgetBorder = registerColor('widget.border',
	{ dark: null, light: null, hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('widgetBorder', '编辑器内小组件(如查找/替换)的边框颜色。'));


// ----- toolbar

export const toolbarHoverBackground = registerColor('toolbar.hoverBackground',
	{ dark: '#5a5d5e50', light: '#b8b8b850', hcDark: null, hcLight: null },
	nls.localize('toolbarHoverBackground', "使用鼠标悬停在操作上时显示工具栏背景"));

export const toolbarHoverOutline = registerColor('toolbar.hoverOutline',
	{ dark: null, light: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('toolbarHoverOutline', "使用鼠标悬停在操作上时显示工具栏轮廓"));

export const toolbarActiveBackground = registerColor('toolbar.activeBackground',
	{ dark: lighten(toolbarHoverBackground, 0.1), light: darken(toolbarHoverBackground, 0.1), hcDark: null, hcLight: null },
	nls.localize('toolbarActiveBackground', "将鼠标悬停在操作上时的工具栏背景"));


// ----- breadcumbs

export const breadcrumbsForeground = registerColor('breadcrumb.foreground',
	transparent(foreground, 0.8),
	nls.localize('breadcrumbsFocusForeground', "焦点导航路径的颜色"));

export const breadcrumbsBackground = registerColor('breadcrumb.background',
	editorBackground,
	nls.localize('breadcrumbsBackground', "导航路径项的背景色。"));

export const breadcrumbsFocusForeground = registerColor('breadcrumb.focusForeground',
	{ light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hcDark: lighten(foreground, 0.1), hcLight: lighten(foreground, 0.1) },
	nls.localize('breadcrumbsFocusForeground', "焦点导航路径的颜色"));

export const breadcrumbsActiveSelectionForeground = registerColor('breadcrumb.activeSelectionForeground',
	{ light: darken(foreground, 0.2), dark: lighten(foreground, 0.1), hcDark: lighten(foreground, 0.1), hcLight: lighten(foreground, 0.1) },
	nls.localize('breadcrumbsSelectedForeground', "已选导航路径项的颜色。"));

export const breadcrumbsPickerBackground = registerColor('breadcrumbPicker.background',
	editorWidgetBackground,
	nls.localize('breadcrumbsSelectedBackground', "导航路径项选择器的背景色。"));


// ----- merge

const headerTransparency = 0.5;
const currentBaseColor = Color.fromHex('#40C8AE').transparent(headerTransparency);
const incomingBaseColor = Color.fromHex('#40A6FF').transparent(headerTransparency);
const commonBaseColor = Color.fromHex('#606060').transparent(0.4);
const contentTransparency = 0.4;
const rulerTransparency = 1;

export const mergeCurrentHeaderBackground = registerColor('merge.currentHeaderBackground',
	{ dark: currentBaseColor, light: currentBaseColor, hcDark: null, hcLight: null },
	nls.localize('mergeCurrentHeaderBackground', '当前标题背景的内联合并冲突。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeCurrentContentBackground = registerColor('merge.currentContentBackground',
	transparent(mergeCurrentHeaderBackground, contentTransparency),
	nls.localize('mergeCurrentContentBackground', '内联合并冲突中的当前内容背景。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeIncomingHeaderBackground = registerColor('merge.incomingHeaderBackground',
	{ dark: incomingBaseColor, light: incomingBaseColor, hcDark: null, hcLight: null },
	nls.localize('mergeIncomingHeaderBackground', '内联合并冲突中的传入标题背景。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeIncomingContentBackground = registerColor('merge.incomingContentBackground',
	transparent(mergeIncomingHeaderBackground, contentTransparency),
	nls.localize('mergeIncomingContentBackground', '内联合并冲突中的传入内容背景。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeCommonHeaderBackground = registerColor('merge.commonHeaderBackground',
	{ dark: commonBaseColor, light: commonBaseColor, hcDark: null, hcLight: null },
	nls.localize('mergeCommonHeaderBackground', '内联合并冲突中的常见祖先标头背景。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeCommonContentBackground = registerColor('merge.commonContentBackground',
	transparent(mergeCommonHeaderBackground, contentTransparency),
	nls.localize('mergeCommonContentBackground', '内联合并冲突中的常见祖先内容背景。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const mergeBorder = registerColor('merge.border',
	{ dark: null, light: null, hcDark: '#C3DF6F', hcLight: '#007ACC' },
	nls.localize('mergeBorder', '内联合并冲突中标头和分割线的边框颜色。'));


export const overviewRulerCurrentContentForeground = registerColor('editorOverviewRuler.currentContentForeground',
	{ dark: transparent(mergeCurrentHeaderBackground, rulerTransparency), light: transparent(mergeCurrentHeaderBackground, rulerTransparency), hcDark: mergeBorder, hcLight: mergeBorder },
	nls.localize('overviewRulerCurrentContentForeground', '内联合并冲突中当前版本区域的概览标尺前景色。'));

export const overviewRulerIncomingContentForeground = registerColor('editorOverviewRuler.incomingContentForeground',
	{ dark: transparent(mergeIncomingHeaderBackground, rulerTransparency), light: transparent(mergeIncomingHeaderBackground, rulerTransparency), hcDark: mergeBorder, hcLight: mergeBorder },
	nls.localize('overviewRulerIncomingContentForeground', '内联合并冲突中传入的版本区域的概览标尺前景色。'));

export const overviewRulerCommonContentForeground = registerColor('editorOverviewRuler.commonContentForeground',
	{ dark: transparent(mergeCommonHeaderBackground, rulerTransparency), light: transparent(mergeCommonHeaderBackground, rulerTransparency), hcDark: mergeBorder, hcLight: mergeBorder },
	nls.localize('overviewRulerCommonContentForeground', '内联合并冲突中共同祖先区域的概览标尺前景色。'));

export const overviewRulerFindMatchForeground = registerColor('editorOverviewRuler.findMatchForeground',
	{ dark: '#d186167e', light: '#d186167e', hcDark: '#AB5A00', hcLight: '#AB5A00' },
	nls.localize('overviewRulerFindMatchForeground', '用于查找匹配项的概述标尺标记颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);

export const overviewRulerSelectionHighlightForeground = registerColor('editorOverviewRuler.selectionHighlightForeground',
	'#A0A0A0CC',
	nls.localize('overviewRulerSelectionHighlightForeground', '用于突出显示所选内容的概述标尺标记颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);


// ----- problems

export const problemsErrorIconForeground = registerColor('problemsErrorIcon.foreground',
	editorErrorForeground,
	nls.localize('problemsErrorIconForeground', "用于问题错误图标的颜色。"));

export const problemsWarningIconForeground = registerColor('problemsWarningIcon.foreground',
	editorWarningForeground,
	nls.localize('problemsWarningIconForeground', "用于问题警告图标的颜色。"));

export const problemsInfoIconForeground = registerColor('problemsInfoIcon.foreground',
	editorInfoForeground,
	nls.localize('problemsInfoIconForeground', "用于问题信息图标的颜色。"));
