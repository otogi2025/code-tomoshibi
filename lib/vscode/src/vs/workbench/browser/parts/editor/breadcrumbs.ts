/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { BreadcrumbsWidget } from '../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import * as glob from '../../../../base/common/glob.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationOverrides, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions, IConfigurationRegistry, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { GroupIdentifier, IEditorPartOptions } from '../../../common/editor.js';

export const IBreadcrumbsService = createDecorator<IBreadcrumbsService>('IEditorBreadcrumbsService');

export interface IBreadcrumbsService {

	readonly _serviceBrand: undefined;

	register(group: GroupIdentifier, widget: BreadcrumbsWidget): IDisposable;

	getWidget(group: GroupIdentifier): BreadcrumbsWidget | undefined;
}


export class BreadcrumbsService implements IBreadcrumbsService {

	declare readonly _serviceBrand: undefined;

	private readonly _map = new Map<number, BreadcrumbsWidget>();

	register(group: number, widget: BreadcrumbsWidget): IDisposable {
		if (this._map.has(group)) {
			throw new Error(`group (${group}) has already a widget`);
		}
		this._map.set(group, widget);
		return {
			dispose: () => this._map.delete(group)
		};
	}

	getWidget(group: number): BreadcrumbsWidget | undefined {
		return this._map.get(group);
	}
}

registerSingleton(IBreadcrumbsService, BreadcrumbsService, InstantiationType.Delayed);


//#region config

export abstract class BreadcrumbsConfig<T> {

	abstract get name(): string;
	abstract get onDidChange(): Event<void>;

	abstract getValue(overrides?: IConfigurationOverrides): T;
	abstract updateValue(value: T, overrides?: IConfigurationOverrides): Promise<void>;
	abstract dispose(): void;

	private constructor() {
		// internal
	}

	static readonly IsEnabled = BreadcrumbsConfig._stub<boolean>('breadcrumbs.enabled');
	static readonly UseQuickPick = BreadcrumbsConfig._stub<boolean>('breadcrumbs.useQuickPick');
	static readonly FilePath = BreadcrumbsConfig._stub<'on' | 'off' | 'last'>('breadcrumbs.filePath');
	static readonly SymbolPath = BreadcrumbsConfig._stub<'on' | 'off' | 'last'>('breadcrumbs.symbolPath');
	static readonly SymbolSortOrder = BreadcrumbsConfig._stub<'position' | 'name' | 'type'>('breadcrumbs.symbolSortOrder');
	static readonly SymbolPathSeparator = BreadcrumbsConfig._stub<string>('breadcrumbs.symbolPathSeparator');
	static readonly Icons = BreadcrumbsConfig._stub<boolean>('breadcrumbs.icons');
	static readonly ShowEditorType = BreadcrumbsConfig._stub<boolean>('breadcrumbs.showEditorType');
	static readonly TitleScrollbarSizing = BreadcrumbsConfig._stub<IEditorPartOptions['titleScrollbarSizing']>('workbench.editor.titleScrollbarSizing');
	static readonly TitleScrollbarVisibility = BreadcrumbsConfig._stub<IEditorPartOptions['titleScrollbarVisibility']>('workbench.editor.titleScrollbarVisibility');

	static readonly FileExcludes = BreadcrumbsConfig._stub<glob.IExpression>('files.exclude');

