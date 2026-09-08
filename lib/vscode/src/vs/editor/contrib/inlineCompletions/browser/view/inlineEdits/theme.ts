/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { assertNever } from '../../../../../../base/common/assert.js';
import { Color } from '../../../../../../base/common/color.js';
import { BugIndicatingError } from '../../../../../../base/common/errors.js';
import { IObservable, observableFromEventOpts } from '../../../../../../base/common/observable.js';
import { localize } from '../../../../../../nls.js';
import { buttonBackground, buttonForeground, diffInserted, diffInsertedLine, diffRemoved, editorBackground, editorHoverBackground, editorHoverBorder, editorHoverForeground } from '../../../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable, ColorIdentifier, darken, registerColor, transparent } from '../../../../../../platform/theme/common/colorUtils.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { InlineCompletionEditorType } from '../../model/provideInlineCompletions.js';
import { InlineEditTabAction } from './inlineEditsViewInterface.js';

export const originalBackgroundColor = registerColor(
	'inlineEdit.originalBackground',
	transparent(diffRemoved, 0.2),
	localize('inlineEdit.originalBackground', '内联编辑中原始文本的背景色。'),
	true
);
export const modifiedBackgroundColor = registerColor(
	'inlineEdit.modifiedBackground',
	transparent(diffInserted, 0.3),
	localize('inlineEdit.modifiedBackground', '内联编辑中已修改文本的背景色。'),
	true
);

export const originalChangedLineBackgroundColor = registerColor(
	'inlineEdit.originalChangedLineBackground',
	transparent(diffRemoved, 0.8),
	localize('inlineEdit.originalChangedLineBackground', '内联编辑的原始文本中已更改行的背景色。'),
	true
);

export const originalChangedTextOverlayColor = registerColor(
	'inlineEdit.originalChangedTextBackground',
	transparent(diffRemoved, 0.8),
	localize('inlineEdit.originalChangedTextBackground', '内联编辑的原始文本中已更改文本的覆盖颜色。'),
	true
);

export const modifiedChangedLineBackgroundColor = registerColor(
	'inlineEdit.modifiedChangedLineBackground',
	{
		light: transparent(diffInsertedLine, 0.7),
		dark: transparent(diffInsertedLine, 0.7),
		hcDark: diffInsertedLine,
		hcLight: diffInsertedLine
	},
	localize('inlineEdit.modifiedChangedLineBackground', '内联编辑的修改文本中已更改行的背景色。'),
	true
);

export const modifiedChangedTextOverlayColor = registerColor(
	'inlineEdit.modifiedChangedTextBackground',
	transparent(diffInserted, 0.7),
	localize('inlineEdit.modifiedChangedTextBackground', '内联编辑的修改文本中已更改文本的覆盖颜色。'),
	true
);

// ------- GUTTER INDICATOR -------

export const inlineEditIndicatorPrimaryForeground = registerColor(
	'inlineEdit.gutterIndicator.primaryForeground',
	buttonForeground,
	localize('inlineEdit.gutterIndicator.primaryForeground', '主要内联编辑装订线指示器的前景色。')
);
export const inlineEditIndicatorPrimaryBorder = registerColor(
	'inlineEdit.gutterIndicator.primaryBorder',
	buttonBackground,
	localize('inlineEdit.gutterIndicator.primaryBorder', '主要内联编辑装订线指示器的边框颜色。')
);
export const inlineEditIndicatorPrimaryBackground = registerColor(
	'inlineEdit.gutterIndicator.primaryBackground',
	{
		light: transparent(inlineEditIndicatorPrimaryBorder, 0.5),
		dark: transparent(inlineEditIndicatorPrimaryBorder, 0.4),
		hcDark: transparent(inlineEditIndicatorPrimaryBorder, 0.4),
		hcLight: transparent(inlineEditIndicatorPrimaryBorder, 0.5),
	},
	localize('inlineEdit.gutterIndicator.primaryBackground', '主要内联编辑装订线指示器的背景色。')
);

export const inlineEditIndicatorSecondaryForeground = registerColor(
	'inlineEdit.gutterIndicator.secondaryForeground',
	editorHoverForeground,
	localize('inlineEdit.gutterIndicator.secondaryForeground', '辅助内联编辑装订线指示器的前景色。')
);
export const inlineEditIndicatorSecondaryBorder = registerColor(
	'inlineEdit.gutterIndicator.secondaryBorder',
	editorHoverBorder,
	localize('inlineEdit.gutterIndicator.secondaryBorder', '辅助内联编辑装订线指示器的边框颜色。')
);
export const inlineEditIndicatorSecondaryBackground = registerColor(
	'inlineEdit.gutterIndicator.secondaryBackground',
	editorHoverBackground,
	localize('inlineEdit.gutterIndicator.secondaryBackground', '辅助内联编辑装订线指示器的背景色。')
);

