/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { IIconRegistry, Extensions as IconRegistryExtensions } from '../../../../platform/theme/common/iconRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import * as resources from '../../../../base/common/resources.js';
import { IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { extname, posix } from '../../../../base/common/path.js';

interface IIconExtensionPoint {
	[id: string]: {
		description: string;
		default: { fontPath: string; fontCharacter: string } | string;
	};
}

const iconRegistry: IIconRegistry = Registry.as<IIconRegistry>(IconRegistryExtensions.IconContribution);

const iconReferenceSchema = iconRegistry.getIconReferenceSchema();
const iconIdPattern = `^${ThemeIcon.iconNameSegment}(-${ThemeIcon.iconNameSegment})+$`;

const iconConfigurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IIconExtensionPoint>({
	extensionPoint: 'icons',
	jsonSchema: {
		description: nls.localize('contributes.icons', '提供由扩展定义的主题图标'),
		type: 'object',
		propertyNames: {
			pattern: iconIdPattern,
			description: nls.localize('contributes.icon.id', '主题图标标识符'),
			patternErrorMessage: nls.localize('contributes.icon.id.format', '标识符只能包含字母、数字和减号，且必须按 "component-iconname" 格式由至少两段组成。'),
		},
		additionalProperties: {
			type: 'object',
			properties: {
				description: {
					type: 'string',
					description: nls.localize('contributes.icon.description', '主题图标的说明'),
				},
				default: {
					anyOf: [
						iconReferenceSchema,
						{
							type: 'object',
							properties: {
								fontPath: {
									description: nls.localize('contributes.icon.default.fontPath', '定义图标的图标字体的路径。'),
									type: 'string'
								},
								fontCharacter: {
									description: nls.localize('contributes.icon.default.fontCharacter', '图标字体中图标的字符。'),
									type: 'string'
								}
							},
							required: ['fontPath', 'fontCharacter'],
							defaultSnippets: [{ body: { fontPath: '${1:myiconfont.woff}', fontCharacter: '${2:\\\\E001}' } }]
						}
					],
					description: nls.localize('contributes.icon.default', '图标的默认值。引用现有主题图标或图标字体中的图标。'),
				}
			},
			required: ['description', 'default'],
			defaultSnippets: [{ body: { description: '${1:my icon}', default: { fontPath: '${2:myiconfont.woff}', fontCharacter: '${3:\\\\E001}' } } }]
		},
		defaultSnippets: [{ body: { '${1:my-icon-id}': { description: '${2:my icon}', default: { fontPath: '${3:myiconfont.woff}', fontCharacter: '${4:\\\\E001}' } } } }]
	}
});

export class IconExtensionPoint {

	constructor() {
		iconConfigurationExtPoint.setHandler((extensions, delta) => {
			for (const extension of delta.added) {
				const extensionValue = <IIconExtensionPoint>extension.value;
				const collector = extension.collector;

				if (!extensionValue || typeof extensionValue !== 'object') {
					collector.error(nls.localize('invalid.icons.configuration', "'configuration.icons' 必须是以图标名称为属性的对象。"));
					return;
				}

				for (const id in extensionValue) {
					if (!id.match(iconIdPattern)) {
						collector.error(nls.localize('invalid.icons.id.format', "'configuration.icons' 键标识图标 ID，只能包含字母、数字和减号。它们需要按 `component-iconname` 格式由至少两段组成。"));
						return;
					}
					const iconContribution = extensionValue[id];
					if (typeof iconContribution.description !== 'string' || iconContribution.description.length === 0) {
						collector.error(nls.localize('invalid.icons.description', "必须定义 'configuration.icons.description' 且它不可为空"));
						return;
					}
					const defaultIcon = iconContribution.default;
					if (typeof defaultIcon === 'string') {
						iconRegistry.registerIcon(id, { id: defaultIcon }, iconContribution.description);
					} else if (typeof defaultIcon === 'object' && typeof defaultIcon.fontPath === 'string' && typeof defaultIcon.fontCharacter === 'string') {
						const fileExt = extname(defaultIcon.fontPath).substring(1);
						const format = formatMap[fileExt];
						if (!format) {
							collector.warn(nls.localize('invalid.icons.default.fontPath.extension', "预期 `contributes.icons.default.fontPath` 的文件扩展名为 'woff'，woff2' 或 'ttf'，为 '{0}'。", fileExt));
							return;
						}
						const extensionLocation = extension.description.extensionLocation;
						const iconFontLocation = resources.joinPath(extensionLocation, defaultIcon.fontPath);
						const fontId = getFontId(extension.description, defaultIcon.fontPath);
						const definition = iconRegistry.registerIconFont(fontId, { src: [{ location: iconFontLocation, format }] });
						if (!resources.isEqualOrParent(iconFontLocation, extensionLocation)) {
							collector.warn(nls.localize('invalid.icons.default.fontPath.path', "预期 `contributes.icons.default.fontPath` ({0}) 将包含在扩展的文件夹 ({0}) 中。", iconFontLocation.path, extensionLocation.path));
							return;
						}
						iconRegistry.registerIcon(id, {
							fontCharacter: defaultIcon.fontCharacter,
							font: {
								id: fontId,
								definition
							}
						}, iconContribution.description);
					} else {
						collector.error(nls.localize('invalid.icons.default', "'configuration.icons.default' 必须是对其他主题图标的 ID (字符串)或图标定义(对象)的引用，属性为 `fontPath` 和 `fontCharacter`。"));
					}
				}
			}
			for (const extension of delta.removed) {
				const extensionValue = <IIconExtensionPoint>extension.value;
				for (const id in extensionValue) {
					iconRegistry.deregisterIcon(id);
				}
			}
		});
	}
}

const formatMap: Record<string, string> = {
	'ttf': 'truetype',
	'woff': 'woff',
	'woff2': 'woff2'
};

function getFontId(description: IExtensionDescription, fontPath: string) {
	return posix.join(description.identifier.value, fontPath);
}
