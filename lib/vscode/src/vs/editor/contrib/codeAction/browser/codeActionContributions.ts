/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { editorConfigurationBaseNode } from '../../../common/config/editorConfigurationSchema.js';
import { AutoFixAction, CodeActionCommand, FixAllAction, OrganizeImportsAction, QuickFixAction, RefactorAction, SourceAction } from './codeActionCommands.js';
import { CodeActionController } from './codeActionController.js';
import { LightBulbWidget } from './lightBulbWidget.js';
import * as nls from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

registerEditorContribution(CodeActionController.ID, CodeActionController, EditorContributionInstantiation.Eventually);
registerEditorContribution(LightBulbWidget.ID, LightBulbWidget, EditorContributionInstantiation.Lazy);
registerAction2(QuickFixAction);
registerEditorAction(RefactorAction);
registerEditorAction(SourceAction);
registerEditorAction(OrganizeImportsAction);
registerEditorAction(AutoFixAction);
registerEditorAction(FixAllAction);
registerEditorCommand(new CodeActionCommand());

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.codeActionWidget.showHeaders': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			description: nls.localize('showCodeActionHeaders', "启用/禁用在代码操作菜单中显示组标头。"),
			default: true,
		},
	}
});

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.codeActionWidget.includeNearbyQuickFixes': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			description: nls.localize('includeNearbyQuickFixes', "启用/禁用在当前未进行诊断时显示行内最近的快速修复。"),
			default: true,
		},
	}
});

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.codeActions.triggerOnFocusChange': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: nls.localize('triggerOnFocusChange', '当 {1} 设置为 {2} 时，启用触发 {0}。代码操作必须设置为 {3} 以便在窗口和焦点更改时触发。', '`#editor.codeActionsOnSave#`', '`#files.autoSave#`', '`afterDelay`', '`always`'),
			default: false,
		},
	}
});
