/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationPropertySchema, IConfigurationNode, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { TerminalSettingId } from '../../../../../platform/terminal/common/terminal.js';

export const enum TerminalSuggestSettingId {
	Enabled = 'terminal.integrated.suggest.enabled',
	QuickSuggestions = 'terminal.integrated.suggest.quickSuggestions',
	SuggestOnTriggerCharacters = 'terminal.integrated.suggest.suggestOnTriggerCharacters',
	RunOnEnter = 'terminal.integrated.suggest.runOnEnter',
	WindowsExecutableExtensions = 'terminal.integrated.suggest.windowsExecutableExtensions',
	Providers = 'terminal.integrated.suggest.providers',
	ShowStatusBar = 'terminal.integrated.suggest.showStatusBar',
	CdPath = 'terminal.integrated.suggest.cdPath',
	InlineSuggestion = 'terminal.integrated.suggest.inlineSuggestion',
	UpArrowNavigatesHistory = 'terminal.integrated.suggest.upArrowNavigatesHistory',
	SelectionMode = 'terminal.integrated.suggest.selectionMode',
	InsertTrailingSpace = 'terminal.integrated.suggest.insertTrailingSpace',
}

export const windowsDefaultExecutableExtensions: string[] = [
	'exe',   // Executable file
	'bat',   // Batch file
	'cmd',   // Command script
	'com',   // Command file

	'msi',   // Windows Installer package

	'ps1',   // PowerShell script

	'vbs',   // VBScript file
	'js',    // JScript file
	'jar',   // Java Archive (requires Java runtime)
	'py',    // Python script (requires Python interpreter)
	'rb',    // Ruby script (requires Ruby interpreter)
	'pl',    // Perl script (requires Perl interpreter)
	'sh',    // Shell script (via WSL or third-party tools)
];

export const terminalSuggestConfigSection = 'terminal.integrated.suggest';

export interface ITerminalSuggestConfiguration {
	enabled: boolean;
	quickSuggestions: boolean | ITerminalQuickSuggestionsOptions;
	suggestOnTriggerCharacters: boolean;
	runOnEnter: 'never' | 'exactMatch' | 'exactMatchIgnoreExtension' | 'always';
	windowsExecutableExtensions: { [key: string]: boolean };
	providers: { [key: string]: boolean };
	showStatusBar: boolean;
	cdPath: 'off' | 'relative' | 'absolute';
	inlineSuggestion: 'off' | 'alwaysOnTopExceptExactMatch' | 'alwaysOnTop';
	insertTrailingSpace: boolean;
}

export interface ITerminalQuickSuggestionsOptions {
	commands: 'on' | 'off';
	arguments: 'on' | 'off';
	unknown: 'on' | 'off';
}

/**
 * Normalizes the quickSuggestions config value to an object.
 * Handles migration from boolean values:
 * - `true` -> { commands: 'on', arguments: 'on', unknown: 'on' }
 * - `false` -> { commands: 'off', arguments: 'off', unknown: 'off' }
 * - object -> passed through as-is
 */
export function normalizeQuickSuggestionsConfig(config: ITerminalSuggestConfiguration['quickSuggestions']): ITerminalQuickSuggestionsOptions {
	if (typeof config === 'boolean') {
		return config
			? { commands: 'on', arguments: 'on', unknown: 'off' }
			: { commands: 'off', arguments: 'off', unknown: 'off' };
	}
	return config;
}

