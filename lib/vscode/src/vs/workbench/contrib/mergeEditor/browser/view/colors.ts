/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../../nls.js';
import { mergeCurrentHeaderBackground, mergeIncomingHeaderBackground, registerColor, transparent } from '../../../../../platform/theme/common/colorRegistry.js';

export const diff = registerColor(
	'mergeEditor.change.background',
	'#9bb95533',
	localize('mergeEditor.change.background', '更改的背景色。')
);

export const diffWord = registerColor(
	'mergeEditor.change.word.background',
	{ dark: '#9ccc2c33', light: '#9ccc2c66', hcDark: '#9ccc2c33', hcLight: '#9ccc2c66', },
	localize('mergeEditor.change.word.background', '字词更改的背景色。')
);

export const diffBase = registerColor(
	'mergeEditor.changeBase.background',
	{ dark: '#4B1818FF', light: '#FFCCCCFF', hcDark: '#4B1818FF', hcLight: '#FFCCCCFF', },
	localize('mergeEditor.changeBase.background', '基中更改的背景色。')
);

export const diffWordBase = registerColor(
	'mergeEditor.changeBase.word.background',
	{ dark: '#6F1313FF', light: '#FFA3A3FF', hcDark: '#6F1313FF', hcLight: '#FFA3A3FF', },
	localize('mergeEditor.changeBase.word.background', '基中字更改的背景色。')
);

export const conflictBorderUnhandledUnfocused = registerColor(
	'mergeEditor.conflict.unhandledUnfocused.border',
	{ dark: '#ffa6007a', light: '#ffa600FF', hcDark: '#ffa6007a', hcLight: '#ffa6007a', },
	localize('mergeEditor.conflict.unhandledUnfocused.border', '未处理的非重点冲突的边框颜色。')
);

export const conflictBorderUnhandledFocused = registerColor(
	'mergeEditor.conflict.unhandledFocused.border',
	'#ffa600',
	localize('mergeEditor.conflict.unhandledFocused.border', '未处理的重点冲突的边框颜色。')
);

export const conflictBorderHandledUnfocused = registerColor(
	'mergeEditor.conflict.handledUnfocused.border',
	'#86868649',
	localize('mergeEditor.conflict.handledUnfocused.border', '已处理的非重点冲突的边框颜色。')
);

export const conflictBorderHandledFocused = registerColor(
	'mergeEditor.conflict.handledFocused.border',
	'#c1c1c1cc',
	localize('mergeEditor.conflict.handledFocused.border', '处理的重点冲突的边框颜色。')
);

export const handledConflictMinimapOverViewRulerColor = registerColor(
	'mergeEditor.conflict.handled.minimapOverViewRuler',
	'#adaca8ee',
	localize('mergeEditor.conflict.handled.minimapOverViewRuler', '输入 1 中更改的前景色。')
);

export const unhandledConflictMinimapOverViewRulerColor = registerColor(
	'mergeEditor.conflict.unhandled.minimapOverViewRuler',
	'#fcba03FF',
	localize('mergeEditor.conflict.unhandled.minimapOverViewRuler', '输入 1 中更改的前景色。')
);

export const conflictingLinesBackground = registerColor(
	'mergeEditor.conflictingLines.background',
	'#ffea0047',
	localize('mergeEditor.conflictingLines.background', '“冲突行”文本的背景。')
);

const contentTransparency = 0.4;
export const conflictInput1Background = registerColor(
	'mergeEditor.conflict.input1.background',
	transparent(mergeCurrentHeaderBackground, contentTransparency),
	localize('mergeEditor.conflict.input1.background', '输入 1 中修饰的背景色。')
);

export const conflictInput2Background = registerColor(
	'mergeEditor.conflict.input2.background',
	transparent(mergeIncomingHeaderBackground, contentTransparency),
	localize('mergeEditor.conflict.input2.background', '输入 2 中修饰的背景色。')
);
