/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './symbolIcons.css';
import { localize } from '../../../../nls.js';
import { foreground, registerColor } from '../../../../platform/theme/common/colorRegistry.js';

export const SYMBOL_ICON_ARRAY_FOREGROUND = registerColor('symbolIcon.arrayForeground', foreground, localize('symbolIcon.arrayForeground', '数组符号的前景色。这些符号将显示在大纲、痕迹导航栏和建议小组件中。'));

export const SYMBOL_ICON_BOOLEAN_FOREGROUND = registerColor('symbolIcon.booleanForeground', foreground, localize('symbolIcon.booleanForeground', '布尔符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_CLASS_FOREGROUND = registerColor('symbolIcon.classForeground', {
	dark: '#EE9D28',
	light: '#D67E00',
	hcDark: '#EE9D28',
	hcLight: '#D67E00'
}, localize('symbolIcon.classForeground', '类符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_COLOR_FOREGROUND = registerColor('symbolIcon.colorForeground', foreground, localize('symbolIcon.colorForeground', '颜色符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_CONSTANT_FOREGROUND = registerColor('symbolIcon.constantForeground', foreground, localize('symbolIcon.constantForeground', '常量符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_CONSTRUCTOR_FOREGROUND = registerColor('symbolIcon.constructorForeground', {
	dark: '#B180D7',
	light: '#652D90',
	hcDark: '#B180D7',
	hcLight: '#652D90'
}, localize('symbolIcon.constructorForeground', '构造函数符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_ENUMERATOR_FOREGROUND = registerColor('symbolIcon.enumeratorForeground', {
	dark: '#EE9D28',
	light: '#D67E00',
	hcDark: '#EE9D28',
	hcLight: '#D67E00'
}, localize('symbolIcon.enumeratorForeground', '枚举符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_ENUMERATOR_MEMBER_FOREGROUND = registerColor('symbolIcon.enumeratorMemberForeground', {
	dark: '#75BEFF',
	light: '#007ACC',
	hcDark: '#75BEFF',
	hcLight: '#007ACC'
}, localize('symbolIcon.enumeratorMemberForeground', '枚举器成员符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_EVENT_FOREGROUND = registerColor('symbolIcon.eventForeground', {
	dark: '#EE9D28',
	light: '#D67E00',
	hcDark: '#EE9D28',
	hcLight: '#D67E00'
}, localize('symbolIcon.eventForeground', '事件符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_FIELD_FOREGROUND = registerColor('symbolIcon.fieldForeground', {
	dark: '#75BEFF',
	light: '#007ACC',
	hcDark: '#75BEFF',
	hcLight: '#007ACC'
}, localize('symbolIcon.fieldForeground', '字段符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_FILE_FOREGROUND = registerColor('symbolIcon.fileForeground', foreground, localize('symbolIcon.fileForeground', '文件符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_FOLDER_FOREGROUND = registerColor('symbolIcon.folderForeground', foreground, localize('symbolIcon.folderForeground', '文件夹符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_FUNCTION_FOREGROUND = registerColor('symbolIcon.functionForeground', {
	dark: '#B180D7',
	light: '#652D90',
	hcDark: '#B180D7',
	hcLight: '#652D90'
}, localize('symbolIcon.functionForeground', '函数符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_INTERFACE_FOREGROUND = registerColor('symbolIcon.interfaceForeground', {
	dark: '#75BEFF',
	light: '#007ACC',
	hcDark: '#75BEFF',
	hcLight: '#007ACC'
}, localize('symbolIcon.interfaceForeground', '接口符号的前景色。这些符号将显示在大纲、痕迹导航栏和建议小组件中。'));

export const SYMBOL_ICON_KEY_FOREGROUND = registerColor('symbolIcon.keyForeground', foreground, localize('symbolIcon.keyForeground', '键符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_KEYWORD_FOREGROUND = registerColor('symbolIcon.keywordForeground', foreground, localize('symbolIcon.keywordForeground', '关键字符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_METHOD_FOREGROUND = registerColor('symbolIcon.methodForeground', {
	dark: '#B180D7',
	light: '#652D90',
	hcDark: '#B180D7',
	hcLight: '#652D90'
}, localize('symbolIcon.methodForeground', '方法符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_MODULE_FOREGROUND = registerColor('symbolIcon.moduleForeground', foreground, localize('symbolIcon.moduleForeground', '模块符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_NAMESPACE_FOREGROUND = registerColor('symbolIcon.namespaceForeground', foreground, localize('symbolIcon.namespaceForeground', '命名空间符号的前景颜色。这些符号出现在轮廓、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_NULL_FOREGROUND = registerColor('symbolIcon.nullForeground', foreground, localize('symbolIcon.nullForeground', '空符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_NUMBER_FOREGROUND = registerColor('symbolIcon.numberForeground', foreground, localize('symbolIcon.numberForeground', '数字符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_OBJECT_FOREGROUND = registerColor('symbolIcon.objectForeground', foreground, localize('symbolIcon.objectForeground', '对象符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_OPERATOR_FOREGROUND = registerColor('symbolIcon.operatorForeground', foreground, localize('symbolIcon.operatorForeground', '运算符符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_PACKAGE_FOREGROUND = registerColor('symbolIcon.packageForeground', foreground, localize('symbolIcon.packageForeground', '包符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_PROPERTY_FOREGROUND = registerColor('symbolIcon.propertyForeground', foreground, localize('symbolIcon.propertyForeground', '属性符号的前景色。这些符号出现在大纲、痕迹导航栏和建议小组件中。'));

export const SYMBOL_ICON_REFERENCE_FOREGROUND = registerColor('symbolIcon.referenceForeground', foreground, localize('symbolIcon.referenceForeground', '参考符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_SNIPPET_FOREGROUND = registerColor('symbolIcon.snippetForeground', foreground, localize('symbolIcon.snippetForeground', '片段符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_STRING_FOREGROUND = registerColor('symbolIcon.stringForeground', foreground, localize('symbolIcon.stringForeground', '字符串符号的前景颜色。这些符号出现在轮廓、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_STRUCT_FOREGROUND = registerColor('symbolIcon.structForeground', foreground, localize('symbolIcon.structForeground', '结构符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_TEXT_FOREGROUND = registerColor('symbolIcon.textForeground', foreground, localize('symbolIcon.textForeground', '文本符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_TYPEPARAMETER_FOREGROUND = registerColor('symbolIcon.typeParameterForeground', foreground, localize('symbolIcon.typeParameterForeground', '类型参数符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_UNIT_FOREGROUND = registerColor('symbolIcon.unitForeground', foreground, localize('symbolIcon.unitForeground', '单位符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));

export const SYMBOL_ICON_VARIABLE_FOREGROUND = registerColor('symbolIcon.variableForeground', {
	dark: '#75BEFF',
	light: '#007ACC',
	hcDark: '#75BEFF',
	hcLight: '#007ACC',
}, localize('symbolIcon.variableForeground', '变量符号的前景颜色。这些符号出现在大纲、痕迹导航栏和建议小部件中。'));
