/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Emitter, Event } from '../../../../base/common/event.js';
import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { IJSONSchema, IJSONSchemaMap } from '../../../../base/common/jsonSchema.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { editorConfigurationBaseNode } from '../../../../editor/common/config/editorConfigurationSchema.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { codeActionCommandId, refactorCommandId, sourceActionCommandId } from '../../../../editor/contrib/codeAction/browser/codeAction.js';
import { CodeActionKind } from '../../../../editor/contrib/codeAction/common/types.js';
import * as nls from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';

const createCodeActionsAutoSave = (description: string): IJSONSchema => {
	return {
		type: 'string',
		enum: ['always', 'explicit', 'never', true, false],
		enumDescriptions: [
			nls.localize('alwaysSave', '触发由窗口或焦点更改触发的显式保存和自动保存的代码操作。'),
			nls.localize('explicitSave', '仅在显式保存时触发代码操作'),
			nls.localize('neverSave', '保存时从不触发代码操作'),
			nls.localize('explicitSaveBoolean', '仅在显式保存时触发代码操作。此值将被弃用，取而代之将使用“显式”。'),
			nls.localize('neverSaveBoolean', '从不在保存时触发代码操作。此值将被弃用，取而代之将使用“从不”。')
		],
		default: 'explicit',
		description: description
	};
};

const createNotebookCodeActionsAutoSave = (description: string): IJSONSchema => {
	return {
		type: ['string', 'boolean'],
		enum: ['explicit', 'never', true, false],
		enumDescriptions: [
			nls.localize('explicit', '仅在显式保存时触发代码操作。'),
			nls.localize('never', '保存时从不触发代码操作。'),
			nls.localize('explicitBoolean', '仅在显式保存时触发代码操作。此值将被弃用，取而代之将使用“显式”。'),
			nls.localize('neverBoolean', '仅在显式保存时触发代码操作。此值将被弃用，取而代之将使用“从不”。')
		],
		default: 'explicit',
		description: description
	};
};


const codeActionsOnSaveSchema: IConfigurationPropertySchema = {
	oneOf: [
		{
			type: 'object',
			additionalProperties: {
				type: 'string'
			},
		},
		{
			type: 'array',
			items: { type: 'string' }
		}
	],
	markdownDescription: nls.localize('editor.codeActionsOnSave', '保存时为编辑器运行代码操作。必须指定代码操作，并且编辑器不能关闭。当 {0} 设置为 `afterDelay` 时，代码操作将仅在显式保存文件时运行。示例: `"source.organizeImports": "explicit" `', '`#files.autoSave#`'),
	type: ['object', 'array'],
	additionalProperties: {
		type: 'string',
		enum: ['always', 'explicit', 'never', true, false],
	},
	default: {},
	scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
};

export const editorConfiguration = Object.freeze<IConfigurationNode>({
	...editorConfigurationBaseNode,
	properties: {
		'editor.codeActionsOnSave': codeActionsOnSaveSchema
	}
});

const notebookCodeActionsOnSaveSchema: IConfigurationPropertySchema = {
	oneOf: [
		{
			type: 'object',
			additionalProperties: {
				type: 'string'
			},
		},
		{
			type: 'array',
			items: { type: 'string' }
		}
	],
	markdownDescription: nls.localize('notebook.codeActionsOnSave', '保存时为笔记本运行一系列代码操作。必须指定代码操作，并且编辑器不能关闭。当 {0} 设置为 `afterDelay` 时，代码操作将仅在显式保存文件时运行。示例: `"notebook.source.organizeImports": "explicit"`', '`#files.autoSave#`'),
	type: 'object',
	additionalProperties: {
		type: ['string', 'boolean'],
		enum: ['explicit', 'never', true, false],
		// enum: ['explicit', 'always', 'never'], -- autosave support needs to be built first
		// nls.localize('always', 'Always triggers Code Actions on save, including autosave, focus, and window change events.'),
	},
	default: {}
};

