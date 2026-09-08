/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ClearDisplayLanguageAction, ConfigureDisplayLanguageAction } from './localizationsActions.js';
import { IExtensionFeatureTableRenderer, IRenderedData, ITableData, IRowData, IExtensionFeaturesRegistry, Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';

export class BaseLocalizationWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	constructor() {
		super();

		// Register action to configure locale and related settings
		registerAction2(ConfigureDisplayLanguageAction);
		registerAction2(ClearDisplayLanguageAction);

		ExtensionsRegistry.registerExtensionPoint({
			extensionPoint: 'localizations',
			defaultExtensionKind: ['ui', 'workspace'],
			jsonSchema: {
				description: localize('vscode.extension.contributes.localizations', "向编辑器提供本地化内容"),
				type: 'array',
				default: [],
				items: {
					type: 'object',
					required: ['languageId', 'translations'],
					defaultSnippets: [{ body: { languageId: '', languageName: '', localizedLanguageName: '', translations: [{ id: 'vscode', path: '' }] } }],
					properties: {
						languageId: {
							description: localize('vscode.extension.contributes.localizations.languageId', '显示字符串翻译的目标语言 ID。'),
							type: 'string'
						},
						languageName: {
							description: localize('vscode.extension.contributes.localizations.languageName', '语言的英文名称。'),
							type: 'string'
						},
						localizedLanguageName: {
							description: localize('vscode.extension.contributes.localizations.languageNameLocalized', '提供语言的名称。'),
							type: 'string'
						},
						translations: {
							description: localize('vscode.extension.contributes.localizations.translations', '与语言关联的翻译的列表。'),
							type: 'array',
							default: [{ id: 'vscode', path: '' }],
							items: {
								type: 'object',
								required: ['id', 'path'],
								properties: {
									id: {
										type: 'string',
										description: localize('vscode.extension.contributes.localizations.translations.id', "使用此翻译的 VS Code 或扩展的 ID。VS Code 的 ID 总为 \"vscode\"，扩展的 ID 的格式应为 \"publisherId.extensionName\"。"),
										pattern: '^((vscode)|([a-z0-9A-Z][a-z0-9A-Z-]*)\\.([a-z0-9A-Z][a-z0-9A-Z-]*))$',
										patternErrorMessage: localize('vscode.extension.contributes.localizations.translations.id.pattern', "翻译 VS Code 或者扩展，ID 分别应为 \"vscode\" 或格式为 \"publisherId.extensionName\"。")
									},
									path: {
										type: 'string',
										description: localize('vscode.extension.contributes.localizations.translations.path', "包含语言翻译的文件的相对路径。")
									}
								},
								defaultSnippets: [{ body: { id: '', path: '' } }],
							},
						}
					}
				}
			}
		});
	}
}

class LocalizationsDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.localizations;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const localizations = manifest.contributes?.localizations || [];
		if (!localizations.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			localize('language id', "语言 ID"),
			localize('localizations language name', "语言名称"),
			localize('localizations localized language name', "语言本地名称"),
		];

		const rows: IRowData[][] = localizations
			.sort((a, b) => a.languageId.localeCompare(b.languageId))
			.map(localization => {
				return [
					localization.languageId,
					localization.languageName ?? '',
					localization.localizedLanguageName ?? ''
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
	id: 'localizations',
	label: localize('localizations', "语言包"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(LocalizationsDataRenderer),
});
