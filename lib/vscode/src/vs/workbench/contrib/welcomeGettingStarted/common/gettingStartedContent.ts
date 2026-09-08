/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import themePickerContent from './media/theme_picker.js';
import themePickerSmallContent from './media/theme_picker_small.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import { URI } from '../../../../base/common/uri.js';
import product from '../../../../platform/product/common/product.js';

interface IGettingStartedContentProvider {
	(): string;
}

const defaultChat = {
	documentationUrl: product.defaultChatAgent?.documentationUrl ?? '',
	provider: product.defaultChatAgent?.provider ?? { default: { name: '' } },
	publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
	termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
	privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};

export function copilotSettingsMessage(manageSettingsUrl: string): string {
	return localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "{0} Copilot 可能会显示 [公共代码]({1})建议并使用你的数据来改进产品。你可以随时更改这些 [设置]({2})。", defaultChat.provider.default.name, defaultChat.publicCodeMatchesUrl, manageSettingsUrl);
}

class GettingStartedContentProviderRegistry {

	private readonly providers = new Map<string, IGettingStartedContentProvider>();

	registerProvider(moduleId: string, provider: IGettingStartedContentProvider): void {
		this.providers.set(moduleId, provider);
	}

	getProvider(moduleId: string): IGettingStartedContentProvider | undefined {
		return this.providers.get(moduleId);
	}
}
export const gettingStartedContentRegistry = new GettingStartedContentProviderRegistry();

export async function moduleToContent(resource: URI): Promise<string> {
	if (!resource.query) {
		throw new Error('Getting Started: invalid resource');
	}

	const query = JSON.parse(resource.query);
	if (!query.moduleId) {
		throw new Error('Getting Started: invalid resource');
	}

	const provider = gettingStartedContentRegistry.getProvider(query.moduleId);
	if (!provider) {
		throw new Error(`Getting Started: no provider registered for ${query.moduleId}`);
	}

	return provider();
}

gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker', themePickerContent);
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker_small', themePickerSmallContent);
// Register empty media for accessibility walkthrough
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/empty', () => '');

const setupIcon = registerIcon('getting-started-setup', Codicon.zap, localize('getting-started-setup-icon', "用于欢迎页面的设置类别的图标"));
const beginnerIcon = registerIcon('getting-started-beginner', Codicon.lightbulb, localize('getting-started-beginner-icon', "用于欢迎页面初学者类别的图标"));

export type BuiltinGettingStartedStep = {
	id: string;
	title: string;
	description: string;
	completionEvents?: string[];
	when?: string;
	media:
	| { type: 'image'; path: string | { hc: string; hcLight?: string; light: string; dark: string }; altText: string }
	| { type: 'svg'; path: string; altText: string }
	| { type: 'markdown'; path: string }
	| { type: 'video'; path: string | { hc: string; hcLight?: string; light: string; dark: string }; poster?: string | { hc: string; hcLight?: string; light: string; dark: string }; altText: string };
};

export type BuiltinGettingStartedCategory = {
	id: string;
	title: string;
	description: string;
	isFeatured: boolean;
	next?: string;
	icon: ThemeIcon;
	when?: string;
	content:
	| { type: 'steps'; steps: BuiltinGettingStartedStep[] };
	walkthroughPageTitle: string;
};

export type BuiltinGettingStartedStartEntry = {
	id: string;
	title: string;
	description: string;
	icon: ThemeIcon;
	when?: string;
	content:
	| { type: 'startEntry'; command: string };
};

type GettingStartedWalkthroughContent = BuiltinGettingStartedCategory[];
type GettingStartedStartEntryContent = BuiltinGettingStartedStartEntry[];

