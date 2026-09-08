/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

import * as types from '../../../../base/common/types.js';
import * as resources from '../../../../base/common/resources.js';
import { ExtensionMessageCollector, IExtensionPoint, ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { ExtensionData, IThemeExtensionPoint, migrateThemeSettingsId } from './workbenchThemeService.js';

import { Event, Emitter } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { Extensions, IExtensionFeatureMarkdownRenderer, IExtensionFeaturesRegistry, IRenderedData } from '../../extensionManagement/common/extensionFeatures.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { IMarkdownString, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ThemeTypeSelector } from '../../../../platform/theme/common/theme.js';

export function registerColorThemeExtensionPoint() {
	return ExtensionsRegistry.registerExtensionPoint<IThemeExtensionPoint[]>({
		extensionPoint: 'themes',
		jsonSchema: {
			description: nls.localize('vscode.extension.contributes.themes', '提供 TextMate 颜色主题。'),
			type: 'array',
			items: {
				type: 'object',
				defaultSnippets: [{ body: { label: '${1:label}', id: '${2:id}', uiTheme: ThemeTypeSelector.VS_DARK, path: './themes/${3:id}.tmTheme.' } }],
				properties: {
					id: {
						description: nls.localize('vscode.extension.contributes.themes.id', '用户设置中使用的颜色主题的 ID。'),
						type: 'string'
					},
					label: {
						description: nls.localize('vscode.extension.contributes.themes.label', '显示在 UI 中的颜色主题标签。'),
						type: 'string'
					},
					uiTheme: {
						markdownDescription: nls.localize('vscode.extension.contributes.themes.uiTheme', '用于定义编辑器周围颜色的基本主题: `vs` 是浅色主题，`vs-dark` 是深色主题。`hc-black` 是深色高对比度主题，`hc-light` 是浅色高对比度主题。'),
						enum: [ThemeTypeSelector.VS, ThemeTypeSelector.VS_DARK, ThemeTypeSelector.HC_BLACK, ThemeTypeSelector.HC_LIGHT]
					},
					path: {
						markdownDescription: nls.localize('vscode.extension.contributes.themes.path', 'tmTheme 文件的路径。该路径相对于扩展文件夹，通常为 `./colorthemes/awesome-color-theme.json`。'),
						type: 'string'
					}
				},
				required: ['path', 'uiTheme']
			}
		}
	});
}
export function registerFileIconThemeExtensionPoint() {
	return ExtensionsRegistry.registerExtensionPoint<IThemeExtensionPoint[]>({
		extensionPoint: 'iconThemes',
		jsonSchema: {
			description: nls.localize('vscode.extension.contributes.iconThemes', '提供文件图标主题。'),
			type: 'array',
			items: {
				type: 'object',
				defaultSnippets: [{ body: { id: '${1:id}', label: '${2:label}', path: './fileicons/${3:id}-icon-theme.json' } }],
				properties: {
					id: {
						description: nls.localize('vscode.extension.contributes.iconThemes.id', '在用户设置中使用的文件图标主题的 ID。'),
						type: 'string'
					},
					label: {
						description: nls.localize('vscode.extension.contributes.iconThemes.label', '文件图标主题的标签，如 UI 所示。'),
						type: 'string'
					},
					path: {
						description: nls.localize('vscode.extension.contributes.iconThemes.path', '文件图标主题定义文件的路径。该路径相对于扩展文件夹，通常为 "./fileicons/awesome-icon-theme.json"。'),
						type: 'string'
					}
				},
				required: ['path', 'id']
			}
		}
	});
}

export function registerProductIconThemeExtensionPoint() {
	return ExtensionsRegistry.registerExtensionPoint<IThemeExtensionPoint[]>({
		extensionPoint: 'productIconThemes',
		jsonSchema: {
			description: nls.localize('vscode.extension.contributes.productIconThemes', '贡献产品图标主题。'),
			type: 'array',
			items: {
				type: 'object',
				defaultSnippets: [{ body: { id: '${1:id}', label: '${2:label}', path: './producticons/${3:id}-product-icon-theme.json' } }],
				properties: {
					id: {
						description: nls.localize('vscode.extension.contributes.productIconThemes.id', '用户设置中使用的产品图标主题的 ID。'),
						type: 'string'
					},
					label: {
						description: nls.localize('vscode.extension.contributes.productIconThemes.label', '产品图标主题的标签，如 UI 所示。'),
						type: 'string'
					},
					path: {
						description: nls.localize('vscode.extension.contributes.productIconThemes.path', '产品图标主题定义文件的路径。该路径相对于扩展文件夹，通常为 "./producticons/awesome-product-icon-theme.json"。'),
						type: 'string'
					}
				},
				required: ['path', 'id']
			}
		}
	});
}

class ThemeDataRenderer extends Disposable implements IExtensionFeatureMarkdownRenderer {

	readonly type = 'markdown';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.themes || !!manifest.contributes?.iconThemes || !!manifest.contributes?.productIconThemes;
	}

	render(manifest: IExtensionManifest): IRenderedData<IMarkdownString> {
		const markdown = new MarkdownString();
		if (manifest.contributes?.themes) {
			markdown.appendMarkdown(`### ${nls.localize('color themes', "颜色主题")}\n\n`);
			for (const theme of manifest.contributes.themes) {
				markdown.appendMarkdown(`- ${theme.label}\n`);
			}
		}
		if (manifest.contributes?.iconThemes) {
			markdown.appendMarkdown(`### ${nls.localize('file icon themes', "文件图标主题")}\n\n`);
			for (const theme of manifest.contributes.iconThemes) {
				markdown.appendMarkdown(`- ${theme.label}\n`);
			}
		}
		if (manifest.contributes?.productIconThemes) {
			markdown.appendMarkdown(`### ${nls.localize('product icon themes', "产品图标主题")}\n\n`);
			for (const theme of manifest.contributes.productIconThemes) {
				markdown.appendMarkdown(`- ${theme.label}\n`);
			}
		}
		return {
			data: markdown,
			dispose: () => { /* noop */ }
		};
	}
}

