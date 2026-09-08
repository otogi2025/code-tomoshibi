/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { isNative, isWeb } from '../../../../base/common/platform.js';
import { PolicyCategory } from '../../../../base/common/policy.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ExtensionGalleryServiceUrlConfigKey } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { EXTENSION_INSTALL_SOURCE_CONTEXT, ExtensionInstallSource, ExtensionRequestsTimeoutConfigKey, IExtensionGalleryService, IExtensionManagementService, VerifyExtensionSignatureConfigKey } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions, getIdAndVersion } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionStorageService } from '../../../../platform/extensionManagement/common/extensionStorage.js';
import { ExtensionType } from '../../../../platform/extensions/common/extensions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import product from '../../../../platform/product/common/product.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { Extensions as ConfigurationMigrationExtensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { EnablementState, IPublisherInfo, IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { EXTENSIONS_SUPPORT_AGENTS_WINDOW } from '../../../services/extensions/common/extensionManifestPropertiesService.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { WORKSPACE_TRUST_EXTENSION_SUPPORT } from '../../../services/workspaces/common/workspaceTrust.js';
import { AutoRestartConfigurationKey, AutoUpdateConfigurationKey, ExtensionEditorTab, IExtensionsWorkbenchService, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID } from '../common/extensions.js';
import { ExtensionsWorkbenchService } from './extensionsWorkbenchService.js';

// Singletons
registerSingleton(IExtensionsWorkbenchService, ExtensionsWorkbenchService, InstantiationType.Eager /* Auto updates extensions */);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		id: 'extensions',
		order: 30,
		title: localize('extensionsConfigurationTitle', "扩展"),
		type: 'object',
		properties: {
			'extensions.autoUpdate': {
				type: 'string',
				enum: ['on', 'off'],
				enumDescriptions: [
					localize('extensions.autoUpdate.on', '仅为启用的扩展自动下载和安装更新。'),
					localize('extensions.autoUpdate.off', '扩展不会自动更新。'),
				],
				description: localize('extensions.autoUpdate', "控制扩展的自动更新行为。更新是从 Microsoft 联机服务中获取的。"),
				default: 'on',
				scope: ConfigurationScope.APPLICATION,
				tags: ['usesOnlineServices'],
				policy: {
					name: 'ExtensionsAutoUpdate',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.125',
					localization: {
						description: {
							key: 'extensions.autoUpdate',
							value: localize('extensions.autoUpdate', "控制扩展的自动更新行为。更新是从 Microsoft 联机服务中获取的。"),
						},
						enumDescriptions: [
							{
								key: 'extensions.autoUpdate.on',
								value: localize('extensions.autoUpdate.on', '仅为启用的扩展自动下载和安装更新。'),
							},
							{
								key: 'extensions.autoUpdate.off',
								value: localize('extensions.autoUpdate.off', '扩展不会自动更新。'),
							},
						]
					}
				}
			},
			'extensions.autoUpdateDelay': {
				type: 'number',
				default: 2,
				minimum: 0,
				markdownDescription: localize('extensions.autoUpdateDelay', "控制扩展更新发布后，在自动安装前延迟的小时数。仅当 `#extensions.autoUpdate#` 设置为 `on` 时适用。此延迟有助于避免在发布后立即安装可能有问题的更新。"),
				scope: ConfigurationScope.APPLICATION,
				policy: {
					name: 'ExtensionsAutoUpdateDelay',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.125',
					localization: {
						description: {
							key: 'extensions.autoUpdateDelay',
							value: localize('extensions.autoUpdateDelay', "控制扩展更新发布后，在自动安装前延迟的小时数。仅当 `#extensions.autoUpdate#` 设置为 `on` 时适用。此延迟有助于避免在发布后立即安装可能有问题的更新。"),
						}
					}
				}
			},
			'extensions.autoCheckUpdates': {
				type: 'boolean',
				description: localize('extensionsCheckUpdates', "启用后，将自动检查扩展更新。若扩展存在更新，将在“扩展”视图中将其标记为过时扩展。更新将从 Microsoft 联机服务中获取。"),
				default: true,
				scope: ConfigurationScope.APPLICATION,
				tags: ['usesOnlineServices']
			},
			'extensions.confirmedUriHandlerExtensionIds': {
				type: 'array',
				items: {
					type: 'string'
				},
				description: localize('handleUriConfirmedExtensions', "当此处列出扩展名时，该扩展名处理URI时将不会显示确认提示。"),
				default: [],
				scope: ConfigurationScope.APPLICATION
			},
			'extensions.webWorker': {
				type: ['boolean', 'string'],
				enum: [true, false, 'auto'],
				enumDescriptions: [
					localize('extensionsWebWorker.true', "Web 辅助角色扩展主机将始终启动。"),
					localize('extensionsWebWorker.false', "Web 辅助角色扩展主机将永远不会启动。"),
					localize('extensionsWebWorker.auto', "Web 辅助角色扩展主机将在 Web 扩展需要时启动。"),
				],
				description: localize('extensionsWebWorker', "启用 Web Worker 扩展主机。"),
				default: 'auto'
			},
			'extensions.supportVirtualWorkspaces': {
				type: 'object',
				markdownDescription: localize('extensions.supportVirtualWorkspaces', "替代扩展的虚拟工作区支持。"),
				patternProperties: {
					'([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
						type: 'boolean',
						default: false
					}
				},
				additionalProperties: false,
				default: {},
				defaultSnippets: [{
					'body': {
						'pub.name': false
					}
				}]
			},
			[EXTENSIONS_SUPPORT_AGENTS_WINDOW]: {
				type: 'object',
				scope: ConfigurationScope.APPLICATION,
				markdownDescription: localize('extensions.supportAgentsWindow', "覆盖智能体窗口对扩展的支持。使用 `true` 的扩展将在智能体窗口中启用，即使它们原本会被禁用。"),
				patternProperties: {
					'([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
						type: 'boolean',
						default: false
					}
				},
				additionalProperties: false,
				default: {},
				defaultSnippets: [{
					'body': {
						'pub.name': true
					}
				}]
			},
			'extensions.experimental.affinity': {
				type: 'object',
				markdownDescription: localize('extensions.affinity', "配置要在其他扩展主机进程中执行的扩展。"),
				patternProperties: {
					'([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
						type: 'integer',
						default: 1
					}
				},
				additionalProperties: false,
				default: {},
				defaultSnippets: [{
					'body': {
						'pub.name': 1
					}
				}]
			},
			[WORKSPACE_TRUST_EXTENSION_SUPPORT]: {
				type: 'object',
				scope: ConfigurationScope.APPLICATION,
				markdownDescription: localize('extensions.supportUntrustedWorkspaces', "替代扩展的不受信任的工作区支持。将始终启用使用 “true” 的扩展。将始终启用使用 “limited” 的扩展，并且扩展将隐藏需要信任的功能。仅当工作区受信任时才会启用使用 “false” 的扩展。"),
				patternProperties: {
					'([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$': {
						type: 'object',
						properties: {
							'supported': {
								type: ['boolean', 'string'],
								enum: [true, false, 'limited'],
								enumDescriptions: [
									localize('extensions.supportUntrustedWorkspaces.true', "将始终启用扩展。"),
									localize('extensions.supportUntrustedWorkspaces.false', "只有在工作区受信任时才会启用扩展。"),
									localize('extensions.supportUntrustedWorkspaces.limited', "将始终启用扩展，并且扩展将隐藏需要信任的功能。"),
								],
								description: localize('extensions.supportUntrustedWorkspaces.supported', "定义扩展的不受信任的工作区支持设置。"),
							},
							'version': {
								type: 'string',
								description: localize('extensions.supportUntrustedWorkspaces.version', "定义应应用替代的扩展的版本。如果未指定，则将在独立于扩展版本的情况下应用替代。"),
							}
						}
					}
				}
			},
			'extensions.experimental.deferredStartupFinishedActivation': {
				type: 'boolean',
				description: localize('extensionsDeferredStartupFinishedActivation', "启用后，将在超时后激活声明“onStartupFinished”激活事件的扩展。"),
				default: false
			},
			'extensions.allowOpenInModalEditor': {
				type: 'boolean',
				description: localize('extensions.allowOpenInModalEditor', "控制扩展和 MCP 服务器是否在模式编辑器覆盖层中打开。"),
				default: false,
				tags: ['experimental'],
				experiment: {
					mode: 'auto'
				}
			},
			[VerifyExtensionSignatureConfigKey]: {
				type: 'boolean',
				description: localize('extensions.verifySignature', "启用后，将在安装之前验证扩展是否已签名。"),
				default: true,
				scope: ConfigurationScope.APPLICATION,
				included: isNative
			},
			[AutoRestartConfigurationKey]: {
				type: 'boolean',
				description: localize('autoRestart', "激活后，如果窗口不在焦点中，扩展将在更新后自动重启。如果已打开 Notebooks 或自定义编辑器，则可能会丢失数据。"),
				default: false,
				included: product.quality !== 'stable'
			},
			[ExtensionGalleryServiceUrlConfigKey]: {
				type: 'string',
				description: localize('extensions.gallery.serviceUrl', "配置要连接到的市场服务 URL"),
				default: '',
				scope: ConfigurationScope.APPLICATION,
				tags: ['usesOnlineServices'],
				included: false,
				policy: {
					name: 'ExtensionGalleryServiceUrl',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.99',
					localization: {
						description: {
							key: 'extensions.gallery.serviceUrl',
							value: localize('extensions.gallery.serviceUrl', "配置要连接到的市场服务 URL"),
						}
					}
				},
			},
			'extensions.supportNodeGlobalNavigator': {
				type: 'boolean',
				description: localize('extensionsSupportNodeGlobalNavigator', "启用后，Node.js 导航器对象将在全局作用域中可用。"),
				default: false,
			},
			[ExtensionRequestsTimeoutConfigKey]: {
				type: 'number',
				description: localize('extensionsRequestTimeout', "控制从商城获取扩展时发出 HTTP 请求的超时时间(毫秒)"),
				default: 60_000,
				scope: ConfigurationScope.APPLICATION,
				tags: ['advanced', 'usesOnlineServices']
			},
		}
	});

