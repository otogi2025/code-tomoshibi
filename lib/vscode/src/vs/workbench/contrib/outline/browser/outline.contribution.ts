/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { OutlinePane } from './outlinePane.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { OutlineConfigKeys } from '../../../services/outline/browser/outline.js';
import { IOutlinePane } from './outline.js';

// --- actions

import './outlineActions.js';

// --- view

const outlineViewIcon = registerIcon('outline-view-icon', Codicon.symbolClass, localize('outlineViewIcon', '查看大纲视图的图标。'));

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: IOutlinePane.Id,
	name: localize2('name', "大纲"),
	containerIcon: outlineViewIcon,
	ctorDescriptor: new SyncDescriptor(OutlinePane),
	canToggleVisibility: true,
	canMoveView: true,
	hideByDefault: false,
	collapsed: true,
	order: 2,
	weight: 30,
	focusCommand: { id: 'outline.focus' }
}], VIEW_CONTAINER);

// --- configurations

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	'id': 'outline',
	'order': 117,
	'title': localize('outlineConfigurationTitle', "大纲"),
	'type': 'object',
	'properties': {
		[OutlineConfigKeys.icons]: {
			'description': localize('outline.showIcons', "使用图标呈现大纲元素。"),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.collapseItems]: {
			'description': localize('outline.initialState', "控制大纲项是折叠还是展开。"),
			'type': 'string',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			'enum': [
				'alwaysCollapse',
				'alwaysExpand'
			],
			'enumDescriptions': [
				localize('outline.initialState.collapsed', "折叠所有项。"),
				localize('outline.initialState.expanded', "展开所有项。")
			],
			'default': 'alwaysExpand'
		},
		[OutlineConfigKeys.problemsEnabled]: {
			'markdownDescription': localize('outline.showProblem', "显示大纲元素上的错误和警告。被关闭时由 {0} 覆盖。", '`#problems.visibility#`'),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.problemsColors]: {
			'markdownDescription': localize('outline.problem.colors', "对大纲元素的错误和警告使用颜色。被关闭时由 {0} 覆盖。", '`#problems.visibility#`'),
			'type': 'boolean',
			'default': true
		},
		[OutlineConfigKeys.problemsBadges]: {
			'markdownDescription': localize('outline.problems.badges', "对大纲元素的错误和警告使用锁屏提醒。被关闭时由 {0} 覆盖。", '`#problems.visibility#`'),
			'type': 'boolean',
			'default': true
		},
		'outline.showFiles': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.file', "启用后，大纲将显示 `file` 符号。")
		},
		'outline.showModules': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.module', "启用后，大纲将显示 `module` 符号。")
		},
		'outline.showNamespaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.namespace', "启用后，大纲将显示 `namespace` 符号。")
		},
		'outline.showPackages': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.package', "启用后，大纲将显示 `package` 符号。")
		},
		'outline.showClasses': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.class', "启用后，大纲将显示 `class` 符号。")
		},
		'outline.showMethods': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.method', "启用后，大纲将显示 `method` 符号。")
		},
		'outline.showProperties': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.property', "启用后，大纲将显示 `property` 符号。")
		},
		'outline.showFields': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.field', "启用时，大纲将显示 `field`符号。")
		},
		'outline.showConstructors': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constructor', "启用大纲时，大纲将显示 `constructor` 符号。")
		},
		'outline.showEnums': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enum', "启用后，大纲将显示 `enum` 符号。")
		},
		'outline.showInterfaces': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.interface', "启用后，大纲将显示 `interface` 符号。")
		},
		'outline.showFunctions': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.function', "启用时，大纲将显示 `function` 符号。")
		},
		'outline.showVariables': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.variable', "启用后，大纲将显示 `variable` 符号。")
		},
		'outline.showConstants': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.constant', "启用后，大纲将显示`constant`符号。")
		},
		'outline.showStrings': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.string', "启用后，大纲将显示 `string` 符号。")
		},
		'outline.showNumbers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.number', "启用后，大纲将显示 `number` 符号。")
		},
		'outline.showBooleans': {
			type: 'boolean',
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			default: true,
			markdownDescription: localize('filteredTypes.boolean', "启用后，大纲将显示 `boolean` 符号。")
		},
		'outline.showArrays': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.array', "启用后，大纲将显示 `array` 符号。")
		},
		'outline.showObjects': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.object', "启用后，大纲将显示 `object` 符号。")
		},
		'outline.showKeys': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.key', "启用后，大纲将显示 `key`符号。")
		},
		'outline.showNull': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.null', "启用后，大纲将显示 `null` 符号。")
		},
		'outline.showEnumMembers': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.enumMember', "启用后，大纲将显示 `enumMember` 符号。")
		},
		'outline.showStructs': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.struct', "启用后，大纲将显示`struct` 符号。")
		},
		'outline.showEvents': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.event', "启用后，大纲将显示 `event` 符号。")
		},
		'outline.showOperators': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.operator', "启用时，大纲显示 `operator` 符号。")
		},
		'outline.showTypeParameters': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			markdownDescription: localize('filteredTypes.typeParameter', "启用后，大纲将显示 `typeParameter` 符号。")
		}
	}
});
