/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon, getAllCodicons } from '../../../base/common/codicons.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../base/common/jsonSchema.js';
import { OperatingSystem, Platform, PlatformToString } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';
import { IExtensionTerminalProfile, ITerminalProfile, TerminalSettingId } from './terminal.js';
import { createProfileSchemaEnums } from './terminalProfiles.js';

export const terminalColorSchema: IJSONSchema = {
	type: ['string', 'null'],
	enum: [
		'terminal.ansiBlack',
		'terminal.ansiRed',
		'terminal.ansiGreen',
		'terminal.ansiYellow',
		'terminal.ansiBlue',
		'terminal.ansiMagenta',
		'terminal.ansiCyan',
		'terminal.ansiWhite'
	],
	default: null
};

export const terminalIconSchema: IJSONSchema = {
	type: 'string',
	enum: Array.from(getAllCodicons(), icon => icon.id),
	markdownEnumDescriptions: Array.from(getAllCodicons(), icon => `$(${icon.id})`),
};

export const terminalProfileBaseProperties: IJSONSchemaMap = {
	args: {
		description: localize('terminalProfile.args', '用于运行 shell 可执行文件的可选参数集。'),
		type: 'array',
		items: {
			type: 'string'
		}
	},
	icon: {
		description: localize('terminalProfile.icon', '要与终端图标关联的 codicon ID。'),
		...terminalIconSchema
	},
	color: {
		description: localize('terminalProfile.color', '要与终端图标关联的主题颜色 ID。'),
		...terminalColorSchema
	},
	env: {
		markdownDescription: localize('terminalProfile.env', "具有将添加到终端配置文件进程的环境变量的对象。设置为 \"null\" 以从基本环境中删除环境变量。"),
		type: 'object',
		additionalProperties: {
			type: ['string', 'null']
		},
		default: {}
	}
};

const terminalProfileSchema: IJSONSchema = {
	type: 'object',
	required: ['path'],
	properties: {
		path: {
			description: localize('terminalProfile.path', '指向 shell 可执行文件的单一路径或一个路径数组(当一个路径失败时，这些路径将被用作回退)。'),
			type: ['string', 'array'],
			items: {
				type: 'string'
			}
		},
		overrideName: {
			description: localize('terminalProfile.overrideName', '是否将检测正在运行程序的动态终端标题替换为静态配置文件名称。'),
			type: 'boolean'
		},
		...terminalProfileBaseProperties
	}
};

const terminalAutomationProfileSchema: IJSONSchema = {
	type: 'object',
	required: ['path'],
	properties: {
		path: {
			description: localize('terminalAutomationProfile.path', 'shell 可执行文件的路径。'),
			type: ['string'],
			items: {
				type: 'string'
			}
		},
		...terminalProfileBaseProperties
	}
};

function createTerminalProfileMarkdownDescription(platform: Platform.Linux | Platform.Mac | Platform.Windows): string {
	const key = platform === Platform.Linux ? 'linux' : platform === Platform.Mac ? 'osx' : 'windows';
	return localize(
		{
			key: 'terminal.integrated.profile',
			comment: ['{0} is the platform, {1} is a code block, {2} and {3} are a link start and end']
		},
		"一组用于 {0} 的终端配置文件自定义，可在该平台上添加、移除或更改终端的启动方式。配置文件由强制路径、可选参数和其他演示选项组成。\r\n\r\n要替代现有配置文件，请使用其配置文件名称作为键，例如:\r\n\r\n{1}\r\n\r\n{2}详细了解如何对配置文件进行配置{3}。",
		PlatformToString(platform),
		'```json\n"terminal.integrated.profile.' + key + '": {\n  "bash": null\n}\n```',
		'[',
		'](https://code.visualstudio.com/docs/terminal/profiles)'
	);
}

