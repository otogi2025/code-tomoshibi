/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import * as Objects from '../../../../base/common/objects.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';

import commonSchema from './jsonSchemaCommon.js';

import { ProblemMatcherRegistry } from './problemMatcher.js';
import { TaskDefinitionRegistry } from './taskDefinitionRegistry.js';
import * as ConfigurationResolverUtils from '../../../services/configurationResolver/common/configurationResolverUtils.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
import { getAllCodicons } from '../../../../base/common/codicons.js';

function fixReferences(literal: Record<string, unknown> | unknown[]) {
	if (Array.isArray(literal)) {
		literal.forEach(element => {
			if (typeof element === 'object' && element !== null) {
				fixReferences(element as Record<string, unknown>);
			}
		});
	} else if (typeof literal === 'object') {
		if (literal['$ref']) {
			literal['$ref'] = literal['$ref'] + '2';
		}
		Object.getOwnPropertyNames(literal).forEach(property => {
			const value = literal[property];
			if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
				fixReferences(value as Record<string, unknown>);
			}
		});
	}
}

const shellCommand: IJSONSchema = {
	anyOf: [
		{
			type: 'boolean',
			default: true,
			description: nls.localize('JsonSchema.shell', '指定命令是 shell 命令还是外部程序。如果省略，则默认为 false。')
		},
		{
			$ref: '#/definitions/shellConfiguration'
		}
	],
	deprecationMessage: nls.localize('JsonSchema.tasks.isShellCommand.deprecated', 'isShellCommand 属性已被弃用。请改为使用任务的 type 属性和选项中的 shell 属性。另请参阅 1.14 发行说明。')
};


const hide: IJSONSchema = {
	type: 'boolean',
	description: nls.localize('JsonSchema.hide', '从运行任务快速选择菜单中隐藏此任务'),
	default: true
};

const inAgents: IJSONSchema = {
	type: 'boolean',
	description: nls.localize('JsonSchema.inAgents', '在智能体运行操作下拉列表中显示此任务'),
	default: false
};

const taskIdentifier: IJSONSchema = {
	type: 'object',
	additionalProperties: true,
	properties: {
		type: {
			type: 'string',
			description: nls.localize('JsonSchema.tasks.dependsOn.identifier', '任务标识符。')
		}
	}
};

const dependsOn: IJSONSchema = {
	anyOf: [
		{
			type: 'string',
			description: nls.localize('JsonSchema.tasks.dependsOn.string', '此任务依赖的另一任务。')
		},
		taskIdentifier,
		{
			type: 'array',
			description: nls.localize('JsonSchema.tasks.dependsOn.array', '此任务依赖的其他任务。'),
			items: {
				anyOf: [
					{
						type: 'string',
					},
					taskIdentifier
				]
			}
		}
	],
	description: nls.localize('JsonSchema.tasks.dependsOn', '表示另一个任务的字符串或此任务所依赖的其他任务的数组。')
};

const dependsOrder: IJSONSchema = {
	type: 'string',
	enum: ['parallel', 'sequence'],
	enumDescriptions: [
		nls.localize('JsonSchema.tasks.dependsOrder.parallel', '并行运行所有 dependsOn 任务。'),
		nls.localize('JsonSchema.tasks.dependsOrder.sequence', '按顺序运行所有 dependsOn 任务。'),
	],
	default: 'parallel',
	description: nls.localize('JsonSchema.tasks.dependsOrder', '确定此任务的依赖任务的顺序。请注意，此属性不是递归的。')
};

const detail: IJSONSchema = {
	type: 'string',
	description: nls.localize('JsonSchema.tasks.detail', '任务的可选说明，在“运行任务”快速选取中作为详细信息显示。')
};

const icon: IJSONSchema = {
	type: 'object',
	description: nls.localize('JsonSchema.tasks.icon', '任务的可选图标'),
	properties: {
		id: {
			description: nls.localize('JsonSchema.tasks.icon.id', '要使用的可选 codicon ID'),
			type: ['string', 'null'],
			enum: Array.from(getAllCodicons(), icon => icon.id),
			markdownEnumDescriptions: Array.from(getAllCodicons(), icon => `$(${icon.id})`),
		},
		color: {
			description: nls.localize('JsonSchema.tasks.icon.color', '图标的可选颜色'),
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
		},
	}
};