export const terminalSuggestConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalSuggestSettingId.Enabled]: {
		restricted: true,
		markdownDescription: localize('suggest.enabled', "为支持的 shell ({0})启用终端 IntelliSense 建议(也称为自动完成)。这需要启用并正常运行或者[手动安装](https://code.visualstudio.com/docs/terminal/shell-integration#_manual-installation-install){1}。", 'Windows PowerShell, PowerShell v7+, zsh, bash, fish', `\`#${TerminalSettingId.ShellIntegrationEnabled}#\``),
		type: 'boolean',
		default: true,
	},
	[TerminalSuggestSettingId.Providers]: {
		restricted: true,
		markdownDescription: localize('suggest.providers', "提供程序默认启用。通过将提供程序的 ID 设置为 “false” 来忽略它们。"),
		type: 'object',
		properties: {},
	},
	[TerminalSuggestSettingId.QuickSuggestions]: {
		restricted: true,
		markdownDescription: localize('suggest.quickSuggestions', "控制是否应在键入时自动显示建议。另请注意控制建议是否由特殊字符触发的 {0} 设置。", `\`#${TerminalSuggestSettingId.SuggestOnTriggerCharacters}#\``),
		type: 'object',
		properties: {
			commands: {
				description: localize('suggest.quickSuggestions.commands', '为命令启用快速建议，这是命令行输入中的第一个字。'),
				type: 'string',
				enum: ['on', 'off'],
			},
			arguments: {
				description: localize('suggest.quickSuggestions.arguments', '为参数启用快速建议，在命令行输入中的第一个字之后的任何内容。'),
				type: 'string',
				enum: ['on', 'off'],
			},
			unknown: {
				description: localize('suggest.quickSuggestions.unknown', '当不清楚最佳建议是什么时启用快速建议，如果此建议位于文件上，并且文件夹将作为回退进行建议。'),
				type: 'string',
				enum: ['on', 'off'],
			},
		},
		additionalProperties: false,
		default: {
			commands: 'off',
			arguments: 'off',
			unknown: 'off',
		},
	},
	[TerminalSuggestSettingId.SuggestOnTriggerCharacters]: {
		restricted: true,
		markdownDescription: localize('suggest.suggestOnTriggerCharacters', "控制在键入触发字符后是否自动显示建议。"),
		type: 'boolean',
		default: false,
	},
	[TerminalSuggestSettingId.RunOnEnter]: {
		restricted: true,
		markdownDescription: localize('suggest.runOnEnter', "控制是否应在使用 `Enter` (而不是 `Tab`)接受结果时立即运行建议。"),
		enum: ['never', 'exactMatch', 'exactMatchIgnoreExtension', 'always'],
		markdownEnumDescriptions: [
			localize('runOnEnter.never', "按 `Enter` 时从不运行。"),
			localize('runOnEnter.exactMatch', "完整输入建议后按 `Enter` 时运行。"),
			localize('runOnEnter.exactMatchIgnoreExtension', "完整输入建议后或输入不包含扩展名的文件后，在按 `Enter` 时运行。"),
			localize('runOnEnter.always', "始终在按 `Enter` 时运行。")
		],
		default: 'never',
	},
	[TerminalSuggestSettingId.SelectionMode]: {
		markdownDescription: localize('terminal.integrated.selectionMode', "控制建议选择在集成终端中的工作方式。"),
		type: 'string',
		enum: ['partial', 'always', 'never'],
		markdownEnumDescriptions: [
			localize('terminal.integrated.selectionMode.partial', "自动触发 IntelliSense 时部分选择建议。可以使用 `Tab` 键接受第一条建议，只有在使用向下键导航建议后，使用 `Enter` 键才会也接受活动建议。"),
			localize('terminal.integrated.selectionMode.always', "自动触发 IntelliSense 时始终选择建议。可以使用 `Enter` 或 `Tab` 键接受第一条建议。"),
			localize('terminal.integrated.selectionMode.never', "自动触发 IntelliSense 时，切勿选择建议。必须先通过向下键导航列表，然后才能使用 `Enter` 或 `Tab` 键来接受活动建议。"),
		],
		default: 'partial',
	},
	[TerminalSuggestSettingId.WindowsExecutableExtensions]: {
		restricted: true,
		markdownDescription: localize("terminalWindowsExecutableSuggestionSetting", "将作为建议包括在终端中的一组 Windows 命令可执行文件扩展。\r\n\r\n默认情况下包括许多可执行文件，如下所列：\r\n\r\n{0}。\r\n\r\n若要排除扩展，请将其设置为 “false”\r\n\r\n.若要将一个不在列表中，请添加它并将其设置为 “true”。",
			windowsDefaultExecutableExtensions.sort().map(extension => `- ${extension}`).join('\n'),
		),
		type: 'object',
		default: {},
	},
	[TerminalSuggestSettingId.ShowStatusBar]: {
		restricted: true,
		markdownDescription: localize('suggest.showStatusBar', "控制是否应显示终端建议状态栏。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSuggestSettingId.CdPath]: {
		restricted: true,
		markdownDescription: localize('suggest.cdPath', "控制是否启用$CDPATH支持，无论当前工作目录是什么，都公开$CDPATH变量中文件夹的子级。$CDPATH应在 Windows 上以分号分隔，并在其他平台上以分号分隔。"),
		type: 'string',
		enum: ['off', 'relative', 'absolute'],
		markdownEnumDescriptions: [
			localize('suggest.cdPath.off', "禁用该功能。"),
			localize('suggest.cdPath.relative', "启用该功能并使用相对路径。"),
			localize('suggest.cdPath.absolute', "启用该功能并使用绝对路径。当 shell 不以本机方式支持 “$CDPATH” 时，这非常有用。"),
		],
		default: 'absolute',
	},
	[TerminalSuggestSettingId.InlineSuggestion]: {
		restricted: true,
		markdownDescription: localize('suggest.inlineSuggestion', "控制是否应检测 shell 的内联建议以及如何对其进行评分。"),
		type: 'string',
		enum: ['off', 'alwaysOnTopExceptExactMatch', 'alwaysOnTop'],
		markdownEnumDescriptions: [
			localize('suggest.inlineSuggestion.off', "禁用该功能。"),
			localize('suggest.inlineSuggestion.alwaysOnTopExceptExactMatch', "启用该功能，对内联建议排序，但不强制置顶。这意味着完全匹配项会排在内联建议上方。"),
			localize('suggest.inlineSuggestion.alwaysOnTop', "启用此功能并始终将内联建议置于顶层。"),
		],
		default: 'alwaysOnTop',
	},
	[TerminalSuggestSettingId.UpArrowNavigatesHistory]: {
		restricted: true,
		markdownDescription: localize('suggest.upArrowNavigatesHistory', "确定当焦点位于第一个建议上且尚未进行导航时，向上键是否导航命令历史记录。设置为 false 时，向上箭会改为将焦点移动到最后一个建议。"),
		type: 'boolean',
		default: true,
	},
	[TerminalSuggestSettingId.InsertTrailingSpace]: {
		restricted: true,
		markdownDescription: localize('suggest.insertTrailingSpace', "控制在接受建议并重新触发建议后是否自动插入空格。文件夹和符号链接文件夹从不添加尾随空格。"),
		type: 'boolean',
		default: false,
	},

};

