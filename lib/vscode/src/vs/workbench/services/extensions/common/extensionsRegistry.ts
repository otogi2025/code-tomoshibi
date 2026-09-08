/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import Severity from '../../../../base/common/severity.js';
import { EXTENSION_IDENTIFIER_PATTERN } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { Extensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IMessage } from './extensions.js';
import { IExtensionDescription, EXTENSION_CATEGORIES, ExtensionIdentifierSet } from '../../../../platform/extensions/common/extensions.js';
import { ExtensionKind } from '../../../../platform/environment/common/environment.js';
import { productSchemaId } from '../../../../platform/product/common/productService.js';
import { ImplicitActivationEvents, IActivationEventsGenerator } from '../../../../platform/extensionManagement/common/implicitActivationEvents.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { allApiProposals } from '../../../../platform/extensions/common/extensionsApiProposals.js';

const schemaRegistry = Registry.as<IJSONContributionRegistry>(Extensions.JSONContribution);

export class ExtensionMessageCollector {

	private readonly _messageHandler: (msg: IMessage) => void;
	private readonly _extension: IExtensionDescription;
	private readonly _extensionPointId: string;

	constructor(
		messageHandler: (msg: IMessage) => void,
		extension: IExtensionDescription,
		extensionPointId: string
	) {
		this._messageHandler = messageHandler;
		this._extension = extension;
		this._extensionPointId = extensionPointId;
	}

	private _msg(type: Severity, message: string): void {
		this._messageHandler({
			type: type,
			message: message,
			extensionId: this._extension.identifier,
			extensionPointId: this._extensionPointId
		});
	}

	public error(message: string): void {
		this._msg(Severity.Error, message);
	}

	public warn(message: string): void {
		this._msg(Severity.Warning, message);
	}

	public info(message: string): void {
		this._msg(Severity.Info, message);
	}
}

export interface IExtensionPointUser<T> {
	description: IExtensionDescription;
	value: T;
	collector: ExtensionMessageCollector;
}

export type IExtensionPointHandler<T> = (extensions: readonly IExtensionPointUser<T>[], delta: ExtensionPointUserDelta<T>) => void;

export interface IExtensionPoint<T> {
	readonly name: string;
	setHandler(handler: IExtensionPointHandler<T>): IDisposable;
	readonly defaultExtensionKind: ExtensionKind[] | undefined;
	readonly canHandleResolver?: boolean;
}

export class ExtensionPointUserDelta<T> {

	private static _toSet<T>(arr: readonly IExtensionPointUser<T>[]): ExtensionIdentifierSet {
		const result = new ExtensionIdentifierSet();
		for (let i = 0, len = arr.length; i < len; i++) {
			result.add(arr[i].description.identifier);
		}
		return result;
	}

	public static compute<T>(previous: readonly IExtensionPointUser<T>[] | null, current: readonly IExtensionPointUser<T>[]): ExtensionPointUserDelta<T> {
		if (!previous || !previous.length) {
			return new ExtensionPointUserDelta<T>(current, []);
		}
		if (!current || !current.length) {
			return new ExtensionPointUserDelta<T>([], previous);
		}

		const previousSet = this._toSet(previous);
		const currentSet = this._toSet(current);

		const added = current.filter(user => !previousSet.has(user.description.identifier));
		const removed = previous.filter(user => !currentSet.has(user.description.identifier));

		return new ExtensionPointUserDelta<T>(added, removed);
	}

	constructor(
		public readonly added: readonly IExtensionPointUser<T>[],
		public readonly removed: readonly IExtensionPointUser<T>[],
	) { }
}

export class ExtensionPoint<T> implements IExtensionPoint<T> {

	public readonly name: string;
	public readonly defaultExtensionKind: ExtensionKind[] | undefined;
	public readonly canHandleResolver?: boolean;

	private _handler: IExtensionPointHandler<T> | null;
	private _users: IExtensionPointUser<T>[] | null;
	private _delta: ExtensionPointUserDelta<T> | null;

	constructor(name: string, defaultExtensionKind: ExtensionKind[] | undefined, canHandleResolver?: boolean) {
		this.name = name;
		this.defaultExtensionKind = defaultExtensionKind;
		this.canHandleResolver = canHandleResolver;
		this._handler = null;
		this._users = null;
		this._delta = null;
	}

	setHandler(handler: IExtensionPointHandler<T>): IDisposable {
		if (this._handler !== null) {
			throw new Error('Handler already set!');
		}
		this._handler = handler;
		this._handle();

		return {
			dispose: () => {
				this._handler = null;
			}
		};
	}

