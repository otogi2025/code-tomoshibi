/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import * as types from '../../../../base/common/types.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, IConfigurationPropertySchema, IConfigurationNode, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { textmateColorsSchemaId, textmateColorGroupSchemaId } from './colorThemeSchema.js';
import { workbenchColorsSchemaId } from '../../../../platform/theme/common/colorRegistry.js';
import { tokenStylingSchemaId } from '../../../../platform/theme/common/tokenClassificationRegistry.js';
import { ThemeSettings, IWorkbenchColorTheme, IWorkbenchFileIconTheme, IColorCustomizations, ITokenColorCustomizations, IWorkbenchProductIconTheme, ISemanticTokenColorCustomizations, ThemeSettingTarget, ThemeSettingDefaults } from './workbenchThemeService.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { isWeb } from '../../../../base/common/platform.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { IHostColorSchemeService } from './hostColorSchemeService.js';
import { IColorScheme } from '../../../../platform/window/common/window.js';

// Configuration: Themes
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const colorThemeSettingEnum: string[] = [];
const colorThemeSettingEnumItemLabels: string[] = [];
const colorThemeSettingEnumDescriptions: string[] = [];

export function formatSettingAsLink(str: string) {
	return `\`#${str}#\``;
}

export const COLOR_THEME_CONFIGURATION_SETTINGS_TAG = 'colorThemeConfiguration';

