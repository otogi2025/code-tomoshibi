/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { MarkdownString } from '../../../base/common/htmlContent.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import * as resources from '../../../base/common/resources.js';
import { isFalsyOrWhitespace } from '../../../base/common/strings.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { ContextKeyExpr } from '../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier, ExtensionIdentifierSet, IExtensionDescription, IExtensionManifest } from '../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { PaneCompositeRegistry, Extensions as ViewletExtensions } from '../../browser/panecomposite.js';
import { CustomTreeView, TreeViewPane } from '../../browser/parts/views/treeView.js';
import { ViewPaneContainer } from '../../browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../common/contributions.js';
import { ICustomViewDescriptor, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainer, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../common/views.js';
import { VIEWLET_ID as EXPLORER } from '../../contrib/files/common/files.js';
import { VIEWLET_ID as REMOTE } from '../../contrib/remote/browser/remoteExplorer.js';
import { WebviewViewPane } from '../../contrib/webviewView/browser/webviewViewPane.js';
import { Extensions as ExtensionFeaturesRegistryExtensions, IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData } from '../../services/extensionManagement/common/extensionFeatures.js';
import { isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { ExtensionMessageCollector, ExtensionsRegistry, IExtensionPoint, IExtensionPointUser } from '../../services/extensions/common/extensionsRegistry.js';

export interface IUserFriendlyViewsContainerDescriptor {
	id: string;
	title: string;
	icon: string;
}

const viewsContainerSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize({ key: 'vscode.extension.contributes.views.containers.id', comment: ['Contribution refers to those that an extension contributes to VS Code through an extension/contribution point. '] }, "用于标识容器的唯一 ID，视图能在容器内通过 \"view\" 参与点提供。"),
			type: 'string',
			pattern: '^[a-zA-Z0-9_-]+$'
		},
		title: {
			description: localize('vscode.extension.contributes.views.containers.title', '人类可读的用于表示此容器的字符串'),
			type: 'string'
		},
		icon: {
			description: localize('vscode.extension.contributes.views.containers.icon', "容器图标的路径。图标大小为 24x24，并居中放置在 50x40 的区域内，其填充颜色为 \"rgb(215, 218, 224)\" 或 \"#d7dae0\"。所有图片格式均可用，推荐使用 SVG 格式。"),
			type: 'string'
		}
	},
	required: ['id', 'title', 'icon']
};

export const viewsContainersContribution: IJSONSchema = {
	description: localize('vscode.extension.contributes.viewsContainers', '向编辑器提供视图容器'),
	type: 'object',
	properties: {
		'activitybar': {
			description: localize('views.container.activitybar', "向活动栏提供视图容器"),
			type: 'array',
			items: viewsContainerSchema
		},
		'panel': {
			description: localize('views.container.panel', "向面板提供视图容器"),
			type: 'array',
			items: viewsContainerSchema
		},
		'secondarySidebar': {
			description: localize('views.container.secondarySidebar', "将视图容器提供给辅助侧栏"),
			type: 'array',
			items: viewsContainerSchema
		}
	},
	additionalProperties: false
};

enum ViewType {
	Tree = 'tree',
	Webview = 'webview'
}


interface IUserFriendlyViewDescriptor {
	type?: ViewType;

	id: string;
	name: string;
	when?: string;

	icon?: string;
	contextualTitle?: string;
	visibility?: string;

	initialSize?: number;

	// From 'remoteViewDescriptor' type
	group?: string;
	remoteName?: string | string[];
	virtualWorkspace?: string;

	accessibilityHelpContent?: string;
}

enum InitialVisibility {
	Visible = 'visible',
	Hidden = 'hidden',
	Collapsed = 'collapsed'
}

