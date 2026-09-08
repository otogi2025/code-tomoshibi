/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import minimist from 'minimist';
import { isWindows } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { NativeParsedArgs } from '../common/argv.js';

/**
 * This code is also used by standalone cli's. Avoid adding any other dependencies.
 */
const helpCategories = {
	o: localize('optionsUpperCase', "选项"),
	e: localize('extensionsManagement', "扩展管理"),
	t: localize('troubleshooting', "故障排查"),
	m: localize('mcp', "模型上下文协议")
};

export interface Option<OptionType> {
	type: OptionType;
	alias?: string;
	deprecates?: string[]; // old deprecated ids
	args?: string | string[];
	description?: string;
	deprecationMessage?: string;
	allowEmptyValue?: boolean;
	cat?: keyof typeof helpCategories;
	global?: boolean;
}

export interface Subcommand<T> {
	type: 'subcommand';
	description?: string;
	deprecationMessage?: string;
	options: OptionDescriptions<Required<T>>;
}

export type OptionDescriptions<T> = {
	[P in keyof T]:
	T[P] extends boolean | undefined ? Option<'boolean'> :
	T[P] extends string | undefined ? Option<'string'> :
	T[P] extends string[] | undefined ? Option<'string[]'> :
	Subcommand<T[P]>
};

export const NATIVE_CLI_COMMANDS = ['tunnel', 'serve-web', 'agent'] as const;