	acceptUsers(users: IExtensionPointUser<T>[]): void {
		this._delta = ExtensionPointUserDelta.compute(this._users, users);
		this._users = users;
		this._handle();
	}

	private _handle(): void {
		if (this._handler === null || this._users === null || this._delta === null) {
			return;
		}

		try {
			this._handler(this._users, this._delta);
		} catch (err) {
			onUnexpectedError(err);
		}
	}
}

const extensionKindSchema: IJSONSchema = {
	type: 'string',
	enum: [
		'ui',
		'workspace'
	],
	enumDescriptions: [
		nls.localize('ui', "UI 扩展类型。在远程窗口中, 仅本地计算机可用时启用此类扩展。"),
		nls.localize('workspace', "工作区扩展类型。在远程窗口中，仅远程可用时启用此类扩展。"),
	],
};

const schemaId = 'vscode://schemas/vscode-extensions';
export const schema: IJSONSchema = {
	properties: {
		engines: {
			type: 'object',
			description: nls.localize('vscode.extension.engines', "引擎兼容性。"),
			properties: {
				'vscode': {
					type: 'string',
					description: nls.localize('vscode.extension.engines.vscode', '对于 VS Code 扩展，指定与其兼容的 VS Code 版本。不能为 *。例如: ^1.105.0 表示最低兼容 VS Code 版本 1.105.0。'),
					default: '^1.105.0',
				}
			}
		},
		publisher: {
			description: nls.localize('vscode.extension.publisher', 'VS Code 扩展的发布者。'),
			type: 'string'
		},
		displayName: {
			description: nls.localize('vscode.extension.displayName', 'VS Code 库中使用的扩展的显示名称。'),
			type: 'string'
		},
		categories: {
			description: nls.localize('vscode.extension.categories', 'VS Code 库用于对扩展进行分类的类别。'),
			type: 'array',
			uniqueItems: true,
			items: {
				oneOf: [{
					type: 'string',
					enum: EXTENSION_CATEGORIES,
				},
				{
					type: 'string',
					const: 'Languages',
					deprecationMessage: nls.localize('vscode.extension.category.languages.deprecated', '请改用 "Programming Languages"'),
				}]
			}
		},
		galleryBanner: {
			type: 'object',
			description: nls.localize('vscode.extension.galleryBanner', 'VS Code 商城使用的横幅。'),
			properties: {
				color: {
					description: nls.localize('vscode.extension.galleryBanner.color', 'VS Code 商城页标题上的横幅颜色。'),
					type: 'string'
				},
				theme: {
					description: nls.localize('vscode.extension.galleryBanner.theme', '横幅文字的颜色主题。'),
					type: 'string',
					enum: ['dark', 'light']
				}
			}
		},
		contributes: {
			description: nls.localize('vscode.extension.contributes', '由此包表示的 VS Code 扩展的所有贡献。'),
			type: 'object',
			// eslint-disable-next-line local/code-no-any-casts
			properties: {
				// extensions will fill in
			} as any as { [key: string]: any },
			default: {}
		},
		preview: {
			type: 'boolean',
			description: nls.localize('vscode.extension.preview', '在 Marketplace 中设置扩展，将其标记为“预览”。'),
		},
		enableProposedApi: {
			type: 'boolean',
			deprecationMessage: nls.localize('vscode.extension.enableProposedApi.deprecated', '请改用 `enabledApiProposals`。'),
		},
		enabledApiProposals: {
			markdownDescription: nls.localize('vscode.extension.enabledApiProposals', '启用 API 建议以试用它们。仅在 **开发期间有效**。**无法使用此属性发布** 扩展。有关更多详细信息，请访问: https://code.visualstudio.com/api/advanced-topics/using-proposed-api'),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				enum: Object.keys(allApiProposals).map(proposalName => proposalName),
				markdownEnumDescriptions: Object.values(allApiProposals).map(value => value.proposal)
			}
		},
		api: {
			markdownDescription: nls.localize('vscode.extension.api', '描述此扩展提供的 API。有关更多详细信息，请访问: https://code.visualstudio.com/api/advanced-topics/remote-extensions#handling-dependencies-with-remote-extensions'),
			type: 'string',
			enum: ['none'],
			enumDescriptions: [
				nls.localize('vscode.extension.api.none', "完全放弃导出任何 API 的功能。通过此操作，依赖于此扩展的其他扩展将能够在单独的扩展主机进程或远程计算机中运行。")
			]
		},
		activationEvents: {
			description: nls.localize('vscode.extension.activationEvents', 'VS Code 扩展的激活事件。'),
			type: 'array',
			items: {
				type: 'string',
				defaultSnippets: [
					{
						label: 'onWebviewPanel',
						description: nls.localize('vscode.extension.activationEvents.onWebviewPanel', '当加载某个 viewType 的 Web 视图时，会发出激活事件'),
						body: 'onWebviewPanel:viewType'
					},
					{
						label: 'onLanguage',
						description: nls.localize('vscode.extension.activationEvents.onLanguage', '在打开被解析为指定语言的文件时发出的激活事件。'),
						body: 'onLanguage:${1:languageId}'
					},
					{
						label: 'onCommand',
						description: nls.localize('vscode.extension.activationEvents.onCommand', '在调用指定命令时发出的激活事件。'),
						body: 'onCommand:${2:commandId}'
					},
					{
						label: 'workspaceContains',
						description: nls.localize('vscode.extension.activationEvents.workspaceContains', '在打开至少包含一个匹配指定 glob 模式的文件的文件夹时发出的激活事件。'),
						body: 'workspaceContains:${4:filePattern}'
					},
					{
						label: 'onStartupFinished',
						description: nls.localize('vscode.extension.activationEvents.onStartupFinished', '启动完成后(在所有 "*" 激活的扩展完成激活后)发出的激活事件。'),
						body: 'onStartupFinished'
					},
					{
						label: 'onTaskType',
						description: nls.localize('vscode.extension.activationEvents.onTaskType', '每当需要列出或解决特定类型的任务时，都会发出激活事件。'),
						body: 'onTaskType:${1:taskType}'
					},
					{
						label: 'onFileSystem',
						description: nls.localize('vscode.extension.activationEvents.onFileSystem', '在使用给定协议打开文件或文件夹时发出的激活事件。'),
						body: 'onFileSystem:${1:scheme}'
					},
					{
						label: 'onEditSession',
						description: nls.localize('vscode.extension.activationEvents.onEditSession', '在使用给定方案访问编辑会话时发出的激活事件。'),
						body: 'onEditSession:${1:scheme}'
					},
					{
						label: 'onSearch',
						description: nls.localize('vscode.extension.activationEvents.onSearch', '在开始从给定协议的文件夹中搜索时发出的激活事件。'),
						body: 'onSearch:${7:scheme}'
					},
					{
						label: 'onView',
						body: 'onView:${5:viewId}',
						description: nls.localize('vscode.extension.activationEvents.onView', '在指定视图被展开时发出的激活事件。'),
					},
					{
						label: 'onUri',
						body: 'onUri',
						description: nls.localize('vscode.extension.activationEvents.onUri', '在打开系统范围内并指向此扩展的 URI 时发出的激活事件。'),
					},
					{
						label: 'onOpenExternalUri',
						body: 'onOpenExternalUri',
						description: nls.localize('vscode.extension.activationEvents.onOpenExternalUri', '每当打开一个外部 uri (例如 http 或 https 链接)时发出的激活事件。'),
					},
					{
						label: 'onCustomEditor',
						body: 'onCustomEditor:${9:viewType}',
						description: nls.localize('vscode.extension.activationEvents.onCustomEditor', '每当指定的自定义编辑器变为可见时，都会发出激活事件。'),
					},
					{
						label: 'onNotebook',
						body: 'onNotebook:${1:type}',
						description: nls.localize('vscode.extension.activationEvents.onNotebook', '在指定的笔记本文档被打开时发出的激活事件。'),
					},
					{
						label: 'onAuthenticationRequest',
						body: 'onAuthenticationRequest:${11:authenticationProviderId}',
						description: nls.localize('vscode.extension.activationEvents.onAuthenticationRequest', '每次从指定的身份验证提供程序请求会话时发出的激活事件。')
					},
					{
						label: 'onRenderer',
						description: nls.localize('vscode.extension.activationEvents.onRenderer', '每当使用笔记本输出呈现器时发出激活事件。'),
						body: 'onRenderer:${11:rendererId}'
					},
					{
						label: 'onTerminalProfile',
						body: 'onTerminalProfile:${1:terminalId}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalProfile', '启动特定终端配置文件时发出的激活事件。'),
					},
					{
						label: 'onTerminalQuickFixRequest',
						body: 'onTerminalQuickFixRequest:${1:quickFixId}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalQuickFixRequest', '当命令匹配与此 ID 关联的选择器时发出的激活事件'),
					},
					{
						label: 'onWalkthrough',
						body: 'onWalkthrough:${1:walkthroughID}',
						description: nls.localize('vscode.extension.activationEvents.onWalkthrough', '打开指定演练时发出的激活事件。'),
					},
					{
						label: 'onIssueReporterOpened',
						body: 'onIssueReporterOpened',
						description: nls.localize('vscode.extension.activationEvents.onIssueReporterOpened', '问题报告器打开时发出的激活事件。'),
					},
					{
						label: 'onChatParticipant',
						body: 'onChatParticipant:${1:participantId}',
						description: nls.localize('vscode.extension.activationEvents.onChatParticipant', '调用指定聊天参与者时发出的激活事件。'),
					},
					{
						label: 'onChatContextProvider',
						body: 'onChatContextProvider:${1:contextProviderId}',
						description: nls.localize('vscode.extension.activationEvents.onChatContextProvider', '调用指定聊天上下文提供程序时发出的激活事件。'),
					},
					{
						label: 'onLanguageModelChatProvider',
						body: 'onLanguageModelChatProvider:${1:vendor}',
						description: nls.localize('vscode.extension.activationEvents.onLanguageModelChatProvider', '请求给定供应商的聊天模型提供程序时发出的激活事件。'),
					},
					{
						label: 'onLanguageModelTool',
						body: 'onLanguageModelTool:${1:toolId}',
						description: nls.localize('vscode.extension.activationEvents.onLanguageModelTool', '调用指定语言模型工具时发出的激活事件。'),
					},
					{
						label: 'onTerminal',
						body: 'onTerminal:{1:shellType}',
						description: nls.localize('vscode.extension.activationEvents.onTerminal', '打开给定 shell 类型的终端时发出的激活事件。'),
					},
					{
						label: 'onTerminalShellIntegration',
						body: 'onTerminalShellIntegration:${1:shellType}',
						description: nls.localize('vscode.extension.activationEvents.onTerminalShellIntegration', '为给定的 shell 类型激活终端 shell 集成时发出的激活事件。'),
					},
					{
						label: 'onMcpCollection',
						description: nls.localize('vscode.extension.activationEvents.onMcpCollection', '每当请求 MCP 服务器中的工具时发出的激活事件。'),
						body: 'onMcpCollection:${2:collectionId}',
					},
					{
						label: '*',
						description: nls.localize('vscode.extension.activationEvents.star', '在 VS Code 启动时发出的激活事件。为确保良好的最终用户体验，请仅在其他激活事件组合不适用于你的情况时，才在扩展中使用此事件。'),
						body: '*'
					}
				],
			}
		},
		badges: {
			type: 'array',
			description: nls.localize('vscode.extension.badges', '在 Marketplace 的扩展页边栏中显示的徽章数组。'),
			items: {
				type: 'object',
				required: ['url', 'href', 'description'],
				properties: {
					url: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.url', '徽章图像 URL。')
					},
					href: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.href', '徽章链接。')
					},
					description: {
						type: 'string',
						description: nls.localize('vscode.extension.badges.description', '徽章说明。')
					}
				}
			}
		},
		markdown: {
			type: 'string',
			description: nls.localize('vscode.extension.markdown', "控制商店中使用的 Markdown 渲染引擎。可为 \"github\" (默认) 或 \"standard\" (标准)。"),
			enum: ['github', 'standard'],
			default: 'github'
		},
		qna: {
			default: 'marketplace',
			description: nls.localize('vscode.extension.qna', "控制市场中的“问与答”(Q&A)链接。设置为 \"marketplace\" 可启用市场的默认“问与答”页面。设置为其他字符串可指向自定义的“问与答”页面。设置为 \"false\" 可完全禁用“问与答”。"),
			anyOf: [
				{
					type: ['string', 'boolean'],
					enum: ['marketplace', false]
				},
				{
					type: 'string'
				}
			]
		},
		extensionDependencies: {
			description: nls.localize('vscode.extension.extensionDependencies', '其他扩展的依赖关系。扩展的标识符始终是 ${publisher}.${name}。例如: vscode.csharp。'),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionAffinity: {
			description: nls.localize('vscode.extension.extensionAffinity', '此扩展应在可能的情况下在同一扩展主机进程中与之共存的扩展。扩展的标识符始终为 ${publisher}.${name}。例如: vscode.git。'),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionPack: {
			description: nls.localize('vscode.extension.contributes.extensionPack', "可一起安装的一组扩展。扩展的标识符始终为 ${publisher}.${name}。例如: vscode.csharp。"),
			type: 'array',
			uniqueItems: true,
			items: {
				type: 'string',
				pattern: EXTENSION_IDENTIFIER_PATTERN
			}
		},
		extensionKind: {
			description: nls.localize('extensionKind', "定义扩展的类型。\"ui\"扩展在本地计算机上安装和运行，而 \"工作区\" 扩展则在远程计算机上运行。"),
			type: 'array',
			items: extensionKindSchema,
			default: ['workspace'],
			defaultSnippets: [
				{
					body: ['ui'],
					description: nls.localize('extensionKind.ui', "定义一个扩展，该扩展在连接到远程窗口时只能在本地计算机上运行。")
				},
				{
					body: ['workspace'],
					description: nls.localize('extensionKind.workspace', "定义一个扩展，该扩展只能在连接远程窗口时在远程计算机上运行。")
				},
				{
					body: ['ui', 'workspace'],
					description: nls.localize('extensionKind.ui-workspace', "定义可在任意一侧运行的扩展，并首选在本地计算机上运行。")
				},
				{
					body: ['workspace', 'ui'],
					description: nls.localize('extensionKind.workspace-ui', "定义可在任意一侧运行的扩展，并首选在远程计算机上运行。")
				},
				{
					body: [],
					description: nls.localize('extensionKind.empty', "定义一个无法在远程上下文中运行的扩展，既不能在本地上，也不能在远程计算机上运行。")
				}
			]
		},
		capabilities: {
			description: nls.localize('vscode.extension.capabilities', "通过扩展声明一组受支持的功能。"),
			type: 'object',
			properties: {
				virtualWorkspaces: {
					description: nls.localize('vscode.extension.capabilities.virtualWorkspaces', "声明是否应在虚拟工作区中启用扩展。虚拟工作区是一个不受任何磁盘资源支持的工作区。当为 false 时，会在虚拟工作区中自动禁用此扩展。默认值为 true。"),
					type: ['boolean', 'object'],
					defaultSnippets: [
						{ label: 'limited', body: { supported: '${1:limited}', description: '${2}' } },
						{ label: 'false', body: { supported: false, description: '${2}' } },
					],
					default: true.valueOf,
					properties: {
						supported: {
							markdownDescription: nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported', "通过扩展为虚拟工作区声明支持级别。"),
							type: ['string', 'boolean'],
							enum: ['limited', true, false],
							enumDescriptions: [
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.limited', "将在禁用了部分功能的虚拟工作区中启用扩展。"),
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.true', "将在虚拟工作区中启用扩展，并启用所有功能。"),
								nls.localize('vscode.extension.capabilities.virtualWorkspaces.supported.false', "将不会在虚拟工作区中启用扩展。"),
							]
						},
						description: {
							type: 'string',
							markdownDescription: nls.localize('vscode.extension.capabilities.virtualWorkspaces.description', "对虚拟工作区如何影响扩展行为及其需要的原因的说明。这仅在 \"supported\" 不为 \"true\" 时适用。"),
						}
					}
				},
				untrustedWorkspaces: {
					description: nls.localize('vscode.extension.capabilities.untrustedWorkspaces', '声明应如何在不受信任的工作区中处理扩展。'),
					type: 'object',
					required: ['supported'],
					defaultSnippets: [
						{ body: { supported: '${1:limited}', description: '${2}' } },
					],
					properties: {
						supported: {
							markdownDescription: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported', "通过扩展为不受信任的工作区声明支持级别。"),
							type: ['string', 'boolean'],
							enum: ['limited', true, false],
							enumDescriptions: [
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.limited', "将在禁用了部分功能的不受信任工作区中启用扩展。"),
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.true', "将在启用了所有功能的不受信任工作区中启用扩展。"),
								nls.localize('vscode.extension.capabilities.untrustedWorkspaces.supported.false', "将不会在不受信任的工作区中启用扩展。"),
							]
						},
						restrictedConfigurations: {
							description: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.restrictedConfigurations', "扩展中提供的、不应在不受信任的工作区中使用工作区值的配置键列表。"),
							type: 'array',
							items: {
								type: 'string'
							}
						},
						description: {
							type: 'string',
							markdownDescription: nls.localize('vscode.extension.capabilities.untrustedWorkspaces.description', "对工作区信任如何影响扩展行为及其需要的原因的说明。这仅在 \"supported\" 不为 \"true\" 时适用。"),
						}
					}
				}
			}
		},
		sponsor: {
			description: nls.localize('vscode.extension.contributes.sponsor', "指定用户可以从中赞助扩展的位置。"),
			type: 'object',
			defaultSnippets: [
				{ body: { url: '${1:https:}' } },
			],
			properties: {
				'url': {
					description: nls.localize('vscode.extension.contributes.sponsor.url', "用户可以从中赞助扩展的 URL。它必须是使用 HTTP 或 HTTPS 协议的有效 URL。示例值: https://github.com/sponsors/nvaccess"),
					type: 'string',
				}
			}
		},
		scripts: {
			type: 'object',
			properties: {
				'vscode:prepublish': {
					description: nls.localize('vscode.extension.scripts.prepublish', '包作为 VS Code 扩展发布前执行的脚本。'),
					type: 'string'
				},
				'vscode:uninstall': {
					description: nls.localize('vscode.extension.scripts.uninstall', 'VS Code 扩展的卸载钩子。在扩展从 VS Code 卸载且 VS Code 重启 (关闭后开启) 后执行的脚本。仅支持 Node 脚本。'),
					type: 'string'
				}
			}
		},
		icon: {
			type: 'string',
			description: nls.localize('vscode.extension.icon', '128 x 128 像素图标的路径。')
		},
		l10n: {
			type: 'string',
			description: nls.localize({
				key: 'vscode.extension.l10n',
				comment: [
					'{Locked="bundle.l10n._locale_.json"}',
					'{Locked="vscode.l10n API"}'
				]
			}, '包含本地化(bundle.l10n.*.json)文件的文件夹的相对路径。如果使用的是 vscode.l10n API，则必须指定它。')
		},
		pricing: {
			type: 'string',
			markdownDescription: nls.localize('vscode.extension.pricing', '扩展的定价信息。可以是免费 (默认) 或试用版。有关详细信息，请访问: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#extension-pricing-label'),
			enum: ['Free', 'Trial'],
			default: 'Free'
		}
	}
};