const terminalPlatformConfiguration: IConfigurationNode = {
	id: 'terminal',
	order: 100,
	title: localize('terminalIntegratedConfigurationTitle', "集成终端"),
	type: 'object',
	properties: {
		[TerminalSettingId.AutomationProfileLinux]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.automationProfile.linux', "要在 Linux 上用于自动化相关终端使用(如任务和调试)的终端配置文件。"),
			type: ['object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.AutomationProfileMacOs]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.automationProfile.osx', "要在 macOS 上用于自动化相关终端使用(如任务和调试)的终端配置文件。"),
			type: ['object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.AutomationProfileWindows]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.automationProfile.windows', "要用于自动化相关终端使用(如任务和调试)的终端配置文件。如果设置了 {0} (现已弃用)，则当前将忽略此设置。", '`terminal.integrated.automationShell.windows`'),
			type: ['object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.AgentHostProfileLinux]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.agentHostProfile.linux', "Linux 中用于智能体主机终端的终端配置文件，包括 AI 智能体工具启动的 shell。接受来自 {0} 的配置文件名称或内联配置对象。未设置时，回退到 {1}。当前适用于本地智能体主机。目前仅使用可执行文件 `path`；会忽略配置文件中的 `args` 和 `env`。远程智能体主机需要远程端 shell 配置，因为本地解析路径在远程可能无效。", '`#terminal.integrated.profiles.linux#`', '`#terminal.integrated.defaultProfile.linux#`'),
			type: ['string', 'object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				{ type: 'string' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.AgentHostProfileMacOs]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.agentHostProfile.osx', "macOS 中用于智能体主机终端的终端配置文件，包括 AI 智能体工具启动的 shell。接受来自 {0} 的配置文件名称或内联配置对象。未设置时，回退到 {1}。当前适用于本地智能体主机。目前仅使用可执行文件 `path`；会忽略配置文件中的 `args` 和 `env`。远程智能体主机需要远程端 shell 配置，因为本地解析路径在远程可能无效。", '`#terminal.integrated.profiles.osx#`', '`#terminal.integrated.defaultProfile.osx#`'),
			type: ['string', 'object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				{ type: 'string' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.AgentHostProfileWindows]: {
			restricted: true,
			markdownDescription: localize('terminal.integrated.agentHostProfile.windows', "Windows 中用于智能体主机终端的终端配置文件，包括 AI 智能体工具启动的 shell。接受来自 {0} 的配置文件名称或内联配置对象。未设置时，回退到 {1}。当前适用于本地智能体主机。目前仅使用可执行文件 `path`；会忽略配置文件中的 `args` 和 `env`。远程智能体主机需要远程端 shell 配置，因为本地解析路径在远程可能无效。", '`#terminal.integrated.profiles.windows#`', '`#terminal.integrated.defaultProfile.windows#`'),
			type: ['string', 'object', 'null'],
			default: null,
			'anyOf': [
				{ type: 'null' },
				{ type: 'string' },
				terminalAutomationProfileSchema
			],
			defaultSnippets: [
				{
					body: {
						path: '${1}',
						icon: '${2}'
					}
				}
			]
		},
		[TerminalSettingId.ProfilesWindows]: {
			restricted: true,
			markdownDescription: createTerminalProfileMarkdownDescription(Platform.Windows),
			type: 'object',
			default: {
				'PowerShell': {
					source: 'PowerShell',
					icon: Codicon.terminalPowershell.id,
				},
				'Command Prompt': {
					path: [
						'${env:windir}\\Sysnative\\cmd.exe',
						'${env:windir}\\System32\\cmd.exe'
					],
					args: [],
					icon: Codicon.terminalCmd.id,
				},
				'Git Bash': {
					source: 'Git Bash',
					icon: Codicon.terminalGitBash.id,
				}
			},
			additionalProperties: {
				'anyOf': [
					{
						type: 'object',
						required: ['source'],
						properties: {
							source: {
								description: localize('terminalProfile.windowsSource', '将自动检测 shell 路径的配置文件源。请注意，非标准可执行文件位置不受支持，必须在新的配置文件中手动创建。'),
								enum: ['PowerShell', 'Git Bash']
							},
							...terminalProfileBaseProperties
						}
					},
					{
						type: 'object',
						required: ['extensionIdentifier', 'id', 'title'],
						properties: {
							extensionIdentifier: {
								description: localize('terminalProfile.windowsExtensionIdentifier', '提供此配置文件的扩展。'),
								type: 'string'
							},
							id: {
								description: localize('terminalProfile.windowsExtensionId', '扩展终端的 ID'),
								type: 'string'
							},
							title: {
								description: localize('terminalProfile.windowsExtensionTitle', '扩展终端的名称'),
								type: 'string'
							},
							...terminalProfileBaseProperties
						}
					},
					{ type: 'null' },
					terminalProfileSchema
				]
			}
		},
		[TerminalSettingId.ProfilesMacOs]: {
			restricted: true,
			markdownDescription: createTerminalProfileMarkdownDescription(Platform.Mac),
			type: 'object',
			default: {
				'bash': {
					path: 'bash',
					args: ['-l'],
					icon: Codicon.terminalBash.id
				},
				'zsh': {
					path: 'zsh',
					args: ['-l']
				},
				'fish': {
					path: 'fish',
					args: ['-l']
				},
				'tmux': {
					path: 'tmux',
					icon: Codicon.terminalTmux.id
				},
				'pwsh': {
					path: 'pwsh',
					icon: Codicon.terminalPowershell.id
				}
			},
			additionalProperties: {
				'anyOf': [
					{
						type: 'object',
						required: ['extensionIdentifier', 'id', 'title'],
						properties: {
							extensionIdentifier: {
								description: localize('terminalProfile.osxExtensionIdentifier', '提供此配置文件的扩展。'),
								type: 'string'
							},
							id: {
								description: localize('terminalProfile.osxExtensionId', '扩展终端的 ID'),
								type: 'string'
							},
							title: {
								description: localize('terminalProfile.osxExtensionTitle', '扩展终端的名称'),
								type: 'string'
							},
							...terminalProfileBaseProperties
						}
					},
					{ type: 'null' },
					terminalProfileSchema
				]
			}
		},
		[TerminalSettingId.ProfilesLinux]: {
			restricted: true,
			markdownDescription: createTerminalProfileMarkdownDescription(Platform.Linux),
			type: 'object',
			default: {
				'bash': {
					path: 'bash',
					icon: Codicon.terminalBash.id
				},
				'zsh': {
					path: 'zsh'
				},
				'fish': {
					path: 'fish'
				},
				'tmux': {
					path: 'tmux',
					icon: Codicon.terminalTmux.id
				},
				'pwsh': {
					path: 'pwsh',
					icon: Codicon.terminalPowershell.id
				}
			},
			additionalProperties: {
				'anyOf': [
					{
						type: 'object',
						required: ['extensionIdentifier', 'id', 'title'],
						properties: {
							extensionIdentifier: {
								description: localize('terminalProfile.linuxExtensionIdentifier', '提供此配置文件的扩展。'),
								type: 'string'
							},
							id: {
								description: localize('terminalProfile.linuxExtensionId', '扩展终端的 ID'),
								type: 'string'
							},
							title: {
								description: localize('terminalProfile.linuxExtensionTitle', '扩展终端的名称'),
								type: 'string'
							},
							...terminalProfileBaseProperties
						}
					},
					{ type: 'null' },
					terminalProfileSchema
				]
			}
		},
		[TerminalSettingId.UseWslProfiles]: {
			description: localize('terminal.integrated.useWslProfiles', '控制是否在终端下拉列表中显示 WSL 发行版'),
			type: 'boolean',
			default: true
		},
		[TerminalSettingId.InheritEnv]: {
			scope: ConfigurationScope.APPLICATION,
			description: localize('terminal.integrated.inheritEnv', "新 shell 是否应从 VS Code 继承其环境，这可能会生成登录 shell，以确保初始化 $PATH 和其他开发变量。这不会对 Windows 造成影响。"),
			type: 'boolean',
			default: true
		},
		[TerminalSettingId.PersistentSessionScrollback]: {
			scope: ConfigurationScope.APPLICATION,
			markdownDescription: localize('terminal.integrated.persistentSessionScrollback', "控制重新连接到永久性终端会话时将还原的最大行数。增加此数量将以占用更多内存为代价还原更多的回滚行，并增加在启动时连接到终端所需的时间。此设置需要重启才能生效，并应设置为小于或等于 `#terminal.integrated.scrollback#` 的值。"),
			type: 'number',
			default: 100
		},
		[TerminalSettingId.ShowLinkHover]: {
			scope: ConfigurationScope.APPLICATION,
			description: localize('terminal.integrated.showLinkHover', "是否显示终端输出中链接的悬停。"),
			type: 'boolean',
			default: true
		},
		[TerminalSettingId.IgnoreProcessNames]: {
			markdownDescription: localize('terminal.integrated.confirmIgnoreProcesses', "使用 {0} 设置时要忽略的一组流程名称。", '`#terminal.integrated.confirmOnKill#`'),
			type: 'array',
			items: {
				type: 'string',
				uniqueItems: true
			},
			default: [
				// Popular prompt programs, these should not count as child processes
				'starship',
				'oh-my-posh',
				// Git bash may runs a subprocess of itself (bin\bash.exe -> usr\bin\bash.exe)
				'bash',
				'zsh',
			]
		}
	}
};