// Register Commands
CommandsRegistry.registerCommand('_extensions.manage', (accessor: ServicesAccessor, extensionId: string, tab?: ExtensionEditorTab, preserveFocus?: boolean, feature?: string) => {
	const extensionService = accessor.get(IExtensionsWorkbenchService);
	const extension = extensionService.local.find(e => areSameExtensions(e.identifier, { id: extensionId }));
	if (extension) {
		extensionService.open(extension, { tab, preserveFocus, feature });
	} else {
		throw new Error(localize('notFound', "找不到扩展“{0}”。", extensionId));
	}
});

CommandsRegistry.registerCommand('extension.open', async (accessor: ServicesAccessor, extensionId: string, tab?: ExtensionEditorTab, preserveFocus?: boolean, feature?: string, sideByside?: boolean) => {
	const extensionService = accessor.get(IExtensionsWorkbenchService);
	const commandService = accessor.get(ICommandService);

	const [extension] = await extensionService.getExtensions([{ id: extensionId }], CancellationToken.None);
	if (extension) {
		return extensionService.open(extension, { tab, preserveFocus, feature, sideByside });
	}

	return commandService.executeCommand('_extensions.manage', extensionId, tab, preserveFocus, feature);
});

CommandsRegistry.registerCommand({
	id: 'workbench.extensions.installExtension',
	metadata: {
		description: localize('workbench.extensions.installExtension.description', "安装给定的扩展"),
		args: [
			{
				name: 'extensionIdOrVSIXUri',
				description: localize('workbench.extensions.installExtension.arg.decription', "扩展 ID 或 VSIX 资源 URI"),
				constraint: (value: any) => typeof value === 'string' || value instanceof URI,
			},
			{
				name: 'options',
				description: '(optional) Options for installing the extension. Object with the following properties: ' +
					'`installOnlyNewlyAddedFromExtensionPackVSIX`: When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only when installing VSIX. ',
				isOptional: true,
				schema: {
					'type': 'object',
					'properties': {
						'installOnlyNewlyAddedFromExtensionPackVSIX': {
							'type': 'boolean',
							'description': localize('workbench.extensions.installExtension.option.installOnlyNewlyAddedFromExtensionPackVSIX', "启用后，VS Code 仅安装来自扩展包 VSIX 的新添加的扩展。仅在安装 VSIX 时才考虑此选项。"),
							default: false
						},
						'installPreReleaseVersion': {
							'type': 'boolean',
							'description': localize('workbench.extensions.installExtension.option.installPreReleaseVersion', "启用后，VS Code 将安装扩展的预发布版本(如果可用)。"),
							default: false
						},
						'justification': {
							'type': ['string', 'object'],
							'description': localize('workbench.extensions.installExtension.option.justification', "安装扩展的理由。这是可用于将任何信息传递给安装处理程序的字符串或对象。即 `{原因: '此扩展要打开 URI'，操作: '打开 URI'}` 将显示一个消息框，其中包含安装时的原因和操作。"),
						},
						'enable': {
							'type': 'boolean',
							'description': localize('workbench.extensions.installExtension.option.enable', "启用后，如果安装了该扩展但已将其禁用，则将启用该扩展。如果已启用该扩展，则该操作不起作用。"),
							default: false
						}
					}
				}
			}
		]
	},
	handler: async (
		accessor,
		arg: string | UriComponents,
		options?: {
			installOnlyNewlyAddedFromExtensionPackVSIX?: boolean;
			installPreReleaseVersion?: boolean;
			donotSync?: boolean;
			justification?: string | { reason: string; action: string };
			enable?: boolean;
		}) => {
		const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
		const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
		const extensionGalleryService = accessor.get(IExtensionGalleryService);
		try {
			if (typeof arg === 'string') {
				const [id, version] = getIdAndVersion(arg);
				const extension = extensionsWorkbenchService.local.find(e => areSameExtensions(e.identifier, { id, uuid: version }));
				if (extension?.enablementState === EnablementState.DisabledByExtensionKind) {
					const [gallery] = await extensionGalleryService.getExtensions([{ id, preRelease: options?.installPreReleaseVersion }], CancellationToken.None);
					if (!gallery) {
						throw new Error(localize('notFound', "找不到扩展“{0}”。", arg));
					}
					await extensionManagementService.installFromGallery(gallery, {
						isMachineScoped: options?.donotSync ? true : undefined, /* do not allow syncing extensions automatically while installing through the command */
						installPreReleaseVersion: options?.installPreReleaseVersion,
						installGivenVersion: !!version,
						context: { [EXTENSION_INSTALL_SOURCE_CONTEXT]: ExtensionInstallSource.COMMAND },
					});
				} else {
					await extensionsWorkbenchService.install(id, {
						version,
						installPreReleaseVersion: options?.installPreReleaseVersion,
						context: { [EXTENSION_INSTALL_SOURCE_CONTEXT]: ExtensionInstallSource.COMMAND },
						justification: options?.justification,
						enable: options?.enable,
						isMachineScoped: options?.donotSync ? true : undefined, /* do not allow syncing extensions automatically while installing through the command */
					}, ProgressLocation.Notification);
				}
			} else {
				const vsix = URI.revive(arg);
				await extensionsWorkbenchService.install(vsix, { installGivenVersion: true });
			}
		} catch (e) {
			onUnexpectedError(e);
			throw e;
		}
	}
});