const viewDescriptor: IJSONSchema = {
	type: 'object',
	required: ['id', 'name', 'icon'],
	defaultSnippets: [{ body: { id: '${1:id}', name: '${2:name}', icon: '${3:icon}' } }],
	properties: {
		type: {
			markdownDescription: localize('vscode.extension.contributes.view.type', "视图的类型。对于基于树状视图的视图，这可以是 \"tree\"，对于基于 Web 视图的视图，这可以是 \"webview\"。默认值为 \"tree\"。"),
			type: 'string',
			enum: [
				'tree',
				'webview',
			],
			markdownEnumDescriptions: [
				localize('vscode.extension.contributes.view.tree', "该视图由 \"createTreeView\" 创建的 \"TreeView\" 提供支持。"),
				localize('vscode.extension.contributes.view.webview', "该视图由 \"registerWebviewViewProvider\" 注册的 \"WebviewView\" 提供支持。"),
			]
		},
		id: {
			markdownDescription: localize('vscode.extension.contributes.view.id', '视图的标识符。这在所有视图中都应是唯一的。建议将扩展 ID 包含在视图 ID 中。使用此选项通过 "vscode.window.registerTreeDataProviderForView" API 注册数据提供程序。也可通过将 "onView:${id}" 事件注册为 "activationEvents" 来触发激活扩展。'),
			type: 'string'
		},
		name: {
			description: localize('vscode.extension.contributes.view.name', '用户可读的视图名称。将显示它'),
			type: 'string'
		},
		when: {
			description: localize('vscode.extension.contributes.view.when', '为真时才显示此视图的条件'),
			type: 'string'
		},
		icon: {
			description: localize('vscode.extension.contributes.view.icon', "视图图标的路径。无法显示视图名称时，将显示视图图标。可以接受任何图像文件类型，但建议图标采用 SVG 格式。"),
			type: 'string'
		},
		contextualTitle: {
			description: localize('vscode.extension.contributes.view.contextualTitle', "当视图移出其原始位置时的用户可读上下文。默认情况下，将使用视图的容器名称。"),
			type: 'string'
		},
		visibility: {
			description: localize('vscode.extension.contributes.view.initialState', "首次安装扩展时视图的初始状态。用户一旦通过折叠、移动或隐藏视图更改视图状态，就不再使用初始状态。"),
			type: 'string',
			enum: [
				'visible',
				'hidden',
				'collapsed'
			],
			default: 'visible',
			enumDescriptions: [
				localize('vscode.extension.contributes.view.initialState.visible', "视图的默认初始状态。但在大多数容器中，视图将展开，但某些内置容器(资源管理器、scm 和调试)显示所有已折叠的参与视图，无论“可见性”如何，都是如此。"),
				localize('vscode.extension.contributes.view.initialState.hidden', "视图不会显示在视图容器中，但可通过视图菜单和其他视图入口点发现，而且用户可取消隐藏视图。"),
				localize('vscode.extension.contributes.view.initialState.collapsed', "视图将在视图容器中折叠显示。")
			]
		},
		initialSize: {
			type: 'number',
			description: localize('vscode.extension.contributs.view.size', "视图的初始大小。大小的行为将类似于 css “flex” 属性，并将在首次显示视图时设置初始大小。在侧栏中，这是视图的高度。仅当同一扩展同时拥有视图和视图容器时，才考虑此值。"),
		},
		accessibilityHelpContent: {
			type: 'string',
			markdownDescription: localize('vscode.extension.contributes.view.accessibilityHelpContent', "在此视图中调用辅助功能帮助对话框时，此内容将作为 markdown 字符串呈现给用户。当以 <keybinding:commandId> 格式提供时，将解析键绑定。如果没有键绑定，则会指示该键绑定，并且此命令将包含在快速检查中，以便于配置。")
		}
	}
};

