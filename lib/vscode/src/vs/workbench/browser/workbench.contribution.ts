/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isStandalone } from '../../base/browser/browser.js';
import { isLinux, isMacintosh, isNative, isWeb, isWindows } from '../../base/common/platform.js';
import { localize } from '../../nls.js';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from '../../platform/configuration/common/configurationRegistry.js';
import product from '../../platform/product/common/product.js';
import { Registry } from '../../platform/registry/common/platform.js';
import { ConfigurationKeyValuePairs, ConfigurationMigrationWorkbenchContribution, DynamicWindowConfiguration, DynamicWorkbenchSecurityConfiguration, Extensions, IConfigurationMigrationRegistry, problemsConfigurationNodeBase, windowConfigurationNodeBase, workbenchConfigurationNodeBase } from '../common/configuration.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../common/contributions.js';
import { NotificationsPosition, NotificationsSettings } from '../common/notifications.js';
import { CustomEditorLabelService } from '../services/editor/common/customEditorLabelService.js';
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../services/history/common/history.js';
import { ActivityBarPosition, EditorActionsLocation, EditorTabsMode, LayoutSettings } from '../services/layout/browser/layoutService.js';
import { defaultWindowTitle, defaultWindowTitleSeparator } from './parts/titlebar/windowTitle.js';

const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