export const notebookEditorConfiguration = Object.freeze<IConfigurationNode>({
	...editorConfigurationBaseNode,
	properties: {
		'notebook.codeActionsOnSave': notebookCodeActionsOnSaveSchema
	}
});

export class CodeActionsContribution extends Disposable implements IWorkbenchContribution {

	private readonly _onDidChangeSchemaContributions = this._register(new Emitter<void>());

	private _allProvidedCodeActionKinds: HierarchicalKind[] = [];

	constructor(
		@IKeybindingService keybindingService: IKeybindingService,
		@ILanguageFeaturesService private readonly languageFeatures: ILanguageFeaturesService
	) {
		super();

		// TODO: @justschen caching of code actions based on extensions loaded: https://github.com/microsoft/vscode/issues/216019
		this._register(
			Event.runAndSubscribe(
				Event.debounce(languageFeatures.codeActionProvider.onDidChange, () => { }, 1000),
				() => {
					this._allProvidedCodeActionKinds = this.getAllProvidedCodeActionKinds();
					this.updateConfigurationSchema(this._allProvidedCodeActionKinds);
					this._onDidChangeSchemaContributions.fire();
				}));

		this._register(keybindingService.registerSchemaContribution({
			getSchemaAdditions: () => this.getKeybindingSchemaAdditions(),
			onDidChange: this._onDidChangeSchemaContributions.event,
		}));
	}

	private getAllProvidedCodeActionKinds(): Array<HierarchicalKind> {
		const out = new Map<string, HierarchicalKind>();
		for (const provider of this.languageFeatures.codeActionProvider.allNoModel()) {
			for (const kind of provider.providedCodeActionKinds ?? []) {
				out.set(kind, new HierarchicalKind(kind));
			}
		}
		return Array.from(out.values());
	}

	private updateConfigurationSchema(allProvidedKinds: Iterable<HierarchicalKind>): void {
		const properties: IJSONSchemaMap = { ...codeActionsOnSaveSchema.properties };
		const notebookProperties: IJSONSchemaMap = { ...notebookCodeActionsOnSaveSchema.properties };
		for (const codeActionKind of allProvidedKinds) {
			if (CodeActionKind.Source.contains(codeActionKind) && !properties[codeActionKind.value]) {
				properties[codeActionKind.value] = createCodeActionsAutoSave(nls.localize('codeActionsOnSave.generic', "控制是否应在文件保存时运行\"{0}\"操作。", codeActionKind.value));
				notebookProperties[codeActionKind.value] = createNotebookCodeActionsAutoSave(nls.localize('codeActionsOnSave.generic', "控制是否应在文件保存时运行\"{0}\"操作。", codeActionKind.value));
			}
		}
		codeActionsOnSaveSchema.properties = properties;
		notebookCodeActionsOnSaveSchema.properties = notebookProperties;

		Registry.as<IConfigurationRegistry>(Extensions.Configuration)
			.notifyConfigurationSchemaUpdated(editorConfiguration);
	}

	private getKeybindingSchemaAdditions(): IJSONSchema[] {
		const conditionalSchema = (command: string, kinds: readonly string[]): IJSONSchema => {
			return {
				if: {
					required: ['command'],
					properties: {
						'command': { const: command }
					}
				},
				then: {
					properties: {
						'args': {
							required: ['kind'],
							properties: {
								'kind': {
									anyOf: [
										{ enum: Array.from(kinds) },
										{ type: 'string' },
									]
								}
							}
						}
					}
				}
			};
		};

		const filterProvidedKinds = (ofKind: HierarchicalKind): string[] => {
			const out = new Set<string>();
			for (const providedKind of this._allProvidedCodeActionKinds) {
				if (ofKind.contains(providedKind)) {
					out.add(providedKind.value);
				}
			}
			return Array.from(out);
		};

		return [
			conditionalSchema(codeActionCommandId, filterProvidedKinds(HierarchicalKind.Empty)),
			conditionalSchema(refactorCommandId, filterProvidedKinds(CodeActionKind.Refactor)),
			conditionalSchema(sourceActionCommandId, filterProvidedKinds(CodeActionKind.Source)),
		];
	}
}