export const startEntries: GettingStartedStartEntryContent = [
	{
		id: 'welcome.showNewFileEntries',
		title: localize('gettingStarted.newFile.title', "新建文件..."),
		description: localize('gettingStarted.newFile.description', "打开新的无标题文本文件、笔记本或自定义编辑器。"),
		icon: Codicon.newFile,
		content: {
			type: 'startEntry',
			command: 'command:welcome.showNewFileEntries',
		}
	},
	{
		id: 'topLevelOpenMac',
		title: localize('gettingStarted.openMac.title', "打开..."),
		description: localize('gettingStarted.openMac.description', "打开文件或文件夹以开始工作"),
		icon: Codicon.folderOpened,
		when: '!isWeb && isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFileFolder',
		}
	},
	{
		id: 'topLevelOpenFile',
		title: localize('gettingStarted.openFile.title', "打开文件..."),
		description: localize('gettingStarted.openFile.description', "打开文件以开始工作"),
		icon: Codicon.goToFile,
		when: 'isWeb || !isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFile',
		}
	},
	{
		id: 'topLevelOpenFolder',
		title: localize('gettingStarted.openFolder.title', "打开文件夹..."),
		description: localize('gettingStarted.openFolder.description', "打开文件夹开始工作"),
		icon: Codicon.folderOpened,
		when: '!isWeb && !isMac',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFolder',
		}
	},
	{
		id: 'topLevelOpenFolderWeb',
		title: localize('gettingStarted.openFolder.title', "打开文件夹..."),
		description: localize('gettingStarted.openFolder.description', "打开文件夹开始工作"),
		icon: Codicon.folderOpened,
		when: '!openFolderWorkspaceSupport && workbenchState == \'workspace\'',
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.files.openFolderViaWorkspace',
		}
	},
	{
		id: 'topLevelGitClone',
		title: localize('gettingStarted.topLevelGitClone.title', "克隆 Git 仓库..."),
		description: localize('gettingStarted.topLevelGitClone.description', "将远程仓库克隆到本地文件夹"),
		when: 'config.git.enabled && !git.missing',
		icon: Codicon.sourceControl,
		content: {
			type: 'startEntry',
			command: 'command:git.clone',
		}
	},
	{
		id: 'topLevelGitOpen',
		title: localize('gettingStarted.topLevelGitOpen.title', "打开仓库..."),
		description: localize('gettingStarted.topLevelGitOpen.description', "连接到远程仓库或拉取请求，以进行浏览、搜索、编辑和提交"),
		when: 'workspacePlatform == \'webworker\'',
		icon: Codicon.sourceControl,
		content: {
			type: 'startEntry',
			command: 'command:remoteHub.openRepository',
		}
	},
	{
		id: 'topLevelOpenTunnel',
		title: localize('gettingStarted.topLevelOpenTunnel.title', "打开隧道..."),
		description: localize('gettingStarted.topLevelOpenTunnel.description', "通过 Tunnel 连接到远程计算机"),
		when: 'isWeb && showRemoteStartEntryInWeb',
		icon: Codicon.remote,
		content: {
			type: 'startEntry',
			command: 'command:workbench.action.remote.showWebStartEntryActions',
		}
	},
	{
		id: 'topLevelNewWorkspaceChat',
		title: localize('gettingStarted.newWorkspaceChat.title', "生成新工作区..."),
		description: localize('gettingStarted.newWorkspaceChat.description', "聊天以创建新工作区"),
		icon: Codicon.chatSparkle,
		when: '!isWeb && !chatSetupHidden && !chatSetupDisabledInWorkspace',
		content: {
			type: 'startEntry',
			command: 'command:welcome.newWorkspaceChat',
		}
	},
];

const Button = (title: string, href: string) => `[${title}](${href})`;