const colorThemeSettingSchema: IConfigurationPropertySchema = {
	type: 'string',
	markdownDescription: nls.localize({ key: 'colorTheme', comment: ['{0} will become a link to another setting.'] }, "指定未启用 {0} 时在工作台中使用颜色主题。", formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
	default: isWeb ? ThemeSettingDefaults.COLOR_THEME_LIGHT : ThemeSettingDefaults.COLOR_THEME_DARK,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
	enum: colorThemeSettingEnum,
	enumDescriptions: colorThemeSettingEnumDescriptions,
	enumItemLabels: colorThemeSettingEnumItemLabels,
	errorMessage: nls.localize('colorThemeError', "主题未知或未安装。"),
};
const preferredDarkThemeSettingSchema: IConfigurationPropertySchema = {
	type: 'string', //
	markdownDescription: nls.localize({ key: 'preferredDarkColorTheme', comment: ['{0} will become a link to another setting.'] }, '指定当系统颜色模式为深色并启用 {0} 时的颜色主题。', formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
	default: ThemeSettingDefaults.COLOR_THEME_DARK,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
	enum: colorThemeSettingEnum,
	enumDescriptions: colorThemeSettingEnumDescriptions,
	enumItemLabels: colorThemeSettingEnumItemLabels,
	errorMessage: nls.localize('colorThemeError', "主题未知或未安装。"),
};
const preferredLightThemeSettingSchema: IConfigurationPropertySchema = {
	type: 'string',
	markdownDescription: nls.localize({ key: 'preferredLightColorTheme', comment: ['{0} will become a link to another setting.'] }, '指定当系统颜色模式为浅色并启用 {0} 时的颜色主题。', formatSettingAsLink(ThemeSettings.DETECT_COLOR_SCHEME)),
	default: ThemeSettingDefaults.COLOR_THEME_LIGHT,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
	enum: colorThemeSettingEnum,
	enumDescriptions: colorThemeSettingEnumDescriptions,
	enumItemLabels: colorThemeSettingEnumItemLabels,
	errorMessage: nls.localize('colorThemeError', "主题未知或未安装。"),
};
const preferredHCDarkThemeSettingSchema: IConfigurationPropertySchema = {
	type: 'string',
	markdownDescription: nls.localize({ key: 'preferredHCDarkColorTheme', comment: ['{0} will become a link to another setting.'] }, '指定在高对比度深色模式下启用 {0} 时的颜色主题。', formatSettingAsLink(ThemeSettings.DETECT_HC)),
	default: ThemeSettingDefaults.COLOR_THEME_HC_DARK,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
	enum: colorThemeSettingEnum,
	enumDescriptions: colorThemeSettingEnumDescriptions,
	enumItemLabels: colorThemeSettingEnumItemLabels,
	errorMessage: nls.localize('colorThemeError', "主题未知或未安装。"),
};
const preferredHCLightThemeSettingSchema: IConfigurationPropertySchema = {
	type: 'string',
	markdownDescription: nls.localize({ key: 'preferredHCLightColorTheme', comment: ['{0} will become a link to another setting.'] }, '指定在高对比度浅色模式下启用 {0} 时的颜色主题。', formatSettingAsLink(ThemeSettings.DETECT_HC)),
	default: ThemeSettingDefaults.COLOR_THEME_HC_LIGHT,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
	enum: colorThemeSettingEnum,
	enumDescriptions: colorThemeSettingEnumDescriptions,
	enumItemLabels: colorThemeSettingEnumItemLabels,
	errorMessage: nls.localize('colorThemeError', "主题未知或未安装。"),
};
const detectColorSchemeSettingSchema: IConfigurationPropertySchema = {
	type: 'boolean',
	markdownDescription: nls.localize({ key: 'detectColorScheme', comment: ['{0} and {1} will become links to other settings.'] }, '如果已启用，将根据系统颜色模式自动选择颜色主题。如果系统颜色模式为深色，则使用 {0}，否则使用 {1}。', formatSettingAsLink(ThemeSettings.PREFERRED_DARK_THEME), formatSettingAsLink(ThemeSettings.PREFERRED_LIGHT_THEME)),
	default: false,
	...(isWeb ? { agentsWindow: { default: true } } : {}),
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
};

const colorCustomizationsSchema: IConfigurationPropertySchema = {
	type: 'object',
	description: nls.localize('workbenchColors', "覆盖当前所选颜色主题的颜色。"),
	allOf: [{ $ref: workbenchColorsSchemaId }],
	default: {},
	defaultSnippets: [{
		body: {
		}
	}]
};
const fileIconThemeSettingSchema: IConfigurationPropertySchema = {
	type: ['string', 'null'],
	default: ThemeSettingDefaults.FILE_ICON_THEME,
	description: nls.localize('iconTheme', "指定工作台中使用的文件图标主题；若指定为 \"null\"，则不显示任何文件图标。"),
	enum: [null],
	enumItemLabels: [nls.localize('noIconThemeLabel', '无')],
	enumDescriptions: [nls.localize('noIconThemeDesc', '无文件图标')],
	errorMessage: nls.localize('iconThemeError', "文件图标主题未知或未安装。")
};
const productIconThemeSettingSchema: IConfigurationPropertySchema = {
	type: ['string', 'null'],
	default: ThemeSettingDefaults.PRODUCT_ICON_THEME,
	description: nls.localize('productIconTheme', "指定使用的产品图标主题。"),
	enum: [ThemeSettingDefaults.PRODUCT_ICON_THEME],
	enumItemLabels: [nls.localize('defaultProductIconThemeLabel', '默认')],
	enumDescriptions: [nls.localize('defaultProductIconThemeDesc', '默认')],
	errorMessage: nls.localize('productIconThemeError', "产品图标主题未知或未安装。")
};

const detectHCSchemeSettingSchema: IConfigurationPropertySchema = {
	type: 'boolean',
	default: true,
	markdownDescription: nls.localize({ key: 'autoDetectHighContrast', comment: ['{0} and {1} will become links to other settings.'] }, "如果已启用，则在操作系统使用高对比度主题时，将自动更改为高对比度主题。要使用的高对比度主题是由“{0}”和“{1}”指定的。", formatSettingAsLink(ThemeSettings.PREFERRED_HC_DARK_THEME), formatSettingAsLink(ThemeSettings.PREFERRED_HC_LIGHT_THEME)),
	scope: ConfigurationScope.APPLICATION,
	tags: [COLOR_THEME_CONFIGURATION_SETTINGS_TAG],
};

const themeSettingsConfiguration: IConfigurationNode = {
	id: 'workbench',
	order: 7.1,
	type: 'object',
	properties: {
		[ThemeSettings.COLOR_THEME]: colorThemeSettingSchema,
		[ThemeSettings.PREFERRED_DARK_THEME]: preferredDarkThemeSettingSchema,
		[ThemeSettings.PREFERRED_LIGHT_THEME]: preferredLightThemeSettingSchema,
		[ThemeSettings.PREFERRED_HC_DARK_THEME]: preferredHCDarkThemeSettingSchema,
		[ThemeSettings.PREFERRED_HC_LIGHT_THEME]: preferredHCLightThemeSettingSchema,
		[ThemeSettings.FILE_ICON_THEME]: fileIconThemeSettingSchema,
		[ThemeSettings.COLOR_CUSTOMIZATIONS]: colorCustomizationsSchema,
		[ThemeSettings.PRODUCT_ICON_THEME]: productIconThemeSettingSchema
	}
};
configurationRegistry.registerConfiguration(themeSettingsConfiguration);

const themeSettingsWindowConfiguration: IConfigurationNode = {
	id: 'window',
	order: 8.1,
	type: 'object',
	properties: {
		[ThemeSettings.DETECT_HC]: detectHCSchemeSettingSchema,
		[ThemeSettings.DETECT_COLOR_SCHEME]: detectColorSchemeSettingSchema,
	}
};
configurationRegistry.registerConfiguration(themeSettingsWindowConfiguration);

function tokenGroupSettings(description: string): IJSONSchema {
	return {
		description,
		$ref: textmateColorGroupSchemaId
	};
}

const themeSpecificSettingKey = '^\\[[^\\]]*(\\]\\s*\\[[^\\]]*)*\\]$';

const tokenColorSchema: IJSONSchema = {
	type: 'object',
	properties: {
		comments: tokenGroupSettings(nls.localize('editorColors.comments', "设置注释的颜色和样式")),
		strings: tokenGroupSettings(nls.localize('editorColors.strings', "设置字符串文本的颜色和样式")),
		keywords: tokenGroupSettings(nls.localize('editorColors.keywords', "设置关键字的颜色和样式。")),
		numbers: tokenGroupSettings(nls.localize('editorColors.numbers', "设置数字的颜色和样式。")),
		types: tokenGroupSettings(nls.localize('editorColors.types', "设置类型定义与引用的颜色和样式。")),
		functions: tokenGroupSettings(nls.localize('editorColors.functions', "设置函数定义与引用的颜色和样式。")),
		variables: tokenGroupSettings(nls.localize('editorColors.variables', "设置变量定义和引用的颜色和样式。")),
		textMateRules: {
			description: nls.localize('editorColors.textMateRules', '使用 TextMate 主题规则设置颜色和样式(高级)。'),
			$ref: textmateColorsSchemaId
		},
		semanticHighlighting: {
			description: nls.localize('editorColors.semanticHighlighting', '是否应为此主题启用语义突出显示。'),
			deprecationMessage: nls.localize('editorColors.semanticHighlighting.deprecationMessage', '改为在 "editor.semanticTokenColorCustomizations" 设置中使用 "enabled"。'),
			markdownDeprecationMessage: nls.localize({ key: 'editorColors.semanticHighlighting.deprecationMessageMarkdown', comment: ['{0} will become a link to another setting.'] }, '请改为在 {0} 设置中使用 `enabled`。', formatSettingAsLink('editor.semanticTokenColorCustomizations')),
			type: 'boolean'
		}
	},
	additionalProperties: false
};

const tokenColorCustomizationSchema: IConfigurationPropertySchema = {
	description: nls.localize('editorColors', "替代当前所选颜色主题中的编辑器语法颜色和字形。"),
	default: {},
	allOf: [{ ...tokenColorSchema, patternProperties: { '^\\[': {} } }]
};

const semanticTokenColorSchema: IJSONSchema = {
	type: 'object',
	properties: {
		enabled: {
			type: 'boolean',
			description: nls.localize('editorColors.semanticHighlighting.enabled', '是否对此主题启用或禁用语义突出显示'),
			suggestSortText: '0_enabled'
		},
		rules: {
			$ref: tokenStylingSchemaId,
			description: nls.localize('editorColors.semanticHighlighting.rules', '此主题的语义标记样式规则。'),
			suggestSortText: '0_rules'
		}
	},
	additionalProperties: false
};

const semanticTokenColorCustomizationSchema: IConfigurationPropertySchema = {
	description: nls.localize('semanticTokenColors', "从当前所选颜色主题重写编辑器语义标记颜色和样式。"),
	default: {},
	allOf: [{ ...semanticTokenColorSchema, patternProperties: { '^\\[': {} } }]
};

const tokenColorCustomizationConfiguration: IConfigurationNode = {
	id: 'editor',
	order: 7.2,
	type: 'object',
	properties: {
		[ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS]: tokenColorCustomizationSchema,
		[ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS]: semanticTokenColorCustomizationSchema
	}
};

configurationRegistry.registerConfiguration(tokenColorCustomizationConfiguration);

export function updateColorThemeConfigurationSchemas(themes: IWorkbenchColorTheme[]) {
	// updates enum for the 'workbench.colorTheme` setting
	themes.sort((a, b) => a.label.localeCompare(b.label));
	colorThemeSettingEnum.splice(0, colorThemeSettingEnum.length, ...themes.map(t => t.settingsId));
	colorThemeSettingEnumDescriptions.splice(0, colorThemeSettingEnumDescriptions.length, ...themes.map(t => t.description || ''));
	colorThemeSettingEnumItemLabels.splice(0, colorThemeSettingEnumItemLabels.length, ...themes.map(t => t.label || ''));

	const themeSpecificWorkbenchColors: IJSONSchema = { properties: {} };
	const themeSpecificTokenColors: IJSONSchema = { properties: {} };
	const themeSpecificSemanticTokenColors: IJSONSchema = { properties: {} };

	const workbenchColors = { $ref: workbenchColorsSchemaId, additionalProperties: false };
	const tokenColors = { properties: tokenColorSchema.properties, additionalProperties: false };
	for (const t of themes) {
		// add theme specific color customization ("[Abyss]":{ ... })
		const themeId = `[${t.settingsId}]`;
		themeSpecificWorkbenchColors.properties![themeId] = workbenchColors;
		themeSpecificTokenColors.properties![themeId] = tokenColors;
		themeSpecificSemanticTokenColors.properties![themeId] = semanticTokenColorSchema;
	}
	themeSpecificWorkbenchColors.patternProperties = { [themeSpecificSettingKey]: workbenchColors };
	themeSpecificTokenColors.patternProperties = { [themeSpecificSettingKey]: tokenColors };
	themeSpecificSemanticTokenColors.patternProperties = { [themeSpecificSettingKey]: semanticTokenColorSchema };

	colorCustomizationsSchema.allOf![1] = themeSpecificWorkbenchColors;
	tokenColorCustomizationSchema.allOf![1] = themeSpecificTokenColors;
	semanticTokenColorCustomizationSchema.allOf![1] = themeSpecificSemanticTokenColors;

	configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration, tokenColorCustomizationConfiguration);
}

export function updateFileIconThemeConfigurationSchemas(themes: IWorkbenchFileIconTheme[]) {
	fileIconThemeSettingSchema.enum!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.settingsId));
	fileIconThemeSettingSchema.enumItemLabels!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.label));
	fileIconThemeSettingSchema.enumDescriptions!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.description || ''));

	configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration);
}