CommandsRegistry.registerCommand({
	id: 'workbench.extensions.uninstallExtension',
	metadata: {
		description: localize('workbench.extensions.uninstallExtension.description', "卸载给定的扩展"),
		args: [
			{
				name: localize('workbench.extensions.uninstallExtension.arg.name', "要卸载的扩展的 id"),
				schema: {
					'type': 'string'
				}
			}
		]
	},
	handler: async (accessor, id: string) => {
		if (!id) {
			throw new Error(localize('id required', "扩展 ID 是必需的。"));
		}
		const extensionManagementService = accessor.get(IExtensionManagementService);
		const installed = await extensionManagementService.getInstalled();
		const [extensionToUninstall] = installed.filter(e => areSameExtensions(e.identifier, { id }));
		if (!extensionToUninstall) {
			throw new Error(localize('notInstalled', "未安装扩展“{0}”。请确保你使用包括发布者的完整的扩展 ID，例如 ms-vscode.csharp。", id));
		}
		if (extensionToUninstall.isBuiltin) {
			throw new Error(localize('builtin', "扩展“{0}”是内置扩展，无法卸载", id));
		}

		try {
			await extensionManagementService.uninstall(extensionToUninstall);
		} catch (e) {
			onUnexpectedError(e);
			throw e;
		}
	}
});

