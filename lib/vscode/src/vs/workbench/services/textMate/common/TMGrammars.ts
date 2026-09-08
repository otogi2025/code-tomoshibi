/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ExtensionsRegistry, IExtensionPoint } from '../../extensions/common/extensionsRegistry.js';
import { languagesExtPoint } from '../../language/common/languageService.js';

export interface IEmbeddedLanguagesMap {
	[scopeName: string]: string;
}

export interface TokenTypesContribution {
	[scopeName: string]: string;
}

export interface ITMSyntaxExtensionPoint {
	language?: string; // undefined if the grammar is only included by other grammars
	scopeName: string;
	path: string;
	embeddedLanguages: IEmbeddedLanguagesMap;
	tokenTypes: TokenTypesContribution;
	injectTo: string[];
	balancedBracketScopes: string[];
	unbalancedBracketScopes: string[];
}

export const grammarsExtPoint: IExtensionPoint<ITMSyntaxExtensionPoint[]> = ExtensionsRegistry.registerExtensionPoint<ITMSyntaxExtensionPoint[]>({
	extensionPoint: 'grammars',
	deps: [languagesExtPoint],
	jsonSchema: {
		description: nls.localize('vscode.extension.contributes.grammars', '贡献 textmate tokenizer。'),
		type: 'array',
		defaultSnippets: [{ body: [{ language: '${1:id}', scopeName: 'source.${2:id}', path: './syntaxes/${3:id}.tmLanguage.' }] }],
		items: {
			type: 'object',
			defaultSnippets: [{ body: { language: '${1:id}', scopeName: 'source.${2:id}', path: './syntaxes/${3:id}.tmLanguage.' } }],
			properties: {
				language: {
					description: nls.localize('vscode.extension.contributes.grammars.language', '此语法为其贡献了内容的语言标识符。'),
					type: 'string'
				},
				scopeName: {
					description: nls.localize('vscode.extension.contributes.grammars.scopeName', 'tmLanguage 文件所用的 textmate 范围名称。'),
					type: 'string'
				},
				path: {
					description: nls.localize('vscode.extension.contributes.grammars.path', 'tmLanguage 文件的路径。该路径是相对于扩展文件夹，通常以 "./syntaxes/" 开头。'),
					type: 'string'
				},
				embeddedLanguages: {
					description: nls.localize('vscode.extension.contributes.grammars.embeddedLanguages', '如果此语法包含嵌入式语言，则为作用域名称到语言 ID 的映射。'),
					type: 'object'
				},
				tokenTypes: {
					description: nls.localize('vscode.extension.contributes.grammars.tokenTypes', '从作用域名到标记类型的映射。'),
					type: 'object',
					additionalProperties: {
						enum: ['string', 'comment', 'other', 'regex']
					}
				},
				injectTo: {
					description: nls.localize('vscode.extension.contributes.grammars.injectTo', '此语法注入到的语言范围名称列表。'),
					type: 'array',
					items: {
						type: 'string'
					}
				},
				balancedBracketScopes: {
					description: nls.localize('vscode.extension.contributes.grammars.balancedBracketScopes', '定义哪些范围名称包含平衡括号。'),
					type: 'array',
					items: {
						type: 'string'
					},
					default: ['*'],
				},
				unbalancedBracketScopes: {
					description: nls.localize('vscode.extension.contributes.grammars.unbalancedBracketScopes', '定义哪些范围名称不包含平衡括号。'),
					type: 'array',
					items: {
						type: 'string'
					},
					default: [],
				},
			},
			required: ['scopeName', 'path']
		}
	}
});
