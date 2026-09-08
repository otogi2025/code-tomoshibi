/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';
import { ExtensionsRegistry } from '../../services/extensions/common/extensionsRegistry.js';
import * as resources from '../../../base/common/resources.js';
import { isString } from '../../../base/common/types.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { Extensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../services/extensionManagement/common/extensionFeatures.js';
import { IExtensionManifest } from '../../../platform/extensions/common/extensions.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';

interface IJSONValidationExtensionPoint {
	fileMatch: string | string[];
	url: string;
}

interface IJSONValidationRegistryExtensionPoint {
	url: string;
}

const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IJSONValidationExtensionPoint[]>({
	extensionPoint: 'jsonValidation',
	defaultExtensionKind: ['workspace', 'web'],
	jsonSchema: {
		description: nls.localize('contributes.jsonValidation', '用于 json 架构配置。'),
		type: 'array',
		defaultSnippets: [{ body: [{ fileMatch: '${1:file.json}', url: '${2:url}' }] }],
		items: {
			type: 'object',
			defaultSnippets: [{ body: { fileMatch: '${1:file.json}', url: '${2:url}' } }],
			properties: {
				fileMatch: {
					type: ['string', 'array'],
					description: nls.localize('contributes.jsonValidation.fileMatch', '要匹配的文件模式(或模式数组)，例如"package.json"或"*. launch"。排除模式以"!"开头'),
					items: {
						type: ['string']
					}
				},
				url: {
					description: nls.localize('contributes.jsonValidation.url', '到扩展文件夹(\'./\')的架构 URL ("http:"、"https:")或相对路径。'),
					type: 'string'
				}
			}
		}
	}
});

const registryExtPoint = ExtensionsRegistry.registerExtensionPoint<IJSONValidationRegistryExtensionPoint[]>({
	extensionPoint: 'jsonValidationRegistry',
	defaultExtensionKind: ['workspace', 'web'],
	jsonSchema: {
		description: nls.localize('contributes.jsonValidationRegistry', 'Contributes a JSON validation registry. The registry can be a dynamic resource from a filesystem provider and allows associations to change at runtime.'),
		type: 'array',
		defaultSnippets: [{ body: [{ url: '${1:url}' }] }],
		items: {
			type: 'object',
			defaultSnippets: [{ body: { url: '${1:url}' } }],
			properties: {
				url: {
					description: nls.localize('contributes.jsonValidationRegistry.url', 'A registry URI or relative path to the extension folder (\'./\').'),
					type: 'string'
				}
			}
		}
	}
});

export class JSONValidationExtensionPoint {

	constructor() {
		configurationExtPoint.setHandler((extensions) => {
			for (const extension of extensions) {
				const extensionValue = <IJSONValidationExtensionPoint[]>extension.value;
				const collector = extension.collector;
				const extensionLocation = extension.description.extensionLocation;

				if (!extensionValue || !Array.isArray(extensionValue)) {
					collector.error(nls.localize('invalid.jsonValidation', "configuration.jsonValidation 必须是数组"));
					return;
				}
				extensionValue.forEach(extension => {
					if (!isString(extension.fileMatch) && !(Array.isArray(extension.fileMatch) && extension.fileMatch.every(isString))) {
						collector.error(nls.localize('invalid.fileMatch', "\"configuration.jsonValidation.fileMatch\"必须定义为字符串或字符串数组。"));
						return;
					}
					const uri = extension.url;
					if (!isString(uri)) {
						collector.error(nls.localize('invalid.url', "configuration.jsonValidation.url 必须是 URL 或相对路径"));
						return;
					}
					if (uri.startsWith('./')) {
						try {
							const colorThemeLocation = resources.joinPath(extensionLocation, uri);
							if (!resources.isEqualOrParent(colorThemeLocation, extensionLocation)) {
								collector.warn(nls.localize('invalid.path.1', "\"contributes.{0}.url\" ({1})应包含在扩展的文件夹({2})内。这可能会使扩展不可移植。", configurationExtPoint.name, colorThemeLocation.toString(), extensionLocation.path));
							}
						} catch (e) {
							collector.error(nls.localize('invalid.url.fileschema', "configuration.jsonValidation.url 是无效的相对 URL: {0}", e.message));
						}
					} else if (!/^[^:/?#]+:\/\//.test(uri)) {
						collector.error(nls.localize('invalid.url.schema', "\"configuration.jsonValidation.url\" 必须是绝对 URL 或者以 \"./\" 开头，以引用扩展中的架构。"));
						return;
					}
				});
			}
		});

		registryExtPoint.setHandler(extensions => {
			for (const extension of extensions) {
				const catalogs = extension.value;
				const collector = extension.collector;
				const extensionLocation = extension.description.extensionLocation;

				if (!Array.isArray(catalogs)) {
					collector.error(nls.localize('invalid.jsonValidationRegistry', "'configuration.jsonValidationRegistry' must be an array"));
					continue;
				}
				for (const catalog of catalogs) {
					const uri = catalog?.url;
					if (!isString(uri)) {
						collector.error(nls.localize('invalid.jsonValidationRegistry.url', "'configuration.jsonValidationRegistry.url' must be a URI or relative path"));
						continue;
					}
					if (uri.startsWith('./')) {
						try {
							const catalogLocation = resources.joinPath(extensionLocation, uri);
							if (!resources.isEqualOrParent(catalogLocation, extensionLocation)) {
								collector.warn(nls.localize('invalid.jsonValidationRegistry.path', "Expected `contributes.{0}.url` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.", registryExtPoint.name, catalogLocation.toString(), extensionLocation.path));
							}
						} catch (e) {
							collector.error(nls.localize('invalid.jsonValidationRegistry.fileschema', "'configuration.jsonValidationRegistry.url' is an invalid relative URI: {0}", e.message));
						}
					} else if (!/^[^:/?#]+:\/\//.test(uri)) {
						collector.error(nls.localize('invalid.jsonValidationRegistry.schema', "'configuration.jsonValidationRegistry.url' must be an absolute URI or start with './' to reference a registry located in the extension."));
					}
				}
			}
		});
	}

}

class JSONValidationDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.jsonValidation;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.jsonValidation || [];
		if (!contrib.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('fileMatch', "匹配文件"),
			nls.localize('schema', "结构"),
		];

		const rows: IRowData[][] = contrib.map(v => {
			return [
				new MarkdownString().appendMarkdown(`\`${Array.isArray(v.fileMatch) ? v.fileMatch.join(', ') : v.fileMatch}\``),
				v.url,
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
	id: 'jsonValidation',
	label: nls.localize('jsonValidation', "JSON 验证"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(JSONValidationDataRenderer),
});
