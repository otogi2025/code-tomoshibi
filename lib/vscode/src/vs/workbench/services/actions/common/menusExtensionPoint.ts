/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { isFalsyOrWhitespace } from '../../../../base/common/strings.js';
import * as resources from '../../../../base/common/resources.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { IExtensionPointUser, ExtensionMessageCollector, ExtensionsRegistry } from '../../extensions/common/extensionsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuId, MenuRegistry, IMenuItem, ISubmenuItem } from '../../../../platform/actions/common/actions.js';
import { URI } from '../../../../base/common/uri.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { index } from '../../../../base/common/arrays.js';
import { isProposedApiEnabled } from '../../extensions/common/extensions.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { IExtensionFeatureTableRenderer, IExtensionFeaturesRegistry, IRenderedData, IRowData, ITableData, Extensions as ExtensionFeaturesExtensions } from '../../extensionManagement/common/extensionFeatures.js';
import { IExtensionManifest, IKeyBinding } from '../../../../platform/extensions/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { platform } from '../../../../base/common/process.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { ResolvedKeybinding } from '../../../../base/common/keybindings.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ApiProposalName } from '../../../../platform/extensions/common/extensionsApiProposals.js';

interface IAPIMenu {
	readonly key: string;
	readonly id: MenuId;
	readonly description: string;
	readonly proposed?: ApiProposalName;
	readonly supportsSubmenus?: boolean; // defaults to true
}

