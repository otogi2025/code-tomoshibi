/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { coalesce } from '../../../../base/common/arrays.js';
import { TypeFromJsonSchema, IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as nls from '../../../../nls.js';
import { IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { CustomEditorPriority } from './customEditor.js';
import { Extensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { languagesExtPoint } from '../../../services/language/common/languageService.js';

const Fields = Object.freeze({
	viewType: 'viewType',
	displayName: 'displayName',
	selector: 'selector',
	priority: 'priority',
});

const PriorityFields = Object.freeze({
	textEditor: 'textEditor',
	diffEditor: 'diffEditor',
});

const customEditorPrioritySchema = {
	type: 'string',
	enum: [
		CustomEditorPriority.default,
		CustomEditorPriority.option,
		CustomEditorPriority.explicit,
	],
	markdownEnumDescriptions: [
		nls.localize('contributes.priority.default', '在用户打开资源时自动使用此编辑器，前提是没有为该资源注册其他默认的自定义编辑器。'),
		nls.localize('contributes.priority.option', '在用户打开资源时不会自动使用此编辑器，但用户可使用 `Reopen With` 命令切换到此编辑器。'),
		nls.localize('contributes.priority.explicit', 'The editor is not automatically used or opted into by an association from another editor mode. It can still be opened using the `Reopen With` command or an association configured specifically for this editor mode.'),
	],
} as const satisfies IJSONSchema;

const customEditorsContributionSchema = {
	type: 'object',
	required: [
		Fields.viewType,
		Fields.displayName,
		Fields.selector,
	],
	additionalProperties: false,
	properties: {
		[Fields.viewType]: {
			type: 'string',
			markdownDescription: nls.localize('contributes.viewType', '自定义编辑器的标识符。它在所有自定义编辑器中都必须是唯一的，因此建议将扩展 ID 作为 "viewType" 的一部分包括在内。在使用 "vscode.registerCustomEditorProvider" 和在 "onCustomEditor:${id}" [激活事件](https://code.visualstudio.com/api/references/activation-events)中注册自定义编辑器时，使用 "viewType"。'),
		},
		[Fields.displayName]: {
			type: 'string',
			description: nls.localize('contributes.displayName', '自定义编辑器的用户可读名称。当选择要使用的编辑器时，向用户显示此名称。'),
		},
		[Fields.selector]: {
			type: 'array',
			description: nls.localize('contributes.selector', '为其启用了自定义编辑器的一组 glob。'),
			items: {
				type: 'object',
				defaultSnippets: [{
					body: {
						filenamePattern: '$1',
					}
				}],
				additionalProperties: false,
				properties: {
					filenamePattern: {
						type: 'string',
						description: nls.localize('contributes.selector.filenamePattern', '为其启用了自定义编辑器的 glob。'),
					},
				}
			}
		},
		[Fields.priority]: {
			markdownDescription: nls.localize('contributes.priority', 'Controls if the custom editor is enabled automatically when the user opens a file or diff editor. This may be overridden by users using the `workbench.editorAssociations` or `workbench.diffEditorAssociations` setting. When omitted, the custom editor defaults to `default` for the normal editor and `explicit` for diff editors, so it is not used for diffs unless it opts in.'),
			anyOf: [
				customEditorPrioritySchema,
				{
					type: 'object',
					required: [PriorityFields.textEditor],
					additionalProperties: false,
					properties: {
						[PriorityFields.textEditor]: {
							...customEditorPrioritySchema,
							markdownDescription: nls.localize('contributes.priority.textEditor', 'Controls if the custom editor is enabled automatically when the user opens a file. `diffEditor` does not inherit this value; when it is not specified it defaults to `explicit`.'),
						},
						[PriorityFields.diffEditor]: {
							...customEditorPrioritySchema,
							markdownDescription: nls.localize('contributes.priority.diffEditor', 'Controls if the custom editor is enabled automatically when the user opens a diff. When not specified this defaults to `explicit`, so the custom editor is not used for diffs unless it opts in.'),
						},
					}
				}
			],
			default: CustomEditorPriority.default
		}
	}
} as const satisfies IJSONSchema;

export type ICustomEditorsExtensionPoint = TypeFromJsonSchema<typeof customEditorsContributionSchema>;

export const customEditorsExtensionPoint = ExtensionsRegistry.registerExtensionPoint<ICustomEditorsExtensionPoint[]>({
	extensionPoint: 'customEditors',
	deps: [languagesExtPoint],
	jsonSchema: {
		description: nls.localize('contributes.customEditors', '提供的自定义编辑器。'),
		type: 'array',
		defaultSnippets: [{
			body: [{
				[Fields.viewType]: '$1',
				[Fields.displayName]: '$2',
				[Fields.selector]: [{
					filenamePattern: '$3'
				}],
			}]
		}],
		items: customEditorsContributionSchema
	},
	activationEventsGenerator: function* (contribs: readonly ICustomEditorsExtensionPoint[]) {
		for (const contrib of contribs) {
			const viewType = contrib[Fields.viewType];
			if (viewType) {
				yield `onCustomEditor:${viewType}`;
			}
		}
	},
});

class CustomEditorsDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.customEditors;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const customEditors = manifest.contributes?.customEditors || [];
		if (!customEditors.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			nls.localize('customEditors view type', "视图类型"),
			nls.localize('customEditors priority', "优先级"),
			nls.localize('customEditors filenamePattern', "文件名模式"),
		];

		const rows: IRowData[][] = customEditors
			.map(customEditor => {
				return [
					customEditor.viewType,
					renderPriority(customEditor.priority),
					coalesce(customEditor.selector.map(x => x.filenamePattern)).join(', ')
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

function renderPriority(priority: ICustomEditorsExtensionPoint['priority'] | string | undefined): string {
	if (!priority) {
		return '';
	}
	if (typeof priority === 'string') {
		return priority;
	}
	return coalesce([
		priority.textEditor ? `textEditor: ${priority.textEditor}` : undefined,
		priority.diffEditor ? `diffEditor: ${priority.diffEditor}` : undefined,
	]).join(', ');
}

Registry.as<IExtensionFeaturesRegistry>(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'customEditors',
	label: nls.localize('customEditors', "自定义编辑器"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(CustomEditorsDataRenderer),
});