CommandsRegistry.registerCommand({
	id: 'workbench.extensions.search',
	metadata: {
		description: localize('workbench.extensions.search.description', "搜索特定扩展"),
		args: [
			{
				name: localize('workbench.extensions.search.arg.name', "要在搜索中使用的查询"),
				schema: { 'type': 'string' }
			}
		]
	},
	handler: async (accessor, query: string = '') => {
		return accessor.get(IExtensionsWorkbenchService).openSearch(query);
	}
});

// Code-Tomoshibi: the marketplace UI is gone, but these command ids are still referenced by string from
// outside this folder (settings editor, welcome page / walkthrough, editor status bar, workspace trust editor).
// They are kept as thin delegates to openSearch(), which now shows a notification explaining that the
// extension store has been removed - a removed id would fail silently at runtime instead.
CommandsRegistry.registerCommand('workbench.extensions.action.showExtensionsForLanguage', (accessor: ServicesAccessor, fileExtension: string) => {
	return accessor.get(IExtensionsWorkbenchService).openSearch(`ext:${fileExtension.replace(/^\./, '')}`);
});

CommandsRegistry.registerCommand('workbench.extensions.action.showExtensionsWithIds', (accessor: ServicesAccessor, extensionIds: string[]) => {
	return accessor.get(IExtensionsWorkbenchService).openSearch(extensionIds.map(id => `@id:${id}`).join(' '));
});