/**
 * Registers terminal configurations required by shared process and remote server.
 */
export function registerTerminalPlatformConfiguration() {
	Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(terminalPlatformConfiguration);
	registerTerminalDefaultProfileConfiguration();
}

let defaultProfilesConfiguration: IConfigurationNode | undefined;
export function registerTerminalDefaultProfileConfiguration(detectedProfiles?: { os: OperatingSystem; profiles: ITerminalProfile[] }, extensionContributedProfiles?: readonly IExtensionTerminalProfile[]) {
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	let profileEnum;
	if (detectedProfiles) {
		profileEnum = createProfileSchemaEnums(detectedProfiles?.profiles, extensionContributedProfiles);
	}
	const oldDefaultProfilesConfiguration = defaultProfilesConfiguration;
	defaultProfilesConfiguration = {
		id: 'terminal',
		order: 100,
		title: localize('terminalIntegratedConfigurationTitle', "集成终端"),
		type: 'object',
		properties: {
			[TerminalSettingId.DefaultProfileLinux]: {
				restricted: true,
				markdownDescription: localize('terminal.integrated.defaultProfile.linux', "Linux 上的默认终端配置文件。"),
				type: ['string', 'null'],
				default: null,
				enum: detectedProfiles?.os === OperatingSystem.Linux ? profileEnum?.values : undefined,
				markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Linux ? profileEnum?.markdownDescriptions : undefined
			},
			[TerminalSettingId.DefaultProfileMacOs]: {
				restricted: true,
				markdownDescription: localize('terminal.integrated.defaultProfile.osx', "macOS 上的默认终端配置文件。"),
				type: ['string', 'null'],
				default: null,
				enum: detectedProfiles?.os === OperatingSystem.Macintosh ? profileEnum?.values : undefined,
				markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Macintosh ? profileEnum?.markdownDescriptions : undefined
			},
			[TerminalSettingId.DefaultProfileWindows]: {
				restricted: true,
				markdownDescription: localize('terminal.integrated.defaultProfile.windows', "Windows 上的默认终端配置文件。"),
				type: ['string', 'null'],
				default: null,
				enum: detectedProfiles?.os === OperatingSystem.Windows ? profileEnum?.values : undefined,
				markdownEnumDescriptions: detectedProfiles?.os === OperatingSystem.Windows ? profileEnum?.markdownDescriptions : undefined
			},
		}
	};
	registry.updateConfigurations({ add: [defaultProfilesConfiguration], remove: oldDefaultProfilesConfiguration ? [oldDefaultProfilesConfiguration] : [] });
}