export const OPTIONS: OptionDescriptions<Required<NativeParsedArgs>> = {
	'chat': {
		type: 'subcommand',
		description: 'Pass in a prompt to run in a chat session in the current working directory.',
		options: {
			'_': { type: 'string[]', description: localize('prompt', "用作聊天的提示。") },
			'mode': { type: 'string', cat: 'o', alias: 'm', args: 'mode', description: localize('chatMode', "聊天会话使用的模式。可用选项:“询问”、“编辑”、“代理”或自定义模式的标识符。默认为“代理”。") },
			'add-file': { type: 'string[]', cat: 'o', alias: 'a', args: 'path', description: localize('addFile', "将文件作为上下文添加到聊天会话。") },
			'maximize': { type: 'boolean', cat: 'o', description: localize('chatMaximize', "最大化聊天会话视图。") },
			'reuse-window': { type: 'boolean', cat: 'o', alias: 'r', description: localize('reuseWindowForChat', "强制使用最后一个活动窗口进行聊天会话。") },
			'new-window': { type: 'boolean', cat: 'o', alias: 'n', description: localize('newWindowForChat', "强制打开一个空窗口进行聊天会话。") },
			'profile': { type: 'string', 'cat': 'o', args: 'profileName', description: localize('profileName', "使用给定的配置文件打开所提供的文件夹或工作区，并将配置文件与工作区相关联。如果配置文件不存在，则会创建一个新的空配置文件。") },
			'help': { type: 'boolean', alias: 'h', description: localize('help', "打印使用情况。") }
		}
	},
	'serve-web': {
		type: 'subcommand',
		description: 'Run a server that displays the editor UI in browsers.',
		options: {
			'cli-data-dir': { type: 'string', args: 'dir', description: localize('cliDataDir', "应在其中存储 CLI 元数据的目录。") },
			'disable-telemetry': { type: 'boolean' },
			'telemetry-level': { type: 'string' },
		}
	},
	'agent': {
		type: 'subcommand',
		description: 'Start and interact with AI agent hosts.',
		options: {
			'cli-data-dir': { type: 'string', args: 'dir', description: localize('cliDataDir', "应在其中存储 CLI 元数据的目录。") },
			'disable-telemetry': { type: 'boolean' },
			'telemetry-level': { type: 'string' },
		}
	},
	'tunnel': {
		type: 'subcommand',
		description: 'Make the current machine accessible from vscode.dev or other machines through a secure tunnel.',
		options: {
			'cli-data-dir': { type: 'string', args: 'dir', description: localize('cliDataDir', "应在其中存储 CLI 元数据的目录。") },
			'disable-telemetry': { type: 'boolean' },
			'telemetry-level': { type: 'string' },
			user: {
				type: 'subcommand',
				options: {
					login: {
						type: 'subcommand',
						options: {
							provider: { type: 'string' },
							'access-token': { type: 'string' }
						}
					}
				}
			}
		}
	},
	'diff': { type: 'boolean', cat: 'o', alias: 'd', args: ['file', 'file'], description: localize('diff', "将两个文件相互比较。") },
	'merge': { type: 'boolean', cat: 'o', alias: 'm', args: ['path1', 'path2', 'base', 'result'], description: localize('merge', "通过提供文件的两个修改版本的路径、两个修改版本的共同来源，以及保存合并结果的输出文件来执行三向合并。") },
	'add': { type: 'boolean', cat: 'o', alias: 'a', args: 'folder', description: localize('add', "将文件夹添加到上一个活动窗口。") },
	'remove': { type: 'boolean', cat: 'o', args: 'folder', description: localize('remove', "从上一个活动窗口中删除文件夹()。") },
	'goto': { type: 'boolean', cat: 'o', alias: 'g', args: 'file:line[:character]', description: localize('goto', "打开路径下的文件并定位到特定行和特定列。") },
	'new-window': { type: 'boolean', cat: 'o', alias: 'n', description: localize('newWindow', "强制打开新窗口。") },
	'reuse-window': { type: 'boolean', cat: 'o', alias: 'r', description: localize('reuseWindow', "强制在已打开的窗口中打开文件或文件夹。") },
	'agents': { type: 'boolean', cat: 'o', deprecates: ['sessions'], description: localize('agents', "打开代理窗口。") },
	'wait': { type: 'boolean', cat: 'o', alias: 'w', description: localize('wait', "等文件关闭后再返回。") },
	'waitMarkerFilePath': { type: 'string' },
	'locale': { type: 'string', cat: 'o', args: 'locale', description: localize('locale', "要使用的区域设置(例如 en-US 或 zh-TW)。") },
	'user-data-dir': { type: 'string', cat: 'o', args: 'dir', description: localize('userDataDir', "指定保存用户数据的目录。可用于打开多个不同的 Code 实例。") },
	'profile': { type: 'string', 'cat': 'o', args: 'profileName', description: localize('profileName', "使用给定的配置文件打开所提供的文件夹或工作区，并将配置文件与工作区相关联。如果配置文件不存在，则会创建一个新的空配置文件。") },
	'help': { type: 'boolean', cat: 'o', alias: 'h', description: localize('help', "打印使用情况。") },
	'stdin-to-clipboard': { type: 'boolean', cat: 'o', alias: 'c', description: localize('clipboard', "copies the STDIN to the clipboard") },

	'extensions-dir': { type: 'string', deprecates: ['extensionHomePath'], cat: 'e', args: 'dir', description: localize('extensionHomePath', "设置扩展的根路径。") },
	'extensions-download-dir': { type: 'string' },
	'builtin-extensions-dir': { type: 'string' },
	'shared-data-dir': { type: 'string' },
	'list-extensions': { type: 'boolean', cat: 'e', description: localize('listExtensions', "列出已安装的扩展。") },
	'agent-plugins-dir': { type: 'string' },
	'agents-user-data-dir': { type: 'string' },
	'agents-extensions-dir': { type: 'string' },
	'show-versions': { type: 'boolean', cat: 'e', description: localize('showVersions', "使用 --list-extensions 时，显示已安装扩展的版本。") },
	'category': { type: 'string', allowEmptyValue: true, cat: 'e', description: localize('category', "使用 --list-extensions 时，按提供的类别筛选已安装的扩展。"), args: 'category' },
	'install-extension': { type: 'string[]', cat: 'e', args: 'ext-id | path', description: localize('installExtension', "安装或更新扩展。参数是 VSIX 的扩展 ID 或路径。扩展的标识符为 '${publisher}.${name}'。使用 '--force' 参数更新到最新版本。若要安装特定版本，请提供 '@${version}'。例如:'vscode.csharp@1.2.3'。") },
	'pre-release': { type: 'boolean', cat: 'e', description: localize('install prerelease', "使用 --install-extension 时安装扩展的预发行版本") },
	'uninstall-extension': { type: 'string[]', cat: 'e', args: 'ext-id', description: localize('uninstallExtension', "卸载扩展。") },
	'update-extensions': { type: 'boolean', cat: 'e', description: localize('updateExtensions', "更新已安装的扩展。") },
	'enable-proposed-api': { type: 'string[]', allowEmptyValue: true, cat: 'e', args: 'ext-id', description: localize('experimentalApis', "为扩展启用实验性 API 功能。可以输入一个或多个扩展的 ID 来进行单独启用。") },


	'version': { type: 'boolean', cat: 't', alias: 'v', description: localize('version', "打印版本。") },
	'verbose': { type: 'boolean', cat: 't', global: true, description: localize('verbose', "打印详细输出(表示 - 等待)。") },
	'log': { type: 'string[]', cat: 't', args: 'level', global: true, description: localize('log', "要使用的日志级别。默认值为 \"info\"。允许的值为 \"critical\"、\"error\"、\"warn\"、\"info\"、\"debug\"、\"trace\"、\"off\"。还可以通过以下格式传递扩展 ID 和日志级别以配置扩展的日志级别: \"${publisher}.${name}:${logLevel}\"。例如: \"vscode.csharp:trace\"。可以接收一个或多个此类条目。") },
	'status': { type: 'boolean', alias: 's', cat: 't', description: localize('status', "打印进程使用情况和诊断信息。") },
	'prof-startup': { type: 'boolean', cat: 't', description: localize('prof-startup', "启动期间运行 CPU 探查器。") },
	'prof-append-timers': { type: 'string' },
	'prof-duration-markers': { type: 'string[]' },
	'prof-duration-markers-file': { type: 'string' },
	'no-cached-data': { type: 'boolean' },
	'prof-startup-prefix': { type: 'string' },
	'prof-v8-extensions': { type: 'boolean' },
	'disable-extensions': { type: 'boolean', deprecates: ['disableExtensions'], cat: 't', description: localize('disableExtensions', "禁用所有已安装的扩展。此选项不会持久化，并且仅在命令打开新窗口时有效。") },
	'disable-extension': { type: 'string[]', cat: 't', args: 'ext-id', description: localize('disableExtension', "禁用提供的扩展。此选项不会持久化，并且仅在命令打开新窗口时有效。") },
	'sync': { type: 'string', cat: 't', description: localize('turn sync', "打开或关闭同步。"), args: ['on | off'] },

	'inspect-extensions': { type: 'string', allowEmptyValue: true, deprecates: ['debugPluginHost'], args: 'port', cat: 't', description: localize('inspect-extensions', "允许调试和分析扩展。您可以在开发人员工具中找到连接 URI。") },
	'inspect-brk-extensions': { type: 'string', allowEmptyValue: true, deprecates: ['debugBrkPluginHost'], args: 'port', cat: 't', description: localize('inspect-brk-extensions', "允许扩展宿主在启动后暂停时进行扩展的调试和分析。您可以在开发人员工具中找到连接 URI。") },
	'disable-lcd-text': { type: 'boolean', cat: 't', description: localize('disableLCDText', "禁用 LCD 字体呈现。") },
	'disable-gpu': { type: 'boolean', cat: 't', description: localize('disableGPU', "禁用 GPU 硬件加速。") },
	'disable-chromium-sandbox': { type: 'boolean', cat: 't', description: localize('disableChromiumSandbox', "仅当需要在 Linux 上以 sudo 用户身份启动应用程序或在 Windows 上的 applocker 环境中以提升的用户身份运行时，才使用此选项。") },
	'sandbox': { type: 'boolean' },
	'locate-shell-integration-path': { type: 'string', cat: 't', args: ['shell'], description: localize('locateShellIntegrationPath', "打印终端 shell 集成脚本的路径。允许的值为 'bash'、'pwsh'、'zsh' 或 'fish'。") },
	'telemetry': { type: 'boolean', cat: 't', description: localize('telemetry', "显示 VS Code 收集的所有遥测事件。") },

	'remote': { type: 'string', allowEmptyValue: true },
	'folder-uri': { type: 'string[]', cat: 'o', args: 'uri' },
	'file-uri': { type: 'string[]', cat: 'o', args: 'uri' },

	'locate-extension': { type: 'string[]' },
	'extensionDevelopmentPath': { type: 'string[]' },
	'extensionDevelopmentKind': { type: 'string[]' },
	'extensionTestsPath': { type: 'string' },
	'extensionEnvironment': { type: 'string' },
	'debugId': { type: 'string' },
	'debugRenderer': { type: 'boolean' },
	'inspect-ptyhost': { type: 'string', allowEmptyValue: true },
	'inspect-brk-ptyhost': { type: 'string', allowEmptyValue: true },
	'inspect-agenthost': { type: 'string', allowEmptyValue: true },
	'inspect-brk-agenthost': { type: 'string', allowEmptyValue: true },
	'inspect-sharedprocess': { type: 'string', allowEmptyValue: true },
	'inspect-brk-sharedprocess': { type: 'string', allowEmptyValue: true },
	'export-default-configuration': { type: 'string' },
	'export-policy-data': { type: 'string', allowEmptyValue: true },
	'export-default-keybindings': { type: 'string', allowEmptyValue: true },
	'install-source': { type: 'string' },
	'enable-smoke-test-driver': { type: 'boolean' },
	'skip-sessions-welcome': { type: 'boolean' },
	'logExtensionHostCommunication': { type: 'boolean' },
	'skip-release-notes': { type: 'boolean' },
	'skip-welcome': { type: 'boolean' },
	'disable-telemetry': { type: 'boolean' },
	'disable-updates': { type: 'boolean' },
	'share-secrets-with-agents-app': { type: 'boolean' },
	'transient': { type: 'boolean', cat: 't', description: localize('transient', "使用临时数据和扩展目录运行，就像首次启动一样。") },
	'use-inmemory-secretstorage': { type: 'boolean', deprecates: ['disable-keytar'] },
	'password-store': { type: 'string' },
	'disable-workspace-trust': { type: 'boolean' },
	'disable-crash-reporter': { type: 'boolean' },
	'crash-reporter-directory': { type: 'string' },
	'crash-reporter-id': { type: 'string' },
	'skip-add-to-recently-opened': { type: 'boolean' },
	'open-url': { type: 'boolean' },
	'file-write': { type: 'boolean' },
	'file-chmod': { type: 'boolean' },
	'install-builtin-extension': { type: 'string[]' },
	'force': { type: 'boolean' },
	'do-not-sync': { type: 'boolean' },
	'do-not-include-pack-dependencies': { type: 'boolean' },
	'trace': { type: 'boolean' },
	'trace-memory-infra': { type: 'boolean' },
	'trace-category-filter': { type: 'string' },
	'trace-options': { type: 'string' },
	'preserve-env': { type: 'boolean' },
	'force-user-env': { type: 'boolean' },
	'force-disable-user-env': { type: 'boolean' },
	'open-devtools': { type: 'boolean' },
	'disable-gpu-sandbox': { type: 'boolean' },
	'logsPath': { type: 'string' },
	'__enable-file-policy': { type: 'boolean' },
	'editSessionId': { type: 'string' },
	'continueOn': { type: 'string' },
	'enable-coi': { type: 'boolean' },
	'unresponsive-sample-interval': { type: 'string' },
	'unresponsive-sample-period': { type: 'string' },
	'enable-rdp-display-tracking': { type: 'boolean' },
	'disable-layout-restore': { type: 'boolean' },
	'disable-experiments': { type: 'boolean' },

	// chromium flags
	'no-proxy-server': { type: 'boolean' },
	// Minimist incorrectly parses keys that start with `--no`
	// https://github.com/substack/minimist/blob/aeb3e27dae0412de5c0494e9563a5f10c82cc7a9/index.js#L118-L121
	// If --no-sandbox is passed via cli wrapper it will be treated as --sandbox which is incorrect, we use
	// the alias here to make sure --no-sandbox is always respected.
	// For https://github.com/microsoft/vscode/issues/128279
	'no-sandbox': { type: 'boolean', alias: 'sandbox' },
	'proxy-server': { type: 'string' },
	'proxy-bypass-list': { type: 'string' },
	'proxy-pac-url': { type: 'string' },
	'js-flags': { type: 'string' }, // chrome js flags
	'inspect': { type: 'string', allowEmptyValue: true },
	'inspect-brk': { type: 'string', allowEmptyValue: true },
	'nolazy': { type: 'boolean' }, // node inspect
	'force-device-scale-factor': { type: 'string' },
	'force-renderer-accessibility': { type: 'boolean' },
	'ignore-certificate-errors': { type: 'boolean' },
	'allow-insecure-localhost': { type: 'boolean' },
	'log-net-log': { type: 'string' },
	'vmodule': { type: 'string' },
	'_urls': { type: 'string[]' },
	'disable-dev-shm-usage': { type: 'boolean' },
	'profile-temp': { type: 'boolean' },
	'ozone-platform': { type: 'string' },
	'enable-tracing': { type: 'string' },
	'trace-startup-format': { type: 'string' },
	'trace-startup-file': { type: 'string' },
	'trace-startup-duration': { type: 'string' },
	'xdg-portal-required-version': { type: 'string' },

	_: { type: 'string[]' } // main arguments
};

