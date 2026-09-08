/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';
import * as objects from '../../../base/common/objects.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import { ExtensionsRegistry, IExtensionPointUser } from '../../services/extensions/common/extensionsRegistry.js';
import { IConfigurationNode, IConfigurationRegistry, Extensions, validateProperty, ConfigurationScope, OVERRIDE_PROPERTY_REGEX, IConfigurationDefaults, configurationDefaultsSchemaId, IConfigurationDelta, getDefaultValue, getAllConfigurationProperties, parseScope, EXTENSION_UNIFICATION_EXTENSION_IDS, overrideIdentifiersFromKey } from '../../../platform/configuration/common/configurationRegistry.js';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from '../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { workspaceSettingsSchemaId, launchSchemaId, tasksSchemaId, mcpSchemaId } from '../../services/configuration/common/configuration.js';
import { hasKey, isObject, isUndefined } from '../../../base/common/types.js';
import { ExtensionIdentifierMap, IExtensionManifest } from '../../../platform/extensions/common/extensions.js';
import { IStringDictionary } from '../../../base/common/collections.js';
import { Extensions as ExtensionFeaturesExtensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../services/extensionManagement/common/extensionFeatures.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';
import product from '../../../platform/product/common/product.js';
import { isProposedApiEnabled } from '../../services/extensions/common/extensions.js';

const jsonRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

const configurationEntrySchema: IJSONSchema = {
	type: 'object',
	defaultSnippets: [{ body: { title: '', properties: {} } }],
	properties: {
		title: {
			description: nls.localize('vscode.extension.contributes.configuration.title', '当前设置类别的标题。此标签将在“设置”编辑器中以副标题形式呈现。如果标题与扩展显示名称相同，则类别将分组到主扩展标题下。'),
			type: 'string'
		},
		order: {
			description: nls.localize('vscode.extension.contributes.configuration.order', '指定后，提供此类别的设置相对于其他类别的顺序。'),
			type: 'integer'
		},
		properties: {
			description: nls.localize('vscode.extension.contributes.configuration.properties', '配置属性的描述。'),
			type: 'object',
			propertyNames: {
				pattern: '\\S+',
				patternErrorMessage: nls.localize('vscode.extension.contributes.configuration.property.empty', '属性不应为空。'),
			},
			additionalProperties: {
				anyOf: [
					{
						title: nls.localize('vscode.extension.contributes.configuration.properties.schema', '配置属性的架构。'),
						$ref: 'http://json-schema.org/draft-07/schema#'
					},
					{
						type: 'object',
						properties: {
							scope: {
								type: 'string',
								enum: ['application', 'machine', 'window', 'resource', 'language-overridable', 'machine-overridable'],
								default: 'window',
								enumDescriptions: [
									nls.localize('scope.application.description', "只能在用户设置中进行配置的配置。"),
									nls.localize('scope.machine.description', "只能在用户设置或远程设置中配置的配置。"),
									nls.localize('scope.window.description', "可在用户、远程或工作区设置中对其进行配置的配置。"),
									nls.localize('scope.resource.description', "可在用户、远程、工作区或文件夹设置中对其进行配置的配置。"),
									nls.localize('scope.language-overridable.description', "可在语言特定设置中配置的资源配置。"),
									nls.localize('scope.machine-overridable.description', "也可在工作区或文件夹设置中配置的计算机配置。")
								],
								markdownDescription: nls.localize('scope.description', "配置适用的作用域。可用作用域包括\"application\"、\"machine\"、\"window\"、\"resource\"和\"machine-overridable\"。")
							},
							enumDescriptions: {
								type: 'array',
								items: {
									type: 'string',
								},
								description: nls.localize('scope.enumDescriptions', '枚举值的说明')
							},
							markdownEnumDescriptions: {
								type: 'array',
								items: {
									type: 'string',
								},
								description: nls.localize('scope.markdownEnumDescriptions', 'Markdown 格式的枚举值说明。')
							},
							enumItemLabels: {
								type: 'array',
								items: {
									type: 'string'
								},
								markdownDescription: nls.localize('scope.enumItemLabels', '要在“设置”编辑器中显示的枚举值的标签。指定后，{0}值仍显示在标签之后，但突出显示较少。', '`enum`')
							},
							markdownDescription: {
								type: 'string',
								description: nls.localize('scope.markdownDescription', 'Markdown 格式的说明。')
							},
							deprecationMessage: {
								type: 'string',
								description: nls.localize('scope.deprecationMessage', '设置后，该属性将被标记为已弃用，并将给定的消息显示为解释。')
							},
							markdownDeprecationMessage: {
								type: 'string',
								description: nls.localize('scope.markdownDeprecationMessage', '设置后，该属性将被标记为已弃用，并按 Markdown 格式显示给定的消息作为解释。')
							},
							editPresentation: {
								type: 'string',
								enum: ['singlelineText', 'multilineText'],
								enumDescriptions: [
									nls.localize('scope.singlelineText.description', '该值将显示在输入框中。'),
									nls.localize('scope.multilineText.description', '该值将显示在文本区域中。')
								],
								default: 'singlelineText',
								description: nls.localize('scope.editPresentation', '指定后，控制字符串设置的表示格式。')
							},
							order: {
								type: 'integer',
								description: nls.localize('scope.order', '指定后，提供此设置相对于同一类别中其他设置的顺序。在未设置此属性的设置之前，将放置具有顺序属性的设置。')
							},
							ignoreSync: {
								type: 'boolean',
								description: nls.localize('scope.ignoreSync', '启用后，“设置同步”默认不会同步此配置的用户值。')
							},
							keywords: {
								type: 'array',
								items: {
									type: 'string'
								},
								description: nls.localize('scope.keywords', '可帮助用户在“设置”编辑器中找到此设置的关键字列表。不会向用户显示这些内容。')
							},
							tags: {
								type: 'array',
								items: {
									type: 'string',
									enum: [
										'accessibility',
										'advanced',
										'experimental',
										'telemetry',
										'usesOnlineServices',
									],
									enumDescriptions: [
										nls.localize('accessibility', '辅助功能设置'),
										nls.localize('advanced', '高级设置在设置编辑器中默认隐藏，除非用户选择显示高级设置。'),
										nls.localize('experimental', '实验性设置可能会发生变更，且可能在未来版本中移除。'),
										nls.localize('preview', '预览设置可在新功能最终确定前用于试用这些功能。'),
										nls.localize('telemetry', '遥测设置'),
										nls.localize('usesOnlineServices', '使用联机服务的设置')
									],
								},
								additionalItems: true,
								markdownDescription: nls.localize('scope.tags', '设置所属的标签列表。然后可以在设置编辑器中搜索到该标签。例如，指定 `experimental` 标签后，可以通过搜索 `@tag:experimental` 找到该设置。'),
							},
							agentsWindow: {
								type: 'object',
								markdownDescription: nls.localize('scope.agentsWindow', "智能体窗口的配置覆盖。允许在智能体窗口中运行时，为此设置指定不同的默认值和只读行为。\r\n\r\n**注意**: 这是一个建议的 API。要使用它，扩展必须在 `enabledApiProposals` 中包含 `agentsWindowConfiguration`。"),
								properties: {
									'default': {
										description: nls.localize('scope.agentsWindow.default', '此设置在智能体窗口中的默认值。'),
									},
									readOnly: {
										type: 'boolean',
										description: nls.localize('scope.agentsWindow.readOnly', '为 true 时，用户无法在智能体窗口中更改此设置。'),
										default: false,
									}
								},
								additionalProperties: false
							}
						}
					}
				]
			}
		}
	}
};

// build up a delta across two ext points and only apply it once
let _configDelta: IConfigurationDelta | undefined;


// BEGIN VSCode extension point `configurationDefaults`
const defaultConfigurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IStringDictionary<IStringDictionary<unknown>>>({
	extensionPoint: 'configurationDefaults',
	jsonSchema: {
		$ref: configurationDefaultsSchemaId,
	},
	canHandleResolver: true
});
defaultConfigurationExtPoint.setHandler((extensions, { added, removed }) => {

	if (_configDelta) {
		// HIGHLY unlikely, but just in case
		configurationRegistry.deltaConfiguration(_configDelta);
	}

	const configNow = _configDelta = {};
	// schedule a HIGHLY unlikely task in case only the default configurations EXT point changes
	queueMicrotask(() => {
		if (_configDelta === configNow) {
			configurationRegistry.deltaConfiguration(_configDelta);
			_configDelta = undefined;
		}
	});

	if (removed.length) {
		const removedDefaultConfigurations = removed.map<IConfigurationDefaults>(extension => ({ overrides: objects.deepClone(extension.value), source: { id: extension.description.identifier.value, displayName: extension.description.displayName } }));
		_configDelta.removedDefaults = removedDefaultConfigurations;
	}
	if (added.length) {
		const registeredProperties = configurationRegistry.getConfigurationProperties();
		const allowedScopes = [ConfigurationScope.MACHINE_OVERRIDABLE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
		const addedDefaultConfigurations = added.map<IConfigurationDefaults>(extension => {
			const overrides = objects.deepClone(extension.value);
			for (const key of Object.keys(overrides)) {
				const registeredPropertyScheme = registeredProperties[key];
				if (registeredPropertyScheme?.disallowConfigurationDefault) {
					extension.collector.warn(nls.localize('config.property.preventDefaultConfiguration.warning', "无法注册“{0}”的配置默认值。此设置不允许提供配置默认值。", key));
					delete overrides[key];
					continue;
				}
				if (!OVERRIDE_PROPERTY_REGEX.test(key)) {
					if (registeredPropertyScheme?.scope && !allowedScopes.includes(registeredPropertyScheme.scope)) {
						extension.collector.warn(nls.localize('config.property.defaultConfiguration.warning', "无法注册“{0}”的配置默认值。仅支持可重写计算机、窗口、资源和可重写语言范围设置的默认值。", key));
						delete overrides[key];
						continue;
					}
				}
			}
			return { overrides, source: { id: extension.description.identifier.value, displayName: extension.description.displayName } };
		});
		_configDelta.addedDefaults = addedDefaultConfigurations;
	}
});
// END VSCode extension point `configurationDefaults`


// BEGIN VSCode extension point `configuration`
const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint<IConfigurationNode>({
	extensionPoint: 'configuration',
	deps: [defaultConfigurationExtPoint],
	jsonSchema: {
		description: nls.localize('vscode.extension.contributes.configuration', '用于配置字符串。'),
		oneOf: [
			configurationEntrySchema,
			{
				type: 'array',
				items: configurationEntrySchema
			}
		]
	},
	canHandleResolver: true
});

const extensionConfigurations: ExtensionIdentifierMap<IConfigurationNode[]> = new ExtensionIdentifierMap<IConfigurationNode[]>();

configurationExtPoint.setHandler((extensions, { added, removed }) => {

	// HIGHLY unlikely (only configuration but not defaultConfiguration EXT point changes)
	_configDelta ??= {};

	if (removed.length) {
		const removedConfigurations: IConfigurationNode[] = [];
		for (const extension of removed) {
			removedConfigurations.push(...(extensionConfigurations.get(extension.description.identifier) || []));
			extensionConfigurations.delete(extension.description.identifier);
		}
		_configDelta.removedConfigurations = removedConfigurations;
	}

	const seenProperties = new Set<string>();

	function handleConfiguration(node: IConfigurationNode, extension: IExtensionPointUser<unknown>): IConfigurationNode {
		const configuration = objects.deepClone(node);

		if (configuration.title && (typeof configuration.title !== 'string')) {
			extension.collector.error(nls.localize('invalid.title', "configuration.title 必须是字符串"));
		}

		validateProperties(configuration, extension);

		configuration.id = node.id || extension.description.identifier.value;
		configuration.extensionInfo = { id: extension.description.identifier.value, displayName: extension.description.displayName };
		configuration.restrictedProperties = extension.description.capabilities?.untrustedWorkspaces?.supported === 'limited' ? extension.description.capabilities?.untrustedWorkspaces.restrictedConfigurations : undefined;
		configuration.title = configuration.title || extension.description.displayName || extension.description.identifier.value;
		return configuration;
	}

	function validateProperties(configuration: IConfigurationNode, extension: IExtensionPointUser<unknown>): void {
		const properties = configuration.properties;
		const extensionConfigurationPolicy = product.extensionConfigurationPolicy;
		if (properties) {
			if (typeof properties !== 'object') {
				extension.collector.error(nls.localize('invalid.properties', "configuration.properties 必须是对象"));
				configuration.properties = {};
			}
			for (const key in properties) {
				const propertyConfiguration = properties[key];
				const message = validateProperty(key, propertyConfiguration, extension.description.identifier.value);
				if (message) {
					delete properties[key];
					extension.collector.warn(message);
					continue;
				}
				if (seenProperties.has(key) && !EXTENSION_UNIFICATION_EXTENSION_IDS.has(extension.description.identifier.value.toLowerCase())) {
					delete properties[key];
					extension.collector.warn(nls.localize('config.property.duplicate', "无法注册“{0}”。此属性已注册。", key));
					continue;
				}
				if (!isObject(propertyConfiguration)) {
					delete properties[key];
					extension.collector.error(nls.localize('invalid.property', "配置对象属性“{0}”必须是对象", key));
					continue;
				}
				const policyEntry = extensionConfigurationPolicy?.[key];
				if (policyEntry) {
					// A reference entry carries a `policyReference` pointer; a full (owner/"parent")
					// entry declares the policy inline. References attach this setting to a policy
					// *owned* by an in-code setting (whose `value` callback JSON cannot carry).
					if (hasKey(policyEntry, { policyReference: true })) {
						propertyConfiguration.policyReference = policyEntry.policyReference;
					} else {
						propertyConfiguration.policy = policyEntry;
					}
				}
				if (propertyConfiguration.tags?.some(tag => tag.toLowerCase() === 'onexp')) {
					propertyConfiguration.experiment = {
						mode: 'startup'
					};
				}
				if (propertyConfiguration.agentsWindow && !isProposedApiEnabled(extension.description, 'agentsWindowConfiguration')) {
					extension.collector.error(nls.localize('config.property.agentsWindow.proposed', "如果未启用 \"agentsWindowConfiguration\" API 建议，扩展“{0}”无法在配置“{1}”上使用 \"agentsWindow\" 属性。", extension.description.identifier.value, key));
					delete propertyConfiguration.agentsWindow;
				}
				seenProperties.add(key);
				propertyConfiguration.scope = propertyConfiguration.scope ? parseScope(propertyConfiguration.scope.toString()) : ConfigurationScope.WINDOW;
			}
		}
		const subNodes = configuration.allOf;
		if (subNodes) {
			extension.collector.error(nls.localize('invalid.allOf', "\"configuration.allOf\" 已被弃用且不应被使用。你可以将多个配置单元作为数组传递给 \"configuration\" 参与点。"));
			for (const node of subNodes) {
				validateProperties(node, extension);
			}
		}
	}

	if (added.length) {
		const addedConfigurations: IConfigurationNode[] = [];
		for (const extension of added) {
			const configurations: IConfigurationNode[] = [];
			const value = <IConfigurationNode | IConfigurationNode[]>extension.value;
			if (Array.isArray(value)) {
				value.forEach(v => configurations.push(handleConfiguration(v, extension)));
			} else {
				configurations.push(handleConfiguration(value, extension));
			}
			extensionConfigurations.set(extension.description.identifier, configurations);
			addedConfigurations.push(...configurations);
		}

		_configDelta.addedConfigurations = addedConfigurations;
	}

	configurationRegistry.deltaConfiguration(_configDelta);
	_configDelta = undefined;
});
// END VSCode extension point `configuration`

jsonRegistry.registerSchema('vscode://schemas/workspaceConfig', {
	allowComments: true,
	allowTrailingCommas: true,
	default: {
		folders: [
			{
				path: ''
			}
		],
		settings: {
		}
	},
	required: ['folders'],
	properties: {
		'folders': {
			minItems: 0,
			uniqueItems: true,
			description: nls.localize('workspaceConfig.folders.description', "将载入到工作区的文件夹列表。"),
			items: {
				type: 'object',
				defaultSnippets: [{ body: { path: '$1' } }],
				oneOf: [{
					properties: {
						path: {
							type: 'string',
							description: nls.localize('workspaceConfig.path.description', "文件路径。例如 \"/root/folderA\" 或 \"./folderA\"。后者表示根据工作区文件位置进行解析的相对路径。")
						},
						name: {
							type: 'string',
							description: nls.localize('workspaceConfig.name.description', "文件夹的可选名称。")
						}
					},
					required: ['path']
				}, {
					properties: {
						uri: {
							type: 'string',
							description: nls.localize('workspaceConfig.uri.description', "文件夹的 URI")
						},
						name: {
							type: 'string',
							description: nls.localize('workspaceConfig.name.description', "文件夹的可选名称。")
						}
					},
					required: ['uri']
				}]
			}
		},
		'settings': {
			type: 'object',
			default: {},
			description: nls.localize('workspaceConfig.settings.description', "工作区设置"),
			$ref: workspaceSettingsSchemaId
		},
		'launch': {
			type: 'object',
			default: { configurations: [], compounds: [] },
			description: nls.localize('workspaceConfig.launch.description', "工作区启动配置"),
			$ref: launchSchemaId
		},
		'tasks': {
			type: 'object',
			default: { version: '2.0.0', tasks: [] },
			description: nls.localize('workspaceConfig.tasks.description', "工作区任务配置"),
			$ref: tasksSchemaId
		},
		'mcp': {
			type: 'object',
			default: {
				inputs: [],
				servers: {
					'mcp-server-time': {
						command: 'uvx',
						args: ['mcp_server_time', '--local-timezone=America/Los_Angeles']
					}
				}
			},
			description: nls.localize('workspaceConfig.mcp.description', "模型上下文协议服务器配置"),
			$ref: mcpSchemaId
		},
		'extensions': {
			type: 'object',
			default: {},
			description: nls.localize('workspaceConfig.extensions.description', "工作区扩展"),
			$ref: 'vscode://schemas/extensions'
		},
		'remoteAuthority': {
			type: 'string',
			doNotSuggest: true,
			description: nls.localize('workspaceConfig.remoteAuthority', "工作区所在的远程服务器。"),
		},
		'transient': {
			type: 'boolean',
			doNotSuggest: true,
			description: nls.localize('workspaceConfig.transient', "重启或重新加载时，暂时性工作区将消失。"),
		}
	},
	errorMessage: nls.localize('unknownWorkspaceProperty', "未知的工作区配置属性")
});


class SettingsTableRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.configuration;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const configuration: IConfigurationNode[] = manifest.contributes?.configuration
			? Array.isArray(manifest.contributes.configuration) ? manifest.contributes.configuration : [manifest.contributes.configuration]
			: [];

		const properties = getAllConfigurationProperties(configuration);

		const contrib = properties ? Object.keys(properties) : [];
		const headers = [nls.localize('setting name', "ID"), nls.localize('description', "说明"), nls.localize('default', "默认值")];
		const rows: IRowData[][] = contrib.sort((a, b) => a.localeCompare(b))
			.map(key => {
				return [
					new MarkdownString().appendMarkdown(`\`${key}\``),
					properties[key].markdownDescription ? new MarkdownString(properties[key].markdownDescription, false) : properties[key].description ?? '',
					new MarkdownString().appendCodeblock('json', JSON.stringify(isUndefined(properties[key].default) ? getDefaultValue(properties[key].type) : properties[key].default, null, 2)),
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

Registry.as<IExtensionFeaturesRegistry>(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'configuration',
	label: nls.localize('settings', "设置"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(SettingsTableRenderer),
});

class ConfigurationDefaultsTableRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.configurationDefaults;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const configurationDefaults = manifest.contributes?.configurationDefaults ?? {};

		const headers = [nls.localize('language', "语言"), nls.localize('setting', "设置"), nls.localize('default override value', "替代值")];
		const rows: IRowData[][] = [];

		for (const key of Object.keys(configurationDefaults).sort((a, b) => a.localeCompare(b))) {
			const value = configurationDefaults[key];
			if (OVERRIDE_PROPERTY_REGEX.test(key)) {
				const languages = overrideIdentifiersFromKey(key);
				const languageMarkdown = new MarkdownString().appendMarkdown(`${languages.join(', ')}`);
				for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
					const row: IRowData[] = [];
					row.push(languageMarkdown);
					row.push(new MarkdownString().appendMarkdown(`\`${key}\``));
					row.push(new MarkdownString().appendCodeblock('json', JSON.stringify(value[key], null, 2)));
					rows.push(row);
				}
			} else {
				const row: IRowData[] = [];
				row.push('');
				row.push(new MarkdownString().appendMarkdown(`\`${key}\``));
				row.push(new MarkdownString().appendCodeblock('json', JSON.stringify(value, null, 2)));
				rows.push(row);
			}
		}

		return {
			data: {
				headers,
				rows
			},
			dispose: () => { }
		};
	}
}

Registry.as<IExtensionFeaturesRegistry>(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'configurationDefaults',
	label: nls.localize('settings default overrides', "默认设置覆盖"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(ConfigurationDefaultsTableRenderer),
});