const remoteViewDescriptor: IJSONSchema = {
	type: 'object',
	required: ['id', 'name'],
	properties: {
		id: {
			description: localize('vscode.extension.contributes.view.id', '视图的标识符。这在所有视图中都应是唯一的。建议将扩展 ID 包含在视图 ID 中。使用此选项通过 "vscode.window.registerTreeDataProviderForView" API 注册数据提供程序。也可通过将 "onView:${id}" 事件注册为 "activationEvents" 来触发激活扩展。'),
			type: 'string'
		},
		name: {
			description: localize('vscode.extension.contributes.view.name', '用户可读的视图名称。将显示它'),
			type: 'string'
		},
		when: {
			description: localize('vscode.extension.contributes.view.when', '为真时才显示此视图的条件'),
			type: 'string'
		},
		group: {
			description: localize('vscode.extension.contributes.view.group', '视图中的嵌套组'),
			type: 'string'
		},
		remoteName: {
			description: localize('vscode.extension.contributes.view.remoteName', '与此视图关联的远程类型的名称'),
			type: ['string', 'array'],
			items: {
				type: 'string'
			}
		}
	}
};
const viewsContribution: IJSONSchema = {
	description: localize('vscode.extension.contributes.views', "向编辑器提供视图"),
	type: 'object',
	properties: {
		'explorer': {
			description: localize('views.explorer', "向活动栏中的“资源管理器”容器提供视图"),
			type: 'array',
			items: viewDescriptor,
			default: []
		},
		'remote': {
			description: localize('views.remote', "向活动栏中的 Remote 容器提供视图。要提供给此容器，必须启用 \"contribViewsRemote\" API 建议。"),
			type: 'array',
			items: remoteViewDescriptor,
			default: []
		},
	},
	additionalProperties: {
		description: localize('views.contributed', "向“提供的视图”容器提供视图"),
		type: 'array',
		items: viewDescriptor,
		default: []
	}
};

type ViewContainerExtensionPointType = { [loc: string]: IUserFriendlyViewsContainerDescriptor[] };
const viewsContainersExtensionPoint: IExtensionPoint<ViewContainerExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewContainerExtensionPointType>({
	extensionPoint: 'viewsContainers',
	jsonSchema: viewsContainersContribution
});

type ViewExtensionPointType = { [loc: string]: IUserFriendlyViewDescriptor[] };
const viewsExtensionPoint: IExtensionPoint<ViewExtensionPointType> = ExtensionsRegistry.registerExtensionPoint<ViewExtensionPointType>({
	extensionPoint: 'views',
	deps: [viewsContainersExtensionPoint],
	jsonSchema: viewsContribution,
	activationEventsGenerator: function* (viewExtensionPointTypeArray) {
		for (const viewExtensionPointType of viewExtensionPointTypeArray) {
			for (const viewDescriptors of Object.values(viewExtensionPointType)) {
				for (const viewDescriptor of viewDescriptors) {
					if (viewDescriptor.id) {
						yield `onView:${viewDescriptor.id}`;
					}
				}
			}
		}
	}
});

const CUSTOM_VIEWS_START_ORDER = 7;