const presentation: IJSONSchema = {
	type: 'object',
	default: {
		echo: true,
		reveal: 'always',
		focus: false,
		panel: 'shared',
		showReuseMessage: true,
		clear: false,
	},
	description: nls.localize('JsonSchema.tasks.presentation', '配置用于显示任务输出并读取其输入的面板。'),
	additionalProperties: false,
	properties: {
		echo: {
			type: 'boolean',
			default: true,
			description: nls.localize('JsonSchema.tasks.presentation.echo', '控制是否将执行的命令显示到面板中。默认值为“true”。')
		},
		focus: {
			type: 'boolean',
			default: false,
			description: nls.localize('JsonSchema.tasks.presentation.focus', '控制面板是否获取焦点。默认值为“false”。如果设置为“true”，面板也会显示。')
		},
		revealProblems: {
			type: 'string',
			enum: ['always', 'onProblem', 'never'],
			enumDescriptions: [
				nls.localize('JsonSchema.tasks.presentation.revealProblems.always', '执行此任务时, 始终显示问题面板。'),
				nls.localize('JsonSchema.tasks.presentation.revealProblems.onProblem', '只有在发现问题时, 才会显示问题面板。'),
				nls.localize('JsonSchema.tasks.presentation.revealProblems.never', '执行此任务时, 永远不会显示问题面板。'),
			],
			default: 'never',
			description: nls.localize('JsonSchema.tasks.presentation.revealProblems', '控制在运行此任务时是否显示问题面板。优先于 "显示" 选项。默认值为 "从不"。')
		},
		reveal: {
			type: 'string',
			enum: ['always', 'silent', 'never'],
			enumDescriptions: [
				nls.localize('JsonSchema.tasks.presentation.reveal.always', '总是在此任务执行时显示终端。'),
				nls.localize('JsonSchema.tasks.presentation.reveal.silent', '只有当任务因错误而退出或者问题匹配器发现错误时，才会显示终端。'),
				nls.localize('JsonSchema.tasks.presentation.reveal.never', '不要在此任务执行时显示终端。'),
			],
			default: 'always',
			description: nls.localize('JsonSchema.tasks.presentation.reveal', '控制运行任务的终端是否显示。可按选项 "revealProblems" 进行替代。默认设置为“始终”。')
		},
		panel: {
			type: 'string',
			enum: ['shared', 'dedicated', 'new'],
			default: 'shared',
			description: nls.localize('JsonSchema.tasks.presentation.instance', '控制是否在任务间共享面板。同一个任务使用相同面板还是每次运行时新创建一个面板。')
		},
		showReuseMessage: {
			type: 'boolean',
			default: true,
			description: nls.localize('JsonSchema.tasks.presentation.showReuseMessage', '控制是否显示“终端将被任务重用，按任意键关闭”提示。')
		},
		clear: {
			type: 'boolean',
			default: false,
			description: nls.localize('JsonSchema.tasks.presentation.clear', '控制是否在执行任务之前清除终端。')
		},
		group: {
			type: 'string',
			description: nls.localize('JsonSchema.tasks.presentation.group', '控制是否使用拆分窗格在特定终端组中执行任务。')
		},
		close: {
			type: 'boolean',
			description: nls.localize('JsonSchema.tasks.presentation.close', '控制任务退出时是否关闭运行任务的终端。')
		},
		preserveTerminalName: {
			type: 'boolean',
			default: false,
			description: nls.localize('JsonSchema.tasks.presentation.preserveTerminalName', '控制在任务完成后是否在终端中保留任务名称。')
		}
	}
};

const terminal: IJSONSchema = Objects.deepClone(presentation);
terminal.deprecationMessage = nls.localize('JsonSchema.tasks.terminal', 'terminal 属性已被弃用。请改为使用 presentation');

const groupStrings: IJSONSchema = {
	type: 'string',
	enum: [
		'build',
		'test',
		'none'
	],
	enumDescriptions: [
		nls.localize('JsonSchema.tasks.group.build', '将任务标记为可通过 "运行生成任务" 命令访问的生成任务。'),
		nls.localize('JsonSchema.tasks.group.test', '将任务标记为可通过 "Run Test Task" 命令访问的测试任务。'),
		nls.localize('JsonSchema.tasks.group.none', '将任务分配为没有组')
	],
	description: nls.localize('JsonSchema.tasks.group.kind', '任务的执行组。')
};

