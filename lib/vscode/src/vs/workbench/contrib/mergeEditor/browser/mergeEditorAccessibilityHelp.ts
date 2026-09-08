/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { localize } from '../../../../nls.js';
import { AccessibleContentProvider, AccessibleViewProviderId, AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ContextKeyEqualsExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';


export class MergeEditorAccessibilityHelpProvider implements IAccessibleViewImplementation {
	readonly name = 'mergeEditor';
	readonly type = AccessibleViewType.Help;
	readonly priority = 125;
	readonly when = ContextKeyEqualsExpr.create('isMergeEditor', true);
	getProvider(accessor: ServicesAccessor) {
		const codeEditorService = accessor.get(ICodeEditorService);

		const codeEditor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();
		if (!codeEditor) {
			return;
		}

		const content = [
			localize('msg1', "你位于合并编辑器中。"),
			localize('msg2', "使用命令“转到下一个未处理的冲突{0}”和“转到上一个未处理的冲突{1}”在合并冲突之间导航。", '<keybinding:merge.goToNextUnhandledConflict>', '<keybinding:merge.goToPreviousUnhandledConflict>'),
			localize('msg3', "运行命令“合并编辑器: 接受来自左侧的所有传入更改{0}”和“合并编辑器: 接受来自右侧的所有当前更改{1}”", '<keybinding:merge.acceptAllInput1>', '<keybinding:merge.acceptAllInput2>'),
			localize('msg4', "完成合并{0}。", '<keybinding:mergeEditor.acceptMerge>'),
			localize('msg5', "在合并编辑器输入、传入和当前更改 {0} 之间切换。", '<keybinding:mergeEditor.toggleBetweenInputs>'),
		];

		return new AccessibleContentProvider(
			AccessibleViewProviderId.MergeEditor,
			{ type: AccessibleViewType.Help },
			() => content.join('\n'),
			() => codeEditor.focus(),
			AccessibilityVerbositySettingId.MergeEditor,
		);
	}
}