export interface ErrorReporter {
	onUnknownOption(id: string): void;
	onMultipleValues(id: string, usedValue: string): void;
	onEmptyValue(id: string): void;
	onDeprecatedOption(deprecatedId: string, message: string): void;

	getSubcommandReporter?(command: string): ErrorReporter;
}

const ignoringReporter = {
	onUnknownOption: () => { },
	onMultipleValues: () => { },
	onEmptyValue: () => { },
	onDeprecatedOption: () => { }
};

export function parseArgs<T>(args: string[], options: OptionDescriptions<T>, errorReporter: ErrorReporter = ignoringReporter): T {
	// Find the first non-option arg, which also isn't the value for a previous `--flag`
	const firstPossibleCommand = args.find((a, i) => a.length > 0 && a[0] !== '-' && options.hasOwnProperty(a) && options[a as T].type === 'subcommand');

	const alias: { [key: string]: string } = {};
	const stringOptions: string[] = ['_'];
	const booleanOptions: string[] = [];
	const globalOptions: Record<string, Option<'boolean'> | Option<'string'> | Option<'string[]'>> = {};
	let command: Subcommand<Record<string, unknown>> | undefined = undefined;
	for (const optionId in options) {
		const o = options[optionId];
		if (o.type === 'subcommand') {
			if (optionId === firstPossibleCommand) {
				command = o;
			}
		} else {
			if (o.alias) {
				alias[optionId] = o.alias;
			}

			if (o.type === 'string' || o.type === 'string[]') {
				stringOptions.push(optionId);
				if (o.deprecates) {
					stringOptions.push(...o.deprecates);
				}
			} else if (o.type === 'boolean') {
				booleanOptions.push(optionId);
				if (o.deprecates) {
					booleanOptions.push(...o.deprecates);
				}
			}
			if (o.global) {
				globalOptions[optionId] = o;
			}
		}
	}
	if (command && firstPossibleCommand) {
		const options: Record<string, Option<'boolean'> | Option<'string'> | Option<'string[]'> | Subcommand<Record<string, unknown>>> = globalOptions;
		for (const optionId in command.options) {
			options[optionId] = command.options[optionId];
		}
		const newArgs = args.filter(a => a !== firstPossibleCommand);
		const reporter = errorReporter.getSubcommandReporter ? errorReporter.getSubcommandReporter(firstPossibleCommand) : undefined;
		const subcommandOptions = parseArgs(newArgs, options as OptionDescriptions<Record<string, unknown>>, reporter);
		// eslint-disable-next-line local/code-no-dangerous-type-assertions
		return <T>{
			[firstPossibleCommand]: subcommandOptions,
			_: []
		};
	}


	// remove aliases to avoid confusion
	const parsedArgs = minimist(args, { string: stringOptions, boolean: booleanOptions, alias });

	const cleanedArgs: Record<string, unknown> = {};
	const remainingArgs: Record<string, unknown> = parsedArgs;

	// https://github.com/microsoft/vscode/issues/58177, https://github.com/microsoft/vscode/issues/106617
	cleanedArgs._ = parsedArgs._.map(arg => String(arg)).filter(arg => arg.length > 0);

	delete remainingArgs._;

	for (const optionId in options) {
		const o = options[optionId];
		if (o.type === 'subcommand') {
			continue;
		}
		if (o.alias) {
			delete remainingArgs[o.alias];
		}

		let val = remainingArgs[optionId];
		if (o.deprecates) {
			for (const deprecatedId of o.deprecates) {
				if (remainingArgs.hasOwnProperty(deprecatedId)) {
					if (!val) {
						val = remainingArgs[deprecatedId];
						if (val) {
							errorReporter.onDeprecatedOption(deprecatedId, o.deprecationMessage || localize('deprecated.useInstead', '请改用 {0}。', optionId));
						}
					}
					delete remainingArgs[deprecatedId];
				}
			}
		}

		if (typeof val !== 'undefined') {
			if (o.type === 'string[]') {
				if (!Array.isArray(val)) {
					val = [val];
				}
				if (!o.allowEmptyValue) {
					const sanitized = (val as string[]).filter((v: string) => v.length > 0);
					if (sanitized.length !== (val as string[]).length) {
						errorReporter.onEmptyValue(optionId);
						val = sanitized.length > 0 ? sanitized : undefined;
					}
				}
			} else if (o.type === 'string') {
				if (Array.isArray(val)) {
					val = val.pop(); // take the last
					errorReporter.onMultipleValues(optionId, val as string);
				} else if (!val && !o.allowEmptyValue) {
					errorReporter.onEmptyValue(optionId);
					val = undefined;
				}
			}
			cleanedArgs[optionId] = val;

			if (o.deprecationMessage) {
				errorReporter.onDeprecatedOption(optionId, o.deprecationMessage);
			}
		}
		delete remainingArgs[optionId];
	}

	for (const key in remainingArgs) {
		errorReporter.onUnknownOption(key);
	}

	return cleanedArgs as T;
}