export function updateProductIconThemeConfigurationSchemas(themes: IWorkbenchProductIconTheme[]) {
	productIconThemeSettingSchema.enum!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.settingsId));
	productIconThemeSettingSchema.enumItemLabels!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.label));
	productIconThemeSettingSchema.enumDescriptions!.splice(1, Number.MAX_VALUE, ...themes.map(t => t.description || ''));

	configurationRegistry.notifyConfigurationSchemaUpdated(themeSettingsConfiguration);
}

const colorSchemeToPreferred = {
	[ColorScheme.DARK]: ThemeSettings.PREFERRED_DARK_THEME,
	[ColorScheme.LIGHT]: ThemeSettings.PREFERRED_LIGHT_THEME,
	[ColorScheme.HIGH_CONTRAST_DARK]: ThemeSettings.PREFERRED_HC_DARK_THEME,
	[ColorScheme.HIGH_CONTRAST_LIGHT]: ThemeSettings.PREFERRED_HC_LIGHT_THEME
};

export class ThemeConfiguration {
	constructor(private configurationService: IConfigurationService, private hostColorService: IHostColorSchemeService) {
	}

	public get colorTheme(): string {
		return this.configurationService.getValue<string>(this.getColorThemeSettingId());
	}

	public get fileIconTheme(): string | null {
		return this.configurationService.getValue<string | null>(ThemeSettings.FILE_ICON_THEME);
	}