export const inlineEditIndicatorSuccessfulForeground = registerColor(
	'inlineEdit.gutterIndicator.successfulForeground',
	buttonForeground,
	localize('inlineEdit.gutterIndicator.successfulForeground', '成功内联编辑装订线指示器的前景色。')
);
export const inlineEditIndicatorSuccessfulBorder = registerColor(
	'inlineEdit.gutterIndicator.successfulBorder',
	buttonBackground,
	localize('inlineEdit.gutterIndicator.successfulBorder', '成功内联编辑装订线指示器的边框颜色。')
);
export const inlineEditIndicatorSuccessfulBackground = registerColor(
	'inlineEdit.gutterIndicator.successfulBackground',
	inlineEditIndicatorSuccessfulBorder,
	localize('inlineEdit.gutterIndicator.successfulBackground', '成功的内联编辑装订线指示器的背景色。')
);

export const inlineEditIndicatorBackground = registerColor(
	'inlineEdit.gutterIndicator.background',
	{
		hcDark: transparent('tab.inactiveBackground', 0.5),
		hcLight: transparent('tab.inactiveBackground', 0.5),
		dark: transparent('tab.inactiveBackground', 0.5),
		light: '#5f5f5f18',
	},
	localize('inlineEdit.gutterIndicator.background', '内联编辑装订线指示器的背景色。')
);

// ------- BORDER COLORS -------

const originalBorder = registerColor(
	'inlineEdit.originalBorder',
	{
		light: diffRemoved,
		dark: diffRemoved,
		hcDark: diffRemoved,
		hcLight: diffRemoved
	},
	localize('inlineEdit.originalBorder', '内联编辑中原始文本的边框颜色。')
);

const modifiedBorder = registerColor(
	'inlineEdit.modifiedBorder',
	{
		light: darken(diffInserted, 0.6),
		dark: diffInserted,
		hcDark: diffInserted,
		hcLight: diffInserted
	},
	localize('inlineEdit.modifiedBorder', '内联编辑中已修改文本的边框颜色。')
);

const tabWillAcceptModifiedBorder = registerColor(
	'inlineEdit.tabWillAcceptModifiedBorder',
	{
		light: darken(modifiedBorder, 0),
		dark: darken(modifiedBorder, 0),
		hcDark: darken(modifiedBorder, 0),
		hcLight: darken(modifiedBorder, 0)
	},
	localize('inlineEdit.tabWillAcceptModifiedBorder', '按 Tab 键接受它时，内联编辑小组件修改后的边框颜色。')
);

const tabWillAcceptOriginalBorder = registerColor(
	'inlineEdit.tabWillAcceptOriginalBorder',
	{
		light: darken(originalBorder, 0),
		dark: darken(originalBorder, 0),
		hcDark: darken(originalBorder, 0),
		hcLight: darken(originalBorder, 0)
	},
	localize('inlineEdit.tabWillAcceptOriginalBorder', '按 Tab 键接受它时，原始文本上方内联编辑小组件的原始边框颜色。')
);

export function getModifiedBorderColor(tabAction: IObservable<InlineEditTabAction>): IObservable<string> {
	return tabAction.map(a => a === InlineEditTabAction.Accept ? tabWillAcceptModifiedBorder : modifiedBorder);
}

export function getOriginalBorderColor(tabAction: IObservable<InlineEditTabAction>): IObservable<string> {
	return tabAction.map(a => a === InlineEditTabAction.Accept ? tabWillAcceptOriginalBorder : originalBorder);
}

export function getEditorBlendedColor(colorIdentifier: ColorIdentifier | IObservable<ColorIdentifier>, themeService: IThemeService): IObservable<Color> {
	let color: IObservable<Color>;
	if (typeof colorIdentifier === 'string') {
		color = observeColor(colorIdentifier, themeService);
	} else {
		color = colorIdentifier.map((identifier, reader) => observeColor(identifier, themeService).read(reader));
	}

	const backgroundColor = observeColor(editorBackground, themeService);

	return color.map((c, reader) => /** @description makeOpaque */ c.makeOpaque(backgroundColor.read(reader)));
}

export function getEditorBackgroundColor(editorType: InlineCompletionEditorType): string {
	let color;
	switch (editorType) {
		case InlineCompletionEditorType.TextEditor:
			color = editorBackground; break;
		case InlineCompletionEditorType.DiffEditor:
			color = editorBackground; break;
		default:
			assertNever(editorType, 'Not supported editor type yet');
	}
	return asCssVariable(color);
}


export function observeColor(colorIdentifier: ColorIdentifier, themeService: IThemeService): IObservable<Color> {
	return observableFromEventOpts(
		{
			owner: { observeColor: colorIdentifier },
			equalsFn: (a: Color, b: Color) => a.equals(b),
			debugName: () => `observeColor(${colorIdentifier})`
		},
		themeService.onDidColorThemeChange,
		() => {
			const color = themeService.getColorTheme().getColor(colorIdentifier);
			if (!color) {
				throw new BugIndicatingError(`Missing color: ${colorIdentifier}`);
			}
			return color;
		}
	);
}

// Styles
export const INLINE_EDITS_BORDER_RADIUS = 3; // also used in CSS file
