/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

import { Schemas } from './problemMatcher.js';

const schema: IJSONSchema = {
	definitions: {
		showOutputType: {
			type: 'string',
			enum: ['always', 'silent', 'never']
		},
		options: {
			type: 'object',
			description: nls.localize('JsonSchema.options', '其他命令选项'),
			properties: {
				cwd: {
					type: 'string',
					description: nls.localize('JsonSchema.options.cwd', '已执行程序或脚本的当前工作目录。如果省略，则使用代码的当前工作区根。')
				},
				env: {
					type: 'object',
					additionalProperties: {
						type: 'string'
					},
					description: nls.localize('JsonSchema.options.env', '已执行程序或 shell 的环境。如果省略，则使用父进程的环境。')
				}
			},
			additionalProperties: {
				type: ['string', 'array', 'object']
			}
		},
		problemMatcherType: {
			oneOf: [
				{
					type: 'string',
					errorMessage: nls.localize('JsonSchema.tasks.matcherError', '无法识别的问题匹配程序。是否已安装支持此问题匹配程序的扩展?')
				},
				Schemas.LegacyProblemMatcher,
				{
					type: 'array',
					items: {
						anyOf: [
							{
								type: 'string',
								errorMessage: nls.localize('JsonSchema.tasks.matcherError', '无法识别的问题匹配程序。是否已安装支持此问题匹配程序的扩展?')
							},
							Schemas.LegacyProblemMatcher
						]
					}
				}
			]
		},
		shellConfiguration: {
			type: 'object',
			additionalProperties: false,
			description: nls.localize('JsonSchema.shellConfiguration', '配置使用的 shell。'),
			properties: {
				executable: {
					type: 'string',
					description: nls.localize('JsonSchema.shell.executable', '待使用的 shell。')
				},
				args: {
					type: 'array',
					description: nls.localize('JsonSchema.shell.args', 'shell 参数。'),
					items: {
						type: 'string'
					}
				}
			}
		},
		commandConfiguration: {
			type: 'object',
			additionalProperties: false,
			properties: {
				command: {
					type: 'string',
					description: nls.localize('JsonSchema.command', '要执行的命令。可以是外部程序或 shell 命令。')
				},
				args: {
					type: 'array',
					description: nls.localize('JsonSchema.tasks.args', '调用此任务时要传递给命令的参数。'),
					items: {
						type: 'string'
					}
				},
				options: {
					$ref: '#/definitions/options'
				}
			}
		},
		taskDescription: {
			type: 'object',
			required: ['taskName'],
			additionalProperties: false,
			properties: {
				taskName: {
					type: 'string',
					description: nls.localize('JsonSchema.tasks.taskName', "任务名称")
				},
				command: {
					type: 'string',
					description: nls.localize('JsonSchema.command', '要执行的命令。可以是外部程序或 shell 命令。')
				},
				args: {
					type: 'array',
					description: nls.localize('JsonSchema.tasks.args', '调用此任务时要传递给命令的参数。'),
					items: {
						type: 'string'
					}
				},
				options: {
					$ref: '#/definitions/options'
				},
				windows: {
					anyOf: [
						{
							$ref: '#/definitions/commandConfiguration',
							description: nls.localize('JsonSchema.tasks.windows', 'Windows 特定的命令配置'),
						},
						{
							properties: {
								problemMatcher: {
									$ref: '#/definitions/problemMatcherType',
									description: nls.localize('JsonSchema.tasks.matchers', '要使用的问题匹配程序。可以是一个字符串或一个问题匹配程序定义，也可以是一个字符串数组和多个问题匹配程序。')
								}
							}
						}
					]
				},
				osx: {
					anyOf: [
						{
							$ref: '#/definitions/commandConfiguration',
							description: nls.localize('JsonSchema.tasks.mac', 'Mac 特定的命令配置')
						},
						{
							properties: {
								problemMatcher: {
									$ref: '#/definitions/problemMatcherType',
									description: nls.localize('JsonSchema.tasks.matchers', '要使用的问题匹配程序。可以是一个字符串或一个问题匹配程序定义，也可以是一个字符串数组和多个问题匹配程序。')
								}
							}
						}
					]
				},
				linux: {
					anyOf: [
						{
							$ref: '#/definitions/commandConfiguration',
							description: nls.localize('JsonSchema.tasks.linux', 'Linux 特定的命令配置')
						},
						{
							properties: {
								problemMatcher: {
									$ref: '#/definitions/problemMatcherType',
									description: nls.localize('JsonSchema.tasks.matchers', '要使用的问题匹配程序。可以是一个字符串或一个问题匹配程序定义，也可以是一个字符串数组和多个问题匹配程序。')
								}
							}
						}
					]
				},
				suppressTaskName: {
					type: 'boolean',
					description: nls.localize('JsonSchema.tasks.suppressTaskName', '控制是否将任务名作为参数添加到命令。如果省略，则使用全局定义的值。'),
					default: true
				},
				showOutput: {
					$ref: '#/definitions/showOutputType',
					description: nls.localize('JsonSchema.tasks.showOutput', '控制是否显示正在运行的任务的输出。如果省略，则使用全局定义的值。')
				},
				echoCommand: {
					type: 'boolean',
					description: nls.localize('JsonSchema.echoCommand', '控制是否将已执行的命令回显到输出。默认值为 false。'),
					default: true
				},
				isWatching: {
					type: 'boolean',
					deprecationMessage: nls.localize('JsonSchema.tasks.watching.deprecation', '已弃用。改用 isBackground。'),
					description: nls.localize('JsonSchema.tasks.watching', '已执行的任务是否保持活动状态，并且是否在监视文件系统。'),
					default: true
				},
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
				isBuildCommand: {
					type: 'boolean',
					description: nls.localize('JsonSchema.tasks.build', '将此任务映射到代码的默认生成命令。'),
					default: true
				},
				isTestCommand: {
					type: 'boolean',
					description: nls.localize('JsonSchema.tasks.test', '将此任务映射到代码的默认测试命令。'),
					default: true
				},
				problemMatcher: {
					$ref: '#/definitions/problemMatcherType',
					description: nls.localize('JsonSchema.tasks.matchers', '要使用的问题匹配程序。可以是一个字符串或一个问题匹配程序定义，也可以是一个字符串数组和多个问题匹配程序。')
				}
			}
		},
		taskRunnerConfiguration: {
			type: 'object',
			required: [],
			properties: {
				command: {
					type: 'string',
					description: nls.localize('JsonSchema.command', '要执行的命令。可以是外部程序或 shell 命令。')
				},
				args: {
					type: 'array',
					description: nls.localize('JsonSchema.args', '传递到命令的其他参数。'),
					items: {
						type: 'string'
					}
				},
				options: {
					$ref: '#/definitions/options'
				},
				showOutput: {
					$ref: '#/definitions/showOutputType',
					description: nls.localize('JsonSchema.showOutput', '控制是否显示运行任务的输出。如果省略，则使用“始终”。')
				},
				isWatching: {
					type: 'boolean',
					deprecationMessage: nls.localize('JsonSchema.watching.deprecation', '已弃用。改用 isBackground。'),
					description: nls.localize('JsonSchema.watching', '已执行的任务是否保持活动状态，并且是否在监视文件系统。'),
					default: true
				},
				isBackground: {
					type: 'boolean',
					description: nls.localize('JsonSchema.background', '已执行的任务是否保持活动状态并在后台运行。'),
					default: true
				},
				promptOnClose: {
					type: 'boolean',
					description: nls.localize('JsonSchema.promptOnClose', '在具有正在运行的后台任务的情况下关闭 VS 代码时是否提示用户。'),
					default: false
				},
				echoCommand: {
					type: 'boolean',
					description: nls.localize('JsonSchema.echoCommand', '控制是否将已执行的命令回显到输出。默认值为 false。'),
					default: true
				},
				suppressTaskName: {
					type: 'boolean',
					description: nls.localize('JsonSchema.suppressTaskName', '控制是否将任务名作为参数添加到命令。默认值是 false。'),
					default: true
				},
				taskSelector: {
					type: 'string',
					description: nls.localize('JsonSchema.taskSelector', '指示参数是任务的前缀。')
				},
				problemMatcher: {
					$ref: '#/definitions/problemMatcherType',
					description: nls.localize('JsonSchema.matchers', '要使用的问题匹配程序。可以是字符串或问题匹配程序定义，或字符串和问题匹配程序数组。')
				},
				tasks: {
					type: 'array',
					description: nls.localize('JsonSchema.tasks', '任务配置。通常是外部任务运行程序中已定义任务的扩充。'),
					items: {
						type: 'object',
						$ref: '#/definitions/taskDescription'
					}
				}
			}
		}
	}
};

export default schema;
