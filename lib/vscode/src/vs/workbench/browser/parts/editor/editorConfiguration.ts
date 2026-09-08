/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, IConfigurationNode, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { diffEditorsAssociationsAgentsWindowDefault, diffEditorsAssociationsSettingId, editorsAssociationsAgentsWindowDefault, editorsAssociationsSettingId, IEditorResolverService, markdownDefaultEditorAgentsWindowSettingId, RegisteredEditorInfo, RegisteredEditorPriority, toRegisteredEditorPriorityInfo } from '../../../services/editor/common/editorResolverService.js';
import { IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { Event } from '../../../../base/common/event.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { ByteSize, getLargeFileConfirmationLimit } from '../../../../platform/files/common/files.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

export class DynamicEditorConfigurations extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.dynamicEditorConfigurations';

	private static readonly AUTO_LOCK_DEFAULT_ENABLED = new Set<string>([
		'terminalEditor',
		'mainThreadWebview-simpleBrowser.view',
		'mainThreadWebview-browserPreview',
		'workbench.editor.processExplorer'
	]);

	private static readonly AUTO_LOCK_EXTRA_EDITORS: RegisteredEditorInfo[] = [

		// List some editor input identifiers that are not
		// registered yet via the editor resolver infrastructure

		{
			id: 'mainThreadWebview-markdown.preview',
			label: localize('markdownPreview', "Markdown 预览"),
			priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
		},
		{
			id: 'mainThreadWebview-simpleBrowser.view',
			label: localize('simpleBrowser', "简易浏览器"),
			priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
		},
		{
			id: 'mainThreadWebview-browserPreview',
			label: localize('livePreview', "实时预览"),
			priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
		}
	];

	private static readonly AUTO_LOCK_REMOVE_EDITORS = new Set<string>([

		// List some editor types that the above `AUTO_LOCK_EXTRA_EDITORS`
		// already covers to avoid duplicates.

		'vscode.markdown.preview.editor'
	]);

	private readonly configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

	private autoLockConfigurationNode: IConfigurationNode | undefined;
	private defaultBinaryEditorConfigurationNode: IConfigurationNode | undefined;
	private editorAssociationsConfigurationNode: IConfigurationNode | undefined;
	private diffEditorAssociationsConfigurationNode: IConfigurationNode | undefined;
	private editorLargeFileConfirmationConfigurationNode: IConfigurationNode | undefined;

	constructor(
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IExtensionService extensionService: IExtensionService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		// Editor configurations are getting updated very aggressively
		// (atleast 20 times) while the extensions are getting registered.
		// As such push out the dynamic configuration until after extensions
		// are registered.
		(async () => {
			await extensionService.whenInstalledExtensionsRegistered();

			this.updateDynamicEditorConfigurations();
			this.registerListeners();
		})();
	}

	private registerListeners(): void {

		// Registered editors (debounced to reduce perf overhead)
		this._register(Event.debounce(this.editorResolverService.onDidChangeEditorRegistrations, (_, e) => e)(() => this.updateDynamicEditorConfigurations()));

		// Re-register when the Agents window Markdown default editor setting changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(markdownDefaultEditorAgentsWindowSettingId)) {
				this.updateDynamicEditorConfigurations();
			}
		}));
	}

	private updateDynamicEditorConfigurations(): void {
		const lockableEditors = [...this.editorResolverService.getEditors(), ...DynamicEditorConfigurations.AUTO_LOCK_EXTRA_EDITORS].filter(e => !DynamicEditorConfigurations.AUTO_LOCK_REMOVE_EDITORS.has(e.id));
		const binaryEditorCandidates = this.editorResolverService.getEditors().filter(e => e.priority.editor !== RegisteredEditorPriority.exclusive).map(e => e.id);

		// Build config from registered editors
		const autoLockGroupConfiguration: IJSONSchemaMap = Object.create(null);
		for (const editor of lockableEditors) {
			autoLockGroupConfiguration[editor.id] = {
				type: 'boolean',
				default: DynamicEditorConfigurations.AUTO_LOCK_DEFAULT_ENABLED.has(editor.id),
				description: editor.label
			};
		}

		// Build default config too
		const defaultAutoLockGroupConfiguration = Object.create(null);
		for (const editor of lockableEditors) {
			defaultAutoLockGroupConfiguration[editor.id] = DynamicEditorConfigurations.AUTO_LOCK_DEFAULT_ENABLED.has(editor.id);
		}

		// Register setting for auto locking groups
		const oldAutoLockConfigurationNode = this.autoLockConfigurationNode;
		this.autoLockConfigurationNode = {
			...workbenchConfigurationNodeBase,
			properties: {
				'workbench.editor.autoLockGroups': {
					type: 'object',
					description: localize('workbench.editor.autoLockGroups', "如果与列出的其中一个类型匹配的编辑器作为编辑器组中的第一个编辑器打开，且打开了多个组，则该组会自动锁定。锁定的组仅用于在用户手势(例如拖放等)显式选择时打开编辑器，默认情况下不使用。因此，锁定的组中的活动编辑器不太可能被意外替换为其他编辑器。"),
					properties: autoLockGroupConfiguration,
					default: defaultAutoLockGroupConfiguration,
					additionalProperties: false
				}
			}
		};

		// Registers setting for default binary editors
		const oldDefaultBinaryEditorConfigurationNode = this.defaultBinaryEditorConfigurationNode;
		this.defaultBinaryEditorConfigurationNode = {
			...workbenchConfigurationNodeBase,
			properties: {
				'workbench.editor.defaultBinaryEditor': {
					type: 'string',
					default: '',
					// This allows for intellisense autocompletion
					enum: [...binaryEditorCandidates, ''],
					description: localize('workbench.editor.defaultBinaryEditor', "检测为二进制文件的默认编辑器。如果未定义，将向用户显示选取器。"),
				}
			}
		};

		// Registers setting for editorAssociations
		const oldEditorAssociationsConfigurationNode = this.editorAssociationsConfigurationNode;
		const markdownDefaultEditorEnabled = this.configurationService.getValue<boolean>(markdownDefaultEditorAgentsWindowSettingId) === true;
		this.editorAssociationsConfigurationNode = {
			...workbenchConfigurationNodeBase,
			properties: {
				[editorsAssociationsSettingId]: {
					type: 'object',
					markdownDescription: localize('editor.editorAssociations', "将 [glob 模式](https://aka.ms/vscode-glob-patterns)配置到编辑器(例如 `\"*.hex\": \"hexEditor.hexedit\"`)。这些优先于默认行为。"),
					patternProperties: {
						'.*': {
							type: 'string',
							enum: binaryEditorCandidates,
						}
					},
					agentsWindow: {
						default: editorsAssociationsAgentsWindowDefault({ markdownDefaultEditor: markdownDefaultEditorEnabled })
					}
				}
			}
		};

		// Registers setting for diffEditorAssociations
		const oldDiffEditorAssociationsConfigurationNode = this.diffEditorAssociationsConfigurationNode;
		this.diffEditorAssociationsConfigurationNode = {
			...workbenchConfigurationNodeBase,
			properties: {
				[diffEditorsAssociationsSettingId]: {
					type: 'object',
					markdownDescription: localize('editor.diffEditorAssociations', "将 [glob 模式](https://aka.ms/vscode-glob-patterns)配置为编辑器以打开差异视图(例如 `\"*.md\": \"vscode.markdown.preview.editor\"`)。这些设置会覆盖差异视图的 `workbench.editorAssociations`。"),
					patternProperties: {
						'.*': {
							type: 'string',
							enum: binaryEditorCandidates,
						}
					},
					agentsWindow: {
						default: diffEditorsAssociationsAgentsWindowDefault({ markdownDefaultEditor: markdownDefaultEditorEnabled })
					}
				}
			}
		};

		// Registers setting for large file confirmation based on environment
		const oldEditorLargeFileConfirmationConfigurationNode = this.editorLargeFileConfirmationConfigurationNode;
		this.editorLargeFileConfirmationConfigurationNode = {
			...workbenchConfigurationNodeBase,
			properties: {
				'workbench.editorLargeFileConfirmation': {
					type: 'number',
					default: getLargeFileConfirmationLimit(this.environmentService.remoteAuthority) / ByteSize.MB,
					minimum: 1,
					scope: ConfigurationScope.RESOURCE,
					markdownDescription: localize('editorLargeFileSizeConfirmation', "在要求在编辑器中打开时进行确认之前，控制以 MB 为单位的文件的最小大小。请注意，此设置可能不适用于所有编辑器类型和环境。"),
				}
			}
		};

		this.configurationRegistry.updateConfigurations({
			add: [
				this.autoLockConfigurationNode,
				this.defaultBinaryEditorConfigurationNode,
				this.editorAssociationsConfigurationNode,
				this.diffEditorAssociationsConfigurationNode,
				this.editorLargeFileConfirmationConfigurationNode
			],
			remove: coalesce([
				oldAutoLockConfigurationNode,
				oldDefaultBinaryEditorConfigurationNode,
				oldEditorAssociationsConfigurationNode,
				oldDiffEditorAssociationsConfigurationNode,
				oldEditorLargeFileConfirmationConfigurationNode
			])
		});
	}
}
