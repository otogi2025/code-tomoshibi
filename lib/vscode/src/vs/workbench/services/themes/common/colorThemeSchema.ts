/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file
import * as nls from '../../../../nls.js';

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

import { workbenchColorsSchemaId } from '../../../../platform/theme/common/colorRegistry.js';
import { tokenStylingSchemaId } from '../../../../platform/theme/common/tokenClassificationRegistry.js';

const textMateScopes = [
	'comment',
	'comment.block',
	'comment.block.documentation',
	'comment.line',
	'constant',
	'constant.character',
	'constant.character.escape',
	'constant.numeric',
	'constant.numeric.integer',
	'constant.numeric.float',
	'constant.numeric.hex',
	'constant.numeric.octal',
	'constant.other',
	'constant.regexp',
	'constant.rgb-value',
	'emphasis',
	'entity',
	'entity.name',
	'entity.name.class',
	'entity.name.function',
	'entity.name.method',
	'entity.name.section',
	'entity.name.selector',
	'entity.name.tag',
	'entity.name.type',
	'entity.other',
	'entity.other.attribute-name',
	'entity.other.inherited-class',
	'invalid',
	'invalid.deprecated',
	'invalid.illegal',
	'keyword',
	'keyword.control',
	'keyword.operator',
	'keyword.operator.new',
	'keyword.operator.assignment',
	'keyword.operator.arithmetic',
	'keyword.operator.logical',
	'keyword.other',
	'markup',
	'markup.bold',
	'markup.changed',
	'markup.deleted',
	'markup.heading',
	'markup.inline.raw',
	'markup.inserted',
	'markup.italic',
	'markup.list',
	'markup.list.numbered',
	'markup.list.unnumbered',
	'markup.other',
	'markup.quote',
	'markup.raw',
	'markup.underline',
	'markup.underline.link',
	'meta',
	'meta.block',
	'meta.cast',
	'meta.class',
	'meta.function',
	'meta.function-call',
	'meta.preprocessor',
	'meta.return-type',
	'meta.selector',
	'meta.tag',
	'meta.type.annotation',
	'meta.type',
	'punctuation.definition.string.begin',
	'punctuation.definition.string.end',
	'punctuation.separator',
	'punctuation.separator.continuation',
	'punctuation.terminator',
	'storage',
	'storage.modifier',
	'storage.type',
	'string',
	'string.interpolated',
	'string.other',
	'string.quoted',
	'string.quoted.double',
	'string.quoted.other',
	'string.quoted.single',
	'string.quoted.triple',
	'string.regexp',
	'string.unquoted',
	'strong',
	'support',
	'support.class',
	'support.constant',
	'support.function',
	'support.other',
	'support.type',
	'support.type.property-name',
	'support.variable',
	'variable',
	'variable.language',
	'variable.name',
	'variable.other',
	'variable.other.readwrite',
	'variable.parameter'
];

export const textmateColorsSchemaId = 'vscode://schemas/textmate-colors';
export const textmateColorGroupSchemaId = `${textmateColorsSchemaId}#/definitions/colorGroup`;