	public get productIconTheme(): string {
		return this.configurationService.getValue<string>(ThemeSettings.PRODUCT_ICON_THEME);
	}

	public get colorCustomizations(): IColorCustomizations {
		return this.configurationService.getValue<IColorCustomizations>(ThemeSettings.COLOR_CUSTOMIZATIONS) || {};
	}

	public get tokenColorCustomizations(): ITokenColorCustomizations {
		const tokenColorCustomization = this.configurationService.getValue<ITokenColorCustomizations>(ThemeSettings.TOKEN_COLOR_CUSTOMIZATIONS) || {};
		const textMateRules = tokenColorCustomization.textMateRules;
		if (!textMateRules) {
			return tokenColorCustomization;
		}
		const updatedRules = textMateRules.map(rule => {
			const fontSize = rule.settings?.fontSize;
			const lineHeight = rule.settings?.lineHeight;
			if (fontSize !== undefined && lineHeight === undefined) {
				return {
					...rule,
					settings: {
						...rule.settings,
						lineHeight: fontSize
					}
				};
			}
			return rule;
		});
		const updatedTokenColorCustomization = {
			...tokenColorCustomization,
			textMateRules: updatedRules
		};
		return updatedTokenColorCustomization;
	}

	public get semanticTokenColorCustomizations(): ISemanticTokenColorCustomizations | undefined {
		return this.configurationService.getValue<ISemanticTokenColorCustomizations>(ThemeSettings.SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS);
	}