CommandsRegistry.registerCommand('workbench.extensions.action.showPopularExtensions', (accessor: ServicesAccessor) => {
	return accessor.get(IExtensionsWorkbenchService).openSearch('@popular ');
});

CommandsRegistry.registerCommand('workbench.extensions.action.showLanguageExtensions', (accessor: ServicesAccessor) => {
	return accessor.get(IExtensionsWorkbenchService).openSearch('@recommended:languages ');
});

CommandsRegistry.registerCommand(LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID, (accessor: ServicesAccessor) => {
	return accessor.get(IExtensionsWorkbenchService).openSearch('@workspaceUnsupported');
});

class ExtensionStorageCleaner implements IWorkbenchContribution {

	constructor(
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IStorageService storageService: IStorageService,
	) {
		ExtensionStorageService.removeOutdatedExtensionVersions(extensionManagementService, storageService);
	}
}

class TrustedPublishersInitializer implements IWorkbenchContribution {
	constructor(
		@IWorkbenchExtensionManagementService extensionManagementService: IWorkbenchExtensionManagementService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IProductService productService: IProductService,
		@IStorageService storageService: IStorageService,
	) {
		const trustedPublishersInitStatusKey = 'trusted-publishers-init-migration';
		if (!storageService.get(trustedPublishersInitStatusKey, StorageScope.APPLICATION)) {
			for (const profile of userDataProfilesService.profiles) {
				extensionManagementService.getInstalled(ExtensionType.User, profile.extensionsResource)
					.then(async extensions => {
						const trustedPublishers = new Map<string, IPublisherInfo>();
						for (const extension of extensions) {
							if (!extension.publisherDisplayName) {
								continue;
							}
							const publisher = extension.manifest.publisher.toLowerCase();
							if (productService.trustedExtensionPublishers?.includes(publisher)
								|| (extension.publisherDisplayName && productService.trustedExtensionPublishers?.includes(extension.publisherDisplayName.toLowerCase()))) {
								continue;
							}
							trustedPublishers.set(publisher, { publisher, publisherDisplayName: extension.publisherDisplayName });
						}
						if (trustedPublishers.size) {
							extensionManagementService.trustPublishers(...trustedPublishers.values());
						}
						storageService.store(trustedPublishersInitStatusKey, 'true', StorageScope.APPLICATION, StorageTarget.MACHINE);
					});
			}
		}
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(TrustedPublishersInitializer, LifecyclePhase.Eventually);
if (isWeb) {
	workbenchRegistry.registerWorkbenchContribution(ExtensionStorageCleaner, LifecyclePhase.Eventually);
}

Registry.as<IConfigurationMigrationRegistry>(ConfigurationMigrationExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: AutoUpdateConfigurationKey,
		/**
		 * Migrates the `extensions.autoUpdate` setting to its new `'on' | 'off'` values.
		 *
		 * The setting previously supported several values that are now retired:
		 * - `true` (All Extensions) and `'onlyEnabledExtensions'` (Only Enabled Extensions)
		 *   are folded into the new `'on'` value, along with the insiders-only `'delayed'` value.
		 * - `false` (None) and the internal `'onlySelectedExtensions'` value map to `'off'`.
		 *   In `'off'` mode, extensions explicitly opted in per-extension are still auto-updated,
		 *   which preserves the `'onlySelectedExtensions'` behavior.
		 *
		 * Returning `[]` is a no-op, used when the value is already in the new format
		 * (`'on'`/`'off'`) or unset.
		 */
		migrateFn: (value, accessor) => {
			if (value === undefined || value === 'on' || value === 'off') {
				return [];
			}
			if (value === false || value === 'onlySelectedExtensions') {
				return { value: 'off' };
			}
			return { value: 'on' };
		}
	}]);
