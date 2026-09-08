/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './tabCompletion.js';
import './snippets.service.contribution.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';
import * as nls from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import * as JSONContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { ConfigureSnippetsAction } from './commands/configureSnippets.js';
import { ApplyFileSnippetAction } from './commands/fileTemplateSnippets.js';
import { InsertSnippetAction } from './commands/insertSnippet.js';
import { SurroundWithSnippetEditorAction } from './commands/surroundWithSnippet.js';
import { SnippetCodeActions } from './snippetCodeActionProvider.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { editorConfigurationBaseNode } from '../../../../editor/common/config/editorConfigurationSchema.js';


// actions
registerAction2(InsertSnippetAction);
CommandsRegistry.registerCommandAlias('editor.action.showSnippets', 'editor.action.insertSnippet');
registerAction2(SurroundWithSnippetEditorAction);
registerAction2(ApplyFileSnippetAction);
registerAction2(ConfigureSnippetsAction);

// workbench contribs
const workbenchContribRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchContribRegistry.registerWorkbenchContribution(SnippetCodeActions, LifecyclePhase.Restored);

// config
Registry
	.as<IConfigurationRegistry>(Extensions.Configuration)
	.registerConfiguration({
		...editorConfigurationBaseNode,
		'properties': {
			'editor.snippets.codeActions.enabled': {
				'description': nls.localize('editor.snippets.codeActions.enabled', '控制外围代码段或文件模板片段是否显示为代码操作。'),
				'type': 'boolean',
				'default': true
			}
		}
	});


// schema
const languageScopeSchemaId = 'vscode://schemas/snippets';

const snippetSchemaProperties: IJSONSchemaMap = {
	prefix: {
		description: nls.localize('snippetSchema.json.prefix', '在 Intellisense 中选择代码片段时要使用的前缀'),
		type: ['string', 'array']
	},
	isFileTemplate: {
		description: nls.localize('snippetSchema.json.isFileTemplate', '代码片段用于填充或替换整个文件'),
		type: 'boolean'
	},
	body: {
		markdownDescription: nls.localize('snippetSchema.json.body', '片段内容。请使用 \'$1\', \'${1:defaultText}\' 来定义光标位置，使用“$0”表示最终光标位置。请插入带有“${varName}”和“${varName:defaultText}”的变量值，例如 "这是文件: $TM_FILENAME"。'),
		type: ['string', 'array'],
		items: {
			type: 'string'
		}
	},
	description: {
		description: nls.localize('snippetSchema.json.description', '代码片段描述。'),
		type: ['string', 'array']
	},
	include: {
		markdownDescription: nls.localize('snippetSchema.json.include', '[glob 模式](https://aka.ms/vscode-glob-patterns) 的列表，包含特定文件的代码片段，例如 `["**/*.test.ts", "*.spec.ts"]` 或 `"**/*.spec.ts"`。如果模式包含路径分隔符，则匹配文件的绝对路径，否则匹配文件的名称。可以通过 `exclude` 属性排除匹配的文件。'),
		type: ['string', 'array'],
		items: {
			type: 'string'
		}
	},
	exclude: {
		markdownDescription: nls.localize('snippetSchema.json.exclude', '[glob 模式](https://aka.ms/vscode-glob-patterns) 的列表，从特定文件中排除代码片段，例如 `["**/*.min.js"]` 或 `"*.min.js"`。如果模式包含路径分隔符，则匹配文件的绝对路径，否则匹配文件的名称。排除模式优先于 `include` 模式。'),
		type: ['string', 'array'],
		items: {
			type: 'string'
		}
	}
};

const languageScopeSchema: IJSONSchema = {
	id: languageScopeSchemaId,
	allowComments: true,
	allowTrailingCommas: true,
	defaultSnippets: [{
		label: nls.localize('snippetSchema.json.default', "空代码片段"),
		body: { '${1:snippetName}': { 'prefix': '${2:prefix}', 'body': '${3:snippet}', 'description': '${4:description}' } }
	}],
	type: 'object',
	description: nls.localize('snippetSchema.json', '用户代码片段配置'),
	additionalProperties: {
		type: 'object',
		required: ['body'],
		properties: snippetSchemaProperties,
		additionalProperties: false
	}
};


const globalSchemaId = 'vscode://schemas/global-snippets';
const globalSchema: IJSONSchema = {
	id: globalSchemaId,
	allowComments: true,
	allowTrailingCommas: true,
	defaultSnippets: [{
		label: nls.localize('snippetSchema.json.default', "空代码片段"),
		body: { '${1:snippetName}': { 'scope': '${2:scope}', 'prefix': '${3:prefix}', 'body': '${4:snippet}', 'description': '${5:description}' } }
	}],
	type: 'object',
	description: nls.localize('snippetSchema.json', '用户代码片段配置'),
	additionalProperties: {
		type: 'object',
		required: ['body'],
		properties: {
			...snippetSchemaProperties,
			scope: {
				description: nls.localize('snippetSchema.json.scope', "此代码段使用的语言名称列表，例如 \"typescript,javascript\"。"),
				type: 'string'
			}
		},
		additionalProperties: false
	}
};

const reg = Registry.as<JSONContributionRegistry.IJSONContributionRegistry>(JSONContributionRegistry.Extensions.JSONContribution);
reg.registerSchema(languageScopeSchemaId, languageScopeSchema);
reg.registerSchema(globalSchemaId, globalSchema);
