/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { Color } from '../../../../base/common/color.js';
import { registerColor, darken, lighten, transparent, ifDefinedThenElse } from '../colorUtils.js';

// Import the colors we need
import { foreground, contrastBorder, activeContrastBorder, focusBorder, iconForeground } from './baseColors.js';
import { editorWidgetBackground, editorFindMatchHighlightBorder, editorFindMatchHighlight, widgetShadow, editorWidgetForeground } from './editorColors.js';


export const listFocusBackground = registerColor('list.focusBackground',
	null,
	nls.localize('listFocusBackground', "焦点项在列表或树活动时的背景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listFocusForeground = registerColor('list.focusForeground',
	null,
	nls.localize('listFocusForeground', "焦点项在列表或树活动时的前景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listFocusOutline = registerColor('list.focusOutline',
	{ dark: focusBorder, light: focusBorder, hcDark: activeContrastBorder, hcLight: activeContrastBorder },
	nls.localize('listFocusOutline', "列表/树活动时，焦点项目的列表/树边框色。活动的列表/树具有键盘焦点，非活动的没有。"));

export const listFocusAndSelectionOutline = registerColor('list.focusAndSelectionOutline',
	null,
	nls.localize('listFocusAndSelectionOutline', "当列表/树处于活动状态且已选择时，重点项的列表/树边框颜色。活动的列表/树具有键盘焦点，但非活动的则没有。"));

export const listActiveSelectionBackground = registerColor('list.activeSelectionBackground',
	{ dark: '#04395E', light: '#0060C0', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
	nls.localize('listActiveSelectionBackground', "已选项在列表或树活动时的背景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listActiveSelectionForeground = registerColor('list.activeSelectionForeground',
	{ dark: Color.white, light: Color.white, hcDark: null, hcLight: null },
	nls.localize('listActiveSelectionForeground', "已选项在列表或树活动时的前景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listActiveSelectionIconForeground = registerColor('list.activeSelectionIconForeground',
	null,
	nls.localize('listActiveSelectionIconForeground', "已选项在列表/树活动时的列表/树图标前景颜色。活动的列表/树具有键盘焦点，非活动的则没有。"));

export const listInactiveSelectionBackground = registerColor('list.inactiveSelectionBackground',
	{ dark: '#37373D', light: '#E4E6F1', hcDark: null, hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
	nls.localize('listInactiveSelectionBackground', "已选项在列表或树非活动时的背景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listInactiveSelectionForeground = registerColor('list.inactiveSelectionForeground',
	null,
	nls.localize('listInactiveSelectionForeground', "已选项在列表或树非活动时的前景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listInactiveSelectionIconForeground = registerColor('list.inactiveSelectionIconForeground',
	null,
	nls.localize('listInactiveSelectionIconForeground', "已选项在列表/树非活动时的图标前景颜色。活动的列表/树具有键盘焦点，非活动的则没有。"));

export const listInactiveFocusBackground = registerColor('list.inactiveFocusBackground',
	null,
	nls.localize('listInactiveFocusBackground', "非活动的列表或树控件中焦点项的背景颜色。活动的列表或树具有键盘焦点，非活动的没有。"));

export const listInactiveFocusOutline = registerColor('list.inactiveFocusOutline',
	null,
	nls.localize('listInactiveFocusOutline', "列表/数非活动时，焦点项目的列表/树边框色。活动的列表/树具有键盘焦点，非活动的没有。"));

export const listHoverBackground = registerColor('list.hoverBackground',
	{ dark: '#2A2D2E', light: '#F0F0F0', hcDark: Color.white.transparent(0.1), hcLight: Color.fromHex('#0F4A85').transparent(0.1) },
	nls.localize('listHoverBackground', "使用鼠标移动项目时，列表或树的背景颜色。"));

export const listHoverForeground = registerColor('list.hoverForeground',
	null,
	nls.localize('listHoverForeground', "鼠标在项目上悬停时，列表或树的前景颜色。"));

export const listDropOverBackground = registerColor('list.dropBackground',
	{ dark: '#062F4A', light: '#D6EBFF', hcDark: null, hcLight: null },
	nls.localize('listDropBackground', "使用鼠标移动项目时，列表或树进行拖放的背景颜色。"));

export const listDropBetweenBackground = registerColor('list.dropBetweenBackground',
	{ dark: iconForeground, light: iconForeground, hcDark: null, hcLight: null },
	nls.localize('listDropBetweenBackground', "使用鼠标在项目之间移动项时，列表/树拖放边框的颜色。"));

export const listHighlightForeground = registerColor('list.highlightForeground',
	{ dark: '#2AAAFF', light: '#0066BF', hcDark: focusBorder, hcLight: focusBorder },
	nls.localize('highlight', '在列表或树中搜索时，其中匹配内容的高亮颜色。'));

export const listFocusHighlightForeground = registerColor('list.focusHighlightForeground',
	{ dark: listHighlightForeground, light: ifDefinedThenElse(listActiveSelectionBackground, listHighlightForeground, '#BBE7FF'), hcDark: listHighlightForeground, hcLight: listHighlightForeground },
	nls.localize('listFocusHighlightForeground', '在列表或树中搜索时，匹配活动聚焦项的突出显示内容的列表/树前景色。'));

export const listInvalidItemForeground = registerColor('list.invalidItemForeground',
	{ dark: '#B89500', light: '#B89500', hcDark: '#B89500', hcLight: '#B5200D' },
	nls.localize('invalidItemForeground', '列表或树中无效项的前景色，例如资源管理器中没有解析的根目录。'));

export const listErrorForeground = registerColor('list.errorForeground',
	{ dark: '#F88070', light: '#B01011', hcDark: null, hcLight: null }, nls.localize('listErrorForeground', '包含错误的列表项的前景颜色。'));

export const listWarningForeground = registerColor('list.warningForeground',
	{ dark: '#CCA700', light: '#855F00', hcDark: null, hcLight: null }, nls.localize('listWarningForeground', '包含警告的列表项的前景颜色。'));

export const listFilterWidgetBackground = registerColor('listFilterWidget.background',
	{ light: darken(editorWidgetBackground, 0), dark: lighten(editorWidgetBackground, 0), hcDark: editorWidgetBackground, hcLight: editorWidgetBackground },
	nls.localize('listFilterWidgetBackground', '列表和树中类型筛选器小组件的背景色。'));

export const listFilterWidgetOutline = registerColor('listFilterWidget.outline',
	{ dark: Color.transparent, light: Color.transparent, hcDark: '#f38518', hcLight: '#007ACC' },
	nls.localize('listFilterWidgetOutline', '列表和树中类型筛选器小组件的轮廓颜色。'));

export const listFilterWidgetNoMatchesOutline = registerColor('listFilterWidget.noMatchesOutline',
	{ dark: '#BE1100', light: '#BE1100', hcDark: contrastBorder, hcLight: contrastBorder },
	nls.localize('listFilterWidgetNoMatchesOutline', '当没有匹配项时，列表和树中类型筛选器小组件的轮廓颜色。'));

export const listFilterWidgetShadow = registerColor('listFilterWidget.shadow',
	widgetShadow,
	nls.localize('listFilterWidgetShadow', '列表和树中类型筛选器小组件的阴影颜色。'));

export const listFilterMatchHighlight = registerColor('list.filterMatchBackground',
	{ dark: editorFindMatchHighlight, light: editorFindMatchHighlight, hcDark: null, hcLight: null },
	nls.localize('listFilterMatchHighlight', '筛选后的匹配项的背景颜色。'));

export const listFilterMatchHighlightBorder = registerColor('list.filterMatchBorder',
	{ dark: editorFindMatchHighlightBorder, light: editorFindMatchHighlightBorder, hcDark: contrastBorder, hcLight: activeContrastBorder },
	nls.localize('listFilterMatchHighlightBorder', '筛选后的匹配项的边框颜色。'));

export const listDeemphasizedForeground = registerColor('list.deemphasizedForeground',
	{ dark: '#8C8C8C', light: '#8E8E90', hcDark: '#A7A8A9', hcLight: '#666666' },
	nls.localize('listDeemphasizedForeground', "取消强调的项的列表/树前景色。"));


// ------ tree

export const treeIndentGuidesStroke = registerColor('tree.indentGuidesStroke',
	{ dark: '#585858', light: '#a9a9a9', hcDark: '#a9a9a9', hcLight: '#a5a5a5' },
	nls.localize('treeIndentGuidesStroke', "缩进参考线的树描边颜色。"));

export const treeInactiveIndentGuidesStroke = registerColor('tree.inactiveIndentGuidesStroke',
	transparent(treeIndentGuidesStroke, 0.4),
	nls.localize('treeInactiveIndentGuidesStroke', "非活动缩进参考线的树描边颜色。"));


// ------ table

export const tableColumnsBorder = registerColor('tree.tableColumnsBorder',
	{ dark: '#CCCCCC20', light: '#61616120', hcDark: null, hcLight: null },
	nls.localize('tableColumnsBorder', "列之间的表边框颜色。"));

export const tableOddRowsBackgroundColor = registerColor('tree.tableOddRowsBackground',
	{ dark: transparent(foreground, 0.04), light: transparent(foreground, 0.04), hcDark: null, hcLight: null },
	nls.localize('tableOddRowsBackgroundColor', "奇数表行的背景色。"));

// ------ action list

export const editorActionListBackground = registerColor('editorActionList.background',
	editorWidgetBackground,
	nls.localize('editorActionListBackground', "操作列表背景色。"));

export const editorActionListForeground = registerColor('editorActionList.foreground',
	editorWidgetForeground,
	nls.localize('editorActionListForeground', "操作列表前景色。"));

export const editorActionListFocusForeground = registerColor('editorActionList.focusForeground',
	listActiveSelectionForeground,
	nls.localize('editorActionListFocusForeground', "聚焦项目的操作列表前景色。"));

export const editorActionListFocusBackground = registerColor('editorActionList.focusBackground',
	listActiveSelectionBackground,
	nls.localize('editorActionListFocusBackground', "聚焦项目的操作列表背景色。"));