export interface ITerminalSuggestProviderInfo {
	id: string;
	description?: string;
}

let terminalSuggestProvidersConfiguration: IConfigurationNode | undefined;

export function registerTerminalSuggestProvidersConfiguration(providers?: Map<string, ITerminalSuggestProviderInfo>) {
	const oldProvidersConfiguration = terminalSuggestProvidersConfiguration;

	providers ??= new Map();
	if (!providers.has('lsp')) {
		providers.set('lsp', {
			id: 'lsp',
			description: localize('suggest.provider.lsp.description', '显示来自语言服务器的建议。')
		});
	}

	const providersProperties: IStringDictionary<IConfigurationPropertySchema> = {};
	for (const id of Array.from(providers.keys()).sort()) {
		providersProperties[id] = {
			type: 'boolean',
			default: id === 'lsp' ? false : true,
			description:
				providers.get(id)?.description ??
				localize('suggest.provider.title', "显示来自 {0} 的建议。", id)
		};
	}

	const defaultValue: IStringDictionary<boolean> = {};
	for (const key in providersProperties) {
		defaultValue[key] = providersProperties[key].default as boolean;
	}

	terminalSuggestProvidersConfiguration = {
		id: 'terminalSuggestProviders',
		order: 100,
		title: localize('terminalSuggestProvidersConfigurationTitle', "终端建议提供程序"),
		type: 'object',
		properties: {
			[TerminalSuggestSettingId.Providers]: {
				restricted: true,
				markdownDescription: localize('suggest.providersEnabledByDefault', "控制在键入时自动显示哪些建议。建议提供程序默认启用。"),
				type: 'object',
				properties: providersProperties,
				default: defaultValue,
				tags: ['preview'],
				additionalProperties: false
			}
		}
	};

	const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
	registry.updateConfigurations({
		add: [terminalSuggestProvidersConfiguration],
		remove: oldProvidersConfiguration ? [oldProvidersConfiguration] : []
	});
}

registerTerminalSuggestProvidersConfiguration();
