/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { ICodeEditor } from '../../../browser/editorBrowser.js';
import { IModelDecorationOptions, IModelDecorationsChangeAccessor, MinimapPosition, TrackedRangeStickiness } from '../../../common/model.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { IDecorationProvider } from './foldingModel.js';
import { localize } from '../../../../nls.js';
import { editorSelectionBackground, iconForeground, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

const foldBackground = registerColor('editor.foldBackground', { light: transparent(editorSelectionBackground, 0.3), dark: transparent(editorSelectionBackground, 0.3), hcDark: null, hcLight: null }, localize('foldBackgroundBackground', "折叠范围后面的背景颜色。颜色必须设为透明，以免隐藏底层装饰。"), true);
registerColor('editor.foldPlaceholderForeground', { light: '#808080', dark: '#808080', hcDark: null, hcLight: null }, localize('collapsedTextColor', "在折叠范围的第一行后的折叠文本的颜色。"));
registerColor('editorGutter.foldingControlForeground', iconForeground, localize('editorGutter.foldingControlForeground', '编辑器装订线中折叠控件的颜色。'));

export const foldingExpandedIcon = registerIcon('folding-expanded', Codicon.chevronDown, localize('foldingExpandedIcon', '编辑器字形边距中已展开的范围的图标。'));
export const foldingCollapsedIcon = registerIcon('folding-collapsed', Codicon.chevronRight, localize('foldingCollapsedIcon', '编辑器字形边距中已折叠的范围的图标。'));
export const foldingManualCollapsedIcon = registerIcon('folding-manual-collapsed', foldingCollapsedIcon, localize('foldingManualCollapedIcon', '编辑器字形边距中手动折叠的范围的图标。'));
export const foldingManualExpandedIcon = registerIcon('folding-manual-expanded', foldingExpandedIcon, localize('foldingManualExpandedIcon', '编辑器字形边距中手动展开的范围的图标。'));

const foldedBackgroundMinimap = { color: themeColorFromId(foldBackground), position: MinimapPosition.Inline };

const collapsed = localize('linesCollapsed', "单击以展开范围。");
const expanded = localize('linesExpanded', "单击以折叠范围。");

export class FoldingDecorationProvider implements IDecorationProvider {

	private static readonly COLLAPSED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-collapsed-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingCollapsedIcon),
	});

	private static readonly COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-collapsed-highlighted-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingCollapsedIcon)
	});

	private static readonly MANUALLY_COLLAPSED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-collapsed-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualCollapsedIcon)
	});

	private static readonly MANUALLY_COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-collapsed-highlighted-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualCollapsedIcon)
	});

	private static readonly NO_CONTROLS_COLLAPSED_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
	});

	private static readonly NO_CONTROLS_COLLAPSED_HIGHLIGHTED_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		afterContentClassName: 'inline-folded',
		className: 'folded-background',
		minimap: foldedBackgroundMinimap,
		isWholeLine: true,
		linesDecorationsTooltip: collapsed,
	});

	private static readonly EXPANDED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-expanded-visual-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: 'alwaysShowFoldIcons ' + ThemeIcon.asClassName(foldingExpandedIcon),
		linesDecorationsTooltip: expanded,
	});

	private static readonly EXPANDED_AUTO_HIDE_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-expanded-auto-hide-visual-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingExpandedIcon),
		linesDecorationsTooltip: expanded,
	});

	private static readonly MANUALLY_EXPANDED_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-expanded-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: 'alwaysShowFoldIcons ' + ThemeIcon.asClassName(foldingManualExpandedIcon),
		linesDecorationsTooltip: expanded,
	});

	private static readonly MANUALLY_EXPANDED_AUTO_HIDE_VISUAL_DECORATION = ModelDecorationOptions.register({
		description: 'folding-manually-expanded-auto-hide-visual-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true,
		firstLineDecorationClassName: ThemeIcon.asClassName(foldingManualExpandedIcon),
		linesDecorationsTooltip: expanded,
	});

	private static readonly NO_CONTROLS_EXPANDED_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-no-controls-range-decoration',
		stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
		isWholeLine: true
	});

	private static readonly HIDDEN_RANGE_DECORATION = ModelDecorationOptions.register({
		description: 'folding-hidden-range-decoration',
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
	});

	public showFoldingControls: 'always' | 'never' | 'mouseover' = 'mouseover';

	public showFoldingHighlights: boolean = true;

	constructor(private readonly editor: ICodeEditor) {
	}

	getDecorationOption(isCollapsed: boolean, isHidden: boolean, isManual: boolean): IModelDecorationOptions {
		if (isHidden) { // is inside another collapsed region
			return FoldingDecorationProvider.HIDDEN_RANGE_DECORATION;
		}
		if (this.showFoldingControls === 'never') {
			if (isCollapsed) {
				return this.showFoldingHighlights ? FoldingDecorationProvider.NO_CONTROLS_COLLAPSED_HIGHLIGHTED_RANGE_DECORATION : FoldingDecorationProvider.NO_CONTROLS_COLLAPSED_RANGE_DECORATION;
			}
			return FoldingDecorationProvider.NO_CONTROLS_EXPANDED_RANGE_DECORATION;
		}
		if (isCollapsed) {
			return isManual ?
				(this.showFoldingHighlights ? FoldingDecorationProvider.MANUALLY_COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION : FoldingDecorationProvider.MANUALLY_COLLAPSED_VISUAL_DECORATION)
				: (this.showFoldingHighlights ? FoldingDecorationProvider.COLLAPSED_HIGHLIGHTED_VISUAL_DECORATION : FoldingDecorationProvider.COLLAPSED_VISUAL_DECORATION);
		} else if (this.showFoldingControls === 'mouseover') {
			return isManual ? FoldingDecorationProvider.MANUALLY_EXPANDED_AUTO_HIDE_VISUAL_DECORATION : FoldingDecorationProvider.EXPANDED_AUTO_HIDE_VISUAL_DECORATION;
		} else {
			return isManual ? FoldingDecorationProvider.MANUALLY_EXPANDED_VISUAL_DECORATION : FoldingDecorationProvider.EXPANDED_VISUAL_DECORATION;
		}
	}

	changeDecorations<T>(callback: (changeAccessor: IModelDecorationsChangeAccessor) => T): T | null {
		return this.editor.changeDecorations(callback);
	}

	removeDecorations(decorationIds: string[]): void {
		this.editor.removeDecorations(decorationIds);
	}
}
