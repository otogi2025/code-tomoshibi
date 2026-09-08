/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../nls.js';
import { registerColor, editorBackground, contrastBorder, transparent, editorWidgetBackground, textLinkForeground, lighten, darken, focusBorder, activeContrastBorder, editorWidgetForeground, editorErrorForeground, editorWarningForeground, editorInfoForeground, treeIndentGuidesStroke, errorForeground, listActiveSelectionBackground, listActiveSelectionForeground, listInactiveSelectionBackground, editorForeground, toolbarHoverBackground, inputBorder, widgetBorder, scrollbarShadow } from '../../platform/theme/common/colorRegistry.js';
import { foreground } from '../../platform/theme/common/colors/baseColors.js';
import { IColorTheme } from '../../platform/theme/common/themeService.js';
import { Color } from '../../base/common/color.js';
import { ColorScheme } from '../../platform/theme/common/theme.js';

// < --- Workbench (not customizable) --- >

export function WORKBENCH_BACKGROUND(theme: IColorTheme): Color {
	switch (theme.type) {
		case ColorScheme.LIGHT:
			return Color.fromHex('#F3F3F3');
		case ColorScheme.HIGH_CONTRAST_LIGHT:
			return Color.fromHex('#FFFFFF');
		case ColorScheme.HIGH_CONTRAST_DARK:
			return Color.fromHex('#000000');
		default:
			return Color.fromHex('#252526');
	}
}

// < --- Tabs --- >

//#region Tab Background