	private static _stub<T>(name: string): { bindTo(service: IConfigurationService): BreadcrumbsConfig<T> } {
		return {
			bindTo(service) {
				const onDidChange = new Emitter<void>();

				const listener = service.onDidChangeConfiguration(e => {
					if (e.affectsConfiguration(name)) {
						onDidChange.fire(undefined);
					}
				});

				return new class implements BreadcrumbsConfig<T> {
					readonly name = name;
					readonly onDidChange = onDidChange.event;
					getValue(overrides?: IConfigurationOverrides): T {
						if (overrides) {
							return service.getValue(name, overrides);
						} else {
							return service.getValue(name);
						}
					}
					updateValue(newValue: T, overrides?: IConfigurationOverrides): Promise<void> {
						if (overrides) {
							return service.updateValue(name, newValue, overrides);
						} else {
							return service.updateValue(name, newValue);
						}
					}
					dispose(): void {
						listener.dispose();
						onDidChange.dispose();
					}
				};
			}
		};
	}
}

Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	id: 'breadcrumbs',
	title: localize('title', "面包屑导航"),
	order: 101,
	type: 'object',
	properties: {
		'breadcrumbs.enabled': {
			description: localize('enabled', "启用/禁用导航面包屑。"),
			type: 'boolean',
			default: true,
			agentsWindow: { default: true },
		},
		'breadcrumbs.filePath': {
			description: localize('filepath', "控制面包屑视图中是否显示文件路径及显示方式。"),
			type: 'string',
			default: 'on',
			enum: ['on', 'off', 'last'],
			enumDescriptions: [
				localize('filepath.on', "在面包屑视图中显示文件路径。"),
				localize('filepath.off', "不在面包屑视图中显示文件路径。"),
				localize('filepath.last', "只在面包屑视图中显示文件路径的最后一段。"),
			]
		},
		'breadcrumbs.symbolPath': {
			description: localize('symbolpath', "控制面包屑视图中是否显示符号及显示方式。"),
			type: 'string',
			default: 'on',
			enum: ['on', 'off', 'last'],
			enumDescriptions: [
				localize('symbolpath.on', "在面包屑视图中显示所有符号。"),
				localize('symbolpath.off', "不在面包屑视图中显示符号。"),
				localize('symbolpath.last', "只在面包屑视图中显示当前符号。"),
			]
		},
		'breadcrumbs.symbolSortOrder': {
			description: localize('symbolSortOrder', "控制面包屑大纲视图中符号的排序方式。"),
			type: 'string',
			default: 'position',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			enum: ['position', 'name', 'type'],
			enumDescriptions: [
				localize('symbolSortOrder.position', "按文件中的位置顺序显示符号大纲。"),
				localize('symbolSortOrder.name', "按字母顺序显示符号大纲。"),
				localize('symbolSortOrder.type', "按符号类型顺序显示符号大纲。"),
			]
		},
		'breadcrumbs.icons': {
			description: localize('icons', "为面包屑项渲染图标。"),
			type: 'boolean',
			default: true
		},
		'breadcrumbs.showEditorType': {
			markdownDescription: localize('showEditorType', "控制面包屑栏是否显示一个下拉菜单，用于在可打开当前文件的编辑器之间切换（例如文本编辑器和自定义编辑器）。仅当存在更专用的编辑器时才会出现该下拉菜单。"),
			type: 'boolean',
			default: false,
			agentsWindow: { default: true },
			tags: ['experimental']
		},
		'breadcrumbs.symbolPathSeparator': {
			description: localize('symbolPathSeparator', "复制面包屑符号路径时使用的分隔符。"),
			type: 'string',
			default: '.',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'breadcrumbs.showFiles': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.file', "启用后，面包屑将显示 `file` 符号。")
		},
		'breadcrumbs.showModules': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.module', "启用后，面包屑将显示 `module` 符号。")
		},
		'breadcrumbs.showNamespaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.namespace', "启用后，面包屑将显示 `namespace` 符号。")
		},
		'breadcrumbs.showPackages': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.package', "启用后，面包屑将显示 `package` 符号。")
		},
		'breadcrumbs.showClasses': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.class', "启用后，面包屑将显示 `class` 符号。")
		},
		'breadcrumbs.showMethods': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.method', "启用后，面包屑将显示 `method` 符号。")
		},
		'breadcrumbs.showProperties': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.property', "启用后，面包屑将显示 `property` 符号。")
		},
		'breadcrumbs.showFields': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.field', "启用后，面包屑将显示 `field` 符号。")
		},
		'breadcrumbs.showConstructors': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constructor', "启用后，面包屑将显示 `constructor` 符号。")
		},
		'breadcrumbs.showEnums': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enum', "启用后，面包屑将显示 `enum` 符号。")
		},
		'breadcrumbs.showInterfaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.interface', "启用后，面包屑将显示 `interface` 符号。")
		},
		'breadcrumbs.showFunctions': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.function', "启用后，面包屑将显示 `function` 符号。")
		},
		'breadcrumbs.showVariables': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.variable', "启用后，面包屑将显示 `variable` 符号。")
		},
		'breadcrumbs.showConstants': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constant', "启用后，面包屑将显示 `constant` 符号。")
		},
		'breadcrumbs.showStrings': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.string', "启用后，面包屑将显示 `string` 符号。")
		},
		'breadcrumbs.showNumbers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.number', "启用后，面包屑将显示 `number` 符号。")
		},
		'breadcrumbs.showBooleans': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.boolean', "启用后，面包屑将显示 `boolean` 符号。")
		},
		'breadcrumbs.showArrays': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.array', "启用后，面包屑将显示 `array` 符号。")
		},
		'breadcrumbs.showObjects': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.object', "启用后，面包屑将显示 `object` 符号。")
		},
		'breadcrumbs.showKeys': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.key', "启用后，面包屑将显示 `key` 符号。")
		},
		'breadcrumbs.showNull': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.null', "启用后，面包屑将显示 `null` 符号。")
		},
		'breadcrumbs.showEnumMembers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enumMember', "启用后，面包屑将显示 `enumMember` 符号。")
		},
		'breadcrumbs.showStructs': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.struct', "启用后，面包屑将显示 `struct` 符号。")
		},
		'breadcrumbs.showEvents': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.event', "启用后，面包屑将显示 `event` 符号。")
		},
		'breadcrumbs.showOperators': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.operator', "启用后，面包屑将显示 `operator` 符号。")
		},
		'breadcrumbs.showTypeParameters': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.typeParameter', "启用后，面包屑将显示 `typeParameter` 符号。")
		}
	}
});

//#endregion