const group: IJSONSchema = {
	oneOf: [
		groupStrings,
		{
			type: 'object',
			properties: {
				kind: groupStrings,
				isDefault: {
					type: ['boolean', 'string'],
					default: false,
					description: nls.localize('JsonSchema.tasks.group.isDefault', '定义此任务是组中的默认任务，还是与应触发此任务的文件匹配的 glob。')
				}
			}
		},
	],
	defaultSnippets: [
		{
			body: { kind: 'build', isDefault: true },
			description: nls.localize('JsonSchema.tasks.group.defaultBuild', '将此任务标记为默认生成任务。')
		},
		{
			body: { kind: 'test', isDefault: true },
			description: nls.localize('JsonSchema.tasks.group.defaultTest', '将此任务标记为默认测试任务。')
		}
	],
	description: nls.localize('JsonSchema.tasks.group', '定义此任务属于的执行组。它支持 "build" 以将其添加到生成组，也支持 "test" 以将其添加到测试组。')
};

const taskType: IJSONSchema = {
	type: 'string',
	enum: ['shell'],
	default: 'process',
	description: nls.localize('JsonSchema.tasks.type', '定义任务是被作为进程运行还是在 shell 中作为命令运行。')
};

const command: IJSONSchema = {
	oneOf: [
		{
			oneOf: [
				{
					type: 'string'
				},
				{
					type: 'array',
					items: {
						type: 'string'
					},
					description: nls.localize('JsonSchema.commandArray', '执行的 Shell 命令。数组项将使用空格连接')
				}
			]
		},
		{
			type: 'object',
			required: ['value', 'quoting'],
			properties: {
				value: {
					oneOf: [
						{
							type: 'string'
						},
						{
							type: 'array',
							items: {
								type: 'string'
							},
							description: nls.localize('JsonSchema.commandArray', '执行的 Shell 命令。数组项将使用空格连接')
						}
					],
					description: nls.localize('JsonSchema.command.quotedString.value', '实际命令值')
				},
				quoting: {
					type: 'string',
					enum: ['escape', 'strong', 'weak'],
					enumDescriptions: [
						nls.localize('JsonSchema.tasks.quoting.escape', '使用 Shell 的转义字符来转义文本 (如，PowerShell 下的 ` 和 bash 下的 \\ )'),
						nls.localize('JsonSchema.tasks.quoting.strong', '使用 Shell 的强引用字符来引用参数 (例如在 PowerShell 和 bash 下的 \')。'),
						nls.localize('JsonSchema.tasks.quoting.weak', '使用 Shell 的弱引用字符来引用参数 (例如在 PowerShell 和 bash 下的 ")。'),
					],
					default: 'strong',
					description: nls.localize('JsonSchema.command.quotesString.quote', '如何引用命令值。')
				}
			}

		}
	],
	description: nls.localize('JsonSchema.command', '要执行的命令。可以是外部程序或 shell 命令。')
};

const args: IJSONSchema = {
	type: 'array',
	items: {
		oneOf: [
			{
				type: 'string',
			},
			{
				type: 'object',
				required: ['value', 'quoting'],
				properties: {
					value: {
						type: 'string',
						description: nls.localize('JsonSchema.args.quotedString.value', '实际参数值')
					},
					quoting: {
						type: 'string',
						enum: ['escape', 'strong', 'weak'],
						enumDescriptions: [
							nls.localize('JsonSchema.tasks.quoting.escape', '使用 Shell 的转义字符来转义文本 (如，PowerShell 下的 ` 和 bash 下的 \\ )'),
							nls.localize('JsonSchema.tasks.quoting.strong', '使用 Shell 的强引用字符来引用参数 (例如在 PowerShell 和 bash 下的 \')。'),
							nls.localize('JsonSchema.tasks.quoting.weak', '使用 Shell 的弱引用字符来引用参数 (例如在 PowerShell 和 bash 下的 ")。'),
						],
						default: 'strong',
						description: nls.localize('JsonSchema.args.quotesString.quote', '参数值应该如何引用。')
					}
				}

			}
		]
	},
	description: nls.localize('JsonSchema.tasks.args', '调用此任务时要传递给命令的参数。')
};

const label: IJSONSchema = {
	type: 'string',
	description: nls.localize('JsonSchema.tasks.label', "任务的用户界面标签")
};

const version: IJSONSchema = {
	type: 'string',
	enum: ['2.0.0'],
	description: nls.localize('JsonSchema.version', '配置的版本号。')
};

