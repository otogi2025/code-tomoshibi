/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { registerColor, transparent } from '../colorUtils.js';

import { foreground } from './baseColors.js';
import { editorErrorForeground, editorInfoForeground, editorWarningForeground } from './editorColors.js';
import { minimapFindMatch } from './minimapColors.js';


export const chartsForeground = registerColor('charts.foreground',
	foreground,
	nls.localize('chartsForeground', "图表中使用的前景颜色。"));

export const chartsLines = registerColor('charts.lines',
	transparent(foreground, .5),
	nls.localize('chartsLines', "用于图表中的水平线条的颜色。"));

export const chartsRed = registerColor('charts.red',
	editorErrorForeground,
	nls.localize('chartsRed', "图表可视化效果中使用的红色。"));

export const chartsBlue = registerColor('charts.blue',
	editorInfoForeground,
	nls.localize('chartsBlue', "图表可视化效果中使用的蓝色。"));

export const chartsYellow = registerColor('charts.yellow',
	editorWarningForeground,
	nls.localize('chartsYellow', "图表可视化效果中使用的黄色。"));

export const chartsOrange = registerColor('charts.orange',
	minimapFindMatch,
	nls.localize('chartsOrange', "图表可视化效果中使用的橙色。"));

export const chartsGreen = registerColor('charts.green',
	{ dark: '#89D185', light: '#388A34', hcDark: '#89D185', hcLight: '#374e06' },
	nls.localize('chartsGreen', "图表可视化效果中使用的绿色。"));

export const chartsPurple = registerColor('charts.purple',
	{ dark: '#B180D7', light: '#652D90', hcDark: '#B180D7', hcLight: '#652D90' },
	nls.localize('chartsPurple', "图表可视化效果中使用的紫色。"));
