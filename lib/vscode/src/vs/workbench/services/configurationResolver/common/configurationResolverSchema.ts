/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

const idDescription = nls.localize('JsonSchema.input.id', "输入的 ID 用于与其变量采用 ${input:id} 形式的输入相关联。");
const typeDescription = nls.localize('JsonSchema.input.type', "要使用的用户输入提示符的类型。");
const descriptionDescription = nls.localize('JsonSchema.input.description', "当提示用户输入时，将显示说明。");
const defaultDescription = nls.localize('JsonSchema.input.default', "输入的默认值。");


export const inputsSchema: IJSONSchema = {
	definitions: {
		inputs: {
			type: 'array',
			description: nls.localize('JsonSchema.inputs', '用户输入。用于定义用户输入提示，例如自由字符串输入或从多个选项中进行选择。'),
			items: {
				oneOf: [
					{
						type: 'object',
						required: ['id', 'type', 'description'],
						additionalProperties: false,
						properties: {
							id: {
								type: 'string',
								description: idDescription
							},
							type: {
								type: 'string',
								description: typeDescription,
								enum: ['promptString'],
								enumDescriptions: [
									nls.localize('JsonSchema.input.type.promptString', "\"promptString\" 类型会打开一个输入框，要求用户输入内容。"),
								]
							},
							description: {
								type: 'string',
								description: descriptionDescription
							},
							default: {
								type: 'string',
								description: defaultDescription
							},
							password: {
								type: 'boolean',
								description: nls.localize('JsonSchema.input.password', "控制是否显示密码输入。密码输入会隐藏键入的文本。"),
							},
						}
					},
					{
						type: 'object',
						required: ['id', 'type', 'description', 'options'],
						additionalProperties: false,
						properties: {
							id: {
								type: 'string',
								description: idDescription
							},
							type: {
								type: 'string',
								description: typeDescription,
								enum: ['pickString'],
								enumDescriptions: [
									nls.localize('JsonSchema.input.type.pickString', "“pickString”类型显示一个选择列表。"),
								]
							},
							description: {
								type: 'string',
								description: descriptionDescription
							},
							default: {
								type: 'string',
								description: defaultDescription
							},
							options: {
								type: 'array',
								description: nls.localize('JsonSchema.input.options', "用于定义快速选择选项的字符串数组。"),
								items: {
									oneOf: [
										{
											type: 'string'
										},
										{
											type: 'object',
											required: ['value'],
											additionalProperties: false,
											properties: {
												label: {
													type: 'string',
													description: nls.localize('JsonSchema.input.pickString.optionLabel', "选项的标签。")
												},
												value: {
													type: 'string',
													description: nls.localize('JsonSchema.input.pickString.optionValue', "选项的值。")
												}
											}
										}
									]
								}
							}
						}
					},
					{
						type: 'object',
						required: ['id', 'type', 'command'],
						additionalProperties: false,
						properties: {
							id: {
								type: 'string',
								description: idDescription
							},
							type: {
								type: 'string',
								description: typeDescription,
								enum: ['command'],
								enumDescriptions: [
									nls.localize('JsonSchema.input.type.command', "\"command\" 类型会执行命令。"),
								]
							},
							command: {
								type: 'string',
								description: nls.localize('JsonSchema.input.command.command', "要为此输入变量执行的命令。")
							},
							args: {
								oneOf: [
									{
										type: 'object',
										description: nls.localize('JsonSchema.input.command.args', "传递给命令的可选参数。")
									},
									{
										type: 'array',
										description: nls.localize('JsonSchema.input.command.args', "传递给命令的可选参数。")
									},
									{
										type: 'string',
										description: nls.localize('JsonSchema.input.command.args', "传递给命令的可选参数。")
									}
								]
							}
						}
					}
				]
			}
		}
	}
};