// Configuration
(function registerConfiguration(): void {

	// Migration support
	registerWorkbenchContribution2(ConfigurationMigrationWorkbenchContribution.ID, ConfigurationMigrationWorkbenchContribution, WorkbenchPhase.Eventually);

	// Dynamic Configuration
	registerWorkbenchContribution2(DynamicWorkbenchSecurityConfiguration.ID, DynamicWorkbenchSecurityConfiguration, WorkbenchPhase.AfterRestored);

	// Workbench
	registry.registerConfiguration({
		...workbenchConfigurationNodeBase,
		'properties': {
			'workbench.externalBrowser': {
				type: 'string',
				markdownDescription: localize('browser', "将浏览器配置为用于在外部打开 http 或 https 链接。这可以是浏览器的名称(“edge”、“chrome”、“firefox”)或浏览器可执行文件的绝对路径。如果未设置，则将使用系统默认值。"),
				included: isNative,
				restricted: true
			},
			'workbench.editor.titleScrollbarSizing': {
				type: 'string',
				enum: ['default', 'large'],
				enumDescriptions: [
					localize('workbench.editor.titleScrollbarSizing.default', "默认大小。"),
					localize('workbench.editor.titleScrollbarSizing.large', "增加大小，以便更轻松地通过鼠标抓取。")
				],
				description: localize('tabScrollbarHeight', "控制编辑器标题区域中用于选项卡和面包屑的滚动条的高度。"),
				default: 'default',
			},
			'workbench.editor.titleScrollbarVisibility': {
				type: 'string',
				enum: ['auto', 'visible', 'hidden'],
				enumDescriptions: [
					localize('workbench.editor.titleScrollbarVisibility.auto', "水平滚动条仅在必要时可见。"),
					localize('workbench.editor.titleScrollbarVisibility.visible', "水平滚动条将始终可见。"),
					localize('workbench.editor.titleScrollbarVisibility.hidden', "水平滚动条将始终隐藏。")
				],
				description: localize('titleScrollbarVisibility', "控制编辑器标题区域中用于选项卡和面包屑的滚动条的可见性。"),
				default: 'auto',
			},
			[LayoutSettings.EDITOR_TABS_MODE]: {
				'type': 'string',
				'enum': [EditorTabsMode.MULTIPLE, EditorTabsMode.SINGLE, EditorTabsMode.NONE],
				'enumDescriptions': [
					localize('workbench.editor.showTabs.multiple', "每个编辑器在编辑器标题区域显示为选项卡。"),
					localize('workbench.editor.showTabs.single', "活动编辑器在编辑器标题区域显示为单个大选项卡。"),
					localize('workbench.editor.showTabs.none', "未显示编辑器标题区域。"),
				],
				'description': localize('showEditorTabs', "控制打开的编辑器是否显示为单个选项卡还是一个大选项卡，或者标题区域是否应显示。"),
				'default': 'multiple'
			},
			[LayoutSettings.EDITOR_ACTIONS_LOCATION]: {
				'type': 'string',
				'enum': [EditorActionsLocation.DEFAULT, EditorActionsLocation.TITLEBAR, EditorActionsLocation.HIDDEN],
				'markdownEnumDescriptions': [
					localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'workbench.editor.editorActionsLocation.default' }, "当 {0} 设置为 {1} 时，在窗口标题栏中显示编辑器操作。否则，编辑器操作将显示在编辑器选项卡栏中。", '`#workbench.editor.showTabs#`', '`none`'),
					localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'workbench.editor.editorActionsLocation.titleBar' }, "在窗口标题栏中显示编辑器操作。如果 {0} 设置为 {1}，则隐藏编辑器操作。", '`#window.customTitleBarVisibility#`', '`never`'),
					localize('workbench.editor.editorActionsLocation.hidden', "未显示编辑器操作。"),
				],
				'markdownDescription': localize('editorActionsLocation', "控制显示编辑器操作的位置。"),
				'default': 'default',
				agentsWindow: { default: 'default', readOnly: true },
			},
			'workbench.editor.alwaysShowEditorActions': {
				'type': 'boolean',
				'markdownDescription': localize('alwaysShowEditorActions', "控制是否始终显示编辑器操作(即使编辑器组不处于活动状态)。"),
				'default': false
			},
			'workbench.editor.wrapTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'wrapTabs' }, "控制当超出可用空间时，选项卡是否应在多行之间换行，或者是否应显示滚动条。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.scrollToSwitchTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'scrollToSwitchTabs' }, "控制在滚动到选项卡上方时是否打开这些选项卡。默认情况下，选项卡仅在鼠标滚动时呈现，但不打开。可通过在滚动时按住 Shift 键来更改滚动期间的此行为。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.highlightModifiedTabs': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'highlightModifiedTabs' }, "控制是否在具有未保存更改的编辑器的选项卡上绘制顶部边框。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', `multiple`),
				'default': false
			},
			'workbench.editor.decorations.badges': {
				'type': 'boolean',
				'markdownDescription': localize('decorations.badges', "控制编辑器文件修饰是否应使用徽章。"),
				'default': true
			},
			'workbench.editor.decorations.colors': {
				'type': 'boolean',
				'markdownDescription': localize('decorations.colors', "控制编辑器文件修饰是否应使用颜色。"),
				'default': true
			},
			[CustomEditorLabelService.SETTING_ID_ENABLED]: {
				'type': 'boolean',
				'markdownDescription': localize('workbench.editor.label.enabled', "控制是否应应用自定义工作台编辑器标签。"),
				'default': true,
			},
			[CustomEditorLabelService.SETTING_ID_PATTERNS]: {
				'type': 'object',
				'markdownDescription': (() => {
					let customEditorLabelDescription = localize('workbench.editor.label.patterns', "控制编辑器标签的呈现。每个 __Item__ 都是与文件路径匹配的模式。同时支持相对文件路径和绝对文件路径。相对路径必须包含 WORKSPACE_FOLDER (例如 `WORKSPACE_FOLDER/src/**.tsx` or `*/src/**.tsx`)。绝对模式必须以 `/` 开头。如果多个模式匹配，则将选取最长匹配路径。每个 __Value__ 都是 __Item__ 匹配时呈现的编辑器的模板。根据上下文替换变量:");
					customEditorLabelDescription += '\n- ' + [
						localize('workbench.editor.label.dirname', "`${dirname}`: 文件所在的文件夹的名称(例如 `WORKSPACE_FOLDER/folder/file.txt -> folder`)。"),
						localize('workbench.editor.label.nthdirname', "`${dirname(N)}`: 文件所在的第 n 个父文件夹的名称(例如 `N=2: WORKSPACE_FOLDER/static/folder/file.txt -> WORKSPACE_FOLDER`)。可以使用负数来从路径开头选取文件夹(例如 `N=-1: WORKSPACE_FOLDER/folder/file.txt -> WORKSPACE_FOLDER`)。如果 __Item__ 是绝对模式路径，则第一个文件夹(`N=-1`)将引用绝对路径中的第一个文件夹，否则它对应于工作区文件夹。"),
						localize('workbench.editor.label.filename', "`${filename}`: 没有文件扩展名的文件的名称(例如 `WORKSPACE_FOLDER/folder/file.txt -> file`)。"),
						localize('workbench.editor.label.extname', "`${extname}`: 文件扩展名(例如 `WORKSPACE_FOLDER/folder/file.txt -> txt`)。"),
						localize('workbench.editor.label.nthextname', "`${extname(N)}`: 由 \".\" 分隔的的第 n 个文件扩展名(例如 `N=2: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext1`)。可以使用负数来从扩展的开头选取扩展(例如 `N=-1: WORKSPACE_FOLDER/folder/file.ext1.ext2.ext3 -> ext2`)。"),
					].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations
					customEditorLabelDescription += '\n\n' + localize('customEditorLabelDescriptionExample', "示例: `\"**/static/**/*.html\": \"${filename} - ${dirname} (${extname})\"` 将文件 `WORKSPACE_FOLDER/static/folder/file.html` 呈现为 `file - folder (html)`。");

					return customEditorLabelDescription;
				})(),
				additionalProperties:
				{
					type: ['string', 'null'],
					markdownDescription: localize('workbench.editor.label.template', "模式匹配时应呈现的模板。可能包括变量 ${dirname}、${filename} 和 ${extname}。"),
					minLength: 1,
					pattern: '.*[a-zA-Z0-9].*'
				},
				'default': {}
			},
			'workbench.editor.labelFormat': {
				'type': 'string',
				'enum': ['default', 'short', 'medium', 'long'],
				'enumDescriptions': [
					localize('workbench.editor.labelFormat.default', "显示文件名。当启用选项卡且在同一组内有两个相同名称的文件时，将添加每个文件路径中可以用于区分的部分。在选项卡被禁用且编辑器活动时，将显示相对于工作区文件夹的路径。"),
					localize('workbench.editor.labelFormat.short', "显示文件名后跟其目录名。"),
					localize('workbench.editor.labelFormat.medium', "显示文件名及其相对于工作区文件夹的路径。"),
					localize('workbench.editor.labelFormat.long', "显示文件名后跟其绝对路径。")
				],
				'default': 'default',
				'description': localize('tabDescription', "控制编辑器标签的格式。"),
			},
			'workbench.editor.untitled.labelFormat': {
				'type': 'string',
				'enum': ['content', 'name'],
				'enumDescriptions': [
					localize('workbench.editor.untitled.labelFormat.content', "无标题文件的名称派生自其第一行的内容，除非它有关联的文件路径。如果行为空或不包含单词字符，它将回退到名称。"),
					localize('workbench.editor.untitled.labelFormat.name', "无标题文件的名称不是从文件的内容派生的。"),
				],
				'default': 'content',
				'description': localize('untitledLabelFormat', "控制无标题编辑器的标签格式。"),
			},
			'workbench.editor.empty.hint': {
				'type': 'string',
				'enum': ['text', 'hidden'],
				'default': 'text',
				'markdownDescription': localize("workbench.editor.empty.hint", "控制空编辑器文本提示是否应在编辑器中可见。")
			},
			'workbench.editor.languageDetection': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.languageDetection', "控制是否自动检测文本编辑器中的语言，除非该语言已由语言选择器显式设置。这也可以按语言确定范围，以便你可以指定不希望关闭的语言。这对于像 Markdown 这样的语言很有用，因为它通常包含可能会欺骗语言检测的其他语言，使其认为它是嵌入语言而不是 Markdown。"),
				scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
			},
			'workbench.editor.historyBasedLanguageDetection': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.historyBasedLanguageDetection', "允许在语言检测中使用编辑器历史记录。这会导致自动语言检测偏向于最近打开的语言，并允许自动语言检测使用较小的输入进行操作。"),
			},
			'workbench.editor.preferHistoryBasedLanguageDetection': {
				type: 'boolean',
				default: false,
				description: localize('workbench.editor.preferBasedLanguageDetection', "启用后，将编辑器历史记录考虑在内的语言检测模型将获得更高的优先级。"),
			},
			'workbench.editor.languageDetectionHints': {
				type: 'object',
				default: { 'untitledEditors': true, 'notebookEditors': true },
				description: localize('workbench.editor.showLanguageDetectionHints', "启用后，当编辑器语言与检测到的内容语言不匹配时，显示状态栏“快速修复”。"),
				additionalProperties: false,
				properties: {
					untitledEditors: {
						type: 'boolean',
						description: localize('workbench.editor.showLanguageDetectionHints.editors', "在无标题文本编辑器中显示"),
					},
					notebookEditors: {
						type: 'boolean',
						description: localize('workbench.editor.showLanguageDetectionHints.notebook', "在笔记本编辑器中显示"),
					}
				}
			},
			'workbench.editor.tabActionLocation': {
				type: 'string',
				enum: ['left', 'right'],
				default: 'right',
				markdownDescription: localize({ comment: ['{0} will be a setting name rendered as a link'], key: 'tabActionLocation' }, "控制编辑器选项卡操作按钮（关闭、取消固定）的位置。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabActionCloseVisibility': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.tabActionCloseVisibility', "控制选项卡关闭操作按钮的可见性。")
			},
			'workbench.editor.tabActionUnpinVisibility': {
				type: 'boolean',
				default: true,
				description: localize('workbench.editor.tabActionUnpinVisibility', "控制选项卡取消固定操作按钮的可见性。")
			},
			'workbench.editor.showTabIndex': {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'showTabIndex' }, "启用后，将显示选项卡索引。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabSizing': {
				'type': 'string',
				'enum': ['fit', 'shrink', 'fixed'],
				'default': 'fit',
				'enumDescriptions': [
					localize('workbench.editor.tabSizing.fit', "始终将标签页保持足够大，能够完全显示编辑器标签。"),
					localize('workbench.editor.tabSizing.shrink', "在不能同时显示所有选项卡时，允许选项卡缩小。"),
					localize('workbench.editor.tabSizing.fixed', "使所有选项卡的大小相同，同时允许它们在可用空间不足以同时显示所有选项卡时变小。")
				],
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'tabSizing' }, "控制编辑器选项卡的大小。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.tabSizingFixedMinWidth': {
				'type': 'number',
				'default': 50,
				'minimum': 38,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabSizingFixedMinWidth' }, "控制将 {0} 大小设置为 {1} 时选项卡的最小宽度。", '`#workbench.editor.tabSizing#`', '`fixed`')
			},
			'workbench.editor.tabSizingFixedMaxWidth': {
				'type': 'number',
				'default': 160,
				'minimum': 38,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabSizingFixedMaxWidth' }, "控制将 {0} 大小设置为 {1} 时选项卡的最大宽度。", '`#workbench.editor.tabSizing#`', '`fixed`')
			},
			'window.density.editorTabHeight': {
				'type': 'string',
				'enum': ['default', 'compact'],
				'default': 'default',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.tabHeight' }, "控制编辑器选项卡的高度。当 {0} 未设置为 {1}时，也适用于标题控件栏。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.pinnedTabSizing': {
				'type': 'string',
				'enum': ['normal', 'compact', 'shrink'],
				'default': 'normal',
				'enumDescriptions': [
					localize('workbench.editor.pinnedTabSizing.normal', "固定的选项卡会继承未固定的选项卡的外观。"),
					localize('workbench.editor.pinnedTabSizing.compact', "固定的选项卡将以紧凑形式显示，其中只包含图标或编辑器名称的第一个字母。"),
					localize('workbench.editor.pinnedTabSizing.shrink', "固定的选项卡缩小至紧凑的固定大小，显示编辑器名称的各部分。")
				],
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'pinnedTabSizing' }, "控制固定的编辑器选项卡的大小。固定的选项卡排在所有打开的选项卡的开头，并且在取消固定之前，通常不会关闭。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`')
			},
			'workbench.editor.pinnedTabsOnSeparateRow': {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'workbench.editor.pinnedTabsOnSeparateRow' }, "启用后，在所有其他选项卡上方的单独行中显示固定的选项卡。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
			},
			'workbench.editor.preventPinnedEditorClose': {
				'type': 'string',
				'enum': ['keyboardAndMouse', 'keyboard', 'mouse', 'never'],
				'default': 'keyboardAndMouse',
				'enumDescriptions': [
					localize('workbench.editor.preventPinnedEditorClose.always', "使用鼠标中间单击或键盘时，始终阻止关闭固定的编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.onlyKeyboard', "使用键盘时阻止关闭固定编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.onlyMouse', "使用鼠标中间单击时，防止关闭固定的编辑器。"),
					localize('workbench.editor.preventPinnedEditorClose.never', "切勿阻止关闭固定编辑器。")
				],
				description: localize('workbench.editor.preventPinnedEditorClose', "控制在使用键盘或鼠标中键单击关闭时是否关闭固定的编辑器。"),
			},
			'workbench.editor.splitSizing': {
				'type': 'string',
				'enum': ['auto', 'distribute', 'split'],
				'default': 'auto',
				'enumDescriptions': [
					localize('workbench.editor.splitSizingAuto', "将活动的编辑器组拆分为若干相等的部分，除非所有编辑器组都已经等为部分。这种情况下，将所有编辑器组拆分为若干相等的部分。"),
					localize('workbench.editor.splitSizingDistribute', "将所有编辑器组拆分为相等的部分。"),
					localize('workbench.editor.splitSizingSplit', "将活动编辑器组拆分为相等的部分。")
				],
				'description': localize('splitSizing', "拆分编辑器组时控制编辑器组大小。"),
				'keywords': ['pane']
			},
			'workbench.editor.splitOnDragAndDrop': {
				'type': 'boolean',
				'default': true,
				'description': localize('splitOnDragAndDrop', "通过将编辑器或文件放到编辑器区域的边缘，控制是否可以由拖放操作拆分编辑器组。"),
				'keywords': ['pane']
			},
			'workbench.editor.dragToOpenWindow': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('dragToOpenWindow', "控制是否可将编辑器拖出窗口以在新窗口中打开。长按 Alt 键，同时拖动以动态切换。")
			},
			'workbench.editor.focusRecentEditorAfterClose': {
				'type': 'boolean',
				'description': localize('focusRecentEditorAfterClose', "控制是按最近使用的顺序还是从左到右关闭编辑器。"),
				'default': true
			},
			'workbench.editor.showIcons': {
				'type': 'boolean',
				'description': localize('showIcons', "控制是否在打开的编辑器中显示图标。这要求同时启用文件图标主题。"),
				'default': true
			},
			'workbench.editor.enablePreview': {
				'type': 'boolean',
				'description': localize('enablePreview', "控制在编辑器打开时是否使用预览模式。每个编辑器组最多只能有一个预览模式编辑器。此编辑器在其选项卡或标题标签和“打开编辑器”视图中以斜体显示其文件名。其内容将替换为在预览模式下打开的下一个编辑器。在预览模式编辑器中进行更改将保留它，就像双击其标签或其标签上下文菜单中的“保持打开”选项一样。通过双击从资源管理器打开文件会立即保留其编辑器。"),
				'default': true
			},
			'workbench.editor.enablePreviewFromQuickOpen': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'enablePreviewFromQuickOpen' }, "控制通过 Quick Open 打开的编辑器是否显示为预览编辑器。预览编辑器不会保持打开状态，在将其显式设置为保持打开(通过双击或编辑)前将会重用。启用后，在选择前按住 Ctrl 可在非预览模式下打开编辑器。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.enablePreviewFromCodeNavigation': {
				'type': 'boolean',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'enablePreviewFromCodeNavigation' }, "控制当从编辑器开始进行代码导航时，编辑器是否保持为预览状态。预览编辑器不会保持打开状态，在将其显式设置为保持打开(通过双击或编辑)前将会重用。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'default': false
			},
			'workbench.editor.closeOnFileDelete': {
				'type': 'boolean',
				'description': localize('closeOnFileDelete', "控制在会话期间显示已打开文件的编辑器是否应在被其他进程删除或重命名时自动关闭。禁用此功能将使编辑器在此类事件中保持打开状态。请注意，从应用程序内删除将始终关闭编辑器，且永远不会关闭具有未保存更改的编辑器以保留数据。"),
				'default': false
			},
			'workbench.editor.openPositioning': {
				'type': 'string',
				'enum': ['left', 'right', 'first', 'last'],
				'default': 'right',
				'markdownDescription': localize({ comment: ['{0}, {1}, {2}, {3} will be a setting name rendered as a link'], key: 'editorOpenPositioning' }, "控制编辑器打开的位置。选择 {0} 或 {1} 可分别在当前活动编辑器的左侧或右侧打开。选择 {2} 或 {3} 打开编辑器的位置与当前活动编辑器无关。", '`left`', '`right`', '`first`', '`last`')
			},
			'workbench.editor.openSideBySideDirection': {
				'type': 'string',
				'enum': ['right', 'down'],
				'default': 'right',
				'markdownDescription': localize('sideBySideDirection', "控制编辑器在并排打开时(例如从资源管理器)出现的默认位置。默认在当前活动编辑器右侧打开。若更改为 \"down\"，则在当前活动编辑器下方打开。这也会影响编辑器工具栏中的拆分编辑器操作。")
			},
			'workbench.editor.closeEmptyGroups': {
				'type': 'boolean',
				'description': localize('closeEmptyGroups', "控制编辑器组中最后一个选项卡关闭时这个空组的行为。若启用，将自动关闭空组。若禁用，空组仍将保留在网格布局中。"),
				'default': true,
				'keywords': ['pane']
			},
			'workbench.editor.revealIfOpen': {
				'type': 'boolean',
				'description': localize('revealIfOpen', "控制是否在打开的任何可见组中显示编辑器。如果禁用，编辑器将优先在当前活动的编辑器组中打开。如果启用，将显示在已打开的编辑器，而不是在当前活动的编辑器组中再次打开。请注意，有些情况下会忽略此设置，例如，强制编辑器在特定组中打开或在当前活动组的一侧打开。"),
				'default': false
			},
			'workbench.editor.useModal': {
				'type': 'string',
				'enum': ['off', 'some', 'all'],
				'enumDescriptions': [
					localize('useModal.off', "编辑器从不在模态浮层中打开。"),
					localize('useModal.some', "某些编辑器(如设置和键盘快捷方式)，可能会在居中模态浮层中打开。"),
					localize('useModal.all', "所有编辑器均在居中模态浮层中打开。"),
				],
				'description': localize('useModal', "控制编辑器是否在模态浮层中打开。"),
				'default': 'some',
				agentsWindow: { default: 'all' },
				experiment: {
					mode: 'startup'
				}
			},
			'workbench.editor.swipeToNavigate': {
				'type': 'boolean',
				'description': localize('swipeToNavigate', "通过使用三指水平滑动来切换打开的文件。请注意，“系统首选项”>“触控板”>“更多手势”>“在页面之间轻扫”必须设置为“用两指或三指轻扫”。"),
				'default': false,
				'included': isMacintosh && !isWeb
			},
			[MOUSE_BACK_FORWARD_NAVIGATION_SETTING]: {
				'type': 'boolean',
				'description': localize('mouseBackForwardToNavigate', "允许使用鼠标按钮四和五执行“返回”和“前进”命令。"),
				'default': true
			},
			'workbench.editor.navigationScope': {
				'type': 'string',
				'enum': ['default', 'editorGroup', 'editor'],
				'default': 'default',
				'markdownDescription': localize('navigationScope', "控制编辑器中“返回”和“前进”等命令的历史导航范围。"),
				'enumDescriptions': [
					localize('workbench.editor.navigationScopeDefault', "浏览所有打开的编辑器和编辑器组。"),
					localize('workbench.editor.navigationScopeEditorGroup', "仅在活动编辑器组的编辑器中导航。"),
					localize('workbench.editor.navigationScopeEditor', "仅在活动编辑器中导航。")
				],
			},
			'workbench.editor.restoreViewState': {
				'type': 'boolean',
				'markdownDescription': localize('restoreViewState', "关闭编辑器后重新打开时，将还原最后的编辑器视图状态(例如滚动位置)。编辑器视图状态按编辑器组存储，并在组关闭时被放弃。使用 {0} 设置以跨所有编辑器组使用最后已知的视图状态，以防找不到编辑器组之前的视图状态。", '`#workbench.editor.sharedViewState#`'),
				'default': true,
				'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
			},
			'workbench.editor.sharedViewState': {
				'type': 'boolean',
				'description': localize('sharedViewState', "跨所有编辑器组保留最新的编辑器视图状态(例如滚动位置等)并在未找到编辑器组的特定编辑器视图状态时进行还原。"),
				'default': false
			},
			'workbench.editor.restoreEditors': {
				'type': 'boolean',
				'description': localize('restoreOnStartup', "控制启动时是否还原编辑器。禁用时，仅还原上次会话中未保存的编辑器。"),
				'default': true,
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.editor.splitInGroupLayout': {
				'type': 'string',
				'enum': ['vertical', 'horizontal'],
				'default': 'horizontal',
				'markdownDescription': localize('splitInGroupLayout', "控制在编辑器组中垂直或水平拆分编辑器时的布局。"),
				'enumDescriptions': [
					localize('workbench.editor.splitInGroupLayoutVertical', "从上到下定位编辑器。"),
					localize('workbench.editor.splitInGroupLayoutHorizontal', "从左到右定位编辑器。")
				]
			},
			'workbench.editor.centeredLayoutAutoResize': {
				'type': 'boolean',
				'default': true,
				'description': localize('centeredLayoutAutoResize', "如果在居中布局中打开了超过一组编辑器，控制是否自动将宽度调整为最大宽度值。当回到只打开了一组编辑器的状态，将自动将宽度调整为原始的居中宽度值。")
			},
			'workbench.editor.centeredLayoutFixedWidth': {
				'type': 'boolean',
				'default': false,
				'description': localize('centeredLayoutDynamicWidth', "调整窗口大小时，居中布局尝试维持常量宽度的控件。")
			},
			'workbench.editor.doubleClickTabToToggleEditorGroupSizes': {
				'type': 'string',
				'enum': ['maximize', 'expand', 'off'],
				'default': 'expand',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'doubleClickTabToToggleEditorGroupSizes' }, "控制双击选项卡时编辑器组的大小调整方式。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.editor.showTabs#`', '`multiple`'),
				'enumDescriptions': [
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.maximize', "所有其他编辑器组均已隐藏，当前编辑器组将最大化以占用整个编辑器区域。"),
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.expand', "该编辑器组通过尽可能缩小所有其他编辑器组来占用尽可能多的空间。"),
					localize('workbench.editor.doubleClickTabToToggleEditorGroupSizes.off', "双击选项卡时不会调整编辑器组的大小。")
				],
				agentsWindow: { default: 'maximize', readOnly: true },
			},
			'workbench.editor.limit.enabled': {
				'type': 'boolean',
				'default': false,
				'description': localize('limitEditorsEnablement', "控制打开的编辑器数是否应受限制。启用后，最近使用较少的编辑器将关闭，以为新打开的编辑器腾出空间。")
			},
			'workbench.editor.limit.value': {
				'type': 'number',
				'default': 10,
				'exclusiveMinimum': 0,
				'markdownDescription': localize('limitEditorsMaximum', "控制打开编辑器的最大数量。使用 {0} 设置控制每个编辑器组或跨所有组的限制。", '`#workbench.editor.limit.perEditorGroup#`')
			},
			'workbench.editor.limit.excludeDirty': {
				'type': 'boolean',
				'default': false,
				'description': localize('limitEditorsExcludeDirty', "控制打开的编辑器的最大数目是否应排除脏编辑器以计入配置的限制。")
			},
			'workbench.editor.limit.perEditorGroup': {
				'type': 'boolean',
				'default': false,
				'description': localize('perEditorGroup', "控制最大打开的编辑器的限制是否应应用于每个编辑器组或所有编辑器组。")
			},
			'workbench.localHistory.enabled': {
				'type': 'boolean',
				'default': true,
				'description': localize('localHistoryEnabled', "控制是否启用本地文件历史记录。启用后，所保存编辑器文件内容将存储到备份位置，以便稍后可以还原或查看内容。更改此设置不会影响现有本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.maxFileSize': {
				'type': 'number',
				'default': 256,
				'minimum': 1,
				'description': localize('localHistoryMaxFileSize', "控制考虑用于本地历史记录的文件最大大小(KB)。较大的文件将不会添加到本地历史记录中。更改此设置不会影响现有本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.maxFileEntries': {
				'type': 'number',
				'default': 50,
				'minimum': 0,
				'description': localize('localHistoryMaxFileEntries', "控制每个文件的最大本地文件历史记录条目数。当文件的本地文件历史记录条目数超过此数目时，将丢弃最早的条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.exclude': {
				'type': 'object',
				'patternProperties': {
					'.*': { 'type': 'boolean' }
				},
				'markdownDescription': localize('exclude', "配置路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)以排除本地文件历史记录中的文件。glob 模式的计算结果始终是相对于工作区文件夹路径所在的位置，除非它们是绝对路径。更改此设置不会影响现有的本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.localHistory.mergeWindow': {
				'type': 'number',
				'default': 10,
				'minimum': 1,
				'markdownDescription': localize('mergeWindow', "配置时间间隔(以秒为单位)，在此间隔期间，本地文件历史记录中的最后一个条目将替换为正在添加的条目。这有助于减少所添加的条目总数，例如启用自动保存时。此设置仅应用于具有相同源的条目。更改此设置不会影响现有本地文件历史记录条目。"),
				'scope': ConfigurationScope.RESOURCE
			},
			'workbench.commandPalette.history': {
				'type': 'number',
				'description': localize('commandHistory', "控制命令面板中保留最近使用命令的数量。设置为 0 时禁用命令历史功能。"),
				'default': 50,
				'minimum': 0
			},
			'workbench.commandPalette.preserveInput': {
				'type': 'boolean',
				'description': localize('preserveInput', "当再次打开命令面板时，控制是否恢复上一次输入的内容。"),
				'default': false
			},
			'workbench.commandPalette.experimental.suggestCommands': {
				'type': 'boolean',
				tags: ['experimental'],
				'description': localize('suggestCommands', "控制命令面板是否应包含常用命令的列表。"),
				'default': false
			},
			'workbench.quickOpen.closeOnFocusLost': {
				'type': 'boolean',
				'description': localize('closeOnFocusLost', "控制 Quick Open 是否在其失去焦点时自动关闭。"),
				'default': true
			},
			'workbench.quickOpen.preserveInput': {
				'type': 'boolean',
				'description': localize('workbench.quickOpen.preserveInput', "在打开 Quick Open 视图时，控制是否自动恢复上一次输入的值。"),
				'default': false
			},
			'workbench.settings.openDefaultSettings': {
				'type': 'boolean',
				'description': localize('openDefaultSettings', "控制在打开设置时是否同时打开显示所有默认设置的编辑器。"),
				'default': false
			},
			'workbench.settings.useSplitJSON': {
				'type': 'boolean',
				'markdownDescription': localize('useSplitJSON', "控制在将设置编辑为 json 时是否使用拆分 json 编辑器。"),
				'default': false
			},
			'workbench.settings.openDefaultKeybindings': {
				'type': 'boolean',
				'description': localize('openDefaultKeybindings', "控制在打开按键绑定设置时是否同时打开显示所有默认按键绑定的编辑器。"),
				'default': false
			},
			'workbench.settings.alwaysShowAdvancedSettings': {
				'type': 'boolean',
				'description': localize('alwaysShowAdvancedSettings', "控制是否始终在设置编辑器中显示高级设置，而无需使用 `@tag:advanced` 筛选器。"),
				'default': product.quality !== 'stable'
			},
			'workbench.sideBar.location': {
				'type': 'string',
				'enum': ['left', 'right'],
				'default': 'left',
				'description': localize('sideBarLocation', "控制主边栏和活动栏的位置。它们可以显示在工作台的左侧或右侧。辅助边栏将显示在工作台的另一侧。"),
				agentsWindow: { default: 'left', readOnly: true },
			},
			'workbench.panel.showLabels': {
				'type': 'boolean',
				'default': true,
				'description': localize('panelShowLabels', "控制面板标题中的活动项是显示为标签还是图标。"),
			},
			'workbench.panel.defaultLocation': {
				'type': 'string',
				'enum': ['left', 'bottom', 'top', 'right'],
				'default': 'bottom',
				'description': localize('panelDefaultLocation', "控制新工作区中面板(终端、调试控制台、输出、问题)的默认位置。它可以显示在编辑器区域的底部、顶部、右侧或左侧。"),
				agentsWindow: { default: 'bottom', readOnly: true },
			},
			'workbench.panel.opensMaximized': {
				'type': 'string',
				'enum': ['always', 'never', 'preserve'],
				'default': 'preserve',
				'description': localize('panelOpensMaximized', "控制面板是否以最大化方式打开。它可以始终以最大化方式打开、永不以最大化方式打开或以关闭前的最后一个状态打开。"),
				'enumDescriptions': [
					localize('workbench.panel.opensMaximized.always', "始终以最大化方式打开面板。"),
					localize('workbench.panel.opensMaximized.never', "打开面板时，切勿将其最大化。"),
					localize('workbench.panel.opensMaximized.preserve', "以关闭面板前的状态打开面板。")
				],
				agentsWindow: { default: 'never', readOnly: true },
			},
			'workbench.secondarySideBar.defaultVisibility': {
				'type': 'string',
				'enum': ['hidden', 'visibleInWorkspace', 'visible', 'maximizedInWorkspace', 'maximized'],
				'default': 'hidden',
				'description': localize('secondarySideBarDefaultVisibility', "控制首次打开的工作区或空窗口中辅助边栏的默认可见性。可以由智能体会话启动编辑器设置替代。"),
				'enumDescriptions': [
					localize('workbench.secondarySideBar.defaultVisibility.hidden', "默认情况下，辅助边栏是隐藏的。"),
					localize('workbench.secondarySideBar.defaultVisibility.visibleInWorkspace', "如果已打开工作区，辅助侧栏默认是可见的。"),
					localize('workbench.secondarySideBar.defaultVisibility.visible', "默认情况下，辅助边栏是可见的。"),
					localize('workbench.secondarySideBar.defaultVisibility.maximizedInWorkspace', "如果打开了工作区，则辅助侧栏是可见的，默认情况下最大化。"),
					localize('workbench.secondarySideBar.defaultVisibility.maximized', "辅助侧栏在默认情况下可见并最大化。")
				],
				agentsWindow: { default: 'hidden', readOnly: true },
			},
			'workbench.secondarySideBar.forceMaximized': {
				'type': 'boolean',
				'default': false,
				tags: ['experimental'],
				'description': localize('secondarySideBarForceMaximized', "控制在支持最大化辅助侧边栏的布局中，是否在启动时及无打开的编辑器时强制始终最大化显示辅助侧边栏。"),
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.secondarySideBar.showLabels': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('secondarySideBarShowLabels', "控制辅助边栏中的活动项是显示为标签还是图标。此设置仅在 {0} 未设置为 {1} 时生效。", '`#workbench.activityBar.location#`', '`top`'),
				agentsWindow: { default: true, readOnly: true },
			},
			'workbench.statusBar.visible': {
				'type': 'boolean',
				'default': true,
				'description': localize('statusBarVisibility', "控制工作台底部状态栏的可见性。"),
				agentsWindow: { default: false, readOnly: true },
			},
			[NotificationsSettings.NOTIFICATIONS_POSITION]: {
				'type': 'string',
				'enum': [NotificationsPosition.BOTTOM_RIGHT, NotificationsPosition.BOTTOM_LEFT, NotificationsPosition.TOP_RIGHT],
				'default': NotificationsPosition.BOTTOM_RIGHT,
				'description': localize('notificationsPosition', "控制通知 Toast 和通知中心的位置。"),
				'enumDescriptions': [
					localize('workbench.notifications.position.bottom-right', "在右下角显示通知。"),
					localize('workbench.notifications.position.bottom-left', "在右下角显示通知。"),
					localize('workbench.notifications.position.top-right', "在右上角显示与操作系统级通知类似的通知。")
				],
				'tags': ['experimental'],
				'experiment': {
					'mode': 'auto'
				}
			},
			[NotificationsSettings.NOTIFICATIONS_BUTTON]: {
				'type': 'boolean',
				'default': true,
				'description': localize('notificationsButton', "控制标题栏中通知按钮的可见性。仅当通知位于右上角时适用。")
			},
			[LayoutSettings.ACTIVITY_BAR_LOCATION]: {
				'type': 'string',
				'enum': ['default', 'top', 'bottom', 'hidden'],
				'default': 'default',
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarLocation' }, "控制活动栏相对于主边栏和辅助侧栏的位置。"),
				'enumDescriptions': [
					localize('workbench.activityBar.location.default', "在主侧栏的一侧和辅助侧栏的顶部显示活动栏。"),
					localize('workbench.activityBar.location.top', "在主边栏和辅助边栏上方显示活动栏。"),
					localize('workbench.activityBar.location.bottom', "在主侧栏和辅助侧栏的底部显示活动栏。"),
					localize('workbench.activityBar.location.hide', "在主边栏和辅助边栏中隐藏活动栏。")
				],
				agentsWindow: { default: 'default', readOnly: true },
			},
			[LayoutSettings.ACTIVITY_BAR_AUTO_HIDE]: {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarAutoHide' }, "控制当只有一个视图容器要显示时，活动栏是否自动隐藏。当 {0} 设置为 {1} 或 {2} 时，这适用于主要和辅助侧边栏。", '`#workbench.activityBar.location#`', '`top`', '`bottom`'),
				agentsWindow: { default: false, readOnly: true },
			},
			[LayoutSettings.ACTIVITY_BAR_COMPACT]: {
				'type': 'boolean',
				'default': false,
				'markdownDescription': localize({ comment: ['This is the description for a setting'], key: 'activityBarCompact' }, "控制活动栏是否使用图标较小、宽度减少的紧凑布局。仅当 {0} 设置为 {1} 时，此设置才适用。", '`#workbench.activityBar.location#`', '`default`'),
				agentsWindow: { default: false, readOnly: true },
			},
			'workbench.activityBar.iconClickBehavior': {
				'type': 'string',
				'enum': ['toggle', 'focus'],
				'default': 'toggle',
				'markdownDescription': localize({ comment: ['{0}, {1} will be a setting name rendered as a link'], key: 'activityBarIconClickBehavior' }, "控制在工作台中单击活动栏图标时出现的行为。如果未将 {0} 设置为 {1}，则会忽略此值。", '`#workbench.activityBar.location#`', '`default`'),
				'enumDescriptions': [
					localize('workbench.activityBar.iconClickBehavior.toggle', "如果单击的项已可见，则隐藏主边栏。"),
					localize('workbench.activityBar.iconClickBehavior.focus', "如果单击的项已可见，则将焦点放在主边栏上。")
				],
				agentsWindow: { default: 'toggle', readOnly: true },
			},
			'workbench.view.alwaysShowHeaderActions': {
				'type': 'boolean',
				'default': false,
				'description': localize('viewVisibility', "控制是否显示视图头部的操作项。视图头部操作项可以一直，或是仅当聚焦到和悬停在视图上时显示。")
			},
			'workbench.view.showQuietly': {
				'type': 'object',
				'description': localize('workbench.view.showQuietly', "如果扩展请求显示隐藏视图，则改为显示可单击的状态栏指示器。"),
				'scope': ConfigurationScope.WINDOW,
				'properties': {
					'workbench.panel.output': {
						'type': 'boolean',
						'description': localize('workbench.panel.output', "输出视图")
					}
				},
				'additionalProperties': false
			},
			'workbench.fontAliasing': {
				'type': 'string',
				'enum': ['default', 'antialiased', 'none', 'auto'],
				'default': 'default',
				'description':
					localize('fontAliasing', "控制在工作台中字体的渲染方式。"),
				'enumDescriptions': [
					localize('workbench.fontAliasing.default', "次像素平滑字体。将在大多数非 retina 显示器上显示最清晰的文字。"),
					localize('workbench.fontAliasing.antialiased', "进行像素而不是次像素级别的字体平滑。可能会导致字体整体显示得更细。"),
					localize('workbench.fontAliasing.none', "禁用字体平滑。将显示边缘粗糙、有锯齿的文字。"),
					localize('workbench.fontAliasing.auto', "根据显示器 DPI 自动应用 `default` 或 `antialiased` 选项。")
				],
				'included': isMacintosh
			},
			'workbench.settings.editor': {
				'type': 'string',
				'enum': ['ui', 'json'],
				'enumDescriptions': [
					localize('settings.editor.ui', "使用设置 ui 编辑器。"),
					localize('settings.editor.json', "使用 json 文件编辑器。"),
				],
				'description': localize('settings.editor.desc', "确定默认情况下要使用的“设置”编辑器。"),
				'default': 'ui',
				'scope': ConfigurationScope.WINDOW
			},
			'workbench.hover.delay': {
				'type': 'number',
				'description': localize('workbench.hover.delay', "控制为工作台项显示悬停之前的延迟时间(以毫秒为单位)(例如，一些扩展提供了树状视图项)。已经可见的项可能需要刷新，然后才会反映出此设置更改。"),
				// Testing has indicated that on Windows and Linux 500 ms matches the native hovers most closely.
				// On Mac, the delay is 1500.
				'default': isMacintosh ? 1500 : 500,
				'minimum': 0
			},
			'workbench.hover.reducedDelay': {
				'type': 'number',
				'description': localize('workbench.hover.reducedDelay', "控制在特定场景下显示悬停时的延迟(以毫秒为单位)，以便更快地反馈。"),
				'default': 500,
				'minimum': 0
			},
			'workbench.reduceMotion': {
				type: 'string',
				description: localize('workbench.reduceMotion', "控制工作台是否应以更少的动画呈现。"),
				'enumDescriptions': [
					localize('workbench.reduceMotion.on', "始终减少动作呈现。"),
					localize('workbench.reduceMotion.off', "不要减少运动呈现"),
					localize('workbench.reduceMotion.auto', "根据 OS 配置减少运动呈现。"),
				],
				default: 'auto',
				tags: ['accessibility'],
				enum: ['on', 'off', 'auto']
			},
			'workbench.reduceTransparency': {
				type: 'string',
				description: localize('workbench.reduceTransparency', "控制工作台是否应以较少透明度和模糊效果呈现，以提高性能。"),
				'enumDescriptions': [
					localize('workbench.reduceTransparency.on', "始终呈现而不含透明度和模糊效果。"),
					localize('workbench.reduceTransparency.off', "不要降低透明度和模糊效果。"),
					localize('workbench.reduceTransparency.auto', "根据操作系统配置降低透明度和模糊效果。"),
				],
				default: 'off',
				tags: ['accessibility'],
				enum: ['on', 'off', 'auto']
			},
			'workbench.navigationControl.enabled': {
				'type': 'boolean',
				'default': true,
				'markdownDescription': isWeb ?
					localize('navigationControlEnabledWeb', "控制是否显示标题栏中的导航控件。") :
					localize({ key: 'navigationControlEnabled', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "控制导航控件是否显示在自定义标题栏中。此设置仅在 {0} 设置为 {1} 时才会生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: false, readOnly: true },
			},
			[LayoutSettings.LAYOUT_ACTIONS]: {
				'type': 'boolean',
				'default': true,
				'markdownDescription': isWeb ?
					localize('layoutControlEnabledWeb', "控制是否显示标题栏中的布局控件。") :
					localize({ key: 'layoutControlEnabled', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "控制布局控件是否显示在自定义标题栏中。仅当 {0} 设置为 {1} 时，此设置才会生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: true, readOnly: true },
			},
			'workbench.layoutControl.type': {
				'type': 'string',
				'enum': ['menu', 'toggles', 'both'],
				'enumDescriptions': [
					localize('layoutcontrol.type.menu', "显示包含布局选项下拉列表的单个按钮。"),
					localize('layoutcontrol.type.toggles', "显示用于切换面板和侧边栏可见性的多个按钮。"),
					localize('layoutcontrol.type.both', "显示下拉列表和切换按钮。"),
				],
				'default': 'both',
				'description': localize('layoutControlType', "控制自定义标题栏中的布局控件是显示为单个菜单按钮还是多个 UI 切换。"),
				agentsWindow: { default: 'both', readOnly: true },
			},
			'workbench.tips.enabled': {
				'type': 'boolean',
				'default': true,
				'description': localize('tips.enabled', "启用后，当没有打开编辑器时将显示水印提示。"),
				agentsWindow: { default: false },
			},
			[LayoutSettings.SHADOWS]: {
				'type': 'boolean',
				'default': true,
				'description': localize('shadows', "控制是否在侧面板和其他工作台元素周围显示阴影效果。")
			},
			[LayoutSettings.MODERN_UI]: {
				'type': 'boolean',
				'default': false,
				'tags': ['experimental'],
				'description': localize('modernUI', "Controls whether the Modern UI Update is enabled. When on, the side bars and bottom panel are shown as floating cards with rounded corners and gaps, and a set of refreshed workbench styles is applied, matching the Agents window design."),
				experiment: { mode: 'auto' },
			},
		}
	});

	// Window

	let windowTitleDescription = localize('windowTitle', "基于打开的工作区或活动编辑器等当前上下文控制窗口标题。根据上下文替换变量:");
	windowTitleDescription += '\n- ' + [
		localize('activeEditorShort', "\"${activeEditorShort}\": 文件名 (例如 myFile.txt)。"),
		localize('activeEditorMedium', "\"${activeEditorMedium}\": 相对于工作区文件夹的文件路径 (例如, myFolder/myFileFolder/myFile.txt)。"),
		localize('activeEditorLong', "\"${activeEditorLong}\": 文件的完整路径 (例如 /Users/Development/myFolder/myFileFolder/myFile.txt)。"),
		localize('activeEditorLanguageId', "`${activeEditorLanguageId}`: 活动编辑器的语言标识符(例如 typescript)。"),
		localize('activeFolderShort', "\"${activeFolderShort}\": 文件所在的文件夹名称 (例如, myFileFolder)。"),
		localize('activeFolderMedium', "\"${activeFolderMedium}\": 相对于工作区文件夹的、包含文件的文件夹的路径, (例如 myFolder/myFileFolder)。"),
		localize('activeFolderLong', "\"${activeFolderLong}\": 文件所在文件夹的完整路径 (例如 /Users/Development/myFolder/myFileFolder)。"),
		localize('folderName', "\"${folderName}\": 文件所在工作区文件夹的名称 (例如 myFolder)。"),
		localize('folderPath', "\"${folderpath}\": 文件所在工作区文件夹的路径 (例如 /Users/Development/myFolder)。"),
		localize('rootName', "`${rootName}`: 具有可选远程名称和工作区指示器的工作区的名称(如果适用)(例如 myFolder、myRemoteFolder [SSH] 或 myWorkspace [工作区])。"),
		localize('rootNameShort', "`${rootNameShort}`: 已缩短的工作区名称，不包含后缀(例如 myFolder、myRemoteFolder 或 myWorkspace)。"),
		localize('rootPath', "\"${rootPath}\": 打开的工作区或文件夹的文件路径 (例如 /Users/Development/myWorkspace)。"),
		localize('profileName', "\"${profileName}\": 在其中打开工作区的配置文件的名称(例如数据科学(配置文件))。如果使用默认配置文件，则忽略此选项。"),
		localize('appName', "\"${appName}\": 例如 VS Code。"),
		localize('remoteName', "`${remoteName}`: 例如 SSH"),
		localize('dirty', "`${dirty}`: 表明活动编辑器具有未保存更改的时间的指示器。"),
		localize('focusedView', "`${focusedView}`: 当前聚焦的视图名称。"),
		localize('activeRepositoryName', "`${activeRepositoryName}`: 活动存储库的名称(例如 vscode)。"),
		localize('activeRepositoryBranchName', "`${activeRepositoryBranchName}`: 活动存储库中活动分支的名称(例如 main)。"),
		localize('activeEditorState', "`${activeEditorState}`: 提供有关活动编辑器状态的信息(例如，已修改)。在处于启用了 {0} 的屏幕阅读器模式时，默认情况下会追加此信息。", '`accessibility.windowTitleOptimized`'),
		localize('separator', "\"${separator}\": 一种条件分隔符 (\"-\"), 仅在被包含值或静态文本的变量包围时显示。")
	].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations

	registry.registerConfiguration({
		...windowConfigurationNodeBase,
		'properties': {
			'window.title': {
				'type': 'string',
				'default': defaultWindowTitle,
				'markdownDescription': windowTitleDescription,
				agentsWindow: { default: '${appName}', readOnly: true },
			},
			'window.titleSeparator': {
				'type': 'string',
				'default': defaultWindowTitleSeparator,
				'markdownDescription': localize("window.titleSeparator", "{0} 使用的分隔符。", '`#window.title#`')
			},
			[LayoutSettings.COMMAND_CENTER]: {
				type: 'boolean',
				default: true,
				markdownDescription: isWeb ?
					localize('window.commandCenterWeb', "将命令启动器与窗口标题一起显示。") :
					localize({ key: 'window.commandCenter', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "将命令启动器与窗口标题一起显示。仅当 {0} 设置为 {1} 时，此设置才会生效。", '`#window.customTitleBarVisibility#`', '`never`'),
				agentsWindow: { default: false, readOnly: true },
			},
			'window.menuBarVisibility': {
				'type': 'string',
				'enum': ['classic', 'visible', 'toggle', 'hidden', 'compact'],
				'markdownEnumDescriptions': [
					localize('window.menuBarVisibility.classic', "菜单显示在窗口顶部，并且仅在全屏模式下隐藏。"),
					localize('window.menuBarVisibility.visible', "即使在全屏模式下，菜单也始终显示在窗口顶部。"),
					isMacintosh ?
						localize('window.menuBarVisibility.toggle.mac', "菜单处于隐藏状态，但通过执行“聚焦应用程序菜单”命令可在窗口顶部显示。") :
						localize('window.menuBarVisibility.toggle', "菜单处于隐藏状态，但通过按 Alt 键可在窗口顶部显示。"),
					localize('window.menuBarVisibility.hidden', "菜单始终隐藏。"),
					isWeb ?
						localize('window.menuBarVisibility.compact.web', "菜单在边栏中显示为紧凑按钮。") :
						localize({ key: 'window.menuBarVisibility.compact', comment: ['{0}, {1} is a placeholder for a setting identifier.'] }, "菜单在边栏中显示为紧凑按钮。当 {0} 为 {1} 且 {2} 为 {3} 或 {4} 时，将忽略此值。", '`#window.titleBarStyle#`', '`native`', '`#window.menuStyle#`', '`native`', '`inherit`')
				],
				'default': isWeb ? 'compact' : 'classic',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': isMacintosh ?
					localize('menuBarVisibility.mac', "控制菜单栏的可见性。“切换”设置表示菜单栏处于隐藏状态，执行“聚焦应用程序菜单”将显示菜单栏。“精简”设置会将菜单移到边栏中。") :
					localize('menuBarVisibility', "控制菜单栏的可见性。“切换”设置表示菜单栏处于隐藏状态，只需按一下 Alt 键即可显示。“精简”设置会将菜单移到边栏中。"),
				'included': isWindows || isLinux || isWeb
			},
			'window.enableMenuBarMnemonics': {
				'type': 'boolean',
				'default': true,
				'scope': ConfigurationScope.APPLICATION,
				'description': localize('enableMenuBarMnemonics', "控制是否可通过 Alt 键快捷键打开主菜单。如果禁用助记符，则可将这些 Alt 键快捷键绑定到编辑器命令。"),
				'included': isWindows || isLinux
			},
			'window.customMenuBarAltFocus': {
				'type': 'boolean',
				'default': true,
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('customMenuBarAltFocus', "控制是否通过按 Alt 键聚焦菜单栏。此设置对使用 Alt 键切换菜单栏没有任何影响。"),
				'included': isWindows || isLinux,
				agentsWindow: { default: false, readOnly: true },
			},
			'window.openFilesInNewWindow': {
				'type': 'string',
				'enum': ['on', 'off', 'default'],
				'enumDescriptions': [
					localize('window.openFilesInNewWindow.on', "在新窗口中打开文件。"),
					localize('window.openFilesInNewWindow.off', "在文件所在文件夹的已有窗口中或在上一个活动窗口中打开文件。"),
					isMacintosh ?
						localize('window.openFilesInNewWindow.defaultMac', "在文件所在文件夹的已有窗口中或在上一个活动窗口中打开文件，除非其通过“程序坞”(Dock) 或“访达”(Finder) 打开。") :
						localize('window.openFilesInNewWindow.default', "在新窗口中打开文件，除非文件从应用程序内进行选取 (例如，通过“文件”菜单)。")
				],
				'default': 'off',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription':
					isMacintosh ?
						localize('openFilesInNewWindowMac', "控制是否应在使用命令行或文件对话框时在新窗口中打开文件。\r\n请注意，此设置可能会被忽略(例如，在使用 `--new-window` 或 `--reuse-window` 命令行选项时)。") :
						localize('openFilesInNewWindow', "控制是否应在使用命令行或文件对话框时在新窗口中打开文件。\r\n请注意，此设置可能会被忽略(例如，在使用 `--new-window` 或 `--reuse-window` 命令行选项时)。")
			},
			'window.openFoldersInNewWindow': {
				'type': 'string',
				'enum': ['on', 'off', 'default'],
				'enumDescriptions': [
					localize('window.openFoldersInNewWindow.on', "在新窗口中打开文件夹。"),
					localize('window.openFoldersInNewWindow.off', "文件夹将替换上一个活动窗口。"),
					localize('window.openFoldersInNewWindow.default', "在新窗口中打开文件夹，除非文件夹从应用程序内进行选取 (例如，通过“文件”菜单)。")
				],
				'default': 'default',
				'scope': ConfigurationScope.APPLICATION,
				'markdownDescription': localize('openFoldersInNewWindow', "控制打开文件夹时是在新窗口打开还是替换上一个活动窗口。\r\n注意，此设置可能会被忽略 (例如，在使用 `--new-window` 或 `--reuse-window` 命令行选项时)。")
			},
			'window.confirmBeforeClose': {
				'type': 'string',
				'enum': ['always', 'keyboardOnly', 'never'],
				'enumDescriptions': [
					isWeb ?
						localize('window.confirmBeforeClose.always.web', "始终尝试请求确认。请注意，浏览器仍可能在未经确认的情况下决定关闭标签页或窗口。") :
						localize('window.confirmBeforeClose.always', "始终询问确认。"),
					isWeb ?
						localize('window.confirmBeforeClose.keyboardOnly.web', "仅在检测到使用了键绑定关闭窗口时请求确认。请注意，在某些情况下可能无法进行检测。") :
						localize('window.confirmBeforeClose.keyboardOnly', "仅在已使用键绑定时请求确认。"),
					isWeb ?
						localize('window.confirmBeforeClose.never.web', "除非即将丢失数据，否则绝不明确询问确认。") :
						localize('window.confirmBeforeClose.never', "从不显式请求确认。")
				],
				'default': (isWeb && !isStandalone()) ? 'keyboardOnly' : 'never', // on by default in web, unless PWA, never on desktop
				'markdownDescription': isWeb ?
					localize('confirmBeforeCloseWeb', "控制在关闭浏览器选项卡或窗口之前是否显示确认对话框。请注意，即使已启用，浏览器仍可能决定在不进行确认的情况下关闭选项卡或窗口，并且此设置仅作为提示，并非在所有情况下都起作用。") :
					localize('confirmBeforeClose', "控制是否在关闭窗口或退出应用程序之前显示确认对话框。"),
				'scope': ConfigurationScope.APPLICATION
			}
		}
	});

	// Dynamic Window Configuration
	registerWorkbenchContribution2(DynamicWindowConfiguration.ID, DynamicWindowConfiguration, WorkbenchPhase.Eventually);

	// Problems
	registry.registerConfiguration({
		...problemsConfigurationNodeBase,
		'properties': {
			'problems.visibility': {
				'type': 'boolean',
				'default': true,
				'description': localize('problems.visibility', "控制问题是否在整个编辑器和工作台中可见。"),
			},
		}
	});

})();

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.activityBar.visible', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [];
			if (value !== undefined) {
				result.push(['workbench.activityBar.visible', { value: undefined }]);
			}
			if (value === false) {
				result.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.HIDDEN }]);
			}
			return result;
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: LayoutSettings.ACTIVITY_BAR_LOCATION, migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (value === 'side') {
				results.push([LayoutSettings.ACTIVITY_BAR_LOCATION, { value: ActivityBarPosition.DEFAULT }]);
			}
			return results;
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.editor.doubleClickTabToToggleEditorGroupSizes', migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (typeof value === 'boolean') {
				value = value ? 'expand' : 'off';
				results.push(['workbench.editor.doubleClickTabToToggleEditorGroupSizes', { value }]);
			}
			return results;
		}
	}, {
		key: LayoutSettings.EDITOR_TABS_MODE, migrateFn: (value: unknown) => {
			const results: ConfigurationKeyValuePairs = [];
			if (typeof value === 'boolean') {
				value = value ? EditorTabsMode.MULTIPLE : EditorTabsMode.SINGLE;
				results.push([LayoutSettings.EDITOR_TABS_MODE, { value }]);
			}
			return results;
		}
	}, {
		key: 'workbench.editor.tabCloseButton', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [];
			if (value === 'left' || value === 'right') {
				result.push(['workbench.editor.tabActionLocation', { value }]);
			} else if (value === 'off') {
				result.push(['workbench.editor.tabActionCloseVisibility', { value: false }]);
			}
			return result;
		}
	}, {
		key: 'zenMode.hideTabs', migrateFn: (value: unknown) => {
			const result: ConfigurationKeyValuePairs = [['zenMode.hideTabs', { value: undefined }]];
			if (value === true) {
				result.push(['zenMode.showTabs', { value: 'single' }]);
			}
			return result;
		}
	}]);

// Migrate the previous standalone experiments (`workbench.experimental.floatingPanels`
// and `workbench.experimental.styleOverrides`) onto the consolidated
// `workbench.experimental.modernUI` toggle. Either of the old settings being on
// enables the unified Modern UI Update experiment.
Registry.as<IConfigurationMigrationRegistry>(Extensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'workbench.experimental.floatingPanels', migrateFn: (value: unknown, valueAccessor) => {
			const result: ConfigurationKeyValuePairs = [['workbench.experimental.floatingPanels', { value: undefined }]];
			if (value === true && valueAccessor(LayoutSettings.MODERN_UI) === undefined) {
				result.push([LayoutSettings.MODERN_UI, { value: true }]);
			}
			return result;
		}
	}, {
		key: 'workbench.experimental.styleOverrides', migrateFn: (value: unknown, valueAccessor) => {
			const result: ConfigurationKeyValuePairs = [['workbench.experimental.styleOverrides', { value: undefined }]];
			if (Array.isArray(value) && value.length > 0 && valueAccessor(LayoutSettings.MODERN_UI) === undefined) {
				result.push([LayoutSettings.MODERN_UI, { value: true }]);
			}
			return result;
		}
	}]);