const CopilotStepTitle = localize('gettingStarted.copilotSetup.title', "通过免费版 Copilot 使用 AI 功能");
const CopilotDescription = localize({ key: 'gettingStarted.copilotSetup.description', comment: ['{Locked="["}', '{Locked="]({0})"}'] }, "可以使用 [Copilot]({0}) 通过自然语言执行跨多个文件生成代码、修复错误、询问代码相关问题等操作。", defaultChat.documentationUrl ?? '');
const CopilotTermsString = localize({ key: 'gettingStarted.copilotSetup.terms', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "继续使用 {0} Copilot 即表示你同意 {1} 的[条款]({2})和[隐私声明]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
const CopilotAnonymousButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetupAnonymousWithoutDialog`);
const CopilotSignedOutButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetup`);
const CopilotSignedInButton = Button(localize('setupCopilotButton.setup', "使用 AI 功能"), `command:workbench.action.chat.triggerSetup`);
const CopilotCompleteButton = Button(localize('setupCopilotButton.chatWithCopilot', "开始聊天"), 'command:workbench.action.chat.open');

function createCopilotSetupStep(id: string, button: string, when: string, includeTerms: boolean): BuiltinGettingStartedStep {
	const description = includeTerms ?
		`${CopilotDescription}\n${CopilotTermsString}\n${button}` :
		`${CopilotDescription}\n${button}`;

	return {
		id,
		title: CopilotStepTitle,
		description,
		when: `${when} && !chatSetupHidden && !chatSetupDisabledInWorkspace`,
		media: {
			type: 'svg', altText: 'VS Code Copilot multi file edits', path: 'multi-file-edits.svg'
		},
	};
}

export const walkthroughs: GettingStartedWalkthroughContent = [
	{
		id: 'Setup',
		title: localize('gettingStarted.setup.title', "开始使用 VS Code"),
		description: localize('gettingStarted.setup.description', "自定义编辑器、了解基础知识并开始编码"),
		isFeatured: true,
		icon: setupIcon,
		when: '!isWeb',
		walkthroughPageTitle: localize('gettingStarted.setup.walkthroughPageTitle', '安装程序 VS Code'),
		next: 'Beginner',
		content: {
			type: 'steps',
			steps: [
				createCopilotSetupStep('CopilotSetupAnonymous', CopilotAnonymousButton, 'chatAnonymous && !chatSetupCompleted', true),
				createCopilotSetupStep('CopilotSetupSignedOut', CopilotSignedOutButton, 'chatEntitlementSignedOut && !chatAnonymous && !github.copilot.hasByokModels', false),
				createCopilotSetupStep('CopilotSetupComplete', CopilotCompleteButton, 'chatSetupCompleted && !chatSetupDisabled && (chatAnonymous || chatPlanPro || chatPlanProPlus || chatPlanMax || chatPlanBusiness || chatPlanEnterprise || chatPlanFree)', false),
				createCopilotSetupStep('CopilotSetupSignedIn', CopilotSignedInButton, '!chatEntitlementSignedOut && (!chatSetupCompleted || chatSetupDisabled || chatPlanCanSignUp)', false),
				{
					id: 'pickColorTheme',
					title: localize('gettingStarted.pickColor.title', "选择主题"),
					description: localize('gettingStarted.pickColor.description.interpolated', "合适的主题有助于你专注代码、更易于识别，并且使用起来更具趣味性。\r\n{0}", Button(localize('titleID', "浏览颜色主题"), 'command:workbench.action.selectTheme')),
					completionEvents: [
						'onSettingChanged:workbench.colorTheme',
						'onCommand:workbench.action.selectTheme'
					],
					media: { type: 'markdown', path: 'theme_picker', }
				},
				{
					id: 'videoTutorial',
					title: localize('gettingStarted.videoTutorial.title', "观看视频教程"),
					description: localize('gettingStarted.videoTutorial.description.interpolated', "请观看系列简短实用视频教程中的第一课，了解 VS Code 的主要功能。\r\n{0}", Button(localize('watch', "观看教程"), 'https://aka.ms/vscode-getting-started-video')),
					media: { type: 'svg', altText: 'VS Code Settings', path: 'learn.svg' },
				}
			]
		}
	},

	{
		id: 'SetupWeb',
		title: localize('gettingStarted.setupWeb.title', "面向 Web 的 VS Code 入门"),
		description: localize('gettingStarted.setupWeb.description', "自定义编辑器、了解基础知识并开始编码"),
		isFeatured: true,
		icon: setupIcon,
		when: 'isWeb',
		next: 'Beginner',
		walkthroughPageTitle: localize('gettingStarted.setupWeb.walkthroughPageTitle', '安装程序 VS Code Web'),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'pickColorThemeWeb',
					title: localize('gettingStarted.pickColor.title', "选择主题"),
					description: localize('gettingStarted.pickColor.description.interpolated', "合适的主题有助于你专注代码、更易于识别，并且使用起来更具趣味性。\r\n{0}", Button(localize('titleID', "浏览颜色主题"), 'command:workbench.action.selectTheme')),
					completionEvents: [
						'onSettingChanged:workbench.colorTheme',
						'onCommand:workbench.action.selectTheme'
					],
					media: { type: 'markdown', path: 'theme_picker', }
				},
				{
					id: 'menuBarWeb',
					title: localize('gettingStarted.menuBar.title', "恰好数量的 UI"),
					description: localize('gettingStarted.menuBar.description.interpolated', "下拉菜单中提供了完整的菜单栏，可为代码腾出空间。切换其外观以加快访问速度。\r\n{0}", Button(localize('toggleMenuBar', "切换菜单栏"), 'command:workbench.action.toggleMenuBar')),
					when: 'isWeb',
					media: {
						type: 'svg', altText: 'Comparing menu dropdown with the visible menu bar.', path: 'menuBar.svg'
					},
				},
				{
					id: 'extensionsWebWeb',
					title: localize('gettingStarted.extensions.title', "使用扩展编码"),
					description: localize('gettingStarted.extensionsWeb.description.interpolated', "扩展是 VS Code 的增强功能。越来越多的扩展可在 Web 上使用。\r\n{0}", Button(localize('browsePopularWeb', "浏览热门 Web 扩展"), 'command:workbench.extensions.action.showPopularExtensions')),
					when: 'workspacePlatform == \'webworker\'',
					media: {
						type: 'svg', altText: 'VS Code extension marketplace with featured language extensions', path: 'extensions-web.svg'
					},
				},
				{
					id: 'findLanguageExtensionsWeb',
					title: localize('gettingStarted.findLanguageExts.title', "对所有语言的丰富支持"),
					description: localize('gettingStarted.findLanguageExts.description.interpolated', "通过语法高亮、内联建议、lint 分析和调试，更智能地编码。虽然已内置多种语言，但可将更多语言添加为扩展。\r\n{0}", Button(localize('browseLangExts', "浏览语言扩展"), 'command:workbench.extensions.action.showLanguageExtensions')),
					when: 'workspacePlatform != \'webworker\'',
					media: {
						type: 'svg', altText: 'Language extensions', path: 'languages.svg'
					},
				},
				{
					id: 'commandPaletteTaskWeb',
					title: localize('gettingStarted.commandPalette.title', "使用命令面板解锁工作效率 "),
					description: localize('gettingStarted.commandPalette.description.interpolated', "在 VS Code 中运行命令，无需动用鼠标即可完成任何任务。\r\n{0}", Button(localize('commandPalette', "打开命令面板"), 'command:workbench.action.showCommands')),
					media: { type: 'svg', altText: 'Command Palette overlay for searching and executing commands.', path: 'commandPalette.svg' },
				},
				{
					id: 'pickAFolderTask-WebWeb',
					title: localize('gettingStarted.setup.OpenFolder.title', "打开你的代码"),
					description: localize('gettingStarted.setup.OpenFolderWeb.description.interpolated', "你已准备好开始编码。可以打开本地项目或远程仓库，以将文件置于 VS Code。\r\n{0}\r\n{1}", Button(localize('openFolder', "打开文件夹"), 'command:workbench.action.addRootFolder'), Button(localize('openRepository', "打开仓库"), 'command:remoteHub.openRepository')),
					when: 'workspaceFolderCount == 0',
					media: {
						type: 'svg', altText: 'Explorer view showing buttons for opening folder and cloning repository.', path: 'openFolder.svg'
					}
				},
				{
					id: 'quickOpenWeb',
					title: localize('gettingStarted.quickOpen.title', "在文件之间快速导航"),
					description: localize('gettingStarted.quickOpen.description.interpolated', "击键一下即可迅速在文件之间导航。提示: 通过按右箭头键打开多个文件。\r\n{0}", Button(localize('quickOpen', "快速打开一个文件"), 'command:toSide:workbench.action.quickOpen')),
					when: 'workspaceFolderCount != 0',
					media: {
						type: 'svg', altText: 'Go to file in quick search.', path: 'search.svg'
					}
				}
			]
		}
	},
	{
		id: 'SetupAccessibility',
		title: localize('gettingStarted.setupAccessibility.title', "辅助功能入门"),
		description: localize('gettingStarted.setupAccessibility.description', "了解可用于访问 VS Code 的工具和快捷方式。请注意，某些操作在演练的上下文中不可操作。"),
		isFeatured: true,
		icon: setupIcon,
		when: CONTEXT_ACCESSIBILITY_MODE_ENABLED.key,
		next: 'Setup',
		walkthroughPageTitle: localize('gettingStarted.setupAccessibility.walkthroughPageTitle', '安装程序 VS Code 辅助功能'),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'accessibilityHelp',
					title: localize('gettingStarted.accessibilityHelp.title', "使用辅助功能帮助对话框了解功能"),
					description: localize('gettingStarted.accessibilityHelp.description.interpolated', "辅助功能帮助对话框提供有关功能内容以及用于操作功能的命令/键绑定的信息。\r\n 由于焦点位于编辑器、终端、笔记本、聊天响应、注释或调试控制台上，可使用“打开辅助功能帮助”命令打开相关对话框。\r\n{0}", Button(localize('openAccessibilityHelp', "打开辅助功能帮助"), 'command:editor.action.accessibilityHelp')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'accessibleView',
					title: localize('gettingStarted.accessibleView.title', "屏幕阅读器用户可以在无障碍视图中逐行、逐字检查内容。"),
					description: localize('gettingStarted.accessibleView.description.interpolated', "辅助视图可用于终端、悬停、通知、批注、笔记本输出、聊天响应、内联完成和调试控制台输出。\r\n 如果焦点位于这些功能上，则可以使用“打开辅助视图”命令打开它。\r\n{0}", Button(localize('openAccessibleView', "打开辅助视图"), 'command:editor.action.accessibleView')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'verbositySettings',
					title: localize('gettingStarted.verbositySettings.title', "控制 aria 标签的详细程度"),
					description: localize('gettingStarted.verbositySettings.description.interpolated', "工作台周围存在功能对应的屏幕阅读器详细程度设置，以便用户熟悉某项功能后，避免听到有关如何操作该功能的提示。例如，存在辅助功能帮助对话框的功能将指示如何打开对话框，直到该功能的详细程度设置被禁用。\r\n 可通过运行“打开辅助功能设置”命令来配置这些和其他辅助功能设置。\r\n{0}", Button(localize('openVerbositySettings', "打开辅助功能设置"), 'command:workbench.action.openAccessibilitySettings')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'commandPaletteTaskAccessibility',
					title: localize('gettingStarted.commandPaletteAccessibility.title', "使用命令面板释放工作效率"),
					description: localize('gettingStarted.commandPaletteAccessibility.description.interpolated', "在 VS Code 中运行命令，无需动用鼠标即可完成任何任务。\r\n{0}", Button(localize('commandPalette', "打开命令面板"), 'command:workbench.action.showCommands')),
					media: { type: 'markdown', path: 'empty' },
				},
				{
					id: 'keybindingsAccessibility',
					title: localize('gettingStarted.keyboardShortcuts.title', "自定义键盘快捷方式"),
					description: localize('gettingStarted.keyboardShortcuts.description.interpolated', "发现喜欢的命令后，创建自定义键盘快捷方式以进行即时访问。\r\n{0}", Button(localize('keyboardShortcuts', "键盘快捷方式"), 'command:toSide:workbench.action.openGlobalKeybindings')),
					media: {
						type: 'markdown', path: 'empty',
					}
				},
				{
					id: 'accessibilitySignals',
					title: localize('gettingStarted.accessibilitySignals.title', "微调要通过音频或盲文设备接收的辅助功能信号"),
					description: localize('gettingStarted.accessibilitySignals.description.interpolated', "辅助功能声音和公告会在各种事件的工作台周围播放。\r\n 可以使用“列出信号声音和列出信号公告”命令来发现和配置这些功能。\r\n{0}\r\n{1}", Button(localize('listSignalSounds', "列出信号声音"), 'command:signals.sounds.help'), Button(localize('listSignalAnnouncements', "列出信号公告"), 'command:accessibility.announcement.help')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'hover',
					title: localize('gettingStarted.hover.title', "访问编辑器中的悬停以获取有关变量或符号的详细信息"),
					description: localize('gettingStarted.hover.description.interpolated', "当焦点位于编辑器中的变量或符号上时，可以使用“显示或打开悬停”命令聚焦悬停。\r\n{0}", Button(localize('showOrFocusHover', "显示或聚焦悬停"), 'command:editor.action.showHover')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'goToSymbol',
					title: localize('gettingStarted.goToSymbol.title', "导航到文件中的符号"),
					description: localize('gettingStarted.goToSymbol.description.interpolated', "“转到符号”命令对于在文档中的重要地标之间导航非常有用。\r\n{0}", Button(localize('openGoToSymbol', "转到“符号”"), 'command:editor.action.goToSymbol')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'codeFolding',
					title: localize('gettingStarted.codeFolding.title', "使用代码折叠可折叠代码块，并关注你感兴趣的代码。"),
					description: localize('gettingStarted.codeFolding.description.interpolated', "使用“切换折叠”命令折叠或展开代码部分。\r\n{0}\r\n 使用“切换折叠递归”命令以递归方式折叠或展开\r\n{1}\r\n", Button(localize('toggleFold', "切换折叠"), 'command:editor.toggleFold'), Button(localize('toggleFoldRecursively', "以递归方式切换折叠"), 'command:editor.toggleFoldRecursively')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'intellisense',
					title: localize('gettingStarted.intellisense.title', "使用 Intellisense 提高编码效率"),
					description: localize('gettingStarted.intellisense.description.interpolated', "可以使用 Trigger Intellisense 命令打开 Intellisense 建议。\r\n{0}\r\n 可以使用触发器内联建议触发内联 Intellisense 建议\r\n{1}\r\n 有用的设置包括 editor.inlineCompletionsAccessibilityVerbose 和 editor.screenReaderAnnounceInlineSuggestion。", Button(localize('triggerIntellisense', "触发器 Intellisense"), 'command:editor.action.triggerSuggest'), Button(localize('triggerInlineSuggestion', '触发内联建议'), 'command:editor.action.inlineSuggest.trigger')),
					media: {
						type: 'markdown', path: 'empty'
					}
				},
				{
					id: 'accessibilitySettings',
					title: localize('gettingStarted.accessibilitySettings.title', "配置辅助功能设置"),
					description: localize('gettingStarted.accessibilitySettings.description.interpolated', "通过运行“打开辅助功能设置”命令可配置辅助功能设置。\r\n{0}", Button(localize('openAccessibilitySettings', "打开辅助功能设置"), 'command:workbench.action.openAccessibilitySettings')),
					media: { type: 'markdown', path: 'empty' }
				},
				{
					id: 'dictation',
					title: localize('gettingStarted.dictation.title', "使用听写功能在编辑器和终端中编写代码和文本"),
					description: localize('gettingStarted.dictation.description.interpolated', "听写功能允许你通过语音编写代码和文本。可使用“语音: 在编辑器中开始听写”命令来激活它。\r\n{0}\r\n 在终端中进行听写时，请使用“语音: 在终端开始听写”和“语音: 在终端停止听写”命令。\r\n{1}\r\n{2}", Button(localize('toggleDictation', "语音: 在编辑器中开始听写"), 'command:workbench.action.editorDictation.start'), Button(localize('terminalStartDictation', "终端: 在终端开始听写"), 'command:workbench.action.terminal.startVoice'), Button(localize('terminalStopDictation', "终端: 在终端停止听写"), 'command:workbench.action.terminal.stopVoice')),
					when: 'hasSpeechProvider',
					media: { type: 'markdown', path: 'empty' }
				}
			]
		}
	},
	{
		id: 'Beginner',
		isFeatured: false,
		title: localize('gettingStarted.beginner.title', "了解基础知识"),
		icon: beginnerIcon,
		description: localize('gettingStarted.beginner.description', "获取最基本功能的概述"),
		walkthroughPageTitle: localize('gettingStarted.beginner.walkthroughPageTitle', '基本功能'),
		content: {
			type: 'steps',
			steps: [
				{
					id: 'settingsAndSync',
					title: localize('gettingStarted.settings.title', "优化设置"),
					description: localize('gettingStarted.settings.description.interpolated', "Customize every aspect of VS Code to fit the way you work.\n{0}", Button(localize('tweakSettings', "打开设置"), 'command:toSide:workbench.action.openSettings')),
					when: 'workspacePlatform != \'webworker\'',
					media: {
						type: 'svg', altText: 'VS Code Settings', path: 'settings.svg'
					},
				},
				{
					id: 'extensions',
					title: localize('gettingStarted.extensions.title', "使用扩展编码"),
					description: localize('gettingStarted.extensions.description.interpolated', "扩展是 VS Code 的精华。扩展范围包括方便地提升生产力、扩展现成的功能以及添加全新的功能。\r\n{0}", Button(localize('browsePopular', "浏览热门扩展"), 'command:workbench.extensions.action.showPopularExtensions')),
					when: 'workspacePlatform != \'webworker\'',
					media: {
						type: 'svg', altText: 'VS Code extension marketplace with featured language extensions', path: 'extensions.svg'
					},
				},
				{
					id: 'terminal',
					title: localize('gettingStarted.terminal.title', "内置终端"),
					description: localize('gettingStarted.terminal.description.interpolated', "在代码近旁快速运行 shell 命令并监视生成输出。\r\n{0}", Button(localize('showTerminal', "打开终端"), 'command:workbench.action.terminal.toggleTerminal')),
					when: 'workspacePlatform != \'webworker\' && remoteName != codespaces && !terminalIsOpen',
					media: {
						type: 'svg', altText: 'Integrated terminal running a few npm commands', path: 'terminal.svg'
					},
				},
				{
					id: 'scmClone',
					title: localize('gettingStarted.scm.title', "使用 Git 跟踪代码"),
					description: localize('gettingStarted.scmClone.description.interpolated', "为项目设置内置版本控制，以跟踪更改并与他人协作。\r\n{0}", Button(localize('cloneRepo', "克隆仓库"), 'command:git.clone')),
					when: 'config.git.enabled && !git.missing && workspaceFolderCount == 0',
					media: {
						type: 'svg', altText: 'Source Control view.', path: 'git.svg',
					},
				},
				{
					id: 'scmSetup',
					title: localize('gettingStarted.scm.title', "使用 Git 跟踪代码"),
					description: localize('gettingStarted.scmSetup.description.interpolated', "为项目设置内置版本控制，以跟踪更改并与他人协作。\r\n{0}", Button(localize('initRepo', "初始化 Git 仓库"), 'command:git.init')),
					when: 'config.git.enabled && !git.missing && workspaceFolderCount != 0 && gitOpenRepositoryCount == 0',
					media: {
						type: 'svg', altText: 'Source Control view.', path: 'git.svg',
					},
				},
				{
					id: 'installGit',
					title: localize('gettingStarted.installGit.title', "安装 Git"),
					description: localize({ key: 'gettingStarted.installGit.description.interpolated', comment: ['The placeholders are command link items should not be translated'] }, "安装 Git 以跟踪项目中的更改。\r\n{0}\r\n安装后 {1}重新加载窗口{2} 以完成 Git 安装。", Button(localize('installGit', "安装 Git"), 'https://aka.ms/vscode-install-git'), '[', '](command:workbench.action.reloadWindow)'),
					when: 'git.missing',
					media: {
						type: 'svg', altText: 'Install Git.', path: 'git.svg',
					},
					completionEvents: [
						'onContext:git.state == initialized'
					]
				},

				{
					id: 'tasks',
					title: localize('gettingStarted.tasks.title', "自动执行项目任务"),
					when: 'workspaceFolderCount != 0 && workspacePlatform != \'webworker\'',
					description: localize('gettingStarted.tasks.description.interpolated', "为常见工作流创建任务，并享受运行脚本和自动检查结果的集成体验。\r\n{0}", Button(localize('runTasks', "运行自动检测到的任务"), 'command:workbench.action.tasks.runTask')),
					media: {
						type: 'svg', altText: 'Task runner.', path: 'runTask.svg',
					},
				},
				{
					id: 'shortcuts',
					title: localize('gettingStarted.shortcuts.title', "自定义快捷方式"),
					description: localize('gettingStarted.shortcuts.description.interpolated', "发现喜欢的命令后，创建自定义键盘快捷方式以进行即时访问。\r\n{0}", Button(localize('keyboardShortcuts', "键盘快捷方式"), 'command:toSide:workbench.action.openGlobalKeybindings')),
					media: {
						type: 'svg', altText: 'Interactive shortcuts.', path: 'shortcuts.svg',
					}
				},
				{
					id: 'workspaceTrust',
					title: localize('gettingStarted.workspaceTrust.title', "安全浏览和编辑代码"),
					description: localize('gettingStarted.workspaceTrust.description.interpolated', "通过 {0}，可以确定项目文件夹是否应 **允许或限制** 自动代码执行 __(扩展、调试等所必需)__。\r\n 打开文件/文件夹将提示授予信任。以后始终可以 {1}。", Button(localize('workspaceTrust', "工作区信任"), 'https://code.visualstudio.com/docs/editor/workspace-trust'), Button(localize('enableTrust', "启用信任"), 'command:toSide:workbench.trust.manage')),
					when: 'workspacePlatform != \'webworker\' && !isWorkspaceTrusted && workspaceFolderCount == 0',
					media: {
						type: 'svg', altText: 'Workspace Trust editor in Restricted mode and a primary button for switching to Trusted mode.', path: 'workspaceTrust.svg'
					},
				},
			]
		}
	}
];