const apiMenus: IAPIMenu[] = [
	{
		key: 'commandPalette',
		id: MenuId.CommandPalette,
		description: localize('menus.commandPalette', "命令面板"),
		supportsSubmenus: false
	},
	{
		key: 'touchBar',
		id: MenuId.TouchBarContext,
		description: localize('menus.touchBar', "触控栏 (仅 macOS)"),
		supportsSubmenus: false
	},
	{
		key: 'editor/title',
		id: MenuId.EditorTitle,
		description: localize('menus.editorTitle', "编辑器标题菜单")
	},
	{
		key: 'modalEditor/editorTitle',
		id: MenuId.ModalEditorEditorTitle,
		description: localize('menus.modalEditorEditorTitle', "模态编辑器中的编辑器标题菜单")
	},
	{
		key: 'editor/title/run',
		id: MenuId.EditorTitleRun,
		description: localize('menus.editorTitleRun', "在编辑器标题菜单内运行子菜单")
	},
	{
		key: 'editor/context',
		id: MenuId.EditorContext,
		description: localize('menus.editorContext', "编辑器上下文菜单")
	},
	{
		key: 'editor/context/copy',
		id: MenuId.EditorContextCopy,
		description: localize('menus.editorContextCopyAs', "编辑器上下文菜单中的“复制为”子菜单")
	},
	{
		key: 'editor/context/share',
		id: MenuId.EditorContextShare,
		description: localize('menus.editorContextShare', "编辑器上下文菜单中的“共享”子菜单"),
		proposed: 'contribShareMenu'
	},
	{
		key: 'explorer/context',
		id: MenuId.ExplorerContext,
		description: localize('menus.explorerContext', "文件资源管理器上下文菜单")
	},
	{
		key: 'explorer/context/share',
		id: MenuId.ExplorerContextShare,
		description: localize('menus.explorerContextShare', "文件资源管理器上下文菜单中的“共享”子菜单"),
		proposed: 'contribShareMenu'
	},
	{
		key: 'editor/title/context',
		id: MenuId.EditorTitleContext,
		description: localize('menus.editorTabContext', "编辑器选项卡上下文菜单")
	},
	{
		key: 'editor/title/context/share',
		id: MenuId.EditorTitleContextShare,
		description: localize('menus.editorTitleContextShare', "编辑器标题上下文菜单内的“共享”子菜单"),
		proposed: 'contribShareMenu'
	},
	{
		key: 'menuBar/home',
		id: MenuId.MenubarHomeMenu,
		description: localize('menus.home', "主指示器上下文菜单(仅限 Web)"),
		proposed: 'contribMenuBarHome',
		supportsSubmenus: false
	},
	{
		key: 'menuBar/edit/copy',
		id: MenuId.MenubarCopy,
		description: localize('menus.opy', "顶层“编辑”菜单中的“复制为”子菜单")
	},
	{
		key: 'terminal/context',
		id: MenuId.TerminalInstanceContext,
		description: localize('menus.terminalContext', "终端上下文菜单")
	},
	{
		key: 'terminal/title/context',
		id: MenuId.TerminalTabContext,
		description: localize('menus.terminalTabContext', "终端选项卡上下文菜单")
	},
	{
		key: 'view/title',
		id: MenuId.ViewTitle,
		description: localize('view.viewTitle', "提供的视图的标题菜单")
	},
	{
		key: 'viewContainer/title',
		id: MenuId.ViewContainerTitle,
		description: localize('view.containerTitle', "贡献的视图容器标题菜单"),
		proposed: 'contribViewContainerTitle'
	},
	{
		key: 'view/item/context',
		id: MenuId.ViewItemContext,
		description: localize('view.itemContext', "提供的视图中的项目的上下文菜单")
	},
	{
		key: 'comments/comment/editorActions',
		id: MenuId.CommentEditorActions,
		description: localize('commentThread.editorActions', "贡献的注释编辑器操作"),
		proposed: 'contribCommentEditorActionsMenu'
	},
	{
		key: 'comments/commentThread/title',
		id: MenuId.CommentThreadTitle,
		description: localize('commentThread.title', "贡献的注释线程标题菜单")
	},
	{
		key: 'comments/commentThread/context',
		id: MenuId.CommentThreadActions,
		description: localize('commentThread.actions', "贡献的注释线程上下文菜单，呈现为注释编辑器下方的按钮"),
		supportsSubmenus: false
	},
	{
		key: 'comments/commentThread/additionalActions',
		id: MenuId.CommentThreadAdditionalActions,
		description: localize('commentThread.actions', "贡献的注释线程上下文菜单，呈现为注释编辑器下方的按钮"),
		supportsSubmenus: true,
		proposed: 'contribCommentThreadAdditionalMenu'
	},
	{
		key: 'comments/commentThread/title/context',
		id: MenuId.CommentThreadTitleContext,
		description: localize('commentThread.titleContext', "提供的注释线程标题的速览上下文菜单，在注释线程的速览标题上呈现为右键单击菜单。"),
		proposed: 'contribCommentPeekContext'
	},
	{
		key: 'comments/comment/title',
		id: MenuId.CommentTitle,
		description: localize('comment.title', "贡献的注释标题菜单")
	},
	{
		key: 'comments/comment/context',
		id: MenuId.CommentActions,
		description: localize('comment.actions', "贡献的注释上下文菜单，呈现为注释编辑器下方的按钮"),
		supportsSubmenus: false
	},
	{
		key: 'comments/commentThread/comment/context',
		id: MenuId.CommentThreadCommentContext,
		description: localize('comment.commentContext', "提供的注释上下文菜单，在注释线程速览视图中呈现为单个注释上的右键单击菜单。"),
		proposed: 'contribCommentPeekContext'
	},
	{
		key: 'commentsView/commentThread/context',
		id: MenuId.CommentsViewThreadActions,
		description: localize('commentsView.threadActions', "注释视图中提供的注释线程上下文菜单"),
		proposed: 'contribCommentsViewThreadMenus'
	},
	{
		key: 'issue/reporter',
		id: MenuId.IssueReporter,
		description: localize('issue.reporter', "提供的问题报告器菜单")
	},
	{
		key: 'extension/context',
		id: MenuId.ExtensionContext,
		description: localize('menus.extensionContext', "扩展上下文菜单")
	},
	{
		key: 'timeline/title',
		id: MenuId.TimelineTitle,
		description: localize('view.timelineTitle', "时间线视图标题菜单")
	},
	{
		key: 'timeline/item/context',
		id: MenuId.TimelineItemContext,
		description: localize('view.timelineContext', "时间线视图项上下文菜单")
	},
	{
		key: 'ports/item/context',
		id: MenuId.TunnelContext,
		description: localize('view.tunnelContext', "“端口”视图项目上下文菜单")
	},
	{
		key: 'ports/item/origin/inline',
		id: MenuId.TunnelOriginInline,
		description: localize('view.tunnelOriginInline', "“端口”视图项源内联菜单")
	},
	{
		key: 'ports/item/port/inline',
		id: MenuId.TunnelPortInline,
		description: localize('view.tunnelPortInline', "端口视图项端口内联菜单")
	},
	{
		key: 'file/newFile',
		id: MenuId.NewFile,
		description: localize('file.newFile', "“新建文件...”快速选取，显示在欢迎页面和文件菜单上。"),
		supportsSubmenus: false,
	},
	{
		key: 'webview/context',
		id: MenuId.WebviewContext,
		description: localize('webview.context', "Webview 上下文菜单")
	},
	{
		key: 'file/share',
		id: MenuId.MenubarShare,
		description: localize('menus.share', "共享顶级“文件”菜单中显示的子菜单。"),
		proposed: 'contribShareMenu'
	},
	{
		key: 'editor/inlineCompletions/actions',
		id: MenuId.InlineCompletionsActions,
		description: localize('inlineCompletions.actions', "悬停在内联完成项上时显示的操作"),
		supportsSubmenus: false,
		proposed: 'inlineCompletionsAdditions'
	},
	{
		key: 'editor/content',
		id: MenuId.EditorContent,
		description: localize('merge.toolbar', "编辑器中的突出按钮覆盖其内容"),
		proposed: 'contribEditorContentMenu'
	},
	{
		key: 'editor/lineNumber/context',
		id: MenuId.EditorLineNumberContext,
		description: localize('editorLineNumberContext', "贡献的编辑器行号上下文菜单")
	},
	{
		key: 'mergeEditor/result/title',
		id: MenuId.MergeInputResultToolbar,
		description: localize('menus.mergeEditorResult', "合并编辑器的结果工具栏"),
		proposed: 'contribMergeEditorMenus'
	},
	{
		key: 'multiDiffEditor/content',
		id: MenuId.MultiDiffEditorContent,
		description: localize('menus.multiDiffEditorContent', "覆盖多重差异编辑器的显著按钮"),
		proposed: 'contribEditorContentMenu'
	},
	{
		key: 'multiDiffEditor/resource/title',
		id: MenuId.MultiDiffEditorFileToolbar,
		description: localize('menus.multiDiffEditorResource', "多差异编辑器中的资源工具栏"),
		proposed: 'contribMultiDiffEditorMenus'
	},
	{
		key: 'diffEditor/gutter/hunk',
		id: MenuId.DiffEditorHunkToolbar,
		description: localize('menus.diffEditorGutterToolBarMenus', "差异编辑器中的装订线工具栏"),
		proposed: 'contribDiffEditorGutterToolBarMenus'
	},
	{
		key: 'diffEditor/gutter/selection',
		id: MenuId.DiffEditorSelectionToolbar,
		description: localize('menus.diffEditorGutterToolBarMenus', "差异编辑器中的装订线工具栏"),
		proposed: 'contribDiffEditorGutterToolBarMenus'
	},
	{
		key: 'searchPanel/aiResults/commands',
		id: MenuId.SearchActionMenu,
		description: localize('searchPanel.aiResultsCommands', "用于呈现为 AI 搜索标题旁边的按钮的菜单的命令"),
	},
];

