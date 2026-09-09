/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ShellIntegrationStatus, TerminalSettingId, WindowsShellType } from '../../../../../platform/terminal/common/terminal.js';
import { AccessibilityCommandId } from '../../../accessibility/common/accessibilityCommands.js';
import { ITerminalInstance, IXtermTerminal } from '../../../terminal/browser/terminal.js';
import { TerminalCommandId } from '../../../terminal/common/terminal.js';
import type { Terminal } from '@xterm/xterm';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TerminalAccessibilitySettingId } from '../common/terminalAccessibilityConfiguration.js';
import { TerminalAccessibilityCommandId } from '../common/terminal.accessibility.js';
import { TerminalLinksCommandId } from '../../links/common/terminal.links.js';
import { IAccessibleViewContentProvider, AccessibleViewProviderId, IAccessibleViewOptions, AccessibleViewType } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { accessibleViewIsShown, accessibleViewCurrentProviderId, AccessibilityVerbositySettingId } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { TerminalSuggestCommandId } from '../../suggest/common/terminal.suggest.js';
import { TerminalSuggestSettingId } from '../../suggest/common/terminalSuggestConfiguration.js';

export const enum ClassName {
	Active = 'active',
	EditorTextArea = 'textarea'
}

export class TerminalAccessibilityHelpProvider extends Disposable implements IAccessibleViewContentProvider {
	id = AccessibleViewProviderId.TerminalHelp;
	private readonly _hasShellIntegration: boolean = false;
	onClose() {
		const expr = ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.TerminalHelp));
		if (expr?.evaluate(this._contextKeyService.getContext(null))) {
			this._commandService.executeCommand(TerminalAccessibilityCommandId.FocusAccessibleBuffer);
		} else {
			this._instance.focus();
		}
		this.dispose();
	}
	options: IAccessibleViewOptions = {
		type: AccessibleViewType.Help,
		readMoreUrl: 'https://code.visualstudio.com/docs/editor/accessibility#_terminal-accessibility'
	};
	verbositySettingKey = AccessibilityVerbositySettingId.Terminal;

	constructor(
		private readonly _instance: Pick<ITerminalInstance, 'shellType' | 'capabilities' | 'onDidRequestFocus' | 'resource' | 'focus'>,
		_xterm: Pick<IXtermTerminal, 'getFont' | 'shellIntegration'> & { raw: Terminal },
		@ICommandService private readonly _commandService: ICommandService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
	) {
		super();
		this._hasShellIntegration = _xterm.shellIntegration.status === ShellIntegrationStatus.VSCode;
	}
	provideContent(): string {
		const content = [
			localize('focusAccessibleTerminalView', '焦点可访问终端视图命令<keybinding:{0}>使屏幕阅读器能够读取终端内容。', TerminalAccessibilityCommandId.FocusAccessibleBuffer),
			localize('preserveCursor', '自定义使用“terminal.integrated.accessibleViewPreserveCursorPosition”在终端和可访问视图之间切换时的光标行为。'),
			localize('openDetectedLink', '打开检测到的链接命令<keybinding:{0}>使屏幕阅读器能够轻松打开在终端中找到的链接。', TerminalLinksCommandId.OpenDetectedLink),
			localize('newWithProfile', '借助创建新终端(带配置文件)命令<keybinding:{0}>，可以使用特定配置文件轻松创建终端。', TerminalCommandId.NewWithProfile),
			localize('focusAfterRun', '使用 `{0}`在终端中运行所选文本后，配置焦点。', TerminalSettingId.FocusAfterRun),
		];

		if (!this._configurationService.getValue(TerminalAccessibilitySettingId.AccessibleViewFocusOnCommandExecution)) {
			content.push(localize('focusViewOnExecution', '启用 `terminal.integrated.accessibleViewFocusOnCommandExecution`，以便在终端中执行命令时自动聚焦终端可访问视图。'));
		}

		if (this._configurationService.getValue(TerminalSuggestSettingId.Enabled)) {
			content.push(localize('suggestTrigger', '可以手动调用终端请求完成命令<键绑定：{0}>，但在键入时也会显示。', TerminalSuggestCommandId.TriggerSuggest));
			content.push(localize('suggest', '当终端建议聚焦小组件时:'));
			content.push(localize('suggestCommands', '- 接受建议<keybinding:{0}>并配置建议设置<keybinding:{1}>。', TerminalSuggestCommandId.AcceptSelectedSuggestion, TerminalSuggestCommandId.ConfigureSettings));
			content.push(localize('suggestCommandsMore', '- 在小组件和终端<keybinding:{0}>之间切换，然后切换详细信息焦点<keybinding:{1}>以了解有关建议的详细信息。', TerminalSuggestCommandId.ToggleDetails, TerminalSuggestCommandId.ToggleDetailsFocus));
			content.push(localize('suggestLearnMore', '- 详细了解建议<keybinding:{0}>。', TerminalSuggestCommandId.LearnMore));
			content.push(localize('suggestConfigure', '- 配置建议设置<keybinding:{0}>', TerminalSuggestCommandId.ConfigureSettings));
		}

		if (this._instance.shellType === WindowsShellType.CommandPrompt) {
			content.push(localize('commandPromptMigration', "考虑使用 powershell (而非命令提示符)以改进体验"));
		}

		if (this._hasShellIntegration) {
			content.push(localize('shellIntegration', "终端具有一种称为 shell 集成的功能，可提供增强的体验并为屏幕阅读器提供有用的命令，例如:"));
			content.push('- ' + localize('goToNextCommand', '可访问视图中转到下一个命令<keybinding:{0}>', TerminalAccessibilityCommandId.AccessibleBufferGoToNextCommand));
			content.push('- ' + localize('goToPreviousCommand', '可访问视图中转到上一个命令<keybinding:{0}>', TerminalAccessibilityCommandId.AccessibleBufferGoToPreviousCommand));
			content.push('- ' + localize('goToSymbol', '转到符号<keybinding:{0}>', AccessibilityCommandId.GoToSymbol));
		} else {
			content.push(localize('noShellIntegration', '未启用 Shell 集成。某些辅助功能可能不可用。'));
		}

		return content.join('\n');
	}
}
