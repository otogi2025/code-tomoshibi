/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import type { IStringDictionary } from '../../../../base/common/collections.js';
import { IJSONSchemaSnippet } from '../../../../base/common/jsonSchema.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { isString } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry, type IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { AgentSandboxEnabledValue } from '../../../../platform/sandbox/common/settings.js';
import { TerminalLocationConfigValue, TerminalSettingId } from '../../../../platform/terminal/common/terminal.js';
import { terminalColorSchema, terminalIconSchema } from '../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { ConfigurationKeyValuePairs, IConfigurationMigrationRegistry, Extensions as WorkbenchExtensions } from '../../../common/configuration.js';
import { terminalContribConfiguration, TerminalContribSettingId } from '../terminalContribExports.js';
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT, MAXIMUM_FONT_WEIGHT, MINIMUM_FONT_WEIGHT, SUGGESTIONS_FONT_WEIGHT } from './terminal.js';

const terminalDescriptors = '\n- ' + [
	'`\${cwd}`: ' + localize("cwd", "终端的当前工作目录。"),
	'`\${cwdFolder}`: ' + localize('cwdFolder', "终端的当前工作目录，当值与初始工作目录不同时，显示在多根工作区或单个根工作区中。在 Windows 上，仅当启用 shell 集成时才会显示此内容。"),
	'`\${workspaceFolder}`: ' + localize('workspaceFolder', "在其中启动终端的工作区。"),
	'`\${workspaceFolderName}`: ' + localize('workspaceFolderName', "在其中启动终端的工作区的 `name`。"),
	'`\${local}`: ' + localize('local', "指示远程工作区中的本地终端。"),
	'`\${process}`: ' + localize('process', "终端流程的名称。"),
	'`\${progress}`: ' + localize('progress', "由 `OSC 9;4` 序列报告的进度状态。"),
	'`\${separator}`: ' + localize('separator', "仅在由带有值或静态文本的变量括住时才显示的条件分隔符 {0}。", '(` - `)'),
	'`\${sequence}`: ' + localize('sequence', "进程提供给终端的名称。"),
	'`\${task}`: ' + localize('task', "指示此终端与任务关联。"),
	'`\${shellType}`: ' + localize('shellType', "检测到的 shell 类型。"),
	'`\${shellCommand}`: ' + localize('shellCommand', "根据 shell 集成正在执行的命令。这也要求检测到的命令行具有高可信度，这在某些提示框架中可能不起作用。"),
	'`\${shellPromptInput}`: ' + localize('shellPromptInput', "shell 的完整提示输入(根据 shell 集成)。"),
].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations

let terminalTitle = localize('terminalTitle', "控制终端标题。根据上下文替换变量:");
terminalTitle += terminalDescriptors;

let terminalDescription = localize('terminalDescription', "控制显示在标题右侧的终端说明。根据上下文替换变量:");
terminalDescription += terminalDescriptors;

export const defaultTerminalFontSize = isMacintosh ? 12 : 14;

const terminalConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalSettingId.SendKeybindingsToShell]: {
		markdownDescription: localize('terminal.integrated.sendKeybindingsToShell', "将大多数键绑定调度到终端而不是工作台，重写 {0}，也可以用于微调。", '`#terminal.integrated.commandsToSkipShell#`'),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.TabsDefaultColor]: {
		description: localize('terminal.integrated.tabs.defaultColor', "默认情况下要与终端图标关联的主题颜色 ID。"),
		...terminalColorSchema,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.TabsDefaultIcon]: {
		description: localize('terminal.integrated.tabs.defaultIcon', "默认情况下要与终端图标关联的 codicon ID。"),
		...terminalIconSchema,
		default: Codicon.terminal.id,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.TabsEnabled]: {
		description: localize('terminal.integrated.tabs.enabled', '本 fork 没有上游那份显示在终端一侧的选项卡列表（源码层已删）。Session 一律走标题栏上的横向胶囊条，这个设置留着只是不破坏旧的 settings.json，打开也不会长出侧边列表。'),
		type: 'boolean',
		default: false,
	},
	[TerminalSettingId.TabsEnableAnimation]: {
		description: localize('terminal.integrated.tabs.enableAnimation', '控制终端选项卡状态是否支持动画(例如正在进行的任务)。'),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.TabsHideCondition]: {
		description: localize('terminal.integrated.tabs.hideCondition', '控制在特定条件下是否将隐藏终端选项卡视图。'),
		type: 'string',
		enum: ['never', 'singleTerminal', 'singleGroup'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.hideCondition.never', "从不隐藏终端选项卡视图"),
			localize('terminal.integrated.tabs.hideCondition.singleTerminal', "仅打开一个终端时隐藏终端选项卡视图"),
			localize('terminal.integrated.tabs.hideCondition.singleGroup', "仅打开一个终端组时隐藏终端选项卡视图"),
		],
		default: 'singleTerminal',
	},
	[TerminalSettingId.TabsShowActiveTerminal]: {
		description: localize('terminal.integrated.tabs.showActiveTerminal', '在视图中显示活动的终端信息，当选项卡中的标题不可见时，此功能尤其有用。'),
		type: 'string',
		enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.showActiveTerminal.always', "始终显示活动终端"),
			localize('terminal.integrated.tabs.showActiveTerminal.singleTerminal', "当仅有一个终端打开时显示活动终端"),
			localize('terminal.integrated.tabs.showActiveTerminal.singleTerminalOrNarrow', "仅当终端已打开或选项卡视图处于窄而无文本状态时显示活动终端"),
			localize('terminal.integrated.tabs.showActiveTerminal.never', "从不显示活动终端"),
		],
		default: 'singleTerminalOrNarrow',
	},
	[TerminalSettingId.TabsShowActions]: {
		description: localize('terminal.integrated.tabs.showActions', '控制是否在“新建终端”按钮旁边显示“终端拆分”和“终止”按钮。'),
		type: 'string',
		enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.showActions.always', "始终显示操作"),
			localize('terminal.integrated.tabs.showActions.singleTerminal', "当终端是唯一打开的终端时显示操作"),
			localize('terminal.integrated.tabs.showActions.singleTerminalOrNarrow', "在终端是唯一打开的终端或选项卡视图处于窄而无文本状态时显示活动终端"),
			localize('terminal.integrated.tabs.showActions.never', "从不显示操作"),
		],
		default: 'singleTerminalOrNarrow',
	},
	[TerminalSettingId.TabsLocation]: {
		type: 'string',
		enum: ['left', 'right'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.location.left', "在终端的左侧显示终端选项卡视图"),
			localize('terminal.integrated.tabs.location.right', "在终端的右侧显示终端选项卡视图")
		],
		default: 'right',
		description: localize('terminal.integrated.tabs.location', "控制终端选项卡的位置，该位置位于实际终端的左侧或右侧。")
	},
	[TerminalSettingId.DefaultLocation]: {
		type: 'string',
		enum: [TerminalLocationConfigValue.Editor, TerminalLocationConfigValue.TerminalView],
		enumDescriptions: [
			localize('terminal.integrated.defaultLocation.editor', "在编辑器中创建终端"),
			localize('terminal.integrated.defaultLocation.view', "在终端视图中创建终端")
		],
		default: 'view',
		description: localize('terminal.integrated.defaultLocation', "控制新建终端的显示位置。"),
		agentsWindow: { default: 'view', readOnly: true },
	},
	[TerminalSettingId.TabsFocusMode]: {
		type: 'string',
		enum: ['singleClick', 'doubleClick'],
		enumDescriptions: [
			localize('terminal.integrated.tabs.focusMode.singleClick', "双击终端选项卡时聚焦终端"),
			localize('terminal.integrated.tabs.focusMode.doubleClick', "双击终端选项卡时聚焦终端")
		],
		default: 'doubleClick',
		description: localize('terminal.integrated.tabs.focusMode', "控制是在双击时将焦点放在某个选项卡上还是单击。")
	},
	[TerminalSettingId.TabsAllowAgentCliTitle]: {
		description: localize('terminal.integrated.tabs.allowAgentCliTitle', "Controls whether agentic CLIs (such as Claude Code, Codex, Command Code, GitHub Copilot CLI, and Gemini CLI) are allowed to set the terminal tab title via escape sequences. When disabled, the configured tab title template is used instead."),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.MacOptionIsMeta]: {
		description: localize('terminal.integrated.macOptionIsMeta', "控制是否将选项键视为 macOS 中的终端上的元键。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.MacOptionClickForcesSelection]: {
		description: localize('terminal.integrated.macOptionClickForcesSelection', "控制在 macOS 上使用 Option+单击时是否强制选择内容。这将强制进行常规(行)选择并禁止使用列选择模式。这样，可使用常规终端选择进行复制粘贴，例如在 tmux 中启用鼠标模式时。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.AltClickMovesCursor]: {
		markdownDescription: localize('terminal.integrated.altClickMovesCursor', "如果启用，则当 {0} 设置为 {1} (默认值)时，alt/option+单击会将提示光标重置于鼠标下方。此功能的有效性取决于 shell。", '`#editor.multiCursorModifier#`', '`\'alt\'`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.CopyOnSelection]: {
		description: localize('terminal.integrated.copyOnSelection', "控制是否将在终端中选定的文本复制到剪贴板。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableMultiLinePasteWarning]: {
		markdownDescription: localize('terminal.integrated.enableMultiLinePasteWarning', "控制将多行粘贴到终端时是否显示警告对话框。"),
		type: 'string',
		enum: ['auto', 'always', 'never'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.enableMultiLinePasteWarning.auto', "启用警告，但在以下情况下不显示该警告：\r\n\r\n- 已启用带括号的粘贴模式（shell 支持本机多行粘贴）\r\n- 粘贴由 shell 的读取一行数据处理（在 pwsh 的情况下）"),
			localize('terminal.integrated.enableMultiLinePasteWarning.always', "如果文本包含新行，则始终显示该警告。"),
			localize('terminal.integrated.enableMultiLinePasteWarning.never', "从不显示警告。")
		],
		default: 'auto'
	},
	[TerminalSettingId.DrawBoldTextInBrightColors]: {
		description: localize('terminal.integrated.drawBoldTextInBrightColors', "控制终端中的加粗文本是否始终使用 \"bright\" ANSI 颜色变量。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.FontFamily]: {
		markdownDescription: localize('terminal.integrated.fontFamily', "控制终端的字体系列，默认为 {0} 的值。", '`#editor.fontFamily#`'),
		type: 'string',
	},
	[TerminalSettingId.FontLigaturesEnabled]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.enabled', "控制是否在终端中启用字体连字。只有配置的 {0} 支持连字才能正常工作。", `\`#${TerminalSettingId.FontFamily}#\``),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.FontLigaturesFeatureSettings]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.featureSettings', "控制启用连字时使用哪些字体功能设置，格式为 `font-feature-settings` CSS 属性。根据字体可能有效的一些示例:") + '\n\n- ' + [
			`\`"calt" off, "ss03"\``,
			`\`"liga" on\``,
			`\`"calt" off, "dlig" on\``
		].join('\n- '),
		type: 'string',
		default: '"calt" on'
	},
	[TerminalSettingId.FontLigaturesFallbackLigatures]: {
		markdownDescription: localize('terminal.integrated.fontLigatures.fallbackLigatures', "启用 {0} 且无法分析特定 {1} 时，这是将始终一起绘制的字符序列集。这允许使用固定的连字集，即使字体不受支持。", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.FontFamily}#\``),
		type: 'array',
		items: [{ type: 'string' }],
		default: [
			'<--', '<---', '<<-', '<-', '->', '->>', '-->', '--->',
			'<==', '<===', '<<=', '<=', '=>', '=>>', '==>', '===>', '>=', '>>=',
			'<->', '<-->', '<--->', '<---->', '<=>', '<==>', '<===>', '<====>', '::', ':::',
			'<~~', '</', '</>', '/>', '~~>', '==', '!=', '/=', '~=', '<>', '===', '!==', '!===',
			'<:', ':=', '*=', '*+', '<*', '<*>', '*>', '<|', '<|>', '|>', '+*', '=*', '=:', ':>',
			'/*', '*/', '+++', '<!--', '<!---'
		]
	},
	[TerminalSettingId.FontSize]: {
		description: localize('terminal.integrated.fontSize', "控制终端的字号(以像素为单位)。"),
		type: 'number',
		default: defaultTerminalFontSize,
		minimum: 6,
		maximum: 100
	},
	[TerminalSettingId.LetterSpacing]: {
		description: localize('terminal.integrated.letterSpacing', "控制终端的字母间距，这是一个整数值，表示要在字符之间添加的额外像素数目。"),
		type: 'number',
		default: DEFAULT_LETTER_SPACING
	},
	[TerminalSettingId.LineHeight]: {
		description: localize('terminal.integrated.lineHeight', "控制终端的行高，此数字乘以终端字号等于实际行高(以像素为单位)。"),
		type: 'number',
		default: DEFAULT_LINE_HEIGHT
	},
	[TerminalSettingId.MinimumContrastRatio]: {
		markdownDescription: localize('terminal.integrated.minimumContrastRatio', "设置每个单元格的前景色时，将改为尝试符合指定的对比度比率。示例值:\r\n\r\n- 1: 不执行任何操作，使用标准主题颜色。\r\n- 4.5: [符合 WCAG AA 标准(最低)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html)(默认)。\r\n- 7: [符合 WCAG AAA 标准(增强)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast7.html)。\r\n- 21: 黑底白字或白底黑字。"),
		type: 'number',
		default: 4.5,
		tags: ['accessibility']
	},
	[TerminalSettingId.TabStopWidth]: {
		markdownDescription: localize('terminal.integrated.tabStopWidth', "制表位中的单元格数。"),
		type: 'number',
		minimum: 1,
		default: 8
	},
	[TerminalSettingId.FastScrollSensitivity]: {
		markdownDescription: localize('terminal.integrated.fastScrollSensitivity', "按 \"Alt\" 时的滚动速度加倍。"),
		type: 'number',
		default: 5
	},
	[TerminalSettingId.MouseWheelScrollSensitivity]: {
		markdownDescription: localize('terminal.integrated.mouseWheelScrollSensitivity', "要在鼠标滚轮滚动事件的 \"deltaY\" 上使用的乘数。"),
		type: 'number',
		default: 1
	},
	[TerminalSettingId.BellDuration]: {
		markdownDescription: localize('terminal.integrated.bellDuration', "触发时在终端选项卡中显示响铃的毫秒数。"),
		type: 'number',
		default: 1000
	},
	[TerminalSettingId.FontWeight]: {
		'anyOf': [
			{
				type: 'number',
				minimum: MINIMUM_FONT_WEIGHT,
				maximum: MAXIMUM_FONT_WEIGHT,
				errorMessage: localize('terminal.integrated.fontWeightError', "仅允许使用关键字“正常”和“加粗”，或使用介于 1 至 1000 之间的数字。")
			},
			{
				type: 'string',
				pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
			},
			{
				enum: SUGGESTIONS_FONT_WEIGHT,
			}
		],
		description: localize('terminal.integrated.fontWeight', "要在终端中用于非粗体文本的字体粗细。接受“正常”和“加粗”这两个关键字，或接受 1-1000 之间的数字。"),
		default: 'normal'
	},
	[TerminalSettingId.FontWeightBold]: {
		'anyOf': [
			{
				type: 'number',
				minimum: MINIMUM_FONT_WEIGHT,
				maximum: MAXIMUM_FONT_WEIGHT,
				errorMessage: localize('terminal.integrated.fontWeightError', "仅允许使用关键字“正常”和“加粗”，或使用介于 1 至 1000 之间的数字。")
			},
			{
				type: 'string',
				pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
			},
			{
				enum: SUGGESTIONS_FONT_WEIGHT,
			}
		],
		description: localize('terminal.integrated.fontWeightBold', "要在终端中用于粗体文本的字体粗细。接受“正常”和“加粗”这两个关键字，或接受 1-1000 之间的数字。"),
		default: 'bold'
	},
	[TerminalSettingId.CursorBlinking]: {
		description: localize('terminal.integrated.cursorBlinking', "控制终端光标是否闪烁。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.TextBlinking]: {
		description: localize('terminal.integrated.textBlinking', "控制是否在终端中启用文本闪烁。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.CursorStyle]: {
		description: localize('terminal.integrated.cursorStyle', "控制终端聚焦时终端光标的样式。"),
		enum: ['block', 'line', 'underline'],
		default: 'block'
	},
	[TerminalSettingId.CursorStyleInactive]: {
		description: localize('terminal.integrated.cursorStyleInactive', "控制终端未聚焦时终端光标的样式。"),
		enum: ['outline', 'block', 'line', 'underline', 'none'],
		default: 'outline'
	},
	[TerminalSettingId.CursorWidth]: {
		markdownDescription: localize('terminal.integrated.cursorWidth', "控制当 {0} 设置为 {1} 时光标的宽度。", '`#terminal.integrated.cursorStyle#`', '`line`'),
		type: 'number',
		default: 1
	},
	[TerminalSettingId.Scrollback]: {
		description: localize('terminal.integrated.scrollback', "控制终端在其缓冲区中保留的最大行数。我们根据此值预分配内存，以确保顺畅体验。因此，随着值的增加，内存量也会增加。"),
		type: 'number',
		default: 1000
	},
	[TerminalSettingId.DetectLocale]: {
		markdownDescription: localize('terminal.integrated.detectLocale', "控制是否检测 \"$LANG\" 环境变量并将其设置为符合 UTF-8 的选项，因为 VS Code 的终端仅支持来自 shell 的 UTF-8 编码数据。"),
		type: 'string',
		enum: ['auto', 'off', 'on'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.detectLocale.auto', "如果现有变量不存在或不以 \"'.UTF-8'\" 结尾，则设置 \"$LANG\" 环境变量。"),
			localize('terminal.integrated.detectLocale.off', "请勿设置 \"$LANG\" 环境变量。"),
			localize('terminal.integrated.detectLocale.on', "始终设置 \"$LANG\" 环境变量。")
		],
		default: 'auto'
	},
	[TerminalSettingId.GpuAcceleration]: {
		type: 'string',
		enum: ['auto', 'on', 'off'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.gpuAcceleration.auto', "让 VS Code 检测哪些呈现器将提供最佳体验。"),
			localize('terminal.integrated.gpuAcceleration.on', "在终端内启用 GPU 加速。"),
			localize('terminal.integrated.gpuAcceleration.off', "禁用终端中的 GPU 加速。当 GPU 加速关闭时，终端的呈现速度会慢得多，但它应该能够在所有系统上可靠地工作。"),
		],
		default: 'auto',
		description: localize('terminal.integrated.gpuAcceleration', "控制终端是否将使用 GPU 来进行呈现。")
	},
	[TerminalSettingId.TerminalTitleSeparator]: {
		'type': 'string',
		'default': ' - ',
		'markdownDescription': localize("terminal.integrated.tabs.separator", "{0} 和 {1} 使用的分隔符。", `\`#${TerminalSettingId.TerminalTitle}#\``, `\`#${TerminalSettingId.TerminalDescription}#\``)
	},
	[TerminalSettingId.TerminalTitle]: {
		'type': 'string',
		'default': '${process}',
		'markdownDescription': terminalTitle
	},
	[TerminalSettingId.TerminalDescription]: {
		'type': 'string',
		'default': '${task}${separator}${local}${separator}${cwdFolder}',
		'markdownDescription': terminalDescription
	},
	[TerminalSettingId.RightClickBehavior]: {
		type: 'string',
		enum: ['default', 'copyPaste', 'paste', 'selectWord', 'nothing'],
		enumDescriptions: [
			localize('terminal.integrated.rightClickBehavior.default', "显示上下文菜单。"),
			localize('terminal.integrated.rightClickBehavior.copyPaste', "当有选定内容时复制，否则粘贴。"),
			localize('terminal.integrated.rightClickBehavior.paste', "右键单击时粘贴。"),
			localize('terminal.integrated.rightClickBehavior.selectWord', "选择光标下方的字词并显示上下文菜单。"),
			localize('terminal.integrated.rightClickBehavior.nothing', "不执行任何操作并将事件传递到终端。")
		],
		default: isMacintosh ? 'selectWord' : isWindows ? 'copyPaste' : 'default',
		description: localize('terminal.integrated.rightClickBehavior', "控制终端如何回应右键单击操作。")
	},
	[TerminalSettingId.MiddleClickBehavior]: {
		type: 'string',
		enum: ['default', 'paste'],
		enumDescriptions: [
			localize('terminal.integrated.middleClickBehavior.default', "将焦点放在终端上的平台默认值。在 Linux 上，这也将粘贴所选内容。"),
			localize('terminal.integrated.middleClickBehavior.paste', "在中键单击时粘贴。"),
		],
		default: 'default',
		description: localize('terminal.integrated.middleClickBehavior', "控制终端如何回应中键单击操作。")
	},
	[TerminalSettingId.Cwd]: {
		restricted: true,
		description: localize('terminal.integrated.cwd', "将在其中启动终端的显式起始路径，它用作 shell 进程的当前工作目录(cwd)。如果根目录不是方便的 cwd，此路径在工作区设置中可能十分有用。"),
		type: 'string',
		default: undefined,
		scope: ConfigurationScope.RESOURCE
	},
	[TerminalSettingId.ConfirmOnExit]: {
		description: localize('terminal.integrated.confirmOnExit', "控制是否确认窗口何时关闭，如果存在活动的终端会话。某些扩展启动的后台终端等将不会触发确认。"),
		type: 'string',
		enum: ['never', 'always', 'hasChildProcesses'],
		enumDescriptions: [
			localize('terminal.integrated.confirmOnExit.never', "从不确认。"),
			localize('terminal.integrated.confirmOnExit.always', "始终确认是否存在终端。"),
			localize('terminal.integrated.confirmOnExit.hasChildProcesses', "确认是否存在具有子进程的终端。"),
		],
		default: 'never'
	},
	[TerminalSettingId.ConfirmOnKill]: {
		description: localize('terminal.integrated.confirmOnKill', "控制是否在终端具有子进程时确认终止终端。当设置为编辑器时，如果编辑器区域中的终端具有子进程，则将标记为已更改。请注意，子进程检测可能不适用于 Git Bash 等 shell，后者不会将其进程作为 shell 的子进程运行。后台终端（如某些扩展程序启动的终端）不会触发确认。"),
		type: 'string',
		enum: ['never', 'editor', 'panel', 'always'],
		enumDescriptions: [
			localize('terminal.integrated.confirmOnKill.never', "从不确认。"),
			localize('terminal.integrated.confirmOnKill.editor', "确认终端是否在编辑器中。"),
			localize('terminal.integrated.confirmOnKill.panel', "确认终端是否在面板中。"),
			localize('terminal.integrated.confirmOnKill.always', "确认终端是在编辑器中还是在面板中。"),
		],
		default: 'editor'
	},
	[TerminalSettingId.EnableBell]: {
		markdownDeprecationMessage: localize('terminal.integrated.enableBell', "现已弃用此项。请改用 `terminal.integrated.enableVisualBell` 和 `accessibility.signals.terminalBell` 设置。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableVisualBell]: {
		description: localize('terminal.integrated.enableVisualBell', "控制是否启用可视化终端铃声。此项显示在终端名称旁边。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.CommandsToSkipShell]: {
		markdownDescription: localize(
			'terminal.integrated.commandsToSkipShell',
			"一组命令 ID，其键绑定将不发送至 shell，而是始终由 VS Code 进行处理。这样的话，通常由 shell 使用的键绑定的行为可如同焦点未在终端上时的行为一样，例如按 “Ctrl+P” 来启动“快速打开”。\r\n\r\n&nbsp;\r\n\r\n默认跳过多项命令。要替代默认值并转而将相关命令的键绑定传递给 shell，请添加以 “-” 字符为前缀的命令。例如，添加“-workbench.action.quickOpen” 可使 “Ctrl+P”到达 shell。\r\n\r\n&nbsp;\r\n\r\n在设置编辑器中查看时，下面的默认跳过命令列表会被截断。要查看完整列表，请执行 {1}，然后从下面的列表中搜索第一个命令。\r\n\r\n&nbsp;\r\n\r\n默认跳过的命令:\r\n\r\n{0}",
			DEFAULT_COMMANDS_TO_SKIP_SHELL.sort().map(command => `- ${command}`).join('\n'),
			`[${localize('openDefaultSettingsJson', "打开默认设置 JSON")}](command:workbench.action.openRawDefaultSettings '${localize('openDefaultSettingsJson.capitalized', "打开默认设置(JSON)")}')`,

		),
		type: 'array',
		items: {
			type: 'string'
		},
		default: []
	},
	[TerminalSettingId.AllowChords]: {
		markdownDescription: localize('terminal.integrated.allowChords', "是否允许终端中的组合键绑定。请注意，如果此值为 true，并且击键导致一个组合，则它将绕过 {0}，当你希望 ctrl+k 转到 shell (而不是 VS Code)时，将此设置为 false 特别有用。", '`#terminal.integrated.commandsToSkipShell#`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.AllowMnemonics]: {
		markdownDescription: localize('terminal.integrated.allowMnemonics', "是否允许使用菜单栏助记键(如 Alt+F)来触发打开菜单栏。请注意，这将导致在设为 true 时，所有 Alt 击键跳过 shell。此设置在 macOS 不起作用。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnvMacOs]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.osx', "具有环境变量的对象，这些变量将添加到 macOS 中的终端要使用的 VS Code 进程。如果设置为 \"null\"，则删除环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvLinux]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.linux', "具有环境变量的对象，这些变量将添加到 Linux 上的终端要使用的 VS Code 进程。如果设置为 \"null\"，则删除环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvWindows]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.env.windows', "具有环境变量的对象，这些变量将添加到将由 Windows 上的终端使用的 VS Code 进程。设置为 \"null\" 以删除环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	},
	[TerminalSettingId.EnvironmentChangesRelaunch]: {
		markdownDescription: localize('terminal.integrated.environmentChangesRelaunch', "在扩展想要向终端的环境贡献内容但尚未与之交互时是否自动重启终端。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShowExitAlert]: {
		description: localize('terminal.integrated.showExitAlert', "控制在退出代码为非零时是否显示“终端进程已终止且显示退出代码”警报。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.WindowsUseConptyDll]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.windowsUseConptyDll', "是否使用 VS Code 附带的 conpty.dll (v1.25.260303002)，而不是与 Windows 捆绑的文件。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSettingId.SplitCwd]: {
		description: localize('terminal.integrated.splitCwd', "控制拆分终端开始时使用的工作目录。"),
		type: 'string',
		enum: ['workspaceRoot', 'initial', 'inherited'],
		enumDescriptions: [
			localize('terminal.integrated.splitCwd.workspaceRoot', "新的拆分终端将使用工作区根作为工作目录。在多根工作区中，提供了要使用根文件夹的选项。"),
			localize('terminal.integrated.splitCwd.initial', "新的拆分终端将使用父终端开始时使用的工作目录。"),
			localize('terminal.integrated.splitCwd.inherited', "在 macOS 和 Linux 上，新的拆分终端将使用父终端的工作目录。在 Windows 上，这与初始行为相同。"),
		],
		default: 'inherited'
	},
	[TerminalSettingId.WordSeparators]: {
		markdownDescription: localize('terminal.integrated.wordSeparators', "一个包含所有字符的字符串，在双击选择单词和回退“word”链接检测时，会被视为单词分隔符。由于这用于链接检测，包括在检测链接时使用“:”之类的字符，将会忽略“file:10:5”等链接的行和列部分。"),
		type: 'string',
		// allow-any-unicode-next-line
		default: ' ()[]{}\',"`─‘’“”|'
	},
	[TerminalSettingId.EnableFileLinks]: {
		description: localize('terminal.integrated.enableFileLinks', "是否在终端中启用文件链接。连接可能会很慢，特别是在网络驱动器上工作时，因为将根据文件系统验证每个文件链接。更改此项将仅在新的终端中生效。"),
		type: 'string',
		enum: ['off', 'on', 'notRemote'],
		enumDescriptions: [
			localize('enableFileLinks.off', "始终关闭。"),
			localize('enableFileLinks.on', "始终可用。"),
			localize('enableFileLinks.notRemote', "仅当不在远程工作区中时启用。")
		],
		default: 'on'
	},
	[TerminalSettingId.AllowedLinkSchemes]: {
		description: localize('terminal.integrated.allowedLinkSchemes', "包含终端可打开其链接的 URI 方案的字符串数组。出于安全原因，默认情况下只允许一小部分可能的方案。"),
		type: 'array',
		items: {
			type: 'string'
		},
		default: [
			'file',
			'http',
			'https',
			'mailto',
			'vscode',
			'vscode-insiders',
		]
	},
	[TerminalSettingId.UnicodeVersion]: {
		type: 'string',
		enum: ['6', '11'],
		enumDescriptions: [
			localize('terminal.integrated.unicodeVersion.six', "unicode 的版本 6。此版本较旧，因此在较旧的系统中效果更好。"),
			localize('terminal.integrated.unicodeVersion.eleven', "unicode 的版本 11。此版本可在使用新式版本 unicode 的新式系统上提供更好的支持。")
		],
		default: '11',
		description: localize('terminal.integrated.unicodeVersion', "控制在终端中计算字符宽度时要使用的 unicode 版本。如果遇到未占用正确空格或退格量的表情符号或其他宽字符，或删除量太大或太小，则可能希望尝试调整此设置。")
	},
	[TerminalSettingId.EnablePersistentSessions]: {
		description: localize('terminal.integrated.enablePersistentSessions', "跨窗口重新加载保持工作区的终端会话/历史记录。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.PersistentSessionReviveProcess]: {
		markdownDescription: localize('terminal.integrated.persistentSessionReviveProcess', "当必须关闭终端进程(例如当窗口或应用程序关闭时)时，这将决定下次打开工作区时，应在何时还原以前的终端会话内容/历史记录和重新创建进程。\r\n\r\n注意事项:\r\n\r\n- 进程当前工作目录的还原取决于是否受 shell 支持。\r\n- 在关闭期间保留会话的时间有限，因此在使用高延迟远程连接时可能会中止相应会话。"),
		type: 'string',
		enum: ['onExit', 'onExitAndWindowClose', 'never'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.persistentSessionReviveProcess.onExit', "在 Windows/Linux 上关闭最后窗口后或当触发 `workbench.action.quit` 命令(命令面板、键绑定、菜单)时，恢复流程。"),
			localize('terminal.integrated.persistentSessionReviveProcess.onExitAndWindowClose', "在 Windows/Linux 上关闭最后窗口后或当触发 `workbench.action.quit` 命令(命令面板、键绑定、菜单)或关闭窗口时，恢复流程。"),
			localize('terminal.integrated.persistentSessionReviveProcess.never', "永远不要还原终端缓冲区或重新创建流程。")
		],
		default: 'onExit'
	},
	[TerminalSettingId.HideOnStartup]: {
		description: localize('terminal.integrated.hideOnStartup', "是否在启动时隐藏终端视图，避免在没有持续会话时创建终端。"),
		type: 'string',
		enum: ['never', 'whenEmpty', 'always'],
		markdownEnumDescriptions: [
			localize('hideOnStartup.never', "启动时切勿隐藏终端视图。"),
			localize('hideOnStartup.whenEmpty', "仅在未还原持久会话时隐藏终端。"),
			localize('hideOnStartup.always', "始终隐藏终端，即使还原持久会话也是如此。")
		],
		default: 'never',
	},
	[TerminalSettingId.HideOnLastClosed]: {
		description: localize('terminal.integrated.hideOnLastClosed', "是否在最后一个终端关闭时隐藏终端视图。仅当终端是视图容器中唯一可见的视图时才会发生这种情况。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.CustomGlyphs]: {
		markdownDescription: localize('terminal.integrated.customGlyphs', "是否为以下 Unicode 范围绘制自定义字形，而不是使用字体:\r\n\r\n{0}\r\n\r\n这通常能实现更好连续行渲染效果，即使使用了行高和字间距也是如此。此功能仅在 {1} 启用时有效。", [
			'- Box Drawing (U+2500-U+257F)',
			'- Block Elements (U+2580-U+259F)',
			'- Braille Patterns (U+2800-U+28FF)',
			'- Powerline Symbols (U+E0A0-U+E0D4, Private Use Area)',
			'- Progress Indicators (U+EE00-U+EE0B, Private Use Area)',
			'- Git Branch Symbols (U+F5D0-U+F60D, Private Use Area)',
			'- Symbols for Legacy Computing (U+1FB00-U+1FBFF)'
		].join('\n'), `\`#${TerminalSettingId.GpuAcceleration}#\``),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.RescaleOverlappingGlyphs]: {
		markdownDescription: localize('terminal.integrated.rescaleOverlappingGlyphs', "是否水平重新缩放单个单元格宽且有字形与下面的单元格重叠的字形。模糊宽度字符(例如罗马数字字符 U+2160+)通常会发生这种情况，等宽字体中不特别推荐这些字符。永远不会重新缩放表情符号字形。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.EnableKittyKeyboardProtocol]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableKittyKeyboardProtocol', "是否启用 kitty 键盘协议，该协议允许终端中的程序请求更详细的键盘输入报告。例如，这可以使 `Shift+Enter` 由程序处理。"),
		type: 'boolean',
		default: true,
		tags: ['advanced']
	},
	[TerminalSettingId.EnableWin32InputMode]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableWin32InputMode', "是否启用 win32 输入模式，该模式在 Windows 上提供增强的键盘输入支持。"),
		type: 'boolean',
		default: false,
		tags: ['experimental', 'advanced'],
		experiment: {
			mode: 'auto'
		}
	},
	[TerminalSettingId.ShellIntegrationEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.enabled', "确定是否自动注入 shell 集成以支持增强型命令跟踪和当前工作目录检测等功能。\r\n\r\nshell 集成通过使用启动脚本注入 shell 来工作。该脚本使 VS Code 能够了解终端中发生的情况。\r\n\r\n支持的 shell:\r\n\r\n- Linux/macOS: bash、fish、pwsh、zsh\r\n- Windows: pwsh、git bash\r\n\r\n此设置仅在创建终端时适用，因此需要重启终端才能生效。\r\n\r\n请注意，如果在终端配置文件中定义了自定义参数、已启用 {1}、具有[复杂 bash `PROMPT_COMMAND`](https://code.visualstudio.com/docs/editor/integrated-terminal#_complex-bash-promptcommand) 或其他不受支持的设置，则脚本注入可能不起作用。若要禁用修饰，请参阅 {0}", '`#terminal.integrated.shellIntegration.decorationsEnabled#`', '`#editor.accessibilitySupport#`'),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShellIntegrationDecorationsEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.decorationsEnabled', "启用 shell 集成后，为每个命令添加修饰。"),
		type: 'string',
		enum: ['both', 'gutter', 'overviewRuler', 'never'],
		enumDescriptions: [
			localize('terminal.integrated.shellIntegration.decorationsEnabled.both', "在装订线(左侧)和概述标尺(右侧)中显示修饰"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.gutter', "在终端左侧显示装订线修饰"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.overviewRuler', "在终端右侧显示概述标尺修饰"),
			localize('terminal.integrated.shellIntegration.decorationsEnabled.never', "不显示修饰"),
		],
		default: 'both'
	},
	[TerminalSettingId.ShellIntegrationTimeout]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.timeout', "配置启动后等待 shell 集成的时长(毫秒)，超过该时间则声明其不存在。默认值 {0} 根据是否启用 shell 集成注入以及它是否是远程窗口使用可变等待时间。1 和 499 之间的值限制为 500 毫秒。如果你的 shell 启动速度非常慢，请考虑将此值调大。", '`-1`'),
		type: 'integer',
		minimum: -1,
		maximum: 60000,
		default: -1
	},
	[TerminalSettingId.ShellIntegrationQuickFixEnabled]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.shellIntegration.quickFixEnabled', "启用 shell 集成后，会为提示符左侧显示为灯泡或闪光图标的终端命令启用快速修复。"),
		type: 'boolean',
		default: true
	},
	[TerminalSettingId.ShellIntegrationEnvironmentReporting]: {
		markdownDescription: localize('terminal.integrated.shellIntegration.environmentReporting', "控制是否报告 shell 环境，使其能够在 {0} 等功能中使用。这可能导致打印 shell 的提示时速度减慢。", `\`#${TerminalContribSettingId.SuggestEnabled}#\``),
		type: 'boolean',
		default: product.quality !== 'stable'
	},
	[TerminalSettingId.SmoothScrolling]: {
		markdownDescription: localize('terminal.integrated.smoothScrolling', "控制终端是否将使用动画滚动。"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.IgnoreBracketedPasteMode]: {
		markdownDescription: localize('terminal.integrated.ignoreBracketedPasteMode', "控制终端是否忽略括号粘贴模式，即使终端已进入模式，在粘贴时忽略 {0} 和 {1} 序列。当 shell 不遵循例如在子 shell 中可能发生的模式时，这非常有用。", '`\\x1b[200~`', '`\\x1b[201~`'),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.EnableImages]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.enableImages', "在终端中启用图像支持，仅当启用 {0} 时生效。Linux 和 macOS 支持 Sixel 和 iTerm 的内联图像协议。Kitty 图形协议支持所有平台。在 Windows 上，所有图像协议仅适用于随 Windows 自带的 ConPTY >= v2 版本，详见 {1}。图像当前不会在窗口重新加载或重新连接时恢复。启用后，终端也会开启透明模式。", `\`#${TerminalSettingId.GpuAcceleration}#\``, `\`#${TerminalSettingId.WindowsUseConptyDll}#\``),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.FocusAfterRun]: {
		markdownDescription: localize('terminal.integrated.focusAfterRun', "控制在运行“终端: 在活动终端中运行所选文本”后是否将焦点放在终端、可访问缓冲区或两者均不集中。"),
		enum: ['terminal', 'accessible-buffer', 'none'],
		default: 'none',
		tags: ['accessibility'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.focusAfterRun.terminal', "始终将焦点放在终端上。"),
			localize('terminal.integrated.focusAfterRun.accessible-buffer', "始终将焦点放在可访问的缓冲区上。"),
			localize('terminal.integrated.focusAfterRun.none', "不执行任何操作。"),
		]
	},
	[TerminalSettingId.AllowInUntrustedWorkspace]: {
		restricted: true,
		markdownDescription: localize('terminal.integrated.allowInUntrustedWorkspace', "控制是否可在不受信任的工作区中创建终端。\r\n\r\n**此功能绕过了阻止终端在不受信任的工作区启动的安全保护。这之所以是一项安全风险，是因为 shell 通常会根据当前工作目录的内容设置为可能自动执行代码。只要你的 shell 设置为绝不会在文件夹中执行代码，则使用它应该就是安全的。**"),
		type: 'boolean',
		default: false
	},
	[TerminalSettingId.DeveloperPtyHostLatency]: {
		description: localize('terminal.integrated.developer.ptyHost.latency', "对 pty 主机发出的所有调用都应用了模拟延迟(毫秒)。这有助于测试终端在高延迟情况下的行为。"),
		type: 'number',
		minimum: 0,
		default: 0,
		tags: ['advanced']
	},
	[TerminalSettingId.DeveloperPtyHostStartupDelay]: {
		description: localize('terminal.integrated.developer.ptyHost.startupDelay', "pty 主机进程的模拟启动延迟(毫秒)。这有助于测试终端在缓慢启动情况下的初始化表现。"),
		type: 'number',
		minimum: 0,
		default: 0,
		tags: ['advanced']
	},
	[TerminalSettingId.DevMode]: {
		description: localize('terminal.integrated.developer.devMode', "为终端启用开发者模式。这会显示额外的调试信息和 shell 集成序列的可视化内容。"),
		type: 'boolean',
		default: false,
		tags: ['advanced']
	},
	...terminalContribConfiguration,
};

export async function registerTerminalConfiguration(getFontSnippets: () => Promise<IJSONSchemaSnippet[]>) {
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'terminal',
		order: 100,
		title: localize('terminalIntegratedConfigurationTitle', "集成终端"),
		type: 'object',
		properties: terminalConfiguration,
	});
	terminalConfiguration[TerminalSettingId.FontFamily].defaultSnippets = await getFontSnippets();
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: TerminalContribSettingId.AgentSandboxEnabled,
		migrateFn: (value: unknown, valueAccessor) => {
			if (value !== AgentSandboxEnabledValue.AllowNetwork) {
				return [];
			}
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [[TerminalContribSettingId.AgentSandboxEnabled, { value: AgentSandboxEnabledValue.On }]];
			if (valueAccessor(TerminalContribSettingId.AgentSandboxAllowNetwork) === undefined) {
				configurationKeyValuePairs.push([TerminalContribSettingId.AgentSandboxAllowNetwork, { value: true }]);
			}
			return configurationKeyValuePairs;
		}
	}, {
		key: TerminalContribSettingId.AgentSandboxWindowsEnabled,
		migrateFn: (value: unknown, valueAccessor) => {
			if (value !== AgentSandboxEnabledValue.AllowNetwork) {
				return [];
			}
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [[TerminalContribSettingId.AgentSandboxWindowsEnabled, { value: AgentSandboxEnabledValue.On }]];
			if (valueAccessor(TerminalContribSettingId.AgentSandboxAllowNetwork) === undefined) {
				configurationKeyValuePairs.push([TerminalContribSettingId.AgentSandboxAllowNetwork, { value: true }]);
			}
			return configurationKeyValuePairs;
		}
	}, {
		key: TerminalSettingId.EnableBell,
		migrateFn: (enableBell, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			let announcement = accessor('accessibility.signals.terminalBell')?.announcement ?? accessor('accessibility.alert.terminalBell');
			if (announcement !== undefined && !isString(announcement)) {
				announcement = announcement ? 'auto' : 'off';
			}
			configurationKeyValuePairs.push(['accessibility.signals.terminalBell', { value: { sound: enableBell ? 'on' : 'off', announcement } }]);
			configurationKeyValuePairs.push([TerminalSettingId.EnableBell, { value: undefined }]);
			configurationKeyValuePairs.push([TerminalSettingId.EnableVisualBell, { value: enableBell }]);
			return configurationKeyValuePairs;
		}
	}]);
