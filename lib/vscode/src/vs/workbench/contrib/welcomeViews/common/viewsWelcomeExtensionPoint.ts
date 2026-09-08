/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';

export enum ViewsWelcomeExtensionPointFields {
	view = 'view',
	contents = 'contents',
	when = 'when',
	group = 'group',
	enablement = 'enablement',
}

export interface ViewWelcome {
	readonly [ViewsWelcomeExtensionPointFields.view]: string;
	readonly [ViewsWelcomeExtensionPointFields.contents]: string;
	readonly [ViewsWelcomeExtensionPointFields.when]: string;
	readonly [ViewsWelcomeExtensionPointFields.group]: string;
	readonly [ViewsWelcomeExtensionPointFields.enablement]: string;
}

export type ViewsWelcomeExtensionPoint = ViewWelcome[];

export const ViewIdentifierMap: { [key: string]: string } = {
	'explorer': 'workbench.explorer.emptyView'
};

const viewsWelcomeExtensionPointSchema = Object.freeze<IConfigurationPropertySchema>({
	type: 'array',
	description: nls.localize('contributes.viewsWelcome', "提供视图欢迎内容。只要没有有意义的内容可显示，就会在基于树的视图中呈现欢迎内容，例如未打开文件夹时的文件资源管理器。此类内容作为产品内文档非常有用，可促使用户在某些功能可用之前使用它们。文件资源管理器欢迎视图中的“克隆仓库”按钮就是一个很好的示例。"),
	items: {
		type: 'object',
		description: nls.localize('contributes.viewsWelcome.view', "为特定视图提供的欢迎页面内容。"),
		required: [
			ViewsWelcomeExtensionPointFields.view,
			ViewsWelcomeExtensionPointFields.contents
		],
		properties: {
			[ViewsWelcomeExtensionPointFields.view]: {
				anyOf: [
					{
						type: 'string',
						description: nls.localize('contributes.viewsWelcome.view.view', "此欢迎内容的目标视图标识符。仅支持基于树的视图。")
					},
					{
						type: 'string',
						description: nls.localize('contributes.viewsWelcome.view.view', "此欢迎内容的目标视图标识符。仅支持基于树的视图。"),
						enum: Object.keys(ViewIdentifierMap)
					}
				]
			},
			[ViewsWelcomeExtensionPointFields.contents]: {
				type: 'string',
				description: nls.localize('contributes.viewsWelcome.view.contents', "要显示的欢迎内容。内容的格式是 Markdown 的子集，仅支持链接。"),
			},
			[ViewsWelcomeExtensionPointFields.when]: {
				type: 'string',
				description: nls.localize('contributes.viewsWelcome.view.when', "显示欢迎内容的条件。"),
			},
			[ViewsWelcomeExtensionPointFields.group]: {
				type: 'string',
				description: nls.localize('contributes.viewsWelcome.view.group', "此欢迎内容所属的组。建议的 API。"),
			},
			[ViewsWelcomeExtensionPointFields.enablement]: {
				type: 'string',
				description: nls.localize('contributes.viewsWelcome.view.enablement', "启用欢迎内容按钮和命令链接的条件。"),
			},
		}
	}
});

export const viewsWelcomeExtensionPointDescriptor = {
	extensionPoint: 'viewsWelcome',
	jsonSchema: viewsWelcomeExtensionPointSchema
};
