/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './highlightDecorations.css';
import { MinimapPosition, OverviewRulerLane, TrackedRangeStickiness } from '../../../common/model.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { DocumentHighlightKind } from '../../../common/languages.js';
import * as nls from '../../../../nls.js';
import { activeContrastBorder, editorSelectionHighlight, minimapSelectionOccurrenceHighlight, overviewRulerSelectionHighlightForeground, registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { registerThemingParticipant, themeColorFromId } from '../../../../platform/theme/common/themeService.js';

const wordHighlightBackground = registerColor('editor.wordHighlightBackground', { dark: '#575757B8', light: '#57575740', hcDark: null, hcLight: null }, nls.localize('wordHighlight', '读取访问期间符号的背景色，例如读取变量时。颜色必须透明，以免隐藏下面的修饰效果。'), true);
registerColor('editor.wordHighlightStrongBackground', { dark: '#004972B8', light: '#0e639c40', hcDark: null, hcLight: null }, nls.localize('wordHighlightStrong', '写入访问过程中符号的背景色，例如写入变量时。颜色必须透明，以免隐藏下面的修饰效果。'), true);
registerColor('editor.wordHighlightTextBackground', wordHighlightBackground, nls.localize('wordHighlightText', '符号在文本中出现时的背景色。颜色必须透明，以免隐藏下层的修饰。'), true);
const wordHighlightBorder = registerColor('editor.wordHighlightBorder', { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('wordHighlightBorder', '符号在进行读取访问操作时的边框颜色，例如读取变量。'));
registerColor('editor.wordHighlightStrongBorder', { light: null, dark: null, hcDark: activeContrastBorder, hcLight: activeContrastBorder }, nls.localize('wordHighlightStrongBorder', '符号在进行写入访问操作时的边框颜色，例如写入变量。'));
registerColor('editor.wordHighlightTextBorder', wordHighlightBorder, nls.localize('wordHighlightTextBorder', "符号在文本中出现时的边框颜色。"));
const overviewRulerWordHighlightForeground = registerColor('editorOverviewRuler.wordHighlightForeground', '#A0A0A0CC', nls.localize('overviewRulerWordHighlightForeground', '用于突出显示符号的概述标尺标记颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);
const overviewRulerWordHighlightStrongForeground = registerColor('editorOverviewRuler.wordHighlightStrongForeground', '#C0A0C0CC', nls.localize('overviewRulerWordHighlightStrongForeground', '用于突出显示写权限符号的概述标尺标记颜色。颜色必须透明，以免隐藏下面的修饰效果。'), true);
const overviewRulerWordHighlightTextForeground = registerColor('editorOverviewRuler.wordHighlightTextForeground', overviewRulerSelectionHighlightForeground, nls.localize('overviewRulerWordHighlightTextForeground', '符号在文本中出现时的概述标尺标记颜色。颜色必须透明，以免隐藏下层的修饰。'), true);

const _WRITE_OPTIONS = ModelDecorationOptions.register({
	description: 'word-highlight-strong',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	className: 'wordHighlightStrong',
	overviewRuler: {
		color: themeColorFromId(overviewRulerWordHighlightStrongForeground),
		position: OverviewRulerLane.Center
	},
	minimap: {
		color: themeColorFromId(minimapSelectionOccurrenceHighlight),
		position: MinimapPosition.Inline
	},
});

const _TEXT_OPTIONS = ModelDecorationOptions.register({
	description: 'word-highlight-text',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	className: 'wordHighlightText',
	overviewRuler: {
		color: themeColorFromId(overviewRulerWordHighlightTextForeground),
		position: OverviewRulerLane.Center
	},
	minimap: {
		color: themeColorFromId(minimapSelectionOccurrenceHighlight),
		position: MinimapPosition.Inline
	},
});

const _SELECTION_HIGHLIGHT_OPTIONS = ModelDecorationOptions.register({
	description: 'selection-highlight-overview',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	className: 'selectionHighlight',
	overviewRuler: {
		color: themeColorFromId(overviewRulerSelectionHighlightForeground),
		position: OverviewRulerLane.Center
	},
	minimap: {
		color: themeColorFromId(minimapSelectionOccurrenceHighlight),
		position: MinimapPosition.Inline
	},
});

const _SELECTION_HIGHLIGHT_OPTIONS_NO_OVERVIEW = ModelDecorationOptions.register({
	description: 'selection-highlight',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	className: 'selectionHighlight',
});

const _REGULAR_OPTIONS = ModelDecorationOptions.register({
	description: 'word-highlight',
	stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
	className: 'wordHighlight',
	overviewRuler: {
		color: themeColorFromId(overviewRulerWordHighlightForeground),
		position: OverviewRulerLane.Center
	},
	minimap: {
		color: themeColorFromId(minimapSelectionOccurrenceHighlight),
		position: MinimapPosition.Inline
	},
});

export function getHighlightDecorationOptions(kind: DocumentHighlightKind | undefined): ModelDecorationOptions {
	if (kind === DocumentHighlightKind.Write) {
		return _WRITE_OPTIONS;
	} else if (kind === DocumentHighlightKind.Text) {
		return _TEXT_OPTIONS;
	} else {
		return _REGULAR_OPTIONS;
	}
}

export function getSelectionHighlightDecorationOptions(hasSemanticHighlights: boolean): ModelDecorationOptions {
	// Show in overviewRuler only if model has no semantic highlighting
	return (hasSemanticHighlights ? _SELECTION_HIGHLIGHT_OPTIONS_NO_OVERVIEW : _SELECTION_HIGHLIGHT_OPTIONS);
}

registerThemingParticipant((theme, collector) => {
	const selectionHighlight = theme.getColor(editorSelectionHighlight);
	if (selectionHighlight) {
		collector.addRule(`.monaco-editor .selectionHighlight { background-color: ${selectionHighlight.transparent(0.5)}; }`);
	}
});