class ViewsExtensionHandler implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.viewsExtensionHandler';

	private viewContainersRegistry: IViewContainersRegistry;
	private viewsRegistry: IViewsRegistry;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		this.viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		this.viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
		this.handleAndRegisterCustomViewContainers();
		this.handleAndRegisterCustomViews();
	}

	private handleAndRegisterCustomViewContainers() {
		viewsContainersExtensionPoint.setHandler((extensions, { added, removed }) => {
			if (removed.length) {
				this.removeCustomViewContainers(removed);
			}
			if (added.length) {
				this.addCustomViewContainers(added, this.viewContainersRegistry.all);
			}
		});
	}

	private addCustomViewContainers(extensionPoints: readonly IExtensionPointUser<ViewContainerExtensionPointType>[], existingViewContainers: ViewContainer[]): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		let activityBarOrder = CUSTOM_VIEWS_START_ORDER + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Sidebar).length;
		let panelOrder = 5 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.Panel).length + 1;
		// offset by 100 because the chat view container used to have order 100 (now 1). Due to caching, we still need to account for the original order value
		let auxiliaryBarOrder = 100 + viewContainersRegistry.all.filter(v => !!v.extensionId && viewContainersRegistry.getViewContainerLocation(v) === ViewContainerLocation.AuxiliaryBar).length + 1;
		for (const { value, collector, description } of extensionPoints) {
			Object.entries(value).forEach(([key, value]) => {
				if (!this.isValidViewsContainer(value, collector)) {
					return;
				}
				switch (key) {
					case 'activitybar':
						activityBarOrder = this.registerCustomViewContainers(value, description, activityBarOrder, existingViewContainers, ViewContainerLocation.Sidebar);
						break;
					case 'panel':
						panelOrder = this.registerCustomViewContainers(value, description, panelOrder, existingViewContainers, ViewContainerLocation.Panel);
						break;
					case 'secondarySidebar':
						auxiliaryBarOrder = this.registerCustomViewContainers(value, description, auxiliaryBarOrder, existingViewContainers, ViewContainerLocation.AuxiliaryBar);
						break;
				}
			});
		}
	}

	private removeCustomViewContainers(extensionPoints: readonly IExtensionPointUser<ViewContainerExtensionPointType>[]): void {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const removedExtensions: ExtensionIdentifierSet = extensionPoints.reduce((result, e) => { result.add(e.description.identifier); return result; }, new ExtensionIdentifierSet());
		for (const viewContainer of viewContainersRegistry.all) {
			if (viewContainer.extensionId && removedExtensions.has(viewContainer.extensionId)) {
				// move all views in this container into default view container
				const views = this.viewsRegistry.getViews(viewContainer);
				if (views.length) {
					this.viewsRegistry.moveViews(views, this.getDefaultViewContainer());
				}
				this.deregisterCustomViewContainer(viewContainer);
			}
		}
	}

	private isValidViewsContainer(viewsContainersDescriptors: IUserFriendlyViewsContainerDescriptor[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(viewsContainersDescriptors)) {
			collector.error(localize('viewcontainer requirearray', "视图容器必须为数组"));
			return false;
		}

		for (const descriptor of viewsContainersDescriptors) {
			if (typeof descriptor.id !== 'string' && isFalsyOrWhitespace(descriptor.id)) {
				collector.error(localize('requireidstring', "属性“{0}”是必需的，并且必须为具有非空值的类型 `string`。只允许使用字母数字字符、 “_” 和 “-”。", 'id'));
				return false;
			}
			if (!(/^[a-z0-9_-]+$/i.test(descriptor.id))) {
				collector.error(localize('requireidstring', "属性“{0}”是必需的，并且必须为具有非空值的类型 `string`。只允许使用字母数字字符、 “_” 和 “-”。", 'id'));
				return false;
			}
			if (typeof descriptor.title !== 'string') {
				collector.error(localize('requirestring', "属性 \"{0}\" 是必需项并且必须为 \"string\" 类型", 'title'));
				return false;
			}
			if (typeof descriptor.icon !== 'string') {
				collector.error(localize('requirestring', "属性 \"{0}\" 是必需项并且必须为 \"string\" 类型", 'icon'));
				return false;
			}
			if (isFalsyOrWhitespace(descriptor.title)) {
				collector.warn(localize('requirenonemptystring', "属性“{0}”是必需的，并且必须为具有非空值的类型 `string`", 'title'));
				return true;
			}
		}

		return true;
	}

	private registerCustomViewContainers(containers: IUserFriendlyViewsContainerDescriptor[], extension: IExtensionDescription, order: number, existingViewContainers: ViewContainer[], location: ViewContainerLocation): number {
		containers.forEach(descriptor => {
			const themeIcon = ThemeIcon.fromString(descriptor.icon);

			const icon = themeIcon || resources.joinPath(extension.extensionLocation, descriptor.icon);
			const id = `workbench.view.extension.${descriptor.id}`;
			const title = descriptor.title || id;
			const viewContainer = this.registerCustomViewContainer(id, title, icon, order++, extension.identifier, location);

			// Move those views that belongs to this container
			if (existingViewContainers.length) {
				const viewsToMove: IViewDescriptor[] = [];
				for (const existingViewContainer of existingViewContainers) {
					if (viewContainer !== existingViewContainer) {
						viewsToMove.push(...this.viewsRegistry.getViews(existingViewContainer).filter(view => (view as ICustomViewDescriptor).originalContainerId === descriptor.id));
					}
				}
				if (viewsToMove.length) {
					this.viewsRegistry.moveViews(viewsToMove, viewContainer);
				}
			}
		});
		return order;
	}

	private registerCustomViewContainer(id: string, title: string, icon: URI | ThemeIcon, order: number, extensionId: ExtensionIdentifier | undefined, location: ViewContainerLocation): ViewContainer {
		let viewContainer = this.viewContainersRegistry.get(id);

		if (!viewContainer) {

			viewContainer = this.viewContainersRegistry.registerViewContainer({
				id,
				title: { value: title, original: title },
				extensionId,
				ctorDescriptor: new SyncDescriptor(
					ViewPaneContainer,
					[id, { mergeViewWithContainerWhenSingleView: true }]
				),
				hideIfEmpty: true,
				order,
				icon,
			}, location);

		}

		return viewContainer;
	}

	private deregisterCustomViewContainer(viewContainer: ViewContainer): void {
		this.viewContainersRegistry.deregisterViewContainer(viewContainer);
		Registry.as<PaneCompositeRegistry>(ViewletExtensions.Viewlets).deregisterPaneComposite(viewContainer.id);
	}

	private handleAndRegisterCustomViews() {
		viewsExtensionPoint.setHandler((extensions, { added, removed }) => {
			if (removed.length) {
				this.removeViews(removed);
			}
			if (added.length) {
				this.addViews(added);
			}
		});
	}

	private addViews(extensions: readonly IExtensionPointUser<ViewExtensionPointType>[]): void {
		const viewIds: Set<string> = new Set<string>();
		const allViewDescriptors: { views: IViewDescriptor[]; viewContainer: ViewContainer }[] = [];

		for (const extension of extensions) {
			const { value, collector } = extension;

			Object.entries(value).forEach(([key, value]) => {
				if (!this.isValidViewDescriptors(value, collector)) {
					return;
				}

				if (key === 'remote' && !isProposedApiEnabled(extension.description, 'contribViewsRemote')) {
					collector.warn(localize('ViewContainerRequiresProposedAPI', "查看容器“{0}”需要将 “enabledApiProposals: [“contribViewsRemote”]” 添加到“远程”。", key));
					return;
				}

				const viewContainer = this.getViewContainer(key);
				if (!viewContainer) {
					collector.warn(localize('ViewContainerDoesnotExist', "视图容器“{0}”不存在。所有注册到其中的视图将被添加到“资源管理器”中。", key));
				}
				const container = viewContainer || this.getDefaultViewContainer();
				const viewDescriptors: ICustomViewDescriptor[] = [];

				for (let index = 0; index < value.length; index++) {
					const item = value[index];
					// validate
					if (viewIds.has(item.id)) {
						collector.error(localize('duplicateView1', "无法注册具有相同 ID“{0}”的多个视图", item.id));
						continue;
					}
					if (this.viewsRegistry.getView(item.id) !== null) {
						collector.error(localize('duplicateView2', "已注册 ID 为“{0}”的视图。", item.id));
						continue;
					}

					const order = ExtensionIdentifier.equals(extension.description.identifier, container.extensionId)
						? index + 1
						: container.viewOrderDelegate
							? container.viewOrderDelegate.getOrder(item.group)
							: undefined;

					let icon: ThemeIcon | URI | undefined;
					if (typeof item.icon === 'string') {
						icon = ThemeIcon.fromString(item.icon) || resources.joinPath(extension.description.extensionLocation, item.icon);
					}

					const initialVisibility = this.convertInitialVisibility(item.visibility);

					const type = this.getViewType(item.type);
					if (!type) {
						collector.error(localize('unknownViewType', "未知视图类型“{0}”。", item.type));
						continue;
					}

					let weight: number | undefined = undefined;
					if (typeof item.initialSize === 'number') {
						if (container.extensionId?.value === extension.description.identifier.value) {
							weight = item.initialSize;
						} else {
							this.logService.warn(`${extension.description.identifier.value} tried to set the view size of ${item.id} but it was ignored because the view container does not belong to it.`);
						}
					}

					let accessibilityHelpContent;
					if (isProposedApiEnabled(extension.description, 'contribAccessibilityHelpContent') && item.accessibilityHelpContent) {
						accessibilityHelpContent = new MarkdownString(item.accessibilityHelpContent);
					}

					const viewDescriptor: ICustomViewDescriptor = {
						type: type,
						ctorDescriptor: type === ViewType.Tree ? new SyncDescriptor(TreeViewPane) : new SyncDescriptor(WebviewViewPane),
						id: item.id,
						name: { value: item.name, original: item.name },
						when: ContextKeyExpr.deserialize(item.when),
						containerIcon: icon || viewContainer?.icon,
						containerTitle: item.contextualTitle || (viewContainer && (typeof viewContainer.title === 'string' ? viewContainer.title : viewContainer.title.value)),
						canToggleVisibility: true,
						canMoveView: viewContainer?.id !== REMOTE,
						treeView: type === ViewType.Tree ? this.instantiationService.createInstance(CustomTreeView, item.id, item.name, extension.description.identifier.value) : undefined,
						collapsed: this.showCollapsed(container) || initialVisibility === InitialVisibility.Collapsed,
						order: order,
						extensionId: extension.description.identifier,
						originalContainerId: key,
						group: item.group,
						// eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
						remoteAuthority: item.remoteName || (<any>item).remoteAuthority, // TODO@roblou - delete after remote extensions are updated
						virtualWorkspace: item.virtualWorkspace,
						hideByDefault: initialVisibility === InitialVisibility.Hidden,
						workspace: viewContainer?.id === REMOTE ? true : undefined,
						weight,
						accessibilityHelpContent
					};


					viewIds.add(viewDescriptor.id);
					viewDescriptors.push(viewDescriptor);
				}

				allViewDescriptors.push({ viewContainer: container, views: viewDescriptors });

			});
		}

		this.viewsRegistry.registerViews2(allViewDescriptors);
	}

	private getViewType(type: string | undefined): ViewType | undefined {
		if (type === ViewType.Webview) {
			return ViewType.Webview;
		}
		if (!type || type === ViewType.Tree) {
			return ViewType.Tree;
		}
		return undefined;
	}

	private getDefaultViewContainer(): ViewContainer {
		return this.viewContainersRegistry.get(EXPLORER)!;
	}

	private removeViews(extensions: readonly IExtensionPointUser<ViewExtensionPointType>[]): void {
		const removedExtensions: ExtensionIdentifierSet = extensions.reduce((result, e) => { result.add(e.description.identifier); return result; }, new ExtensionIdentifierSet());
		for (const viewContainer of this.viewContainersRegistry.all) {
			const removedViews = this.viewsRegistry.getViews(viewContainer).filter(v => (v as ICustomViewDescriptor).extensionId && removedExtensions.has((v as ICustomViewDescriptor).extensionId));
			if (removedViews.length) {
				this.viewsRegistry.deregisterViews(removedViews, viewContainer);
				for (const view of removedViews) {
					const anyView = view as ICustomViewDescriptor;
					if (anyView.treeView) {
						anyView.treeView.dispose();
					}
				}
			}
		}
	}

	private convertInitialVisibility(value: string | undefined): InitialVisibility | undefined {
		if (Object.values(InitialVisibility).includes(value as InitialVisibility)) {
			return value as InitialVisibility;
		}
		return undefined;
	}

	private isValidViewDescriptors(viewDescriptors: IUserFriendlyViewDescriptor[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(viewDescriptors)) {
			collector.error(localize('requirearray', "视图必须是一个数组"));
			return false;
		}

		for (const descriptor of viewDescriptors) {
			if (typeof descriptor.id !== 'string') {
				collector.error(localize('requirestring', "属性 \"{0}\" 是必需项并且必须为 \"string\" 类型", 'id'));
				return false;
			}
			if (typeof descriptor.name !== 'string') {
				collector.error(localize('requirestring', "属性 \"{0}\" 是必需项并且必须为 \"string\" 类型", 'name'));
				return false;
			}
			if (descriptor.when && typeof descriptor.when !== 'string') {
				collector.error(localize('optstring', "属性 \"{0}\" 可以省略，或者必须为 \"string\" 类型", 'when'));
				return false;
			}
			if (descriptor.icon && typeof descriptor.icon !== 'string') {
				collector.error(localize('optstring', "属性 \"{0}\" 可以省略，或者必须为 \"string\" 类型", 'icon'));
				return false;
			}
			if (descriptor.contextualTitle && typeof descriptor.contextualTitle !== 'string') {
				collector.error(localize('optstring', "属性 \"{0}\" 可以省略，或者必须为 \"string\" 类型", 'contextualTitle'));
				return false;
			}
			if (descriptor.visibility && !this.convertInitialVisibility(descriptor.visibility)) {
				collector.error(localize('optenum', "属性“{0}”可被省略或必须是 {1} 之一", 'visibility', Object.values(InitialVisibility).join(', ')));
				return false;
			}
		}

		return true;
	}

	private getViewContainer(value: string): ViewContainer | undefined {
		switch (value) {
			case 'explorer': return this.viewContainersRegistry.get(EXPLORER);
			case 'remote': return this.viewContainersRegistry.get(REMOTE);
			default: return this.viewContainersRegistry.get(`workbench.view.extension.${value}`);
		}
	}

	private showCollapsed(container: ViewContainer): boolean {
		switch (container.id) {
			case EXPLORER:
				return true;
		}
		return false;
	}
}

class ViewContainersDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.viewsContainers;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.viewsContainers || {};

		const viewContainers = Object.keys(contrib).reduce((result, location) => {
			const viewContainersForLocation = contrib[location];
			result.push(...viewContainersForLocation.map(viewContainer => ({ ...viewContainer, location })));
			return result;
		}, [] as Array<{ id: string; title: string; location: string }>);

		if (!viewContainers.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			localize('view container id', "ID"),
			localize('view container title', "标题"),
			localize('view container location', "位置"),
		];

		const rows: IRowData[][] = viewContainers
			.sort((a, b) => a.id.localeCompare(b.id))
			.map(viewContainer => {
				return [
					viewContainer.id,
					viewContainer.title,
					viewContainer.location
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

class ViewsDataRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.views;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const contrib = manifest.contributes?.views || {};

		const views = Object.keys(contrib).reduce((result, location) => {
			const viewsForLocation = contrib[location];
			result.push(...viewsForLocation.map(view => ({ ...view, location })));
			return result;
		}, [] as Array<{ id: string; name: string; location: string }>);

		if (!views.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			localize('view id', "ID"),
			localize('view name title', "名称"),
			localize('view container location', "位置"),
		];

		const rows: IRowData[][] = views
			.sort((a, b) => a.id.localeCompare(b.id))
			.map(view => {
				return [
					view.id,
					view.name,
					view.location
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

Registry.as<IExtensionFeaturesRegistry>(ExtensionFeaturesRegistryExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'viewsContainers',
	label: localize('viewsContainers', "查看容器"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(ViewContainersDataRenderer),
});

Registry.as<IExtensionFeaturesRegistry>(ExtensionFeaturesRegistryExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'views',
	label: localize('views', "视图"),
	access: {
		canToggle: false
	},
	renderer: new SyncDescriptor(ViewsDataRenderer),
});

registerWorkbenchContribution2(ViewsExtensionHandler.ID, ViewsExtensionHandler, WorkbenchPhase.BlockStartup);
