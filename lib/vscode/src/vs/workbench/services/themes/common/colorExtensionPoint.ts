/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { IColorRegistry, Extensions as ColorRegistryExtensions } from '../../../../platform/theme/common/colorRegistry.js';
import { Color } from '../../../../base/common/color.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Extensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../extensionManagement/common/extensionFeatures.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';

interface IColorExtensionPoint {
	id: string;
	description: string;
	defaults: { light: string; dark: string; highContrast: string; highContrastLight?: string };
}

const colorRegistry: IColorRegistry = Registry.as<IColorRegistry>(ColorRegistryExtensions.ColorContribution);

const colorReferenceSchema = colorRegistry.getColorReferenceSchema();
const colorIdPattern = '^\\w+[.\\w+]*$';

const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IColorExtensionPoint[]>({
	extensionPoint: 'colors',
	jsonSchema: {
		description: nls.localize('contributes.color', '提供由扩展定义的主题颜色'),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: nls.localize('contributes.color.id', '主题颜色标识符'),
					pattern: colorIdPattern,
					patternErrorMessage: nls.localize('contributes.color.id.format', '标识符只能包含字母、数字和点，且不能以点开头'),
				},
				description: {
					type: 'string',
					description: nls.localize('contributes.color.description', '主题颜色的说明'),
				},
				defaults: {
					type: 'object',
					properties: {
						light: {
							description: nls.localize('contributes.defaults.light', '浅色主题的默认颜色。应为十六进制颜色值 (#RRGGBB[AA]) 或是主题颜色标识符，其提供默认值。'),
							type: 'string',
							anyOf: [
								colorReferenceSchema,
								{ type: 'string', format: 'color-hex' }
							]
						},
						dark: {
							description: nls.localize('contributes.defaults.dark', '深色主题的默认颜色。应为十六进制颜色值 (#RRGGBB[AA]) 或是主题颜色标识符，其提供默认值。'),
							type: 'string',
							anyOf: [
								colorReferenceSchema,
								{ type: 'string', format: 'color-hex' }
							]
						},
						highContrast: {
							description: nls.localize('contributes.defaults.highContrast', '高对比度深色主题的默认颜色。十六进制颜色值 (#RRGGBB[AA])或提供默认值的主题化颜色的标识符。如果未提供，则“深色”用作高对比度深色主题的默认颜色。'),
							type: 'string',
							anyOf: [
								colorReferenceSchema,
								{ type: 'string', format: 'color-hex' }
							]
						},
						highContrastLight: {
							description: nls.localize('contributes.defaults.highContrastLight', '高对比度浅色主题的默认颜色。十六进制颜色值 (#RRGGBB[AA])或提供默认值的主题化颜色的标识符。如果未提供，则“浅色”用作高对比度浅色主题的默认颜色。'),
							type: 'string',
							anyOf: [
								colorReferenceSchema,
								{ type: 'string', format: 'color-hex' }
							]
						}
					},
					required: ['light', 'dark']
				}
			}
		}
	}
});

export class ColorExtensionPoint {

	constructor() {
		configurationExtPoint.setHandler((extensions, delta) => {
			for (const extension of delta.added) {
				const extensionValue = <IColorExtensionPoint[]>extension.value;
				const collector = extension.collector;

				if (!extensionValue || !Array.isArray(extensionValue)) {
					collector.error(nls.localize('invalid.colorConfiguration', "\"configuration.colors\" 必须是数组"));
					return;
				}
				const parseColorValue = (s: string, name: string) => {
					if (s.length > 0) {
						if (s[0] === '#') {
							return Color.Format.CSS.parseHex(s);
						} else {
							return s;
						}
					}
					collector.error(nls.localize('invalid.default.colorType', "{0} 必须为十六进制颜色值 (#RRGGBB[AA] 或 #RGB[A]) 或是主题颜色标识符，其提供默认值。", name));
					return Color.red;
				};

				for (const colorContribution of extensionValue) {
					if (typeof colorContribution.id !== 'string' || colorContribution.id.length === 0) {
						collector.error(nls.localize('invalid.id', "必须定义 \"configuration.colors.id\" 且它不可为空"));
						return;
					}
					if (!colorContribution.id.match(colorIdPattern)) {
						collector.error(nls.localize('invalid.id.format', "\"configuration.colors.id\" 只能包含字母、数字和点，且不能以点开头"));
						return;
					}
					if (typeof colorContribution.description !== 'string' || colorContribution.id.length === 0) {
						collector.error(nls.localize('invalid.description', "必须定义 \"configuration.colors.description\" 且它不可为空"));
						return;
					}
					const defaults = colorContribution.defaults;
					if (!defaults || typeof defaults !== 'object' || typeof defaults.light !== 'string' || typeof defaults.dark !== 'string') {
						collector.error(nls.localize('invalid.defaults', "必须定义 'configuration.colors.defaults'，且其必须包含 'light' 和 'dark'"));
						return;
					}
					if (defaults.highContrast && typeof defaults.highContrast !== 'string') {
						collector.error(nls.localize('invalid.defaults.highContrast', "如果已定义，则 'configuration.colors.defaults.highContrast' 必须为字符串。"));
						return;
					}
					if (defaults.highContrastLight && typeof defaults.highContrastLight !== 'string') {
						collector.error(nls.localize('invalid.defaults.highContrastLight', "如果已定义，则 'configuration.colors.defaults.highContrastLight' 必须为字符串。"));
						return;
					}

					colorRegistry.registerColor(colorContribution.id, {
						light: parseColorValue(defaults.light, 'configuration.colors.defaults.light'),
						dark: parseColorValue(defaults.dark, 'configuration.colors.defaults.dark'),
						hcDark: parseColorValue(defaults.highContrast ?? defaults.dark, 'configuration.colors.defaults.highContrast'),
						hcLight: parseColorValue(defaults.highContrastLight ?? defaults.light, 'configuration.colors.defaults.highContrastLight'),
					}, colorContribution.description);
				}
			}
			for (const extension of delta.removed) {
				const extensionValue = <IColorExtensionPoint[]>extension.value;
				for (const colorContribution of extensionValue) {
					colorRegistry.deregisterColor(colorContribution.id);
				}
			}
		});
	}
}

class ColorDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.colors;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const colors = manifest.contributes?.colors || [];
		if (!colors.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('id', "ID"),
			nls.localize('description', "说明"),
			nls.localize('defaultDark', "深色默认"),
			nls.localize('defaultLight', "浅色默认"),
			nls.localize('defaultHC', "高对比度默认"),
		];

		const toColor = (colorReference: string): Color | undefined => colorReference[0] === '#' ? Color.fromHex(colorReference) : undefined;

		const rows: IRowData[][] = colors.sort((a, b) => a.id.localeCompare(b.id))
			.map(color => {
				return [
					new MarkdownString().appendMarkdown(`\`${color.id}\``),
					color.description,
					toColor(color.defaults.dark) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.dark}\``),
					toColor(color.defaults.light) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.light}\``),
					toColor(color.defaults.highContrast) ?? new MarkdownString().appendMarkdown(`\`${color.defaults.highContrast}\``),
				];
			});

		return {
			data: {
				headers,
				rows
			},
			dispose: () => { }
		};
	}
}

Registry.as<IExtensionFeaturesRegistry>(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'colors',
	label: nls.localize('colors', "颜色"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(ColorDataRenderer),
});