namespace schema {

	// --- menus, submenus contribution point

	export interface IUserFriendlyMenuItem {
		command: string;
		alt?: string;
		when?: string;
		group?: string;
	}

	export interface IUserFriendlySubmenuItem {
		submenu: string;
		when?: string;
		group?: string;
	}

	export interface IUserFriendlySubmenu {
		id: string;
		label: string;
		icon?: IUserFriendlyIcon;
	}

	export function isMenuItem(item: IUserFriendlyMenuItem | IUserFriendlySubmenuItem): item is IUserFriendlyMenuItem {
		return typeof (item as IUserFriendlyMenuItem).command === 'string';
	}

	export function isValidMenuItem(item: IUserFriendlyMenuItem, collector: ExtensionMessageCollector): boolean {
		if (typeof item.command !== 'string') {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", 'command'));
			return false;
		}
		if (item.alt && typeof item.alt !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'alt'));
			return false;
		}
		if (item.when && typeof item.when !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'when'));
			return false;
		}
		if (item.group && typeof item.group !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'group'));
			return false;
		}

		return true;
	}

	export function isValidSubmenuItem(item: IUserFriendlySubmenuItem, collector: ExtensionMessageCollector): boolean {
		if (typeof item.submenu !== 'string') {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", 'submenu'));
			return false;
		}
		if (item.when && typeof item.when !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'when'));
			return false;
		}
		if (item.group && typeof item.group !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'group'));
			return false;
		}

		return true;
	}

	export function isValidItems(items: (IUserFriendlyMenuItem | IUserFriendlySubmenuItem)[], collector: ExtensionMessageCollector): boolean {
		if (!Array.isArray(items)) {
			collector.error(localize('requirearray', "子菜单项必须是数组"));
			return false;
		}

		for (const item of items) {
			if (isMenuItem(item)) {
				if (!isValidMenuItem(item, collector)) {
					return false;
				}
			} else {
				if (!isValidSubmenuItem(item, collector)) {
					return false;
				}
			}
		}

		return true;
	}

	export function isValidSubmenu(submenu: IUserFriendlySubmenu, collector: ExtensionMessageCollector): boolean {
		if (typeof submenu !== 'object') {
			collector.error(localize('require', "子菜单项必须是对象"));
			return false;
		}

		if (typeof submenu.id !== 'string') {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", 'id'));
			return false;
		}
		if (typeof submenu.label !== 'string') {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", 'label'));
			return false;
		}

		return true;
	}

	const menuItem: IJSONSchema = {
		type: 'object',
		required: ['command'],
		properties: {
			command: {
				description: localize('vscode.extension.contributes.menuItem.command', '要执行的命令的标识符。该命令必须在“命令”部分中声明'),
				type: 'string'
			},
			alt: {
				description: localize('vscode.extension.contributes.menuItem.alt', '要执行的替代命令的标识符。该命令必须在 \'commands\' 部分中声明'),
				type: 'string'
			},
			when: {
				description: localize('vscode.extension.contributes.menuItem.when', '此条件必须为 true 才能显示此项'),
				type: 'string'
			},
			group: {
				description: localize('vscode.extension.contributes.menuItem.group', '此项所属的组'),
				type: 'string'
			}
		}
	};

	const submenuItem: IJSONSchema = {
		type: 'object',
		required: ['submenu'],
		properties: {
			submenu: {
				description: localize('vscode.extension.contributes.menuItem.submenu', '要在此项中显示的子菜单的标识符。'),
				type: 'string'
			},
			when: {
				description: localize('vscode.extension.contributes.menuItem.when', '此条件必须为 true 才能显示此项'),
				type: 'string'
			},
			group: {
				description: localize('vscode.extension.contributes.menuItem.group', '此项所属的组'),
				type: 'string'
			}
		}
	};

	const submenu: IJSONSchema = {
		type: 'object',
		required: ['id', 'label'],
		properties: {
			id: {
				description: localize('vscode.extension.contributes.submenu.id', '要显示为子菜单的菜单的标识符。'),
				type: 'string'
			},
			label: {
				description: localize('vscode.extension.contributes.submenu.label', '指向此子菜单的菜单项的标签。'),
				type: 'string'
			},
			icon: {
				description: localize({ key: 'vscode.extension.contributes.submenu.icon', comment: ['do not translate or change "\\$(zap)", \\ in front of $ is important.'] }, '(可选)用于在 UI 中表示子菜单的图标。文件路径、具有深色和浅色主题的文件路径的对象，或主题图标引用，如 "\\$(zap)"'),
				anyOf: [{
					type: 'string'
				},
				{
					type: 'object',
					properties: {
						light: {
							description: localize('vscode.extension.contributes.submenu.icon.light', '使用浅色主题时的图标路径'),
							type: 'string'
						},
						dark: {
							description: localize('vscode.extension.contributes.submenu.icon.dark', '使用深色主题时的图标路径'),
							type: 'string'
						}
					}
				}]
			}
		}
	};

	export const menusContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.menus', "向编辑器提供菜单项"),
		type: 'object',
		properties: index(apiMenus, menu => menu.key, menu => ({
			markdownDescription: menu.proposed ? localize('proposed', "建议的 API 需要 `enabledApiProposal: [“{0}”]` - {1}", menu.proposed, menu.description) : menu.description,
			type: 'array',
			items: menu.supportsSubmenus === false ? menuItem : { oneOf: [menuItem, submenuItem] }
		})),
		additionalProperties: {
			description: 'Submenu',
			type: 'array',
			items: { oneOf: [menuItem, submenuItem] }
		}
	};

	export const submenusContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.submenus', "将子菜单项分配到编辑器"),
		type: 'array',
		items: submenu
	};

	// --- commands contribution point

	export interface IUserFriendlyCommand {
		command: string;
		title: string | ILocalizedString;
		shortTitle?: string | ILocalizedString;
		enablement?: string;
		category?: string | ILocalizedString;
		icon?: IUserFriendlyIcon;
	}

	export type IUserFriendlyIcon = string | { light: string; dark: string };

	export function isValidCommand(command: IUserFriendlyCommand, collector: ExtensionMessageCollector): boolean {
		if (!command) {
			collector.error(localize('nonempty', "应为非空值。"));
			return false;
		}
		if (isFalsyOrWhitespace(command.command)) {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", 'command'));
			return false;
		}
		if (!isValidLocalizedString(command.title, collector, 'title')) {
			return false;
		}
		if (command.shortTitle && !isValidLocalizedString(command.shortTitle, collector, 'shortTitle')) {
			return false;
		}
		if (command.enablement && typeof command.enablement !== 'string') {
			collector.error(localize('optstring', "属性“{0}”可以省略，或者必须为 `string` 类型", 'precondition'));
			return false;
		}
		if (command.category && !isValidLocalizedString(command.category, collector, 'category')) {
			return false;
		}
		if (!isValidIcon(command.icon, collector)) {
			return false;
		}
		return true;
	}

	function isValidIcon(icon: IUserFriendlyIcon | undefined, collector: ExtensionMessageCollector): boolean {
		if (typeof icon === 'undefined') {
			return true;
		}
		if (typeof icon === 'string') {
			return true;
		} else if (typeof icon.dark === 'string' && typeof icon.light === 'string') {
			return true;
		}
		collector.error(localize('opticon', "可以省略属性 `icon`，若不省略则必须是字符串或文字，例如 `{dark, light}`"));
		return false;
	}

	function isValidLocalizedString(localized: string | ILocalizedString, collector: ExtensionMessageCollector, propertyName: string): boolean {
		if (typeof localized === 'undefined') {
			collector.error(localize('requireStringOrObject', "属性“{0}”是必要属性，其类型必须是 `string` 或 `object`", propertyName));
			return false;
		} else if (typeof localized === 'string' && isFalsyOrWhitespace(localized)) {
			collector.error(localize('requirestring', "属性“{0}”是必需项，并且必须为 `string` 类型", propertyName));
			return false;
		} else if (typeof localized !== 'string' && (isFalsyOrWhitespace(localized.original) || isFalsyOrWhitespace(localized.value))) {
			collector.error(localize('requirestrings', "属性“{0}”和“{1}”是必要属性，其类型必须是 `{dark, light}`", `${propertyName}.value`, `${propertyName}.original`));
			return false;
		}

		return true;
	}

	const commandType: IJSONSchema = {
		type: 'object',
		required: ['command', 'title'],
		properties: {
			command: {
				description: localize('vscode.extension.contributes.commandType.command', '要执行的命令的标识符'),
				type: 'string'
			},
			title: {
				description: localize('vscode.extension.contributes.commandType.title', '在 UI 中依据其表示命令的标题'),
				type: 'string'
			},
			shortTitle: {
				markdownDescription: localize('vscode.extension.contributes.commandType.shortTitle', '(可选)简短标题，在 UI 中表示该命令。菜单将根据显示命令的上下文选取“标题”或“简短标题”。'),
				type: 'string'
			},
			category: {
				description: localize('vscode.extension.contributes.commandType.category', '(可选)类别字符串，命令在界面中根据此项分组'),
				type: 'string'
			},
			enablement: {
				description: localize('vscode.extension.contributes.commandType.precondition', '(可选)必须为 true 才能启用 UI (菜单和键绑定)中命令的条件。不会阻止通过其他方式执行命令，例如 `executeCommand`-api。'),
				type: 'string'
			},
			icon: {
				description: localize({ key: 'vscode.extension.contributes.commandType.icon', comment: ['do not translate or change "\\$(zap)", \\ in front of $ is important.'] }, '(可选)用于在 UI 中表示命令的图标。文件路径、具有深色和浅色主题的文件路径的对象，或主题图标引用，如 "\\$(zap)"'),
				anyOf: [{
					type: 'string'
				},
				{
					type: 'object',
					properties: {
						light: {
							description: localize('vscode.extension.contributes.commandType.icon.light', '使用浅色主题时的图标路径'),
							type: 'string'
						},
						dark: {
							description: localize('vscode.extension.contributes.commandType.icon.dark', '使用深色主题时的图标路径'),
							type: 'string'
						}
					}
				}]
			}
		}
	};

	export const commandsContribution: IJSONSchema = {
		description: localize('vscode.extension.contributes.commands', "对命令面板提供命令。"),
		oneOf: [
			commandType,
			{
				type: 'array',
				items: commandType
			}
		]
	};
}

