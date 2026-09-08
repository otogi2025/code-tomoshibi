/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { AccessibleDiffViewerNext, AccessibleDiffViewerPrev } from '../../../../editor/browser/widget/diffEditor/commands.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { localize } from '../../../../nls.js';
import { AccessibleViewProviderId, AccessibleViewType, AccessibleContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyEqualsExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { getCommentCommandInfo } from '../../accessibility/browser/editorAccessibilityHelp.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';

export class DiffEditorAccessibilityHelp implements IAccessibleViewImplementation {
	readonly priority = 105;
	readonly name = 'diff-editor';
	readonly when = ContextKeyEqualsExpr.create('isInDiffEditor', true);
	readonly type = AccessibleViewType.Help;
	getProvider(accessor: ServicesAccessor) {
		const editorService = accessor.get(IEditorService);
		const codeEditorService = accessor.get(ICodeEditorService);
		const keybindingService = accessor.get(IKeybindingService);
		const contextKeyService = accessor.get(IContextKeyService);

		if (!(editorService.activeTextEditorControl instanceof DiffEditorWidget)) {
			return;
		}

		const codeEditor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();
		if (!codeEditor) {
			return;
		}

		const switchSides = localize('msg3', "运行命令差异编辑器: 切换侧面{0}可在原始编辑器和修改后的编辑器之间切换。", '<keybinding:diffEditor.switchSide>');
		const diffEditorActiveAnnouncement = localize('msg5', "accessibility.verbosity.diffEditorActive 设置控制在差异编辑器成为活动编辑器时是否会发布差异编辑器公告。");

		const keys = ['accessibility.signals.diffLineDeleted', 'accessibility.signals.diffLineInserted', 'accessibility.signals.diffLineModified'];
		const content = [
			localize('msg1', "在一个差异编辑器的窗格中。"),
			localize('msg2', "在针对屏幕阅读器优化的差异审阅模式下查看下一个{0}或上一个{1}差异。", '<keybinding:' + AccessibleDiffViewerNext.id + '>', '<keybinding:' + AccessibleDiffViewerPrev.id + '>'),
			switchSides,
			diffEditorActiveAnnouncement,
			localize('msg4', "若要控制应播放哪些辅助功能信号，可以配置以下设置: {0}。", keys.join(', ')),
		];
		const commentCommandInfo = getCommentCommandInfo(keybindingService, contextKeyService, codeEditor);
		if (commentCommandInfo) {
			content.push(commentCommandInfo);
		}
		return new AccessibleContentProvider(
			AccessibleViewProviderId.DiffEditor,
			{ type: AccessibleViewType.Help },
			() => content.join('\n'),
			() => codeEditor.focus(),
			AccessibilityVerbositySettingId.DiffEditor,
		);
	}
}
