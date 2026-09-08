/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file
import * as nls from '../../../../nls.js';

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { fontIdErrorMessage, fontIdRegex, fontStyleRegex, fontWeightRegex, iconsSchemaId } from '../../../../platform/theme/common/iconRegistry.js';

const schemaId = 'vscode://schemas/product-icon-theme';
const schema: IJSONSchema = {
	type: 'object',
	allowComments: true,
	allowTrailingCommas: true,
	properties: {
		fonts: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: nls.localize('schema.id', '字体的 ID。'),
						pattern: fontIdRegex.source,
						patternErrorMessage: fontIdErrorMessage
					},
					src: {
						type: 'array',
						description: nls.localize('schema.src', '字体的位置。'),
						items: {
							type: 'object',
							properties: {
								path: {
									type: 'string',
									description: nls.localize('schema.font-path', '相对于当前产品图标主题文件的字体路径。'),
								},
								format: {
									type: 'string',
									description: nls.localize('schema.font-format', '字体的格式。'),
									enum: ['woff', 'woff2', 'truetype', 'opentype', 'embedded-opentype', 'svg']
								}
							},
							required: [
								'path',
								'format'
							]
						}
					},
					weight: {
						type: 'string',
						description: nls.localize('schema.font-weight', '字体的粗细。要了解有效值，请参阅 https://developer.mozilla.org/zh-cn/docs/Web/CSS/font-weight。'),
						anyOf: [
							{ enum: ['normal', 'bold', 'lighter', 'bolder'] },
							{ type: 'string', pattern: fontWeightRegex.source }
						]
					},
					style: {
						type: 'string',
						description: nls.localize('schema.font-style', '字体的样式。要了解有效值，请参阅 https://developer.mozilla.org/zh-cn/docs/Web/CSS/font-style。'),
						anyOf: [
							{ enum: ['normal', 'italic', 'oblique'] },
							{ type: 'string', pattern: fontStyleRegex.source }
						]
					}
				},
				required: [
					'id',
					'src'
				]
			}
		},
		iconDefinitions: {
			description: nls.localize('schema.iconDefinitions', '字体字符的图标名称的关联。'),
			$ref: iconsSchemaId
		}
	}
};

export function registerProductIconThemeSchemas() {
	const schemaRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
	schemaRegistry.registerSchema(schemaId, schema);
}