const identifier: IJSONSchema = {
	type: 'string',
	description: nls.localize('JsonSchema.tasks.identifier', '用于在 launch.json 或 dependsOn 子句中引用任务的用户定义标识符。'),
	deprecationMessage: nls.localize('JsonSchema.tasks.identifier.deprecated', '已弃用用户定义的标识符。对于自定义任务，请使用名称进行引用；对于由扩展提供的任务，请使用其中定义的任务标识符。')
};

const runOptions: IJSONSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		reevaluateOnRerun: {
			type: 'boolean',
			description: nls.localize('JsonSchema.tasks.reevaluateOnRerun', '是否在重新运行时重新评估任务变量。'),
			default: true
		},
		runOn: {
			type: 'string',
			enum: ['default', 'folderOpen'],
			description: nls.localize('JsonSchema.tasks.runOn', '配置何时应运行任务。如果设置为 folderOpen，任务将在打开文件夹时自动运行。如果设置为 worktreeCreated，则任务将在创建代理会话工作树时自动运行。'),
			default: 'default'
		},
		instanceLimit: {
			type: 'number',
			description: nls.localize('JsonSchema.tasks.instanceLimit', '允许同时运行的任务的实例数。'),
			default: 1
		},
		instancePolicy: {
			type: 'string',
			enum: ['terminateNewest', 'terminateOldest', 'prompt', 'warn', 'silent'],
			enumDescriptions: [
				nls.localize('JsonSchema.tasks.instancePolicy.terminateNewest', '终止最新的实例。'),
				nls.localize('JsonSchema.tasks.instancePolicy.terminateOldest', '终止最旧的实例。'),
				nls.localize('JsonSchema.tasks.instancePolicy.prompt', '询问要终止哪个实例。'),
				nls.localize('JsonSchema.tasks.instancePolicy.warn', '不执行任何操作，但会警告已达到实例限制。'),
				nls.localize('JsonSchema.tasks.instancePolicy.silent', '不执行任何操作。'),
			],
			description: nls.localize('JsonSchema.tasks.instancePolicy', '达到实例限制时应用的策略。'),
			default: 'prompt'
		}
	},
	description: nls.localize('JsonSchema.tasks.runOptions', '任务的运行相关选项')
};

const commonSchemaDefinitions = commonSchema.definitions!;
const options: IJSONSchema = Objects.deepClone(commonSchemaDefinitions.options);
const optionsProperties = options.properties!;
optionsProperties.shell = Objects.deepClone(commonSchemaDefinitions.shellConfiguration);

const taskConfiguration: IJSONSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		label: {
			type: 'string',
			description: nls.localize('JsonSchema.tasks.taskLabel', "任务标签")
		},
		taskName: {
			type: 'string',
			description: nls.localize('JsonSchema.tasks.taskName', '任务名称'),
			deprecationMessage: nls.localize('JsonSchema.tasks.taskName.deprecated', '任务的 name 属性已被弃用。请改为使用 label 属性。')
		},
		identifier: Objects.deepClone(identifier),
		group: Objects.deepClone(group),
		isBackground: {
			type: 'boolean',
			description: nls.localize('JsonSchema.tasks.background', '执行的任务是否保持活动状态并在后台运行。'),
			default: true
		},
		promptOnClose: {
			type: 'boolean',
			description: nls.localize('JsonSchema.tasks.promptOnClose', '若 VS Code 关闭时有一个任务正在运行，是否提示用户。'),
			default: false
		},
		presentation: Objects.deepClone(presentation),
		icon: Objects.deepClone(icon),
		hide: Objects.deepClone(hide),
		inAgents: Objects.deepClone(inAgents),
		options: options,
		problemMatcher: {
			$ref: '#/definitions/problemMatcherType',
			description: nls.localize('JsonSchema.tasks.matchers', '要使用的问题匹配程序。可以是一个字符串或一个问题匹配程序定义，也可以是一个字符串数组和多个问题匹配程序。')
		},
		runOptions: Objects.deepClone(runOptions),
		dependsOn: Objects.deepClone(dependsOn),
		dependsOrder: Objects.deepClone(dependsOrder),
		detail: Objects.deepClone(detail),
	}
};

const taskDefinitions: IJSONSchema[] = [];
TaskDefinitionRegistry.onReady().then(() => {
	updateTaskDefinitions();
});