const textmateColorSchema: IJSONSchema = {
	type: 'array',
	definitions: {
		colorGroup: {
			default: '#FF0000',
			anyOf: [
				{
					type: 'string',
					format: 'color-hex'
				},
				{
					$ref: '#/definitions/settings'
				}
			]
		},
		settings: {
			type: 'object',
			description: nls.localize('schema.token.settings', '标记的颜色和样式。'),
			properties: {
				foreground: {
					type: 'string',
					description: nls.localize('schema.token.foreground', '标记的前景色。'),
					format: 'color-hex',
					default: '#ff0000'
				},
				background: {
					type: 'string',
					deprecationMessage: nls.localize('schema.token.background.warning', '暂不支持标记背景色。')
				},
				fontStyle: {
					type: 'string',
					description: nls.localize('schema.token.fontStyle', '这条规则的字形: "italic" (斜体)、"bold" (粗体)、"underline" (下划线)、"strikethrough" (删除线) 或是上述的组合。空字符串将取消继承的设置。'),
					pattern: '^(\\s*\\b(italic|bold|underline|strikethrough))*\\s*$',
					patternErrorMessage: nls.localize('schema.fontStyle.error', '字形必须为 "italic" (斜体)、"bold" (粗体)、"underline" (下划线)、"strikethrough" (删除线)、上述的组合或是为空字符串。'),
					defaultSnippets: [
						{ label: nls.localize('schema.token.fontStyle.none', '无 (清除继承的设置)'), bodyText: '""' },
						{ body: 'italic' },
						{ body: 'bold' },
						{ body: 'underline' },
						{ body: 'strikethrough' },
						{ body: 'italic bold' },
						{ body: 'italic underline' },
						{ body: 'italic strikethrough' },
						{ body: 'bold underline' },
						{ body: 'bold strikethrough' },
						{ body: 'underline strikethrough' },
						{ body: 'italic bold underline' },
						{ body: 'italic bold strikethrough' },
						{ body: 'italic underline strikethrough' },
						{ body: 'bold underline strikethrough' },
						{ body: 'italic bold underline strikethrough' }
					]
				},
				fontFamily: {
					type: 'string',
					description: nls.localize('schema.token.fontFamily', '令牌的字体系列(例如，"Fira Code"、"JetBrains Mono")。')
				},
				fontSize: {
					type: 'number',
					description: nls.localize('schema.token.fontSize', '令牌的字号乘数(例如，1.2 表示使用默认字号的 1.2 倍)。')
				},
				lineHeight: {
					type: 'number',
					description: nls.localize('schema.token.lineHeight', '令牌的行高乘数(例如，1.2 表示使用默认高度的 1.2 倍)。如果设置了字号但未明确设置行高，则行高将根据字号计算。')
				}
			},
			additionalProperties: false,
			defaultSnippets: [{ body: { foreground: '${1:#FF0000}', fontStyle: '${2:bold}' } }]
		}
	},
	items: {
		type: 'object',
		defaultSnippets: [{ body: { scope: '${1:keyword.operator}', settings: { foreground: '${2:#FF0000}' } } }],
		properties: {
			name: {
				type: 'string',
				description: nls.localize('schema.properties.name', '规则的描述。')
			},
			scope: {
				description: nls.localize('schema.properties.scope', '此规则适用的范围选择器。'),
				anyOf: [
					{
						enum: textMateScopes
					},
					{
						type: 'string'
					},
					{
						type: 'array',
						items: {
							enum: textMateScopes
						}
					},
					{
						type: 'array',
						items: {
							type: 'string'
						}
					}
				]
			},
			settings: {
				$ref: '#/definitions/settings'
			}
		},
		required: [
			'settings'
		],
		additionalProperties: false
	}
};

export const colorThemeSchemaId = 'vscode://schemas/color-theme';

const colorThemeSchema: IJSONSchema = {
	type: 'object',
	allowComments: true,
	allowTrailingCommas: true,
	properties: {
		colors: {
			description: nls.localize('schema.workbenchColors', '工作台中的颜色'),
			$ref: workbenchColorsSchemaId,
			additionalProperties: false
		},
		tokenColors: {
			anyOf: [{
				type: 'string',
				description: nls.localize('schema.tokenColors.path', 'tmTheme 文件路径(相对于当前文件)。')
			},
			{
				description: nls.localize('schema.colors', '语法突出显示颜色'),
				$ref: textmateColorsSchemaId
			}
			]
		},
		semanticHighlighting: {
			type: 'boolean',
			description: nls.localize('schema.supportsSemanticHighlighting', '是否应为此主题启用语义突出显示。')
		},
		semanticTokenColors: {
			type: 'object',
			description: nls.localize('schema.semanticTokenColors', '语义标记的颜色'),
			$ref: tokenStylingSchemaId
		}
	}
};



export function registerColorThemeSchemas() {
	const schemaRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
	schemaRegistry.registerSchema(colorThemeSchemaId, colorThemeSchema);
	schemaRegistry.registerSchema(textmateColorsSchemaId, textmateColorSchema);
}