function formatUsage(optionId: string, option: Option<'boolean'> | Option<'string'> | Option<'string[]'>) {
	let args = '';
	if (option.args) {
		if (Array.isArray(option.args)) {
			args = ` <${option.args.join('> <')}>`;
		} else {
			args = ` <${option.args}>`;
		}
	}
	if (option.alias) {
		return `-${option.alias} --${optionId}${args}`;
	}
	return `--${optionId}${args}`;
}

// exported only for testing
export function formatOptions(options: OptionDescriptions<unknown> | Record<string, Option<'boolean'> | Option<'string'> | Option<'string[]'>>, columns: number): string[] {
	const usageTexts: [string, string][] = [];
	for (const optionId in options) {
		const o = options[optionId as keyof typeof options] as Option<'boolean'> | Option<'string'> | Option<'string[]'>;
		const usageText = formatUsage(optionId, o);
		usageTexts.push([usageText, o.description!]);
	}
	return formatUsageTexts(usageTexts, columns);
}

function formatUsageTexts(usageTexts: [string, string][], columns: number) {
	const maxLength = usageTexts.reduce((previous, e) => Math.max(previous, e[0].length), 12);
	const argLength = maxLength + 2/*left padding*/ + 1/*right padding*/;
	if (columns - argLength < 25) {
		// Use a condensed version on narrow terminals
		return usageTexts.reduce<string[]>((r, ut) => r.concat([`  ${ut[0]}`, `      ${ut[1]}`]), []);
	}
	const descriptionColumns = columns - argLength - 1;
	const result: string[] = [];
	for (const ut of usageTexts) {
		const usage = ut[0];
		const wrappedDescription = wrapText(ut[1], descriptionColumns);
		const keyPadding = indent(argLength - usage.length - 2/*left padding*/);
		result.push('  ' + usage + keyPadding + wrappedDescription[0]);
		for (let i = 1; i < wrappedDescription.length; i++) {
			result.push(indent(argLength) + wrappedDescription[i]);
		}
	}
	return result;
}