export function updateTaskDefinitions() {
	for (const taskType of TaskDefinitionRegistry.all()) {
		// Check that we haven't already added this task type
		if (taskDefinitions.find(schema => {
			return schema.properties?.type?.enum?.find ? schema.properties?.type.enum.find(element => element === taskType.taskType) : undefined;
		})) {
			continue;
		}

		const schema: IJSONSchema = Objects.deepClone(taskConfiguration);
		const schemaProperties = schema.properties!;
		// Since we do this after the schema is assigned we need to patch the refs.
		schemaProperties.type = {
			type: 'string',
			description: nls.localize('JsonSchema.customizations.customizes.type', '要自定义的任务类型'),
			enum: [taskType.taskType]
		};
		if (taskType.required) {
			schema.required = taskType.required.slice();
		} else {
			schema.required = [];
		}
		// Customized tasks require that the task type be set.
		schema.required.push('type');
		if (taskType.properties) {
			for (const key of Object.keys(taskType.properties)) {
				const property = taskType.properties[key];
				schemaProperties[key] = Objects.deepClone(property);
			}
		}
		fixReferences(schema as unknown as Record<string, unknown>);
		taskDefinitions.push(schema);
	}
}

const customize = Objects.deepClone(taskConfiguration);
customize.properties!.customize = {
	type: 'string',
	deprecationMessage: nls.localize('JsonSchema.tasks.customize.deprecated', 'customize 属性已被弃用。请参阅 1.14 发行说明了解如何迁移到新的任务自定义方法')
};
if (!customize.required) {
	customize.required = [];
}
customize.required.push('customize');
taskDefinitions.push(customize);

const definitions = Objects.deepClone(commonSchemaDefinitions);
const taskDescription: IJSONSchema = definitions.taskDescription;
taskDescription.required = ['label'];
const taskDescriptionProperties = taskDescription.properties!;
taskDescriptionProperties.label = Objects.deepClone(label);
taskDescriptionProperties.command = Objects.deepClone(command);
taskDescriptionProperties.args = Objects.deepClone(args);
taskDescriptionProperties.isShellCommand = Objects.deepClone(shellCommand);
taskDescriptionProperties.dependsOn = dependsOn;
taskDescriptionProperties.hide = Objects.deepClone(hide);
taskDescriptionProperties.inAgents = Objects.deepClone(inAgents);
taskDescriptionProperties.dependsOrder = dependsOrder;
taskDescriptionProperties.identifier = Objects.deepClone(identifier);
taskDescriptionProperties.type = Objects.deepClone(taskType);
taskDescriptionProperties.presentation = Objects.deepClone(presentation);
taskDescriptionProperties.terminal = terminal;
taskDescriptionProperties.icon = Objects.deepClone(icon);
taskDescriptionProperties.group = Objects.deepClone(group);
taskDescriptionProperties.runOptions = Objects.deepClone(runOptions);
taskDescriptionProperties.detail = detail;
taskDescriptionProperties.taskName.deprecationMessage = nls.localize(
	'JsonSchema.tasks.taskName.deprecated',
	'任务的 name 属性已被弃用。请改为使用 label 属性。'
);
// Clone the taskDescription for process task before setting a default to prevent two defaults #115281
const processTask = Objects.deepClone(taskDescription);
taskDescription.default = {
	label: 'My Task',
	type: 'shell',
	command: 'echo Hello',
	problemMatcher: []
};
definitions.showOutputType.deprecationMessage = nls.localize(
	'JsonSchema.tasks.showOutput.deprecated',
	'showOutput 属性已被弃用。请改为使用 presentation 属性内的 reveal 属性。另请参阅 1.14 发行说明。'
);
taskDescriptionProperties.echoCommand.deprecationMessage = nls.localize(
	'JsonSchema.tasks.echoCommand.deprecated',
	'isBuildCommand 属性已被弃用。请改为使用 presentation 属性内的 echo 属性。另请参阅 1.14 发行说明。'
);
taskDescriptionProperties.suppressTaskName.deprecationMessage = nls.localize(
	'JsonSchema.tasks.suppressTaskName.deprecated',
	'suppressTaskName 属性已被弃用。请改为在任务中内嵌命令及其参数。另请参阅 1.14 发行说明。'
);
taskDescriptionProperties.isBuildCommand.deprecationMessage = nls.localize(
	'JsonSchema.tasks.isBuildCommand.deprecated',
	'isBuildCommand 属性已被弃用。请改为使用 group 属性。另请参阅 1.14 发行说明。'
);
taskDescriptionProperties.isTestCommand.deprecationMessage = nls.localize(
	'JsonSchema.tasks.isTestCommand.deprecated',
	'isTestCommand 属性已被弃用。请改为使用 group 属性。另请参阅 1.14 发行说明。'
);