export const TAB_ACTIVE_BACKGROUND = registerColor('tab.activeBackground', editorBackground, localize('tabActiveBackground', "活动选项卡的背景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BACKGROUND = registerColor('tab.unfocusedActiveBackground', TAB_ACTIVE_BACKGROUND, localize('tabUnfocusedActiveBackground', "非焦点组中的活动选项卡背景色。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_INACTIVE_BACKGROUND = registerColor('tab.inactiveBackground', {
	dark: '#2D2D2D',
	light: '#ECECEC',
	hcDark: null,
	hcLight: null,
}, localize('tabInactiveBackground', "非活动选项卡的背景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_BACKGROUND = registerColor('tab.unfocusedInactiveBackground', TAB_INACTIVE_BACKGROUND, localize('tabUnfocusedInactiveBackground', "不带焦点的组中处于非活动状态的选项卡的背景色。选项卡是编辑器区域中的编辑器的容器。可在一个编辑器组中打开多个选项卡。可存在多个编辑器组。"));

//#endregion

//#region Tab Foreground

export const TAB_ACTIVE_FOREGROUND = registerColor('tab.activeForeground', {
	dark: Color.white,
	light: '#333333',
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabActiveForeground', "活动组中活动选项卡的前景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_INACTIVE_FOREGROUND = registerColor('tab.inactiveForeground', {
	dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabInactiveForeground', "活动组中非活动选项卡的前景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_FOREGROUND = registerColor('tab.unfocusedActiveForeground', {
	dark: transparent(TAB_ACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_ACTIVE_FOREGROUND, 0.7),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabUnfocusedActiveForeground', "一个失去焦点的编辑器组中的活动选项卡的前景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_FOREGROUND = registerColor('tab.unfocusedInactiveForeground', {
	dark: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
	light: transparent(TAB_INACTIVE_FOREGROUND, 0.5),
	hcDark: Color.white,
	hcLight: '#292929'
}, localize('tabUnfocusedInactiveForeground', "在一个失去焦点的组中非活动选项卡的前景色。在编辑器区域，选项卡是编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

//#endregion

//#region Tab Hover Foreground/Background

export const TAB_HOVER_BACKGROUND = registerColor('tab.hoverBackground', null, localize('tabHoverBackground', "选项卡被悬停时的背景色。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_BACKGROUND = registerColor('tab.unfocusedHoverBackground', {
	dark: transparent(TAB_HOVER_BACKGROUND, 0.5),
	light: transparent(TAB_HOVER_BACKGROUND, 0.7),
	hcDark: null,
	hcLight: null
}, localize('tabUnfocusedHoverBackground', "非焦点组选项卡被悬停时的背景色。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_HOVER_FOREGROUND = registerColor('tab.hoverForeground', null, localize('tabHoverForeground', "悬停时选项卡的前景色。选项卡是编辑器区域中的编辑器的容器。可在一个编辑器组中打开多个选项卡。可存在多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_FOREGROUND = registerColor('tab.unfocusedHoverForeground', {
	dark: transparent(TAB_HOVER_FOREGROUND, 0.5),
	light: transparent(TAB_HOVER_FOREGROUND, 0.5),
	hcDark: null,
	hcLight: null
}, localize('tabUnfocusedHoverForeground', "悬停时不带焦点的组中的选项卡前景色。选项卡是编辑器区域中的编辑器的容器。可在一个编辑器组中打开多个选项卡。可存在多个编辑器组。"));

//#endregion

//#region Tab Borders

export const TAB_BORDER = registerColor('tab.border', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: contrastBorder,
	hcLight: contrastBorder,
}, localize('tabBorder', "用于将选项卡彼此分隔开的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以存在多个编辑器组。"));

export const TAB_LAST_PINNED_BORDER = registerColor('tab.lastPinnedBorder', {
	dark: treeIndentGuidesStroke,
	light: treeIndentGuidesStroke,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('lastPinnedTabBorder', "用于将固定的选项卡与其他选项卡隔开的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_ACTIVE_BORDER = registerColor('tab.activeBorder', null, localize('tabActiveBorder', "活动选项卡底部的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以存在多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BORDER = registerColor('tab.unfocusedActiveBorder', {
	dark: transparent(TAB_ACTIVE_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_BORDER, 0.7),
	hcDark: null,
	hcLight: null
}, localize('tabActiveUnfocusedBorder', "在失去焦点的编辑器组中的活动选项卡底部的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以存在多个编辑器组。"));

export const TAB_ACTIVE_BORDER_TOP = registerColor('tab.activeBorderTop', {
	dark: null,
	light: null,
	hcDark: null,
	hcLight: '#B5200D'
}, localize('tabActiveBorderTop', "活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以存在多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_BORDER_TOP = registerColor('tab.unfocusedActiveBorderTop', {
	dark: transparent(TAB_ACTIVE_BORDER_TOP, 0.5),
	light: transparent(TAB_ACTIVE_BORDER_TOP, 0.7),
	hcDark: null,
	hcLight: '#B5200D'
}, localize('tabActiveUnfocusedBorderTop', "在失去焦点的编辑器组中的活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以存在多个编辑器组。"));

export const TAB_SELECTED_BORDER_TOP = registerColor('tab.selectedBorderTop', {
	dark: focusBorder,
	light: focusBorder,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder
}, localize('tabSelectedBorderTop', "所选选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_SELECTED_BACKGROUND = registerColor('tab.selectedBackground', listInactiveSelectionBackground, localize('tabSelectedBackground', "所选选项卡的后台进程。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_SELECTED_FOREGROUND = registerColor('tab.selectedForeground', TAB_ACTIVE_FOREGROUND, localize('tabSelectedForeground', "所选选项卡的前台进程。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));


export const TAB_HOVER_BORDER = registerColor('tab.hoverBorder', null, localize('tabHoverBorder', "选项卡被悬停时用于突出显示的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_HOVER_BORDER = registerColor('tab.unfocusedHoverBorder', {
	dark: transparent(TAB_HOVER_BORDER, 0.5),
	light: transparent(TAB_HOVER_BORDER, 0.7),
	hcDark: null,
	hcLight: contrastBorder
}, localize('tabUnfocusedHoverBorder', "非焦点组选项卡被悬停时用于突出显示的边框。选项卡是编辑器区域中编辑器的容器。可在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

//#endregion

//#region Tab Drag and Drop Border

export const TAB_DRAG_AND_DROP_BORDER = registerColor('tab.dragAndDropBorder', {
	dark: TAB_ACTIVE_FOREGROUND,
	light: TAB_ACTIVE_FOREGROUND,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder
}, localize('tabDragAndDropBorder', "选项卡之间的边框，指示可以在两个选项卡之间插入选项卡。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

//#endregion

//#region Tab Modified Border

export const TAB_ACTIVE_MODIFIED_BORDER = registerColor('tab.activeModifiedBorder', {
	dark: '#3399CC',
	light: '#33AAEE',
	hcDark: null,
	hcLight: contrastBorder
}, localize('tabActiveModifiedBorder', "活动组中已修改的活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_INACTIVE_MODIFIED_BORDER = registerColor('tab.inactiveModifiedBorder', {
	dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('tabInactiveModifiedBorder', "活动组中已修改的非活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedActiveModifiedBorder', {
	dark: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_ACTIVE_MODIFIED_BORDER, 0.7),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('unfocusedActiveModifiedBorder', "未聚焦组中已修改的活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

export const TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER = registerColor('tab.unfocusedInactiveModifiedBorder', {
	dark: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
	light: transparent(TAB_INACTIVE_MODIFIED_BORDER, 0.5),
	hcDark: Color.white,
	hcLight: contrastBorder
}, localize('unfocusedINactiveModifiedBorder', "未聚焦组中已修改的非活动选项卡顶部的边框。选项卡是编辑器区域中编辑器的容器。可以在一个编辑器组中打开多个选项卡。可以有多个编辑器组。"));

//#endregion

// < --- Editors --- >

export const EDITOR_PANE_BACKGROUND = registerColor('editorPane.background', editorBackground, localize('editorPaneBackground', "居中编辑器布局中左侧与右侧编辑器窗格的背景色。"));

export const EDITOR_GROUP_EMPTY_BACKGROUND = registerColor('editorGroup.emptyBackground', null, localize('editorGroupEmptyBackground', "空编辑器组的背景色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_FOCUSED_EMPTY_BORDER = registerColor('editorGroup.focusedEmptyBorder', {
	dark: null,
	light: null,
	hcDark: focusBorder,
	hcLight: focusBorder
}, localize('editorGroupFocusedEmptyBorder', "空编辑器组被聚焦时的边框颜色。编辑组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_TABS_BACKGROUND = registerColor('editorGroupHeader.tabsBackground', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: null,
	hcLight: null
}, localize('tabsContainerBackground', "启用选项卡时编辑器组标题的背景颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_TABS_BORDER = registerColor('editorGroupHeader.tabsBorder', null, localize('tabsContainerBorder', "选项卡启用时编辑器组标题的边框颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_NO_TABS_BACKGROUND = registerColor('editorGroupHeader.noTabsBackground', editorBackground, localize('editorGroupHeaderBackground', "禁用选项卡(“\"workbench.editor.showTabs\": \"single\"”)时编辑器组标题颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_HEADER_BORDER = registerColor('editorGroupHeader.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorTitleContainerBorder', "编辑器组标题标头的边框颜色。编辑器组是编辑器的容器。"));

export const EDITOR_GROUP_BORDER = registerColor('editorGroup.border', {
	dark: '#444444',
	light: '#E7E7E7',
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorGroupBorder', "将多个编辑器组彼此分隔开的颜色。编辑器组是编辑器的容器。"));

export const EDITOR_DRAG_AND_DROP_BACKGROUND = registerColor('editorGroup.dropBackground', {
	dark: Color.fromHex('#53595D').transparent(0.5),
	light: Color.fromHex('#2677CB').transparent(0.18),
	hcDark: null,
	hcLight: Color.fromHex('#0F4A85').transparent(0.50)
}, localize('editorDragAndDropBackground', "拖动编辑器时的背景颜色。此颜色应有透明度，以便编辑器内容能透过背景。"));

export const EDITOR_DROP_INTO_PROMPT_FOREGROUND = registerColor('editorGroup.dropIntoPromptForeground', editorWidgetForeground, localize('editorDropIntoPromptForeground', "拖动文件时编辑器上显示的文本前景色。此文本通知用户可以按住 Shift 来拖入编辑器中。"));

export const EDITOR_DROP_INTO_PROMPT_BACKGROUND = registerColor('editorGroup.dropIntoPromptBackground', editorWidgetBackground, localize('editorDropIntoPromptBackground', "拖动文件时编辑器上显示的文本背景色。此文本通知用户可以按住 Shift 放入编辑器中。"));

export const EDITOR_DROP_INTO_PROMPT_BORDER = registerColor('editorGroup.dropIntoPromptBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('editorDropIntoPromptBorder', "拖动文件时在编辑器上显示的文本边框颜色。此文本通知用户可以按住 Shift 来拖入编辑器中。"));

export const SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER = registerColor('sideBySideEditor.horizontalBorder', EDITOR_GROUP_BORDER, localize('sideBySideEditor.horizontalBorder', "在编辑器组中上下并排显示时，用于分隔两个编辑器的颜色。"));

export const SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER = registerColor('sideBySideEditor.verticalBorder', EDITOR_GROUP_BORDER, localize('sideBySideEditor.verticalBorder', "在编辑器组中左右并排显示时，用于区分两个编辑器的颜色。"));


// < --- Output Editor -->

const OUTPUT_VIEW_BACKGROUND = registerColor('outputView.background', null, localize('outputViewBackground', "输出视图背景色。"));


registerColor('outputViewStickyScroll.background', OUTPUT_VIEW_BACKGROUND, localize('outputViewStickyScrollBackground', "输出视图粘滞滚动背景色。"));


// < --- Banner --- >

export const BANNER_BACKGROUND = registerColor('banner.background', {
	dark: listActiveSelectionBackground,
	light: darken(listActiveSelectionBackground, 0.3),
	hcDark: listActiveSelectionBackground,
	hcLight: listActiveSelectionBackground
}, localize('banner.background', "横幅背景颜色。横幅显示在窗口的标题栏下。"));

export const BANNER_FOREGROUND = registerColor('banner.foreground', listActiveSelectionForeground, localize('banner.foreground', "横幅前景色。横幅显示在窗口的标题栏下。"));

export const BANNER_ICON_FOREGROUND = registerColor('banner.iconForeground', editorInfoForeground, localize('banner.iconForeground', "横幅图标颜色。横幅显示在窗口的标题栏下。"));

// < --- Status --- >

export const STATUS_BAR_FOREGROUND = registerColor('statusBar.foreground', {
	dark: '#FFFFFF',
	light: '#FFFFFF',
	hcDark: '#FFFFFF',
	hcLight: editorForeground
}, localize('statusBarForeground', "工作区或文件夹打开时状态栏的前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_NO_FOLDER_FOREGROUND = registerColor('statusBar.noFolderForeground', STATUS_BAR_FOREGROUND, localize('statusBarNoFolderForeground', "没有打开文件夹时状态栏的前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_BACKGROUND = registerColor('statusBar.background', {
	dark: '#007ACC',
	light: '#007ACC',
	hcDark: null,
	hcLight: null,
}, localize('statusBarBackground', "工作区或文件夹打开时状态栏的背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_NO_FOLDER_BACKGROUND = registerColor('statusBar.noFolderBackground', {
	dark: '#68217A',
	light: '#68217A',
	hcDark: null,
	hcLight: null,
}, localize('statusBarNoFolderBackground', "没有打开文件夹时状态栏的背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_BORDER = registerColor('statusBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('statusBarBorder', "状态栏分隔侧边栏和编辑器的边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_FOCUS_BORDER = registerColor('statusBar.focusBorder', {
	dark: STATUS_BAR_FOREGROUND,
	light: STATUS_BAR_FOREGROUND,
	hcDark: null,
	hcLight: STATUS_BAR_FOREGROUND
}, localize('statusBarFocusBorder', "聚焦于键盘导航时状态栏的边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_NO_FOLDER_BORDER = registerColor('statusBar.noFolderBorder', STATUS_BAR_BORDER, localize('statusBarNoFolderBorder', "当没有打开文件夹时，用来使状态栏与侧边栏、编辑器分隔的状态栏边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_ACTIVE_BACKGROUND = registerColor('statusBarItem.activeBackground', {
	dark: Color.white.transparent(0.18),
	light: Color.white.transparent(0.18),
	hcDark: Color.white.transparent(0.18),
	hcLight: Color.black.transparent(0.18)
}, localize('statusBarItemActiveBackground', "单击时的状态栏项背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_FOCUS_BORDER = registerColor('statusBarItem.focusBorder', {
	dark: STATUS_BAR_FOREGROUND,
	light: STATUS_BAR_FOREGROUND,
	hcDark: null,
	hcLight: activeContrastBorder
}, localize('statusBarItemFocusBorder', "聚焦于键盘导航时的状态栏项目边框颜色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.hoverBackground', {
	dark: Color.white.transparent(0.12),
	light: Color.black.transparent(0.12),
	hcDark: Color.black,
	hcLight: Color.white
}, localize('statusBarItemHoverBackground', "悬停时的状态栏项背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.hoverForeground', STATUS_BAR_FOREGROUND, localize('statusBarItemHoverForeground', "悬停时的状态栏项前景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND = registerColor('statusBarItem.compactHoverBackground', {
	dark: Color.white.transparent(0.12),
	light: Color.black.transparent(0.12),
	hcDark: Color.black,
	hcLight: Color.white
}, localize('statusBarItemCompactHoverBackground', "悬停在包含两个悬停的项时的状态栏项背景色。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_FOREGROUND = registerColor('statusBarItem.prominentForeground', STATUS_BAR_FOREGROUND, localize('statusBarProminentItemForeground', "状态栏突出显示项的前景色。突出的项目从其他状态栏条目中突出显示，以指示重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_BACKGROUND = registerColor('statusBarItem.prominentBackground', Color.black.transparent(0.5), localize('statusBarProminentItemBackground', "状态栏突出显示项的背景色。突出的项目从其他状态栏条目中突出显示，以指示重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.prominentHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarProminentItemHoverForeground', "悬停时状态栏突出显示项的前景色。突出的项目从其他状态栏条目中突出显示，以指示重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_PROMINENT_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.prominentHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarProminentItemHoverBackground', "悬停时状态栏突出显示项的背景色。突出的项目从其他状态栏条目中突出显示，以指示重要性。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_BACKGROUND = registerColor('statusBarItem.errorBackground', {
	dark: darken(errorForeground, .4),
	light: darken(errorForeground, .4),
	hcDark: null,
	hcLight: '#B5200D'
}, localize('statusBarErrorItemBackground', "状态栏错误项的背景颜色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_FOREGROUND = registerColor('statusBarItem.errorForeground', Color.white, localize('statusBarErrorItemForeground', "状态错误项的前景色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.errorHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarErrorItemHoverForeground', "悬停时状态错误项的前景色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_ERROR_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.errorHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarErrorItemHoverBackground', "悬停时状态错误项的背景色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_BACKGROUND = registerColor('statusBarItem.warningBackground', {
	dark: darken(editorWarningForeground, .4),
	light: darken(editorWarningForeground, .4),
	hcDark: null,
	hcLight: '#895503'
}, localize('statusBarWarningItemBackground', "状态栏警告项的背景颜色。警告项比状态栏中的其他条目更醒目以显示警告条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_FOREGROUND = registerColor('statusBarItem.warningForeground', Color.white, localize('statusBarWarningItemForeground', "状态错误项的前景色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.warningHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarWarningItemHoverForeground', "悬停时状态警告项的前景色。警告项比状态栏中的其他条目更醒目以显示警告条件。状态栏显示在窗口底部。"));

export const STATUS_BAR_WARNING_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.warningHoverBackground', STATUS_BAR_ITEM_HOVER_BACKGROUND, localize('statusBarWarningItemHoverBackground', "悬停时状态错误项的背景色。错误项比状态栏中的其他条目更醒目以显示错误条件。状态栏显示在窗口底部。"));


// < --- Activity Bar --- >

export const ACTIVITY_BAR_BACKGROUND = registerColor('activityBar.background', {
	dark: '#333333',
	light: '#2C2C2C',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('activityBarBackground', "活动栏背景色。活动栏显示在最左侧或最右侧，并允许在侧边栏的视图间切换。"));

export const ACTIVITY_BAR_FOREGROUND = registerColor('activityBar.foreground', {
	dark: Color.white,
	light: Color.white,
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarForeground', "活动栏项在活动时的前景色。活动栏显示在最左侧或最右侧，并允许在侧边栏的视图间切换。"));

export const ACTIVITY_BAR_INACTIVE_FOREGROUND = registerColor('activityBar.inactiveForeground', {
	dark: transparent(ACTIVITY_BAR_FOREGROUND, 0.4),
	light: transparent(ACTIVITY_BAR_FOREGROUND, 0.4),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarInActiveForeground', "活动栏项在非活动时的前景色。活动栏显示在最左侧或最右侧，并允许在侧边栏的视图间切换。"));

export const ACTIVITY_BAR_BORDER = registerColor('activityBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('activityBarBorder', "活动栏分隔侧边栏的边框颜色。活动栏显示在最左侧或最右侧，并可以切换侧边栏的视图。"));

export const ACTIVITY_BAR_ACTIVE_BORDER = registerColor('activityBar.activeBorder', {
	dark: ACTIVITY_BAR_FOREGROUND,
	light: ACTIVITY_BAR_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('activityBarActiveBorder', "活动项的活动栏边框颜色。活动栏显示在最左侧或右侧，并允许在侧栏视图之间切换。"));

export const ACTIVITY_BAR_ACTIVE_FOCUS_BORDER = registerColor('activityBar.activeFocusBorder', {
	dark: null,
	light: null,
	hcDark: null,
	hcLight: '#B5200D'
}, localize('activityBarActiveFocusBorder', "活动项的活动栏焦点边框颜色。活动栏显示在最左侧或右侧，并允许在侧栏视图之间切换。"));

export const ACTIVITY_BAR_ACTIVE_BACKGROUND = registerColor('activityBar.activeBackground', null, localize('activityBarActiveBackground', "活动项的活动栏背景颜色。活动栏显示在最左侧或右侧，并允许在侧栏视图之间切换。"));

export const ACTIVITY_BAR_DRAG_AND_DROP_BORDER = registerColor('activityBar.dropBorder', {
	dark: ACTIVITY_BAR_FOREGROUND,
	light: ACTIVITY_BAR_FOREGROUND,
	hcDark: null,
	hcLight: null,
}, localize('activityBarDragAndDropBorder', "拖放活动栏项的反馈颜色。活动栏显示在最左侧或最右侧，并允许在侧边栏视图之间切换。"));

export const ACTIVITY_BAR_BADGE_BACKGROUND = registerColor('activityBarBadge.background', {
	dark: '#007ACC',
	light: '#007ACC',
	hcDark: '#000000',
	hcLight: '#0F4A85'
}, localize('activityBarBadgeBackground', "活动通知徽章背景色。活动栏显示在最左侧或最右侧，并允许在侧边栏的视图间切换。"));

export const ACTIVITY_BAR_BADGE_FOREGROUND = registerColor('activityBarBadge.foreground', Color.white, localize('activityBarBadgeForeground', "活动通知徽章前景色。活动栏显示在最左侧或最右侧，并允许在侧边栏的视图间切换。"));

export const ACTIVITY_BAR_TOP_FOREGROUND = registerColor('activityBarTop.foreground', {
	dark: '#E7E7E7',
	light: '#424242',
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarTop', "活动栏中的项位于顶部/底部时的活动前景色。活动允许在边栏视图之间切换。"));

export const ACTIVITY_BAR_TOP_ACTIVE_BORDER = registerColor('activityBarTop.activeBorder', {
	dark: ACTIVITY_BAR_TOP_FOREGROUND,
	light: ACTIVITY_BAR_TOP_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: '#B5200D'
}, localize('activityBarTopActiveFocusBorder', "活动栏中的活动项位于顶部/底部时的焦点边框颜色。活动允许在边栏视图之间切换。"));

export const ACTIVITY_BAR_TOP_ACTIVE_BACKGROUND = registerColor('activityBarTop.activeBackground', null, localize('activityBarTopActiveBackground', "活动栏中的活动项位于顶部/底部时的背景色。该活动允许在侧边栏的不同视图之间进行切换。"));

export const ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND = registerColor('activityBarTop.inactiveForeground', {
	dark: transparent(ACTIVITY_BAR_TOP_FOREGROUND, 0.6),
	light: transparent(ACTIVITY_BAR_TOP_FOREGROUND, 0.75),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('activityBarTopInActiveForeground', "活动栏中的项位于顶部/底部时的非活动前景色。活动允许在边栏视图之间切换。"));

export const ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER = registerColor('activityBarTop.dropBorder', ACTIVITY_BAR_TOP_FOREGROUND, localize('activityBarTopDragAndDropBorder', "活动栏中的项位于顶部/底部时的拖放反馈颜色。活动允许在边栏视图之间切换。"));

export const ACTIVITY_BAR_TOP_BACKGROUND = registerColor('activityBarTop.background', null, localize('activityBarTopBackground', "设置为顶部/底部时活动栏的背景色。"));


// < --- Panels --- >

export const PANEL_BACKGROUND = registerColor('panel.background', editorBackground, localize('panelBackground', "面板的背景色。面板显示在编辑器区域下方，可包含输出和集成终端等视图。"));

export const PANEL_BORDER = registerColor('panel.border', {
	dark: Color.fromHex('#808080').transparent(0.35),
	light: Color.fromHex('#808080').transparent(0.35),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('panelBorder', "将面板与编辑器隔开的边框的颜色。面板显示在编辑区域下方，包含输出和集成终端等视图。"));

export const PANEL_TITLE_BORDER = registerColor('panelTitle.border', {
	dark: null,
	light: null,
	hcDark: PANEL_BORDER,
	hcLight: PANEL_BORDER
}, localize('panelTitleBorder', "底部的面板标题边框颜色，将标题与视图隔开。面板显示在编辑器区域下方，可包含输出和集成终端等视图。"));

export const PANEL_ACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.activeForeground', {
	dark: '#E7E7E7',
	light: '#424242',
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('panelActiveTitleForeground', "活动面板的标题颜色。面板显示在编辑器区域下方，并包含输出和集成终端等视图。"));

export const PANEL_INACTIVE_TITLE_FOREGROUND = registerColor('panelTitle.inactiveForeground', {
	dark: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.6),
	light: transparent(PANEL_ACTIVE_TITLE_FOREGROUND, 0.75),
	hcDark: Color.white,
	hcLight: editorForeground
}, localize('panelInactiveTitleForeground', "非活动面板的标题颜色。面板显示在编辑器区域下方，并包含输出和集成终端等视图。"));

export const PANEL_ACTIVE_TITLE_BORDER = registerColor('panelTitle.activeBorder', {
	dark: PANEL_ACTIVE_TITLE_FOREGROUND,
	light: PANEL_ACTIVE_TITLE_FOREGROUND,
	hcDark: contrastBorder,
	hcLight: '#B5200D'
}, localize('panelActiveTitleBorder', "活动面板标题的边框颜色。面板显示在编辑器区域下方，并包含输出和集成终端等视图。"));

export const PANEL_TITLE_BADGE_BACKGROUND = registerColor('panelTitleBadge.background', ACTIVITY_BAR_BADGE_BACKGROUND, localize('panelTitleBadgeBackground', "面板标题徽章背景色。面板显示在编辑器区域下方，可包含输出和集成终端等视图。"));

export const PANEL_TITLE_BADGE_FOREGROUND = registerColor('panelTitleBadge.foreground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('panelTitleBadgeForeground', "面板标题徽章前景色。面板显示在编辑器区域下方，可包含输出和集成终端等视图。"));

export const PANEL_INPUT_BORDER = registerColor('panelInput.border', {
	dark: inputBorder,
	light: Color.fromHex('#ddd'),
	hcDark: inputBorder,
	hcLight: inputBorder
}, localize('panelInputBorder', "用于面板中输入内容的输入框边框。"));

export const PANEL_DRAG_AND_DROP_BORDER = registerColor('panel.dropBorder', PANEL_ACTIVE_TITLE_FOREGROUND, localize('panelDragAndDropBorder', "拖放面板标题的反馈颜色。面板显示在编辑器区域的下方，包含输出和集成终端等视图。"));

export const PANEL_SECTION_DRAG_AND_DROP_BACKGROUND = registerColor('panelSection.dropBackground', EDITOR_DRAG_AND_DROP_BACKGROUND, localize('panelSectionDragAndDropBackground', "拖放面板区域的反馈颜色。颜色应具有透明度，以便面板区域仍可以显示出来。面板显示在编辑器区域的下方，包含输出和集成终端等视图。面板部分是嵌套在面板中的视图。"));

export const PANEL_SECTION_HEADER_BACKGROUND = registerColor('panelSectionHeader.background', {
	dark: Color.fromHex('#808080').transparent(0.2),
	light: Color.fromHex('#808080').transparent(0.2),
	hcDark: null,
	hcLight: null,
}, localize('panelSectionHeaderBackground', "面板区域标题背景色。面板显示在编辑器区域的下方，包含输出和集成终端等视图。面板部分是嵌套在面板中的视图。"));

export const PANEL_SECTION_HEADER_FOREGROUND = registerColor('panelSectionHeader.foreground', null, localize('panelSectionHeaderForeground', "面板区域标题前景色。面板显示在编辑器区域的下方，包含输出和集成终端等视图。面板部分是嵌套在面板中的视图。"));

export const PANEL_SECTION_HEADER_BORDER = registerColor('panelSectionHeader.border', contrastBorder, localize('panelSectionHeaderBorder', "当多个视图在面板中垂直堆叠时使用的面板区域标题边框颜色。面板显示在编辑器区域下方，其中包含输出和集成终端等视图。面板部分是嵌套在面板中的视图。"));

export const PANEL_SECTION_BORDER = registerColor('panelSection.border', PANEL_BORDER, localize('panelSectionBorder', "当多个视图在面板中水平堆叠时使用的面板区域边框颜色。面板显示在编辑器区域下方，其中包含输出和集成终端等视图。面板部分是嵌套在面板中的视图。"));

export const PANEL_STICKY_SCROLL_BACKGROUND = registerColor('panelStickyScroll.background', PANEL_BACKGROUND, localize('panelStickyScrollBackground', "面板中粘滞滚动的背景色。"));

export const PANEL_STICKY_SCROLL_BORDER = registerColor('panelStickyScroll.border', null, localize('panelStickyScrollBorder', "面板中粘滞滚动的边框颜色。"));

export const PANEL_STICKY_SCROLL_SHADOW = registerColor('panelStickyScroll.shadow', scrollbarShadow, localize('panelStickyScrollShadow', "面板中粘滞滚动的阴影颜色。"));


// < --- Browser --- >

export const BROWSER_BORDER = registerColor('browser.border', TAB_BORDER, localize('browserBorder', "集成浏览器页面的边框颜色。"));


// < --- Profiles --- >

export const PROFILE_BADGE_BACKGROUND = registerColor('profileBadge.background', {
	dark: '#4D4D4D',
	light: '#C4C4C4',
	hcDark: Color.white,
	hcLight: Color.black
}, localize('profileBadgeBackground', "配置文件徽章背景色。配置文件徽章显示在活动栏中设置齿轮图标的顶部。"));

export const PROFILE_BADGE_FOREGROUND = registerColor('profileBadge.foreground', {
	dark: Color.white,
	light: '#333333',
	hcDark: Color.black,
	hcLight: Color.white
}, localize('profileBadgeForeground', "配置文件徽章前景颜色。配置文件徽章显示在活动栏中设置齿轮图标的顶部。"));


// < --- Remote --- >

export const STATUS_BAR_REMOTE_ITEM_BACKGROUND = registerColor('statusBarItem.remoteBackground', ACTIVITY_BAR_BADGE_BACKGROUND, localize('statusBarItemRemoteBackground', "状态栏上远程指示器的背景色。"));

export const STATUS_BAR_REMOTE_ITEM_FOREGROUND = registerColor('statusBarItem.remoteForeground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('statusBarItemRemoteForeground', "状态栏上远程指示器的前景色。"));

export const STATUS_BAR_REMOTE_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.remoteHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarRemoteItemHoverForeground', "悬停时状态栏上远程指示器的前景色。"));

export const STATUS_BAR_REMOTE_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.remoteHoverBackground', {
	dark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	light: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcDark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcLight: null
}, localize('statusBarRemoteItemHoverBackground', "悬停时状态栏上远程指示器的背景色。"));

export const STATUS_BAR_OFFLINE_ITEM_BACKGROUND = registerColor('statusBarItem.offlineBackground', '#6c1717', localize('statusBarItemOfflineBackground', "工作台脱机时的状态栏项背景色。"));

export const STATUS_BAR_OFFLINE_ITEM_FOREGROUND = registerColor('statusBarItem.offlineForeground', STATUS_BAR_REMOTE_ITEM_FOREGROUND, localize('statusBarItemOfflineForeground', "工作台脱机时的状态栏项前景色。"));

export const STATUS_BAR_OFFLINE_ITEM_HOVER_FOREGROUND = registerColor('statusBarItem.offlineHoverForeground', STATUS_BAR_ITEM_HOVER_FOREGROUND, localize('statusBarOfflineItemHoverForeground', "工作台脱机时，状态栏项前台悬停颜色。"));

export const STATUS_BAR_OFFLINE_ITEM_HOVER_BACKGROUND = registerColor('statusBarItem.offlineHoverBackground', {
	dark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	light: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcDark: STATUS_BAR_ITEM_HOVER_BACKGROUND,
	hcLight: null
}, localize('statusBarOfflineItemHoverBackground', "工作台脱机时，状态栏项背景悬停颜色。"));

export const EXTENSION_BADGE_BACKGROUND = registerColor('extensionBadge.remoteBackground', ACTIVITY_BAR_BADGE_BACKGROUND, localize('extensionBadge.remoteBackground', "扩展视图中远程徽标的背景色。"));
export const EXTENSION_BADGE_FOREGROUND = registerColor('extensionBadge.remoteForeground', ACTIVITY_BAR_BADGE_FOREGROUND, localize('extensionBadge.remoteForeground', "扩展视图中远程徽标的前景色。"));


// < --- Side Bar --- >

export const SIDE_BAR_BACKGROUND = registerColor('sideBar.background', {
	dark: '#252526',
	light: '#F3F3F3',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('sideBarBackground', "侧边栏背景色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_FOREGROUND = registerColor('sideBar.foreground', null, localize('sideBarForeground', "侧边栏前景色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_BORDER = registerColor('sideBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('sideBarBorder', "侧边栏分隔编辑器的边框颜色。侧边栏包含资源管理器、搜索等视图。"));

export const SIDE_BAR_TITLE_BACKGROUND = registerColor('sideBarTitle.background', SIDE_BAR_BACKGROUND, localize('sideBarTitleBackground', "边栏标题背景色。边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_TITLE_FOREGROUND = registerColor('sideBarTitle.foreground', SIDE_BAR_FOREGROUND, localize('sideBarTitleForeground', "侧边栏标题前景色。侧边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_TITLE_BORDER = registerColor('sideBarTitle.border', {
	dark: null,
	light: null,
	hcDark: SIDE_BAR_BORDER,
	hcLight: SIDE_BAR_BORDER
}, localize('sideBarTitleBorder', "底部的侧栏标题边框颜色，将标题与视图隔开。边栏是资源管理器和搜索等视图的容器。"));

export const SIDE_BAR_DRAG_AND_DROP_BACKGROUND = registerColor('sideBar.dropBackground', EDITOR_DRAG_AND_DROP_BACKGROUND, localize('sideBarDragAndDropBackground', "侧边栏中的部分在拖放时的反馈颜色。此颜色应有透明度，以便侧边栏中的部分仍能透过。侧边栏是资源管理器和搜索等视图的容器。侧边栏部分是嵌套在侧边栏中的视图。"));

export const SIDE_BAR_SECTION_HEADER_BACKGROUND = registerColor('sideBarSectionHeader.background', {
	dark: Color.fromHex('#808080').transparent(0.2),
	light: Color.fromHex('#808080').transparent(0.2),
	hcDark: null,
	hcLight: null
}, localize('sideBarSectionHeaderBackground', "侧边栏部分标题背景色。此侧边栏是资源管理器和搜索等视图的容器。侧边栏部分是在侧边栏中嵌套的视图。"));

export const SIDE_BAR_SECTION_HEADER_FOREGROUND = registerColor('sideBarSectionHeader.foreground', SIDE_BAR_FOREGROUND, localize('sideBarSectionHeaderForeground', "侧边栏部分标题前景色。侧栏是类似资源管理器和搜索等视图的容器。侧栏部分是在侧栏中嵌套的视图。"));

export const SIDE_BAR_SECTION_HEADER_BORDER = registerColor('sideBarSectionHeader.border', contrastBorder, localize('sideBarSectionHeaderBorder', "侧边栏部分标题边界色。侧栏是类似资源管理器和搜索等视图的容器。侧栏部分是在侧栏中嵌套的视图。"));

export const ACTIVITY_BAR_TOP_BORDER = registerColor('sideBarActivityBarTop.border', SIDE_BAR_SECTION_HEADER_BORDER, localize('sideBarActivityBarTopBorder', "顶部/底部的活动栏与视图之间的边框颜色。"));

export const SIDE_BAR_STICKY_SCROLL_BACKGROUND = registerColor('sideBarStickyScroll.background', SIDE_BAR_BACKGROUND, localize('sideBarStickyScrollBackground', "侧边栏中粘滞滚动的背景色。"));

export const SIDE_BAR_STICKY_SCROLL_BORDER = registerColor('sideBarStickyScroll.border', null, localize('sideBarStickyScrollBorder', "边栏中粘滞滚动的边框颜色。"));

export const SIDE_BAR_STICKY_SCROLL_SHADOW = registerColor('sideBarStickyScroll.shadow', scrollbarShadow, localize('sideBarStickyScrollShadow', "边栏中粘滞滚动的阴影颜色。"));

// < --- Surface --- >

// Generic framed container surfaces ("cards"). Used by the modern workbench
// layout to frame the floating parts (side bar, panel, auxiliary bar, editor).
// Defaults mirror the agent sessions window's panel treatment so the look is
// shared, but themes can target these tokens independently.

export const SURFACE_BACKGROUND = registerColor('surface.background', {
	dark: SIDE_BAR_BACKGROUND,
	light: editorBackground,
	hcDark: SIDE_BAR_BACKGROUND,
	hcLight: SIDE_BAR_BACKGROUND
}, localize('surfaceBackground', "Background color of framed container surfaces (\"cards\"), such as the floating workbench panels in the modern layout."));

export const SURFACE_FOREGROUND = registerColor('surface.foreground', SIDE_BAR_FOREGROUND, localize('surfaceForeground', "Foreground color of framed container surfaces (\"cards\"), such as the floating workbench panels in the modern layout."));

export const SURFACE_BORDER = registerColor('surface.border', {
	dark: transparent(foreground, 0.15),
	light: transparent(foreground, 0.15),
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('surfaceBorder', "Border color of framed container surfaces (\"cards\"), such as the floating workbench panels in the modern layout."));

// < --- Title Bar --- >

export const TITLE_BAR_ACTIVE_FOREGROUND = registerColor('titleBar.activeForeground', {
	dark: '#CCCCCC',
	light: '#333333',
	hcDark: '#FFFFFF',
	hcLight: '#292929'
}, localize('titleBarActiveForeground', "窗口处于活动状态时的标题栏前景色。"));

export const TITLE_BAR_INACTIVE_FOREGROUND = registerColor('titleBar.inactiveForeground', {
	dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
	light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, 0.6),
	hcDark: null,
	hcLight: '#292929'
}, localize('titleBarInactiveForeground', "窗口处于非活动状态时的标题栏前景色。"));

export const TITLE_BAR_ACTIVE_BACKGROUND = registerColor('titleBar.activeBackground', {
	dark: '#3C3C3C',
	light: '#DDDDDD',
	hcDark: '#000000',
	hcLight: '#FFFFFF'
}, localize('titleBarActiveBackground', "窗口处于活动状态时的标题栏背景色。"));

export const TITLE_BAR_INACTIVE_BACKGROUND = registerColor('titleBar.inactiveBackground', {
	dark: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
	light: transparent(TITLE_BAR_ACTIVE_BACKGROUND, 0.6),
	hcDark: null,
	hcLight: null,
}, localize('titleBarInactiveBackground', "窗口处于非活动状态时的标题栏背景色。"));

export const TITLE_BAR_BORDER = registerColor('titleBar.border', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('titleBarBorder', "标题栏边框颜色。"));

// < --- Menubar --- >

export const MENUBAR_SELECTION_FOREGROUND = registerColor('menubar.selectionForeground', TITLE_BAR_ACTIVE_FOREGROUND, localize('menubarSelectionForeground', "菜单栏中选定菜单项的前景色。"));

export const MENUBAR_SELECTION_BACKGROUND = registerColor('menubar.selectionBackground', {
	dark: toolbarHoverBackground,
	light: toolbarHoverBackground,
	hcDark: null,
	hcLight: null,
}, localize('menubarSelectionBackground', "菜单栏中选定菜单项的背景色。"));

export const MENUBAR_SELECTION_BORDER = registerColor('menubar.selectionBorder', {
	dark: null,
	light: null,
	hcDark: activeContrastBorder,
	hcLight: activeContrastBorder,
}, localize('menubarSelectionBorder', "菜单栏中所选菜单项的边框颜色。"));

// < --- Command Center --- >

// foreground (inactive and active)
export const COMMAND_CENTER_FOREGROUND = registerColor(
	'commandCenter.foreground',
	TITLE_BAR_ACTIVE_FOREGROUND,
	localize('commandCenter-foreground', "命令中心前景色"),
	false
);
export const COMMAND_CENTER_ACTIVEFOREGROUND = registerColor(
	'commandCenter.activeForeground',
	MENUBAR_SELECTION_FOREGROUND,
	localize('commandCenter-activeForeground', "命令中心的活动前景色"),
	false
);
export const COMMAND_CENTER_INACTIVEFOREGROUND = registerColor(
	'commandCenter.inactiveForeground',
	TITLE_BAR_INACTIVE_FOREGROUND,
	localize('commandCenter-inactiveForeground', "窗口处于非活动状态时命令中心的前景色"),
	false
);
// background (inactive and active)
export const COMMAND_CENTER_BACKGROUND = registerColor(
	'commandCenter.background',
	{ dark: Color.white.transparent(0.05), hcDark: null, light: Color.black.transparent(0.05), hcLight: null },
	localize('commandCenter-background', "命令中心背景色"),
	false
);
export const COMMAND_CENTER_ACTIVEBACKGROUND = registerColor(
	'commandCenter.activeBackground',
	{ dark: Color.white.transparent(0.08), hcDark: MENUBAR_SELECTION_BACKGROUND, light: Color.black.transparent(0.08), hcLight: MENUBAR_SELECTION_BACKGROUND },
	localize('commandCenter-activeBackground', "命令中心的活动背景色"),
	false
);
// border: active and inactive. defaults to active background
export const COMMAND_CENTER_BORDER = registerColor(
	'commandCenter.border', { dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .20), hcDark: contrastBorder, light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .20), hcLight: contrastBorder },
	localize('commandCenter-border', "命令中心的边框颜色"),
	false
);
export const COMMAND_CENTER_ACTIVEBORDER = registerColor(
	'commandCenter.activeBorder', { dark: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .30), hcDark: TITLE_BAR_ACTIVE_FOREGROUND, light: transparent(TITLE_BAR_ACTIVE_FOREGROUND, .30), hcLight: TITLE_BAR_ACTIVE_FOREGROUND },
	localize('commandCenter-activeBorder', "命令中心的活动边框颜色"),
	false
);
// border: defaults to active background
export const COMMAND_CENTER_INACTIVEBORDER = registerColor(
	'commandCenter.inactiveBorder', transparent(TITLE_BAR_INACTIVE_FOREGROUND, .25),
	localize('commandCenter-inactiveBorder', "窗口处于非活动状态时命令中心的边框颜色"),
	false
);


// < --- Notifications --- >

export const NOTIFICATIONS_CENTER_BORDER = registerColor('notificationCenter.border', {
	dark: widgetBorder,
	light: widgetBorder,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('notificationCenterBorder', "通知中心的边框颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_TOAST_BORDER = registerColor('notificationToast.border', {
	dark: widgetBorder,
	light: widgetBorder,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('notificationToastBorder', "通知横幅的边框颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_FOREGROUND = registerColor('notifications.foreground', editorWidgetForeground, localize('notificationsForeground', "通知的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_BACKGROUND = registerColor('notifications.background', editorWidgetBackground, localize('notificationsBackground', "通知的背景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_LINKS = registerColor('notificationLink.foreground', textLinkForeground, localize('notificationsLink', "通知链接的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_CENTER_HEADER_FOREGROUND = registerColor('notificationCenterHeader.foreground', null, localize('notificationCenterHeaderForeground', "通知中心头部的前景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_CENTER_HEADER_BACKGROUND = registerColor('notificationCenterHeader.background', {
	dark: lighten(NOTIFICATIONS_BACKGROUND, 0.3),
	light: darken(NOTIFICATIONS_BACKGROUND, 0.05),
	hcDark: NOTIFICATIONS_BACKGROUND,
	hcLight: NOTIFICATIONS_BACKGROUND
}, localize('notificationCenterHeaderBackground', "通知中心头部的背景色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_BORDER = registerColor('notifications.border', NOTIFICATIONS_CENTER_HEADER_BACKGROUND, localize('notificationsBorder', "通知中心中分隔通知的边框的颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_ERROR_ICON_FOREGROUND = registerColor('notificationsErrorIcon.foreground', editorErrorForeground, localize('notificationsErrorIconForeground', "用于错误通知图标的颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_WARNING_ICON_FOREGROUND = registerColor('notificationsWarningIcon.foreground', editorWarningForeground, localize('notificationsWarningIconForeground', "用于警告通知图标的颜色。通知从窗口右下角滑入。"));

export const NOTIFICATIONS_INFO_ICON_FOREGROUND = registerColor('notificationsInfoIcon.foreground', editorInfoForeground, localize('notificationsInfoIconForeground', "用于信息通知图标的颜色。通知从窗口右下角滑入。"));

export const WINDOW_ACTIVE_BORDER = registerColor('window.activeBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('windowActiveBorder', "窗口在 macOS 或 Linux 上处于活动状态时用于窗口边框的颜色。在 Linux 上需要自定义标题栏样式和自定义或隐藏窗口控件。"));

export const WINDOW_INACTIVE_BORDER = registerColor('window.inactiveBorder', {
	dark: null,
	light: null,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('windowInactiveBorder', "窗口在 macOS 或 Linux 上处于非活动状态时用于窗口边框的颜色。在 Linux 上需要自定义标题栏样式和自定义或隐藏窗口控件。"));
