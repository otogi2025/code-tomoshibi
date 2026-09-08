/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { registerColor, editorInfoForeground, editorWarningForeground, editorErrorForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { chartsGreen, chartsPurple } from '../../../../platform/theme/common/colors/chartsColors.js';

/*
 * Markdown alert colors for GitHub-style alert syntax.
 */

export const markdownAlertNoteColor = registerColor('markdownAlert.note.foreground',
	editorInfoForeground,
	localize('markdownAlertNoteForeground', "Markdown 中“备注”提示的前景色。"));

export const markdownAlertTipColor = registerColor('markdownAlert.tip.foreground',
	chartsGreen,
	localize('markdownAlertTipForeground', "Markdown 中“使用技巧”提示的前景色。"));

export const markdownAlertImportantColor = registerColor('markdownAlert.important.foreground',
	chartsPurple,
	localize('markdownAlertImportantForeground', "Markdown 中“重要信息”提示的前景色。"));

export const markdownAlertWarningColor = registerColor('markdownAlert.warning.foreground',
	editorWarningForeground,
	localize('markdownAlertWarningForeground', "Markdown 中“警告”提示的前景色。"));

export const markdownAlertCautionColor = registerColor('markdownAlert.caution.foreground',
	editorErrorForeground,
	localize('markdownAlertCautionForeground', "Markdown 中“注意”提示的前景色。"));