	public getPreferredColorScheme(): ColorScheme | undefined {
		if (this.configurationService.getValue(ThemeSettings.DETECT_HC) && this.hostColorService.highContrast) {
			return this.hostColorService.dark ? ColorScheme.HIGH_CONTRAST_DARK : ColorScheme.HIGH_CONTRAST_LIGHT;
		}
		if (this.isDetectingColorScheme()) {
			return this.hostColorService.dark ? ColorScheme.DARK : ColorScheme.LIGHT;
		}
		return undefined;
	}

	public isDetectingHighContrast(): boolean {
		return this.configurationService.getValue(ThemeSettings.DETECT_HC);
	}

	public isDetectingColorScheme(): boolean {
		return this.configurationService.getValue(ThemeSettings.DETECT_COLOR_SCHEME);
	}

	public isPreferredColorSchemeChange(previous: IColorScheme): boolean {
		const darkChanged = previous.dark !== this.hostColorService.dark;
		if (this.isDetectingColorScheme() && darkChanged) {
			return true;
		}
		if (this.isDetectingHighContrast()) {
			return previous.highContrast !== this.hostColorService.highContrast || (this.hostColorService.highContrast && darkChanged);
		}
		return false;
	}

	public getColorThemeSettingId(): ThemeSettings {
		const preferredScheme = this.getPreferredColorScheme();
		return preferredScheme ? colorSchemeToPreferred[preferredScheme] : ThemeSettings.COLOR_THEME;
	}

	public async setColorTheme(theme: IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme> {
		await this.writeConfiguration(this.getColorThemeSettingId(), theme.settingsId, settingsTarget);
		return theme;
	}

	public async setFileIconTheme(theme: IWorkbenchFileIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchFileIconTheme> {
		await this.writeConfiguration(ThemeSettings.FILE_ICON_THEME, theme.settingsId, settingsTarget);
		return theme;
	}

	public async setProductIconTheme(theme: IWorkbenchProductIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchProductIconTheme> {
		await this.writeConfiguration(ThemeSettings.PRODUCT_ICON_THEME, theme.settingsId, settingsTarget);
		return theme;
	}

	public isDefaultColorTheme(): boolean {
		const settings = this.configurationService.inspect(this.getColorThemeSettingId());
		return settings && settings.default?.value === settings.value;
	}

	public findAutoConfigurationTarget(key: string) {
		const settings = this.configurationService.inspect(key);
		if (!types.isUndefined(settings.workspaceFolderValue)) {
			return ConfigurationTarget.WORKSPACE_FOLDER;
		} else if (!types.isUndefined(settings.workspaceValue)) {
			return ConfigurationTarget.WORKSPACE;
		} else if (!types.isUndefined(settings.userRemoteValue)) {
			return ConfigurationTarget.USER_REMOTE;
		}
		return ConfigurationTarget.USER;
	}

	private async writeConfiguration(key: string, value: unknown, settingsTarget: ThemeSettingTarget): Promise<void> {
		if (settingsTarget === undefined || settingsTarget === 'preview') {
			return;
		}

		const settings = this.configurationService.inspect(key);
		if (settingsTarget === 'auto') {
			return this.configurationService.updateValue(key, value);
		}

		if (settingsTarget === ConfigurationTarget.USER) {
			if (value === settings.userValue) {
				return Promise.resolve(undefined); // nothing to do
			} else if (value === settings.defaultValue) {
				if (types.isUndefined(settings.userValue)) {
					return Promise.resolve(undefined); // nothing to do
				}
				value = undefined; // remove configuration from user settings
			}
		} else if (settingsTarget === ConfigurationTarget.WORKSPACE || settingsTarget === ConfigurationTarget.WORKSPACE_FOLDER || settingsTarget === ConfigurationTarget.USER_REMOTE) {
			if (value === settings.value) {
				return Promise.resolve(undefined); // nothing to do
			}
		}
		return this.configurationService.updateValue(key, value, settingsTarget);
	}
}