// Process tasks are almost identical schema-wise to shell tasks, but they are required to have a command
processTask.properties!.type = {
	type: 'string',
	enum: ['process'],
	default: 'process',
	description: nls.localize('JsonSchema.tasks.type', '定义任务是被作为进程运行还是在 shell 中作为命令运行。')
};
processTask.required!.push('command');
processTask.required!.push('type');

taskDefinitions.push(processTask);

taskDefinitions.push({
	$ref: '#/definitions/taskDescription'
});

const definitionsTaskRunnerConfigurationProperties = definitions.taskRunnerConfiguration.properties!;
const tasks = definitionsTaskRunnerConfigurationProperties.tasks;
tasks.items = {
	oneOf: taskDefinitions
};

definitionsTaskRunnerConfigurationProperties.inputs = inputsSchema.definitions!.inputs;

definitions.commandConfiguration.properties!.isShellCommand = Objects.deepClone(shellCommand);
definitions.commandConfiguration.properties!.args = Objects.deepClone(args);
definitions.options.properties!.shell = {
	$ref: '#/definitions/shellConfiguration'
};

definitionsTaskRunnerConfigurationProperties.isShellCommand = Objects.deepClone(shellCommand);
definitionsTaskRunnerConfigurationProperties.type = Objects.deepClone(taskType);
definitionsTaskRunnerConfigurationProperties.group = Objects.deepClone(group);
definitionsTaskRunnerConfigurationProperties.presentation = Objects.deepClone(presentation);
definitionsTaskRunnerConfigurationProperties.suppressTaskName.deprecationMessage = nls.localize(
	'JsonSchema.tasks.suppressTaskName.deprecated',
	'suppressTaskName 属性已被弃用。请改为在任务中内嵌命令及其参数。另请参阅 1.14 发行说明。'
);
definitionsTaskRunnerConfigurationProperties.taskSelector.deprecationMessage = nls.localize(
	'JsonSchema.tasks.taskSelector.deprecated',
	'taskSelector 属性已被弃用。请改为在任务中内嵌命令及其参数。另请参阅 1.14 发行说明。'
);

const osSpecificTaskRunnerConfiguration = Objects.deepClone(definitions.taskRunnerConfiguration);
delete osSpecificTaskRunnerConfiguration.properties!.tasks;
osSpecificTaskRunnerConfiguration.additionalProperties = false;
definitions.osSpecificTaskRunnerConfiguration = osSpecificTaskRunnerConfiguration;
definitionsTaskRunnerConfigurationProperties.version = Objects.deepClone(version);

const schema: IJSONSchema = {
	oneOf: [
		{
			'allOf': [
				{
					type: 'object',
					required: ['version'],
					properties: {
						version: Objects.deepClone(version),
						windows: {
							'$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
							'description': nls.localize('JsonSchema.windows', 'Windows 特定的命令配置')
						},
						osx: {
							'$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
							'description': nls.localize('JsonSchema.mac', 'Mac 特定的命令配置')
						},
						linux: {
							'$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
							'description': nls.localize('JsonSchema.linux', 'Linux 特定的命令配置')
						}
					}
				},
				{
					$ref: '#/definitions/taskRunnerConfiguration'
				}
			]
		}
	]
};

schema.definitions = definitions;

function deprecatedVariableMessage(schemaMap: IJSONSchemaMap, property: string) {
	const mapAtProperty = schemaMap[property].properties!;
	if (mapAtProperty) {
		Object.keys(mapAtProperty).forEach(name => {
			deprecatedVariableMessage(mapAtProperty, name);
		});
	} else {
		ConfigurationResolverUtils.applyDeprecatedVariableMessage(schemaMap[property]);
	}
}

Object.getOwnPropertyNames(definitions).forEach(key => {
	const newKey = key + '2';
	definitions[newKey] = definitions[key];
	delete definitions[key];
	deprecatedVariableMessage(definitions, newKey);
});
fixReferences(schema as unknown as Record<string, unknown>);

export function updateProblemMatchers() {
	try {
		const matcherIds = ProblemMatcherRegistry.keys().map(key => '$' + key);
		definitions.problemMatcherType2.oneOf![0].enum = matcherIds;
		(definitions.problemMatcherType2.oneOf![2].items as IJSONSchema).anyOf![0].enum = matcherIds;
	} catch (err) {
		console.log('Installing problem matcher ids failed');
	}
}

ProblemMatcherRegistry.onReady().then(() => {
	updateProblemMatchers();
});

export default schema;