export type removeArray<T> = T extends Array<infer X> ? X : T;

export interface IExtensionPointDescriptor<T> {
	extensionPoint: string;
	deps?: IExtensionPoint<unknown>[];
	jsonSchema: IJSONSchema;
	defaultExtensionKind?: ExtensionKind[];
	canHandleResolver?: boolean;
	/**
	 * A function which runs before the extension point has been validated and which
	 * should collect automatic activation events from the contribution.
	 */
	activationEventsGenerator?: IActivationEventsGenerator<removeArray<T>>;
}

export class ExtensionsRegistryImpl {

	private readonly _extensionPoints = new Map<string, ExtensionPoint<any>>();

	public registerExtensionPoint<T>(desc: IExtensionPointDescriptor<T>): IExtensionPoint<T> {
		if (this._extensionPoints.has(desc.extensionPoint)) {
			throw new Error('Duplicate extension point: ' + desc.extensionPoint);
		}
		const result = new ExtensionPoint<T>(desc.extensionPoint, desc.defaultExtensionKind, desc.canHandleResolver);
		this._extensionPoints.set(desc.extensionPoint, result);
		if (desc.activationEventsGenerator) {
			ImplicitActivationEvents.register(desc.extensionPoint, desc.activationEventsGenerator);
		}

		schema.properties!['contributes'].properties![desc.extensionPoint] = desc.jsonSchema;
		schemaRegistry.registerSchema(schemaId, schema);

		return result;
	}

	public getExtensionPoints(): ExtensionPoint<unknown>[] {
		return Array.from(this._extensionPoints.values());
	}
}

const PRExtensions = {
	ExtensionsRegistry: 'ExtensionsRegistry'
};
Registry.add(PRExtensions.ExtensionsRegistry, new ExtensionsRegistryImpl());
export const ExtensionsRegistry: ExtensionsRegistryImpl = Registry.as(PRExtensions.ExtensionsRegistry);

schemaRegistry.registerSchema(schemaId, schema);


schemaRegistry.registerSchema(productSchemaId, {
	properties: {
		extensionEnabledApiProposals: {
			description: nls.localize('product.extensionEnabledApiProposals', "相应扩展可以自由使用的 API 建议。"),
			type: 'object',
			properties: {},
			additionalProperties: {
				anyOf: [{
					type: 'array',
					uniqueItems: true,
					items: {
						type: 'string',
						enum: Object.keys(allApiProposals),
						markdownEnumDescriptions: Object.values(allApiProposals).map(value => value.proposal)
					}
				}]
			}
		}
	}
});
