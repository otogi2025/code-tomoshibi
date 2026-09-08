/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import * as Objects from '../../../../base/common/objects.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

import { ProblemMatcherRegistry } from './problemMatcher.js';

import commonSchema from './jsonSchemaCommon.js';

const schema: IJSONSchema = {
	oneOf: [
		{
			allOf: [
				{
					type: 'object',
					required: ['version'],
					properties: {
						version: {
							type: 'string',
							enum: ['0.1.0'],
							deprecationMessage: nls.localize('JsonSchema.version.deprecated', '任务版本 0.1.0 已被弃用。请使用 2.0.0'),
							description: nls.localize('JsonSchema.version', '配置的版本号')
						},
						_runner: {
							deprecationMessage: nls.localize('JsonSchema._runner', '此 runner 已完成使命。请使用官方 runner 属性')
						},
						runner: {
							type: 'string',
							enum: ['process', 'terminal'],
							default: 'process',
							description: nls.localize('JsonSchema.runner', '定义任务是否作为进程执行，输出显示在输出窗口还是在终端内。')
						},
						windows: {
							$ref: '#/definitions/taskRunnerConfiguration',
							description: nls.localize('JsonSchema.windows', 'Windows 特定的命令配置')
						},
						osx: {
							$ref: '#/definitions/taskRunnerConfiguration',
							description: nls.localize('JsonSchema.mac', 'Mac 特定的命令配置')
						},
						linux: {
							$ref: '#/definitions/taskRunnerConfiguration',
							description: nls.localize('JsonSchema.linux', 'Linux 特定的命令配置')
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

const shellCommand: IJSONSchema = {
	type: 'boolean',
	default: true,
	description: nls.localize('JsonSchema.shell', '指定命令是 shell 命令还是外部程序。如果省略，则默认为 false。')
};

schema.definitions = Objects.deepClone(commonSchema.definitions);
const definitions = schema.definitions!;
definitions['commandConfiguration']['properties']!['isShellCommand'] = Objects.deepClone(shellCommand);
definitions['taskDescription']['properties']!['isShellCommand'] = Objects.deepClone(shellCommand);
definitions['taskRunnerConfiguration']['properties']!['isShellCommand'] = Objects.deepClone(shellCommand);

Object.getOwnPropertyNames(definitions).forEach(key => {
	const newKey = key + '1';
	definitions[newKey] = definitions[key];
	delete definitions[key];
});

function fixReferences(literal: Record<string, unknown> | unknown[]) {
	if (Array.isArray(literal)) {
		literal.forEach(element => {
			if (typeof element === 'object' && element !== null) {
				fixReferences(element as Record<string, unknown>);
			}
		});
	} else if (typeof literal === 'object') {
		if (literal['$ref']) {
			literal['$ref'] = literal['$ref'] + '1';
		}
		Object.getOwnPropertyNames(literal).forEach(property => {
			const value = literal[property];
			if (Array.isArray(value) || typeof value === 'object') {
				fixReferences(value as Record<string, unknown>);
			}
		});
	}
}
fixReferences(schema as unknown as Record<string, unknown>);

ProblemMatcherRegistry.onReady().then(() => {
	try {
		const matcherIds = ProblemMatcherRegistry.keys().map(key => '$' + key);
		definitions.problemMatcherType1.oneOf![0].enum = matcherIds;
		(definitions.problemMatcherType1.oneOf![2].items as IJSONSchema).anyOf![1].enum = matcherIds;
	} catch (err) {
		console.log('Installing problem matcher ids failed');
	}
});

export default schema;