const _commandRegistrations = new DisposableStore();

export const commandsExtensionPoint = ExtensionsRegistry.registerExtensionPoint<schema.IUserFriendlyCommand | schema.IUserFriendlyCommand[]>({
	extensionPoint: 'commands',
	jsonSchema: schema.commandsContribution,
	activationEventsGenerator: function* (contribs: readonly schema.IUserFriendlyCommand[]) {
		for (const contrib of contribs) {
			if (contrib.command) {
				yield `onCommand:${contrib.command}`;
			}
		}
	}
});

commandsExtensionPoint.setHandler(extensions => {

	function handleCommand(userFriendlyCommand: schema.IUserFriendlyCommand, extension: IExtensionPointUser<unknown>) {

		if (!schema.isValidCommand(userFriendlyCommand, extension.collector)) {
			return;
		}

		const { icon, enablement, category, title, shortTitle, command } = userFriendlyCommand;

		let absoluteIcon: { dark: URI; light?: URI } | ThemeIcon | undefined;
		if (icon) {
			if (typeof icon === 'string') {
				absoluteIcon = ThemeIcon.fromString(icon) ?? { dark: resources.joinPath(extension.description.extensionLocation, icon), light: resources.joinPath(extension.description.extensionLocation, icon) };

			} else {
				absoluteIcon = {
					dark: resources.joinPath(extension.description.extensionLocation, icon.dark),
					light: resources.joinPath(extension.description.extensionLocation, icon.light)
				};
			}
		}

		const existingCmd = MenuRegistry.getCommand(command);
		if (existingCmd) {
			if (existingCmd.source) {
				extension.collector.info(localize('dup1', "{1} 已注册命令 `{0}` ({2})", userFriendlyCommand.command, existingCmd.source.title, existingCmd.source.id));
			} else {
				extension.collector.info(localize('dup0', "已注册命令 `{0}`", userFriendlyCommand.command));
			}
		}
		_commandRegistrations.add(MenuRegistry.addCommand({
			id: command,
			title,
			source: { id: extension.description.identifier.value, title: extension.description.displayName ?? extension.description.name },
			shortTitle,
			tooltip: title,
			category,
			precondition: ContextKeyExpr.deserialize(enablement),
			icon: absoluteIcon
		}));
	}

	// remove all previous command registrations
	_commandRegistrations.clear();

	for (const extension of extensions) {
		const { value } = extension;
		if (Array.isArray(value)) {
			for (const command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});

interface IRegisteredSubmenu {
	readonly id: MenuId;
	readonly label: string;
	readonly icon?: { dark: URI; light?: URI } | ThemeIcon;
}

const _submenus = new Map<string, IRegisteredSubmenu>();

const submenusExtensionPoint = ExtensionsRegistry.registerExtensionPoint<schema.IUserFriendlySubmenu[]>({
	extensionPoint: 'submenus',
	jsonSchema: schema.submenusContribution
});

submenusExtensionPoint.setHandler(extensions => {

	_submenus.clear();

	for (const extension of extensions) {
		const { value, collector } = extension;

		for (const [, submenuInfo] of Object.entries(value)) {

			if (!schema.isValidSubmenu(submenuInfo, collector)) {
				continue;
			}

			if (!submenuInfo.id) {
				collector.warn(localize('submenuId.invalid.id', "“{0}”不是有效的子菜单标识符", submenuInfo.id));
				continue;
			}
			if (_submenus.has(submenuInfo.id)) {
				collector.info(localize('submenuId.duplicate.id', "以前已注册 `{0}` 子菜单。", submenuInfo.id));
				continue;
			}
			if (!submenuInfo.label) {
				collector.warn(localize('submenuId.invalid.label', "“{0}”不是有效的子菜单标签", submenuInfo.label));
				continue;
			}

			let absoluteIcon: { dark: URI; light?: URI } | ThemeIcon | undefined;
			if (submenuInfo.icon) {
				if (typeof submenuInfo.icon === 'string') {
					absoluteIcon = ThemeIcon.fromString(submenuInfo.icon) || { dark: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon) };
				} else {
					absoluteIcon = {
						dark: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon.dark),
						light: resources.joinPath(extension.description.extensionLocation, submenuInfo.icon.light)
					};
				}
			}

			const item: IRegisteredSubmenu = {
				id: MenuId.for(`api:${submenuInfo.id}`),
				label: submenuInfo.label,
				icon: absoluteIcon
			};

			_submenus.set(submenuInfo.id, item);
		}
	}
});

const _apiMenusByKey = new Map(apiMenus.map(menu => ([menu.key, menu])));
const _menuRegistrations = new DisposableStore();
const _submenuMenuItems = new Map<string /* menu id */, Set<string /* submenu id */>>();

const menusExtensionPoint = ExtensionsRegistry.registerExtensionPoint<{ [loc: string]: (schema.IUserFriendlyMenuItem | schema.IUserFriendlySubmenuItem)[] }>({
	extensionPoint: 'menus',
	jsonSchema: schema.menusContribution,
	deps: [submenusExtensionPoint]
});

menusExtensionPoint.setHandler(extensions => {

	// remove all previous menu registrations
	_menuRegistrations.clear();
	_submenuMenuItems.clear();

	for (const extension of extensions) {
		const { value, collector } = extension;

		for (const entry of Object.entries(value)) {
			if (!schema.isValidItems(entry[1], collector)) {
				continue;
			}

			let menu = _apiMenusByKey.get(entry[0]);

			if (!menu) {
				const submenu = _submenus.get(entry[0]);

				if (submenu) {
					menu = {
						key: entry[0],
						id: submenu.id,
						description: ''
					};
				}
			}

			if (!menu) {
				continue;
			}

			if (menu.proposed && !isProposedApiEnabled(extension.description, menu.proposed)) {
				collector.error(localize('proposedAPI.invalid', "{0} 是建议的菜单标识符。它需要 “package.json#enabledApiProposals: [“{1}”]”，并且仅在开发用完或使用以下命令行开关时可用: --enable-proposed-api {2}", entry[0], menu.proposed, extension.description.identifier.value));
				continue;
			}

			for (const menuItem of entry[1]) {
				let item: IMenuItem | ISubmenuItem;

				if (schema.isMenuItem(menuItem)) {
					const command = MenuRegistry.getCommand(menuItem.command);
					const alt = menuItem.alt && MenuRegistry.getCommand(menuItem.alt) || undefined;

					if (!command) {
						collector.error(localize('missing.command', "菜单项引用未在“命令”部分进行定义的命令“{0}”。", menuItem.command));
						continue;
					}
					if (menuItem.alt && !alt) {
						collector.warn(localize('missing.altCommand', "菜单项引用了未在 'commands' 部分定义的替代命令“{0}”。", menuItem.alt));
					}
					if (menuItem.command === menuItem.alt) {
						collector.info(localize('dupe.command', "菜单项引用的命令中默认和替代命令相同"));
					}

					item = { command, alt, group: undefined, order: undefined, when: undefined };
				} else {
					if (menu.supportsSubmenus === false) {
						collector.error(localize('unsupported.submenureference', "菜单项引用了不具有子菜单支持的菜单的子菜单。"));
						continue;
					}

					const submenu = _submenus.get(menuItem.submenu);

					if (!submenu) {
						collector.error(localize('missing.submenu', "菜单项引用了未在“子菜单”部分定义的子菜单“{0}”。", menuItem.submenu));
						continue;
					}

					let submenuRegistrations = _submenuMenuItems.get(menu.id.id);

					if (!submenuRegistrations) {
						submenuRegistrations = new Set();
						_submenuMenuItems.set(menu.id.id, submenuRegistrations);
					}

					if (submenuRegistrations.has(submenu.id.id)) {
						collector.warn(localize('submenuItem.duplicate', "`{0}` 子菜单已提供给 `{1}` 菜单。", menuItem.submenu, entry[0]));
						continue;
					}

					submenuRegistrations.add(submenu.id.id);

					item = { submenu: submenu.id, icon: submenu.icon, title: submenu.label, group: undefined, order: undefined, when: undefined };
				}

				if (menuItem.group) {
					const idx = menuItem.group.lastIndexOf('@');
					if (idx > 0) {
						item.group = menuItem.group.substr(0, idx);
						item.order = Number(menuItem.group.substr(idx + 1)) || undefined;
					} else {
						item.group = menuItem.group;
					}
				}

				if (menu.id === MenuId.ViewContainerTitle && !menuItem.when?.includes('viewContainer == workbench.view.debug')) {
					// Not a perfect check but enough to communicate that this proposed extension point is currently only for the debug view container
					collector.error(localize('viewContainerTitle.when', "{0} 菜单贡献必须在其 {2} 字句中检查 {1}。", '`viewContainer/title`', '`viewContainer == workbench.view.debug`', '"when"'));
					continue;
				}

				item.when = ContextKeyExpr.deserialize(menuItem.when);
				_menuRegistrations.add(MenuRegistry.appendMenuItem(menu.id, item));
			}
		}
	}
});

class CommandsTableRenderer extends Disposable implements IExtensionFeatureTableRenderer {

	readonly type = 'table';

	constructor(
		@IKeybindingService private readonly _keybindingService: IKeybindingService
	) { super(); }

	shouldRender(manifest: IExtensionManifest): boolean {
		return !!manifest.contributes?.commands;
	}

	render(manifest: IExtensionManifest): IRenderedData<ITableData> {
		const rawCommands = manifest.contributes?.commands || [];
		const commands = rawCommands.map(c => ({
			id: c.command,
			title: c.title,
			keybindings: [] as ResolvedKeybinding[],
			menus: [] as string[]
		}));

		const byId = index(commands, c => c.id);

		const menus = manifest.contributes?.menus || {};

		// Add to commandPalette array any commands not explicitly contributed to it
		const implicitlyOnCommandPalette = index(commands, c => c.id);
		if (menus['commandPalette']) {
			for (const command of menus['commandPalette']) {
				delete implicitlyOnCommandPalette[command.command];
			}
		}

		if (Object.keys(implicitlyOnCommandPalette).length) {
			if (!menus['commandPalette']) {
				menus['commandPalette'] = [];
			}
			for (const command in implicitlyOnCommandPalette) {
				menus['commandPalette'].push({ command });
			}
		}

		for (const context in menus) {
			for (const menu of menus[context]) {

				// This typically happens for the commandPalette context
				if (menu.when === 'false') {
					continue;
				}
				if (menu.command) {
					let command = byId[menu.command];
					if (command) {
						if (!command.menus.includes(context)) {
							command.menus.push(context);
						}
					} else {
						command = { id: menu.command, title: '', keybindings: [], menus: [context] };
						byId[command.id] = command;
						commands.push(command);
					}
				}
			}
		}

		const rawKeybindings = manifest.contributes?.keybindings ? (Array.isArray(manifest.contributes.keybindings) ? manifest.contributes.keybindings : [manifest.contributes.keybindings]) : [];

		rawKeybindings.forEach(rawKeybinding => {
			const keybinding = this.resolveKeybinding(rawKeybinding);

			if (!keybinding) {
				return;
			}

			let command = byId[rawKeybinding.command];

			if (command) {
				command.keybindings.push(keybinding);
			} else {
				command = { id: rawKeybinding.command, title: '', keybindings: [keybinding], menus: [] };
				byId[command.id] = command;
				commands.push(command);
			}
		});

		if (!commands.length) {
			return { data: { headers: [], rows: [] }, dispose: () => { } };
		}

		const headers = [
			localize('command name', "ID"),
			localize('command title', "标题"),
			localize('keyboard shortcuts', "键盘快捷方式"),
			localize('menuContexts', "菜单上下文")
		];

		const rows: IRowData[][] = commands.sort((a, b) => a.id.localeCompare(b.id))
			.map(command => {
				return [
					new MarkdownString().appendMarkdown(`\`${command.id}\``),
					typeof command.title === 'string' ? command.title : command.title.value,
					command.keybindings,
					new MarkdownString().appendMarkdown(`${command.menus.sort((a, b) => a.localeCompare(b)).map(menu => `\`${menu}\``).join('&nbsp;')}`),
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

	private resolveKeybinding(rawKeyBinding: IKeyBinding): ResolvedKeybinding | undefined {
		let key: string | undefined;

		switch (platform) {
			case 'win32': key = rawKeyBinding.win; break;
			case 'linux': key = rawKeyBinding.linux; break;
			case 'darwin': key = rawKeyBinding.mac; break;
		}

		return this._keybindingService.resolveUserBinding(key ?? rawKeyBinding.key)[0];
	}

}

Registry.as<IExtensionFeaturesRegistry>(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
	id: 'commands',
	label: localize('commands', "命令"),
	access: {
		canToggle: false,
	},
	renderer: new SyncDescriptor(CommandsTableRenderer),
});