Registry.as<IExtensionFeaturesRegistry>(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'themes',
	label: nls.localize('themes', "主题"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(ThemeDataRenderer),
});

export interface ThemeChangeEvent<T> {
	themes: T[];
	added: T[];
	removed: T[];
}

export interface IThemeData {
	id: string;
	settingsId: string | null;
	location?: URI;
}

export class ThemeRegistry<T extends IThemeData> implements IDisposable {

	private extensionThemes: T[];

	private readonly onDidChangeEmitter = new Emitter<ThemeChangeEvent<T>>();
	public readonly onDidChange: Event<ThemeChangeEvent<T>> = this.onDidChangeEmitter.event;

	constructor(
		private readonly themesExtPoint: IExtensionPoint<IThemeExtensionPoint[]>,
		private create: (theme: IThemeExtensionPoint, themeLocation: URI, extensionData: ExtensionData) => T,
		private idRequired = false,
		private builtInTheme: T | undefined = undefined
	) {
		this.extensionThemes = [];
		this.initialize();
	}

	dispose() {
		this.themesExtPoint.setHandler(() => { });
		this.onDidChangeEmitter.dispose();
	}

	private initialize() {
		this.themesExtPoint.setHandler((extensions, delta) => {
			const previousIds: { [key: string]: T } = {};

			const added: T[] = [];
			for (const theme of this.extensionThemes) {
				previousIds[theme.id] = theme;
			}
			this.extensionThemes.length = 0;
			for (const ext of extensions) {
				const extensionData = ExtensionData.fromName(ext.description.publisher, ext.description.name, ext.description.isBuiltin);
				this.onThemes(extensionData, ext.description.extensionLocation, ext.value, this.extensionThemes, ext.collector);
			}
			for (const theme of this.extensionThemes) {
				if (!previousIds[theme.id]) {
					added.push(theme);
				} else {
					delete previousIds[theme.id];
				}
			}
			const removed = Object.values(previousIds);
			this.onDidChangeEmitter.fire({ themes: this.extensionThemes, added, removed });
		});
	}

	private onThemes(extensionData: ExtensionData, extensionLocation: URI, themeContributions: IThemeExtensionPoint[], resultingThemes: T[] = [], log?: ExtensionMessageCollector): T[] {
		if (!Array.isArray(themeContributions)) {
			log?.error(nls.localize(
				'reqarray',
				"扩展点“{0}”必须是数组。 ",
				this.themesExtPoint.name
			));
			return resultingThemes;
		}
		themeContributions.forEach(theme => {
			if (!theme.path || !types.isString(theme.path)) {
				log?.error(nls.localize(
					'reqpath',
					"“contributes.{0}.path”中应为字符串。提供的值: {1}",
					this.themesExtPoint.name,
					String(theme.path)
				));
				return;
			}
			if (this.idRequired && (!theme.id || !types.isString(theme.id))) {
				log?.error(nls.localize(
					'reqid',
					"contributes.{0}.id\" 中的预期字符串。提供的值: {1}",
					this.themesExtPoint.name,
					String(theme.id)
				));
				return;
			}

			const themeLocation = resources.joinPath(extensionLocation, theme.path);
			if (!resources.isEqualOrParent(themeLocation, extensionLocation)) {
				log?.warn(nls.localize('invalid.path.1', "“contributes.{0}.path”({1})应包含在扩展的文件夹({2})内。这可能会使扩展不可移植。", this.themesExtPoint.name, themeLocation.path, extensionLocation.path));
			}

			const themeData = this.create(theme, themeLocation, extensionData);
			resultingThemes.push(themeData);
		});
		return resultingThemes;
	}

	public findThemeById(themeId: string): T | undefined {
		if (this.builtInTheme && this.builtInTheme.id === themeId) {
			return this.builtInTheme;
		}
		const allThemes = this.getThemes();
		for (const t of allThemes) {
			if (t.id === themeId) {
				return t;
			}
		}
		return undefined;
	}

	public findThemeBySettingsId(settingsId: string | null, defaultSettingsId?: string): T | undefined {
		const migratedId = settingsId ? migrateThemeSettingsId(settingsId) : settingsId;
		if (this.builtInTheme && this.builtInTheme.settingsId === migratedId) {
			return this.builtInTheme;
		}
		const allThemes = this.getThemes();
		let defaultTheme: T | undefined = undefined;
		for (const t of allThemes) {
			if (t.settingsId === migratedId) {
				return t;
			}
			if (t.settingsId === defaultSettingsId) {
				defaultTheme = t;
			}
		}
		return defaultTheme;
	}

	public findThemeByExtensionLocation(extLocation: URI | undefined): T[] {
		if (extLocation) {
			return this.getThemes().filter(t => t.location && resources.isEqualOrParent(t.location, extLocation));
		}
		return [];
	}

	public getThemes(): T[] {
		return this.extensionThemes;
	}

	public getMarketplaceThemes(manifest: any, extensionLocation: URI, extensionData: ExtensionData): T[] {
		const themes = manifest?.contributes?.[this.themesExtPoint.name];
		if (Array.isArray(themes)) {
			return this.onThemes(extensionData, extensionLocation, themes);
		}
		return [];
	}

}