function indent(count: number): string {
	return ' '.repeat(count);
}

function wrapText(text: string, columns: number): string[] {
	const lines: string[] = [];
	while (text.length) {
		let index = text.length < columns ? text.length : text.lastIndexOf(' ', columns);
		if (index === 0) {
			index = columns;
		}
		const line = text.slice(0, index).trim();
		text = text.slice(index).trimStart();
		lines.push(line);
	}
	return lines;
}

export function buildHelpMessage(productName: string, executableName: string, version: string, options: OptionDescriptions<unknown> | Record<string, Option<'boolean'> | Option<'string'> | Option<'string[]'> | Subcommand<Record<string, unknown>>>, capabilities?: { noPipe?: boolean; noInputFiles?: boolean; isChat?: boolean }): string {
	const columns = (process.stdout).isTTY && (process.stdout).columns || 80;
	const inputFiles = capabilities?.noInputFiles ? '' : capabilities?.isChat ? ` [${localize('cliPrompt', '提示')}]` : ` [${localize('paths', '路径')}...]`;
	const subcommand = capabilities?.isChat ? ' chat' : '';

	const help = [`${productName} ${version}`];
	help.push('');
	help.push(`${localize('usage', "使用情况")}: ${executableName}${subcommand} [${localize('options', "选项")}]${inputFiles}`);
	help.push('');
	if (capabilities?.noPipe !== true) {
		help.push(buildStdinMessage(executableName, capabilities?.isChat));
		help.push('');
	}
	const optionsByCategory: { [P in keyof typeof helpCategories]?: Record<string, Option<'boolean'> | Option<'string'> | Option<'string[]'>> } = {};
	const subcommands: { command: string; description: string }[] = [];
	for (const optionId in options) {
		const o = options[optionId as keyof typeof options] as Option<'boolean'> | Option<'string'> | Option<'string[]'> | Subcommand<Record<string, unknown>>;
		if (o.type === 'subcommand') {
			if (o.description) {
				subcommands.push({ command: optionId, description: o.description });
			}
		} else if (o.description && o.cat) {
			const cat = o.cat;
			let optionsByCat = optionsByCategory[cat];
			if (!optionsByCat) {
				optionsByCategory[cat] = optionsByCat = {};
			}
			optionsByCat[optionId] = o;
		}
	}

	for (const helpCategoryKey in optionsByCategory) {
		const key = <keyof typeof helpCategories>helpCategoryKey;

		const categoryOptions = optionsByCategory[key];
		if (categoryOptions) {
			help.push(helpCategories[key]);
			help.push(...formatOptions(categoryOptions, columns));
			help.push('');
		}
	}

	if (subcommands.length) {
		help.push(localize('subcommands', "子命令"));
		help.push(...formatUsageTexts(subcommands.map(s => [s.command, s.description]), columns));
		help.push('');
	}

	return help.join('\n');
}

export function buildStdinMessage(executableName: string, isChat?: boolean): string {
	let example: string;
	if (isWindows) {
		if (isChat) {
			example = `echo Hello World | ${executableName} chat <prompt> -`;
		} else {
			example = `echo Hello World | ${executableName} -`;
		}
	} else {
		if (isChat) {
			example = `ps aux | grep code | ${executableName} chat <prompt> -`;
		} else {
			example = `ps aux | grep code | ${executableName} -`;
		}
	}

	return localize('stdinUsage', "要从 stdin 中读取，请追加 \"-\" (例如 \"{0}\")", example);
}

export function buildVersionMessage(version: string | undefined, commit: string | undefined): string {
	return `${version || localize('unknownVersion', "未知版本")}\n${commit || localize('unknownCommit', "未知提交")}\n${process.arch}`;
}
