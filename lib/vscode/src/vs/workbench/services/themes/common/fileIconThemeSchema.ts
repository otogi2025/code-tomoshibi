/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file
import * as nls from '../../../../nls.js';

import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { fontWeightRegex, fontStyleRegex, fontSizeRegex, fontIdRegex, fontColorRegex, fontIdErrorMessage } from '../../../../platform/theme/common/iconRegistry.js';

const schemaId = 'vscode://schemas/icon-theme';
const schema: IJSONSchema = {
	type: 'object',
	allowComments: true,
	allowTrailingCommas: true,
	definitions: {
		folderExpanded: {
			type: 'string',
			description: nls.localize('schema.folderExpanded', '展开文件夹的文件夹图标。展开文件夹图标是可选的。如果未设置，将显示为文件夹定义的图标。')
		},
		folder: {
			type: 'string',
			description: nls.localize('schema.folder', '折叠文件夹的文件夹图标，如果未设置 folderExpanded，也指展开文件夹的文件夹图标。')

		},
		file: {
			type: 'string',
			description: nls.localize('schema.file', '默认文件图标，针对不与任何扩展名、文件名或语言 ID 匹配的所有文件显示。')

		},
		rootFolder: {
			type: 'string',
			description: nls.localize('schema.rootFolder', '折叠的根文件夹的文件夹图标，如果未设置 rootFolderExpanded，也指展开的根文件夹的文件夹图标。')
		},
		rootFolderExpanded: {
			type: 'string',
			description: nls.localize('schema.rootFolderExpanded', '展开的根文件夹的文件夹图标。展开的根文件夹图标是可选的。如果未设置，将显示为根文件夹定义的图标。')
		},
		rootFolderNames: {
			type: 'object',
			description: nls.localize('schema.rootFolderNames', '将根文件夹名称关联到图标。对象键是根文件夹名称。不允许使用模式或通配符。根文件夹名匹配不区分大小写。'),
			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.folderName', '关联的图标定义的 ID。')
			}
		},
		rootFolderNamesExpanded: {
			type: 'object',
			description: nls.localize('schema.rootFolderNamesExpanded', '将根文件夹名称关联到展开的根文件夹的图标。对象键是根文件夹名称。不允许使用模式或通配符。根文件夹名匹配不区分大小写。'),
			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.rootFolderNameExpanded', '关联的图标定义的 ID。')
			}
		},
		folderNames: {
			type: 'object',
			description: nls.localize('schema.folderNames', '将文件夹名关联到图标。对象中的键是文件夹名，其中不含任何路径字段。不允许使用模式或通配符。文件夹名匹配不区分大小写。'),
			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.folderName', '关联的图标定义的 ID。')
			}
		},
		folderNamesExpanded: {
			type: 'object',
			description: nls.localize('schema.folderNamesExpanded', '将文件夹名关联到展开文件夹的图标。对象中的键是文件夹名，其中不含任何路径字段。不允许使用模式或通配符。文件夹名匹配不区分大小写。'),
			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.folderNameExpanded', '关联的图标定义的 ID。')
			}
		},
		fileExtensions: {
			type: 'object',
			description: nls.localize('schema.fileExtensions', '将文件扩展名关联到图标。对象中的键是文件扩展名。扩展名是文件名的最后一部分，位于最后一个点之后 (不包括该点)。比较扩展名时不区分大小写。'),

			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.fileExtension', '关联的图标定义的 ID。')
			}
		},
		fileNames: {
			type: 'object',
			description: nls.localize('schema.fileNames', '将文件名关联到图标。对象中的键是完整文件名，其中不含任何路径字段。文件名可以包括点和可能有的文件扩展名。不允许使用模式或通配符。文件名匹配不区分大小写。'),

			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.fileName', '关联的图标定义的 ID。')
			}
		},
		languageIds: {
			type: 'object',
			description: nls.localize('schema.languageIds', '将语言与图标相关联。对象键是语言贡献点中定义的语言 ID。'),

			additionalProperties: {
				type: 'string',
				description: nls.localize('schema.languageId', '关联的图标定义的 ID。')
			}
		},
		associations: {
			type: 'object',
			properties: {
				folderExpanded: {
					$ref: '#/definitions/folderExpanded'
				},
				folder: {
					$ref: '#/definitions/folder'
				},
				file: {
					$ref: '#/definitions/file'
				},
				folderNames: {
					$ref: '#/definitions/folderNames'
				},
				folderNamesExpanded: {
					$ref: '#/definitions/folderNamesExpanded'
				},
				rootFolder: {
					$ref: '#/definitions/rootFolder'
				},
				rootFolderExpanded: {
					$ref: '#/definitions/rootFolderExpanded'
				},
				rootFolderNames: {
					$ref: '#/definitions/rootFolderNames'
				},
				rootFolderNamesExpanded: {
					$ref: '#/definitions/rootFolderNamesExpanded'
				},
				fileExtensions: {
					$ref: '#/definitions/fileExtensions'
				},
				fileNames: {
					$ref: '#/definitions/fileNames'
				},
				languageIds: {
					$ref: '#/definitions/languageIds'
				}
			}
		}
	},
	properties: {
		fonts: {
			type: 'array',
			description: nls.localize('schema.fonts', '图标定义中使用的字体。'),
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
									description: nls.localize('schema.font-path', '相对于当前文件图标主题文件的字体路径。'),
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
						pattern: fontWeightRegex.source
					},
					style: {
						type: 'string',
						description: nls.localize('schema.font-style', '字体的样式。要了解有效值，请参阅 https://developer.mozilla.org/zh-cn/docs/Web/CSS/font-style。'),
						pattern: fontStyleRegex.source
					},
					size: {
						type: 'string',
						description: nls.localize('schema.font-size', '默认字体大小。强烈建议使用百分比值，例如: 125%。'),
						pattern: fontSizeRegex.source
					}
				},
				required: [
					'id',
					'src'
				]
			}
		},
		iconDefinitions: {
			type: 'object',
			description: nls.localize('schema.iconDefinitions', '将文件与图标关联时可使用的所有图标的说明。'),
			additionalProperties: {
				type: 'object',
				description: nls.localize('schema.iconDefinition', '图标定义。对象键是定义的 ID。'),
				properties: {
					iconPath: {
						type: 'string',
						description: nls.localize('schema.iconPath', '使用 SVG 或 PNG 时: 到图像的路径。该路径相对于图标设置文件。')
					},
					fontCharacter: {
						type: 'string',
						description: nls.localize('schema.fontCharacter', '使用字形字体时: 要使用的字体中的字符。')
					},
					fontColor: {
						type: 'string',
						format: 'color-hex',
						description: nls.localize('schema.fontColor', '使用字形字体时: 要使用的颜色。'),
						pattern: fontColorRegex.source
					},
					fontSize: {
						type: 'string',
						description: nls.localize('schema.fontSize', '使用某种字体时: 文本字体的字体大小(以百分比表示)。如果未设置，则默认为字体定义中的大小。'),
						pattern: fontSizeRegex.source
					},
					fontId: {
						type: 'string',
						description: nls.localize('schema.fontId', '使用某种字体时: 字体的 ID。如果未设置，则默认为第一个字体定义。'),
						pattern: fontIdRegex.source,
						patternErrorMessage: fontIdErrorMessage
					}
				}
			}
		},
		folderExpanded: {
			$ref: '#/definitions/folderExpanded'
		},
		folder: {
			$ref: '#/definitions/folder'
		},
		file: {
			$ref: '#/definitions/file'
		},
		folderNames: {
			$ref: '#/definitions/folderNames'
		},
		folderNamesExpanded: {
			$ref: '#/definitions/folderNamesExpanded'
		},
		rootFolder: {
			$ref: '#/definitions/rootFolder'
		},
		rootFolderExpanded: {
			$ref: '#/definitions/rootFolderExpanded'
		},
		rootFolderNames: {
			$ref: '#/definitions/rootFolderNames'
		},
		rootFolderNamesExpanded: {
			$ref: '#/definitions/rootFolderNamesExpanded'
		},
		fileExtensions: {
			$ref: '#/definitions/fileExtensions'
		},
		fileNames: {
			$ref: '#/definitions/fileNames'
		},
		languageIds: {
			$ref: '#/definitions/languageIds'
		},
		light: {
			$ref: '#/definitions/associations',
			description: nls.localize('schema.light', '浅色主题中文件图标的可选关联。')
		},
		highContrast: {
			$ref: '#/definitions/associations',
			description: nls.localize('schema.highContrast', '高对比度颜色主题中文件图标的可选关联。')
		},
		hidesExplorerArrows: {
			type: 'boolean',
			description: nls.localize('schema.hidesExplorerArrows', '配置文件资源管理器的箭头是否应在此主题启用时隐藏。')
		},
		showLanguageModeIcons: {
			type: 'boolean',
			description: nls.localize('schema.showLanguageModeIcons', '配置如果主题未为某个语言定义图标，是否应使用默认语言图标。')
		}
	}
};

export function registerFileIconThemeSchemas() {
	const schemaRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
	schemaRegistry.registerSchema(schemaId, schema);
}
