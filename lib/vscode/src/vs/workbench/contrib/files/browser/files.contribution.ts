/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { sep } from '../../../../base/common/path.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IFileEditorInput, IEditorFactoryRegistry, EditorExtensions } from '../../../common/editor.js';
import { AutoSaveConfiguration, HotExitConfiguration, FILES_EXCLUDE_CONFIG, FILES_ASSOCIATIONS_CONFIG, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, FILES_READONLY_FROM_PERMISSIONS_CONFIG } from '../../../../platform/files/common/files.js';
import { SortOrder, LexicographicOptions, FILE_EDITOR_INPUT_ID, BINARY_TEXT_FILE_MODE, UndoConfirmLevel, IFilesConfiguration } from '../common/files.js';
import { TextFileEditorTracker } from './editors/textFileEditorTracker.js';
import { TextFileSaveErrorHandler } from './editors/textFileSaveErrorHandler.js';
import { FileEditorInput } from './editors/fileEditorInput.js';
import { BinaryFileEditor } from './editors/binaryFileEditor.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { isNative, isWeb, isWindows } from '../../../../base/common/platform.js';
import { ExplorerViewletViewsContribution } from './explorerViewlet.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../../browser/editor.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ExplorerService, UNDO_REDO_SOURCE } from './explorerService.js';
import { GUESSABLE_ENCODINGS, SUPPORTED_ENCODINGS } from '../../../services/textfile/common/encoding.js';
import { Schemas } from '../../../../base/common/network.js';
import { WorkspaceWatcher } from './workspaceWatcher.js';
import { editorConfigurationBaseNode } from '../../../../editor/common/config/editorConfigurationSchema.js';
import { DirtyFilesIndicator } from '../common/dirtyFilesIndicator.js';
import { UndoCommand, RedoCommand } from '../../../../editor/browser/editorExtensions.js';
import { IUndoRedoService } from '../../../../platform/undoRedo/common/undoRedo.js';
import { IExplorerService } from './files.js';
import { FileEditorInputSerializer, FileEditorWorkingCopyEditorHandler } from './editors/fileEditorHandler.js';
import { ModesRegistry } from '../../../../editor/common/languages/modesRegistry.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { TextFileEditor } from './editors/textFileEditor.js';

class FileUriLabelContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fileUriLabel';

	constructor(@ILabelService labelService: ILabelService) {
		labelService.registerFormatter({
			scheme: Schemas.file,
			formatting: {
				label: '${authority}${path}',
				separator: sep,
				tildify: !isWindows,
				normalizeDriveLetter: isWindows,
				authorityPrefix: sep + sep,
				workspaceSuffix: ''
			}
		});
	}
}

registerSingleton(IExplorerService, ExplorerService, InstantiationType.Delayed);

// Register file editors

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		TextFileEditor,
		TextFileEditor.ID,
		nls.localize('textFileEditor', "文本文件编辑器")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		BinaryFileEditor,
		BinaryFileEditor.ID,
		nls.localize('binaryFileEditor', "二进制文件编辑器")
	),
	[
		new SyncDescriptor(FileEditorInput)
	]
);

// Register default file input factory
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerFileEditorFactory({

	typeId: FILE_EDITOR_INPUT_ID,

	createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService): IFileEditorInput => {
		return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
	},

	isFileEditor: (obj): obj is IFileEditorInput => {
		return obj instanceof FileEditorInput;
	}
});

// Register Editor Input Serializer & Handler
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(FILE_EDITOR_INPUT_ID, FileEditorInputSerializer);
registerWorkbenchContribution2(FileEditorWorkingCopyEditorHandler.ID, FileEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);

// Register Explorer views
registerWorkbenchContribution2(ExplorerViewletViewsContribution.ID, ExplorerViewletViewsContribution, WorkbenchPhase.BlockStartup);

// Register Text File Editor Tracker
registerWorkbenchContribution2(TextFileEditorTracker.ID, TextFileEditorTracker, WorkbenchPhase.BlockStartup);

// Register Text File Save Error Handler
registerWorkbenchContribution2(TextFileSaveErrorHandler.ID, TextFileSaveErrorHandler, WorkbenchPhase.BlockStartup);

// Register uri display for file uris
registerWorkbenchContribution2(FileUriLabelContribution.ID, FileUriLabelContribution, WorkbenchPhase.BlockStartup);

// Register Workspace Watcher
registerWorkbenchContribution2(WorkspaceWatcher.ID, WorkspaceWatcher, WorkbenchPhase.AfterRestored);

// Register Dirty Files Indicator
registerWorkbenchContribution2(DirtyFilesIndicator.ID, DirtyFilesIndicator, WorkbenchPhase.BlockStartup);

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

const hotExitConfiguration: IConfigurationPropertySchema = isNative ?
	{
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', '禁用热退出。当尝试关闭具有未保存更改的编辑器的窗口时，将显示提示。'),
			nls.localize('hotExit.onExit', '触发 "workbench.action.quit" 命令(命令面板、键绑定、菜单)或在 Windows/Linux 上关闭最后一个窗口时，将触发热退出。所有未打开文件夹的窗口都将在下次启动时恢复。可通过“文件”>“打开最近使用的文件”>“更多…”，访问之前打开的窗口(包含未保存的文件)列表'),
			nls.localize('hotExit.onExitAndWindowClose', '触发 "workbench.action.quit" 命令(命令面板、键绑定、菜单)或在 Windows/Linux 上关闭最后一个窗口时将触发热退出，还将对已打开文件夹的所有窗口触发热退出(无论是否是最后一个窗口)。所有未打开文件夹的窗口将在下次启动时恢复。可通过“文件”>“打开最近使用的文件”>“更多…”，访问之前打开的窗口(包含未保存的文件)列表')
		],
		'markdownDescription': nls.localize('hotExit', "[热退出](https://aka.ms/vscode-hot-exit)控制是否在会话之间记住未保存的文件，从而允许在退出编辑器时跳过保存提示。", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	} : {
		'type': 'string',
		'scope': ConfigurationScope.APPLICATION,
		'enum': [HotExitConfiguration.OFF, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE],
		'default': HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE,
		'markdownEnumDescriptions': [
			nls.localize('hotExit.off', '禁用热退出。当尝试关闭具有未保存更改的编辑器的窗口时，将显示提示。'),
			nls.localize('hotExit.onExitAndWindowCloseBrowser', '当浏览器退出或窗口或选项卡关闭时，将触发热退出。')
		],
		'markdownDescription': nls.localize('hotExit', "[热退出](https://aka.ms/vscode-hot-exit)控制是否在会话之间记住未保存的文件，从而允许在退出编辑器时跳过保存提示。", HotExitConfiguration.ON_EXIT, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE)
	};

configurationRegistry.registerConfiguration({
	'id': 'files',
	'order': 9,
	'title': nls.localize('filesConfigurationTitle', "文件"),
	'type': 'object',
	'properties': {
		[FILES_EXCLUDE_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('exclude', "配置 [glob 模式](https://aka.ms/vscode-glob-patterns)以排除文件和文件夹。例如，文件资源管理器根据此设置决定要显示或隐藏的文件和文件夹。请参阅 `#search.exclude#` 设置以定义特定于搜索的排除。请参阅 `#explorer.excludeGitIgnore#` 设置以基于 `.gitignore` 忽略文件。"),
			'default': {
				...{ '**/.git': true, '**/.svn': true, '**/.hg': true, '**/.DS_Store': true, '**/Thumbs.db': true },
				...(isWeb ? { '**/*.crswap': true /* filter out swap files used for local file access */ } : undefined)
			},
			'scope': ConfigurationScope.RESOURCE,
			'additionalProperties': {
				'anyOf': [
					{
						'type': 'boolean',
						'enum': [true, false],
						'enumDescriptions': [nls.localize('trueDescription', "启用该模式。"), nls.localize('falseDescription', "禁用该模式。")],
						'description': nls.localize('files.exclude.boolean', "匹配文件路径所依据的 glob 模式。设置为 true 或 false 可启用或禁用该模式。"),
					},
					{
						'type': 'object',
						'properties': {
							'when': {
								'type': 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								'pattern': '\\w*\\$\\(basename\\)\\w*',
								'default': '$(basename).ext',
								'markdownDescription': nls.localize({ key: 'files.exclude.when', comment: ['\\$(basename) should not be translated'] }, "对匹配文件同辈进行额外检查。将 \\$(basename) 用作匹配文件名的变量。")
							}
						}
					}
				]
			}
		},
		[FILES_ASSOCIATIONS_CONFIG]: {
			'type': 'object',
			'markdownDescription': nls.localize('associations', "配置与语言的文件关联的 [glob patterns](https://aka.ms/vscode-glob-patterns)(例如“*.extension”:“html”)。如果模式包含路径分隔符，则模式将在文件的绝对路径上匹配，否则将匹配文件的名称。它们优先于安装的语言的默认关联。"),
			'additionalProperties': {
				'type': 'string'
			}
		},
		'files.encoding': {
			'type': 'string',
			'enum': Object.keys(SUPPORTED_ENCODINGS),
			'default': 'utf8',
			'description': nls.localize('encoding', "在读取和写入文件时使用的默认字符集编码。可以按语言对此项进行配置。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
			'enumDescriptions': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong),
			'enumItemLabels': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong)
		},
		'files.autoGuessEncoding': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoGuessEncoding', "启用后，编辑器将尝试在打开文件时猜测字符集编码。还可以按语言配置此设置。请注意，文本搜索不遵守此设置。仅遵守 {0}。", '`#files.encoding#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.candidateGuessEncodings': {
			'type': 'array',
			'items': {
				'type': 'string',
				'enum': Object.keys(GUESSABLE_ENCODINGS),
				'enumDescriptions': Object.keys(GUESSABLE_ENCODINGS).map(key => GUESSABLE_ENCODINGS[key].labelLong)
			},
			'default': [],
			'markdownDescription': nls.localize('candidateGuessEncodings', "编辑器应尝试按其列出顺序进行猜测的字符集编码的列表。如果无法确定，则遵循 {0}", '`#files.encoding#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.eol': {
			'type': 'string',
			'enum': [
				'\n',
				'\r\n',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('eol.LF', "LF"),
				nls.localize('eol.CRLF', "CRLF"),
				nls.localize('eol.auto', "使用具体操作系统规定的行末字符。")
			],
			'default': 'auto',
			'description': nls.localize('eol', "默认行尾字符。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.enableTrash': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('useTrash', "在删除文件或文件夹时，将它们移动到操作系统的“废纸篓”中 (Windows 为“回收站”)。禁用此设置将永久删除文件或文件夹。")
		},
		'files.trimTrailingWhitespace': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimTrailingWhitespace', "启用后，将在保存文件时删除行尾的空格。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.trimTrailingWhitespaceInRegexAndStrings': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('trimTrailingWhitespaceInRegexAndStrings', "启用后，将在保存时或执行 \"editor.action.trimTrailingWhitespace\" 时从多行字符串中移除尾随空格，并将移除正则表达式。当没有最新的标记信息时，这可能导致无法从各行中剪裁掉空格。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.insertFinalNewline': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('insertFinalNewline', "启用后，保存文件时在文件末尾插入一个最终新行。"),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.trimFinalNewlines': {
			'type': 'boolean',
			'default': false,
			'description': nls.localize('trimFinalNewlines', "启用后，保存文件时将删除在最终新行后的所有新行。"),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
		'files.autoSave': {
			'type': 'string',
			'enum': [AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE],
			'markdownEnumDescriptions': [
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.off' }, "具有更改的编辑器永远不会自动保存。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.afterDelay' }, "在配置的 `#files.autoSaveDelay#` 之后，会自动保存具有更改的编辑器。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onFocusChange' }, "当编辑器失去焦点时，会自动保存具有更改的编辑器。"),
				nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'files.autoSave.onWindowChange' }, "当窗口失去焦点时，会自动保存具有更改的编辑器。")
			],
			'default': isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSave' }, "控制具有未保存更改的编辑器的 [自动保存](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save)。", AutoSaveConfiguration.OFF, AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE, AutoSaveConfiguration.AFTER_DELAY),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
			agentsWindow: { default: 'afterDelay' },
		},
		'files.autoSaveDelay': {
			'type': 'number',
			'default': 1000,
			'minimum': 0,
			'markdownDescription': nls.localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'autoSaveDelay' }, "控制自动保存具有未保存更改的编辑器之前的延迟(以毫秒为单位)。只有当 `#files.autoSave#` 设置为 `{0}` 时才适用。", AutoSaveConfiguration.AFTER_DELAY),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.autoSaveWorkspaceFilesOnly': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoSaveWorkspaceFilesOnly', "启用后，会将编辑器的 [自动保存](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save)限制为打开的工作区内的文件。仅在启用 {0} 后适用。", '`#files.autoSave#`'),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.autoSaveWhenNoErrors': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': nls.localize('autoSaveWhenNoErrors', "启用后，会将编辑器的 [自动保存](https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save) 限制为在触发自动保存时未报告任何错误的文件。仅在启用 {0} 后适用。", '`#files.autoSave#`'),
			scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.watcherExclude': {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {
				// Avoiding a '**' pattern here which results in a very complex
				// RegExp that can slow things down significantly in large workspaces
				'.git/objects/**': true,
				'.git/subtree-cache/**': true,
				'.hg/store/**': true,
				'*/.git/objects/**': true,
				'*/.git/subtree-cache/**': true,
				'*/.hg/store/**': true,
				// Code-Tomoshibi: the workspace root is the whole home directory and the
				// built-in git extension is removed, so watching these dirs only burns CPU
				'**/.git/**': true,
				'**/node_modules/**': true,
				'**/.cache/**': true,
				'**/.npm/**': true,
				'**/.local/**': true,
				'**/.cargo/**': true,
				'**/.rustup/**': true,
				'**/.nvm/**': true
			},
			'markdownDescription': nls.localize('watcherExclude', "配置要从文件监视中排除的路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)。路径可以相对于被监视的文件夹，也可以是绝对路径。glob 模式相对于被监视的文件夹进行匹配。当遇到文件观察程序进程消耗大量 CPU 的情况时，请确保排除不太重要的大型文件夹(例如生成输出文件夹)。"),
			'scope': ConfigurationScope.RESOURCE
		},
		'files.watcherInclude': {
			'type': 'array',
			'items': {
				'type': 'string'
			},
			'default': [],
			'description': nls.localize('watcherInclude', "配置额外路径以监视工作区内的更改。默认情况下，将以递归方式监视所有工作区文件夹，但符号链接的文件夹除外。可以显式添加绝对路径或相对路径，以支持作为符号链接的监视文件夹。将使用当前打开的工作区将相对路径解析为绝对路径。"),
			'scope': ConfigurationScope.RESOURCE
		},
		'files.hotExit': hotExitConfiguration,
		'files.defaultLanguage': {
			'type': 'string',
			'markdownDescription': nls.localize('defaultLanguage', "分配给新文件的默认语言标识符。如果配置为 \"${activeEditorLanguage}\"，将使用当前活动文本编辑器(如果有)的语言标识符。")
		},
		[FILES_READONLY_INCLUDE_CONFIG]: {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {},
			'markdownDescription': nls.localize('filesReadonlyInclude', "配置路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)以标记为只读。glob 模式的计算结果始终是相对于工作区文件夹路径所在的位置，除非它们是绝对路径。可以通过 `#files.readonlyExclude#` 设置排除匹配路径。来自只读文件系统提供程序的文件始终是只读文件，不受此设置影响。"),
			'scope': ConfigurationScope.RESOURCE
		},
		[FILES_READONLY_EXCLUDE_CONFIG]: {
			'type': 'object',
			'patternProperties': {
				'.*': { 'type': 'boolean' }
			},
			'default': {},
			'markdownDescription': nls.localize('filesReadonlyExclude', "配置路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)，以避免在该路径或模式因 `#files.readonlyInclude#` 设置而发生匹配时被标记为只读。glob 模式的计算结果始终是相对于工作区文件夹路径所在的位置，除非它们是绝对路径。来自只读文件系统提供程序的文件始终是只读文件，不受此设置影响。"),
			'scope': ConfigurationScope.RESOURCE
		},
		[FILES_READONLY_FROM_PERMISSIONS_CONFIG]: {
			'type': 'boolean',
			'markdownDescription': nls.localize('filesReadonlyFromPermissions', "当文件权限指示为只读时，将文件标记为只读。可以通过 `#files.readonlyInclude#` 和 `#files.readonlyExclude#` 设置替代此操作。"),
			'default': false
		},
		'files.restoreUndoStack': {
			'type': 'boolean',
			'description': nls.localize('files.restoreUndoStack', "重新打开文件后，还原撤消堆栈。"),
			'default': true
		},
		'files.saveConflictResolution': {
			'type': 'string',
			'enum': [
				'askUser',
				'overwriteFileOnDisk'
			],
			'enumDescriptions': [
				nls.localize('askUser', "将拒绝保存并请求手动解决保存冲突。"),
				nls.localize('overwriteFileOnDisk', "将通过在编辑器中用更改覆盖磁盘上的文件来解决保存冲突。")
			],
			'description': nls.localize('files.saveConflictResolution', "当文件保存到磁盘上并被另一个程序更改时，可能会发生保存冲突。 为了防止数据丢失，要求用户将编辑器中的更改与磁盘上的版本进行比较。 仅当经常遇到保存冲突错误时，才应更改此设置；如果不谨慎使用，可能会导致数据丢失。"),
			'default': 'askUser',
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE
		},
		'files.dialog.defaultPath': {
			'type': 'string',
			'pattern': '^((\\/|\\\\\\\\|[a-zA-Z]:\\\\).*)?$', // slash OR UNC-root OR drive-root OR undefined
			'patternErrorMessage': nls.localize('defaultPathErrorMessage', "文件对话框的默认路径必须是绝对路径(例如 C:\\\\myFolder 或 /myFolder)。"),
			'description': nls.localize('fileDialogDefaultPath', "文件对话框的默认路径，用于替代用户的主路径。仅在缺少特定于上下文的路径时使用，例如最近打开的文件或文件夹。"),
			'scope': ConfigurationScope.MACHINE
		},
		'files.simpleDialog.enable': {
			'type': 'boolean',
			'description': nls.localize('files.simpleDialog.enable', "启用简单文件对话框以打开和保存文件和文件夹。简单文件对话框在启用后会替代系统文件对话框。"),
			'default': false
		},
		'files.participants.timeout': {
			type: 'number',
			default: 60000,
			markdownDescription: nls.localize('files.participants.timeout', "超时(以毫秒为单位)后，将取消创建、重命名和删除的文件参与者。使用 `0` 禁用参与者。"),
		}
	}
});

configurationRegistry.registerConfiguration({
	...editorConfigurationBaseNode,
	properties: {
		'editor.formatOnSave': {
			'type': 'boolean',
			'markdownDescription': nls.localize('formatOnSave', "保存时设置文件格式。格式化程序必须可用，并且不得关闭编辑器。当 {0} 设置为 `afterDelay` 时，仅在显式保存时才会格式化文件。", '`#files.autoSave#`'),
			'scope': ConfigurationScope.LANGUAGE_OVERRIDABLE,
		},
	}
});

configurationRegistry.registerConfiguration({
	'id': 'explorer',
	'order': 10,
	'title': nls.localize('explorerConfigurationTitle', "文件资源管理器"),
	'type': 'object',
	'properties': {
		'explorer.openEditors.visible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisible', comment: ['Open is an adjective'] }, "“打开编辑器”窗格中显示的初始编辑器数上限。超过此限制将显示滚动条，并允许调整窗格大小以显示更多项目。"),
			'default': 9,
			'minimum': 1
		},
		'explorer.openEditors.minVisible': {
			'type': 'number',
			'description': nls.localize({ key: 'openEditorsVisibleMin', comment: ['Open is an adjective'] }, "“打开编辑器”窗格中预分配的编辑器槽数下限。如果设置为 0，则“打开编辑器”窗格将根据编辑器数量动态重设大小。"),
			'default': 0,
			'minimum': 0
		},
		'explorer.openEditors.sortOrder': {
			'type': 'string',
			'enum': ['editorOrder', 'alphabetical', 'fullPath'],
			'description': nls.localize({ key: 'openEditorsSortOrder', comment: ['Open is an adjective'] }, "控制编辑器在“打开编辑器”窗格中的排序顺序。"),
			'enumDescriptions': [
				nls.localize('sortOrder.editorOrder', '编辑器按编辑器标签显示的顺序排列。'),
				nls.localize('sortOrder.alphabetical', '编辑器在每个编辑器组内按选项卡名称以字母顺序排序。'),
				nls.localize('sortOrder.fullPath', '编辑器在每个编辑器组内按完整路径以字母顺序排序。')
			],
			'default': 'editorOrder'
		},
		'explorer.autoReveal': {
			'type': ['boolean', 'string'],
			'enum': [true, false, 'focusNoScroll'],
			'default': true,
			'enumDescriptions': [
				nls.localize('autoReveal.on', '将显示和选择文件。'),
				nls.localize('autoReveal.off', '不会显示和选择文件。'),
				nls.localize('autoReveal.focusNoScroll', '文件不会滚动到视图中，但仍会获得焦点。'),
			],
			'description': nls.localize('autoReveal', "控制资源管理器是否应在打开文件时自动显示并选择文件。")
		},
		'explorer.autoRevealExclude': {
			'type': 'object',
			'markdownDescription': nls.localize('autoRevealExclude', "配置路径或 [glob 模式](https://aka.ms/vscode-glob-patterns)，以便在打开文件和文件夹时避免在资源管理器中显示和选择这些文件和文件夹。glob 模式的计算结果始终是相对于工作区文件夹路径所在的位置，除非它们是绝对路径。"),
			'default': { '**/node_modules': true, '**/bower_components': true },
			'additionalProperties': {
				'anyOf': [
					{
						'type': 'boolean',
						'description': nls.localize('explorer.autoRevealExclude.boolean', "匹配文件路径所依据的 glob 模式。设置为 true 或 false 可启用或禁用该模式。"),
					},
					{
						type: 'object',
						properties: {
							when: {
								type: 'string', // expression ({ "**/*.js": { "when": "$(basename).js" } })
								pattern: '\\w*\\$\\(basename\\)\\w*',
								default: '$(basename).ext',
								description: nls.localize('explorer.autoRevealExclude.when', '对匹配文件同级进行额外检查。将 {0} 用作匹配文件名的变量。', '$(basename)')
							}
						}
					}
				]
			}
		},
		'explorer.enableDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('enableDragAndDrop', "控制资源管理器是否应允许通过拖放来移动文件和文件夹。此设置仅影响从浏览器内部进行拖放。"),
			'default': true
		},
		'explorer.confirmDragAndDrop': {
			'type': 'boolean',
			'description': nls.localize('confirmDragAndDrop', "控制资源管理器是否应在通过拖放移动文件或文件夹时要求确认。"),
			'default': true
		},
		'explorer.confirmPasteNative': {
			'type': 'boolean',
			'description': nls.localize('confirmPasteNative', "控制在粘贴本机文件和文件夹时资源管理器是否应要求进行确认。"),
			'default': true
		},
		'explorer.confirmDelete': {
			'type': 'boolean',
			'description': nls.localize('confirmDelete', "控制在删除文件和文件夹时资源管理器是否应要求进行确认。"),
			'default': true
		},
		'explorer.enableUndo': {
			'type': 'boolean',
			'description': nls.localize('enableUndo', "控制资源管理器是否应支持撤消文件和文件夹操作。"),
			'default': true
		},
		'explorer.confirmUndo': {
			'type': 'string',
			'enum': [UndoConfirmLevel.Verbose, UndoConfirmLevel.Default, UndoConfirmLevel.Light],
			'description': nls.localize('confirmUndo', "控制资源管理器是否应在撤消时要求确认。"),
			'default': UndoConfirmLevel.Default,
			'enumDescriptions': [
				nls.localize('enableUndo.verbose', '资源管理器将在所有撤消操作之前进行提示。'),
				nls.localize('enableUndo.default', '资源管理器将在破坏性撤消操作之前进行提示。'),
				nls.localize('enableUndo.light', '聚焦时，资源管理器将不会在撤消操作之前进行提示。'),
			],
		},
		'explorer.expandSingleFolderWorkspaces': {
			'type': 'boolean',
			'description': nls.localize('expandSingleFolderWorkspaces', "控制资源管理器是否应在初始化期间展开仅包含一个文件夹的多根工作区"),
			'default': true
		},
		'explorer.sortOrder': {
			'type': 'string',
			'enum': [SortOrder.Default, SortOrder.Mixed, SortOrder.FilesFirst, SortOrder.Type, SortOrder.Modified, SortOrder.FoldersNestsFiles],
			'default': SortOrder.Default,
			'enumDescriptions': [
				nls.localize('sortOrder.default', '按名称排列文件和文件夹。文件夹显示在文件前。'),
				nls.localize('sortOrder.mixed', '按名称排列文件和文件夹。两者穿插显示。'),
				nls.localize('sortOrder.filesFirst', '按名称排列文件和文件夹。文件显示在文件夹前。'),
				nls.localize('sortOrder.type', '按拓展类型为文件和文件夹分组，然后按名称排列它们。文件夹显示在文件前。'),
				nls.localize('sortOrder.modified', '按最后修改日期降序排列文件和文件夹。文件夹显示在文件前。'),
				nls.localize('sortOrder.foldersNestsFiles', '文件和文件夹按其名称排序。文件夹显示在文件之前。具有嵌套子级的文件将显示在其他文件之前。')
			],
			'markdownDescription': nls.localize('sortOrder', "控制资源管理器中文件和文件夹基于属性的排序。启用 `#explorer.fileNesting.enabled#` 后，还控制嵌套文件的排序。")
		},
		'explorer.sortOrderLexicographicOptions': {
			'type': 'string',
			'enum': [LexicographicOptions.Default, LexicographicOptions.Upper, LexicographicOptions.Lower, LexicographicOptions.Unicode],
			'default': LexicographicOptions.Default,
			'enumDescriptions': [
				nls.localize('sortOrderLexicographicOptions.default', '将大写和小写名称混合在一起。'),
				nls.localize('sortOrderLexicographicOptions.upper', '大写名称组合在一起，位于小写名称之前。'),
				nls.localize('sortOrderLexicographicOptions.lower', '小写名称组合在一起，位于大写名称之前。'),
				nls.localize('sortOrderLexicographicOptions.unicode', '名称按 unicode 顺序排序。')
			],
			'description': nls.localize('sortOrderLexicographicOptions', "在资源管理器中控制文件和文件夹名称的词典排序。")
		},
		'explorer.sortOrderReverse': {
			'type': 'boolean',
			'description': nls.localize('sortOrderReverse', "控制是否应颠倒文件和文件夹的排序顺序。"),
			'default': false,
		},
		'explorer.decorations.colors': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.colors', "控制文件修饰是否应使用颜色。"),
			default: true
		},
		'explorer.decorations.badges': {
			type: 'boolean',
			description: nls.localize('explorer.decorations.badges', "控制文件修饰是否应使用徽章。"),
			default: true
		},
		'explorer.incrementalNaming': {
			'type': 'string',
			enum: ['simple', 'smart', 'disabled'],
			enumDescriptions: [
				nls.localize('simple', "在重复名称的末尾附加单词“copy”，后面可能跟一个数字。"),
				nls.localize('smart', "在重复名称的末尾添加一个数字。如果某个号码已经是名称的一部分，请尝试增加该号码。"),
				nls.localize('disabled', "禁用增量命名。如果存在两个具有相同名称的文件，系统将提示你覆盖现有文件。")
			],
			description: nls.localize('explorer.incrementalNaming', "选择在粘贴同名资源管理器项时要使用的重命名方式。"),
			default: 'simple'
		},
		'explorer.autoOpenDroppedFile': {
			'type': 'boolean',
			'description': nls.localize('autoOpenDroppedFile', "控制资源管理器是否应在将文件放入资源管理器时自动打开该文件"),
			'default': true
		},
		'explorer.compactFolders': {
			'type': 'boolean',
			'description': nls.localize('compressSingleChildFolders', "控制资源管理器是否应以紧凑形式呈现文件夹。在此形式中，单个子文件夹将被压缩在组合的树元素中。例如，对 Java 包结构非常有用。"),
			'default': true
		},
		'explorer.copyRelativePathSeparator': {
			'type': 'string',
			'enum': [
				'/',
				'\\',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('copyRelativePathSeparator.slash', "使用斜杠作为路径分隔字符。"),
				nls.localize('copyRelativePathSeparator.backslash', "使用反斜杠作为路径分隔字符。"),
				nls.localize('copyRelativePathSeparator.auto', "使用操作系统特定路径分隔字符。"),
			],
			'description': nls.localize('copyRelativePathSeparator', "复制相对文件路径时使用的路径分隔字符。"),
			'default': 'auto'
		},
		'explorer.copyPathSeparator': {
			'type': 'string',
			'enum': [
				'/',
				'\\',
				'auto'
			],
			'enumDescriptions': [
				nls.localize('copyPathSeparator.slash', "使用斜杠作为路径分隔字符。"),
				nls.localize('copyPathSeparator.backslash', "使用反斜杠作为路径分隔字符。"),
				nls.localize('copyPathSeparator.auto', "使用操作系统特定路径分隔字符。"),
			],
			'description': nls.localize('copyPathSeparator', "复制文件路径时使用的路径分隔字符。"),
			'default': 'auto'
		},
		'explorer.excludeGitIgnore': {
			type: 'boolean',
			markdownDescription: nls.localize('excludeGitignore', "控制是否应从资源管理器中分析和排除 .gitignore 中的条目。类似于 {0}。", '`#files.exclude#`'),
			default: false,
			scope: ConfigurationScope.RESOURCE
		},
		'explorer.fileNesting.enabled': {
			'type': 'boolean',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingEnabled', "控制是否已在资源管理器中启用文件嵌套。文件嵌套允许目录中的相关文件在单个父文件下以可视方式组合在一起。"),
			'default': false,
		},
		'explorer.fileNesting.expand': {
			'type': 'boolean',
			'markdownDescription': nls.localize('fileNestingExpand', "控制是否自动扩展文件嵌套。要使此操作生效，必须设置 {0}。", '`#explorer.fileNesting.enabled#`'),
			'default': true,
		},
		'explorer.fileNesting.patterns': {
			'type': 'object',
			scope: ConfigurationScope.RESOURCE,
			'markdownDescription': nls.localize('fileNestingPatterns', "控制资源管理器中的文件嵌套。必须设置 {0} 才能让它生效。每个 __Item__ 都表示父模式，且可能包含匹配任意字符串的单个 `*` 字符。每个 __Value__ 都表示子模式的逗号分隔列表，这些子模式应显示嵌套在给定父级下。子模式可能包含多个特殊标记:\r\n- `${capture}`: 匹配父模式的 `*` 的解析值\r\n- `${basename}`: 匹配父文件的基名，即 `file.ts` 中的 `file`\r\n- `${extname}`: 匹配父文件的扩展名，即 `file.ts` 中的 `ts`\r\n- `${dirname}`: 匹配父文件的目录名，即 `src/file.ts` 中的 `src`\r\n- `*`: 匹配任意字符串，每个子模式只能使用一次", '`#explorer.fileNesting.enabled#`'),
			patternProperties: {
				'^[^*]*\\*?[^*]*$': {
					markdownDescription: nls.localize('fileNesting.description', "每个键模式可能包含将与任何字符串匹配的单个 `*` 字符。"),
					type: 'string',
					pattern: '^([^,*]*\\*?[^,*]*)(, ?[^,*]*\\*?[^,*]*)*$',
				}
			},
			additionalProperties: false,
			'default': {
				'*.ts': '${capture}.js',
				'*.js': '${capture}.js.map, ${capture}.min.js, ${capture}.d.ts',
				'*.jsx': '${capture}.js',
				'*.tsx': '${capture}.ts',
				'tsconfig.json': 'tsconfig.*.json',
				'package.json': 'package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb, bun.lock',
			}
		}
	}
});

UndoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canUndo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.undo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

RedoCommand.addImplementation(110, 'explorer', (accessor: ServicesAccessor) => {
	const undoRedoService = accessor.get(IUndoRedoService);
	const explorerService = accessor.get(IExplorerService);
	const configurationService = accessor.get(IConfigurationService);

	const explorerCanUndo = configurationService.getValue<IFilesConfiguration>().explorer.enableUndo;
	if (explorerService.hasViewFocus() && undoRedoService.canRedo(UNDO_REDO_SOURCE) && explorerCanUndo) {
		undoRedoService.redo(UNDO_REDO_SOURCE);
		return true;
	}

	return false;
});

ModesRegistry.registerLanguage({
	id: BINARY_TEXT_FILE_MODE,
	aliases: ['Binary'],
	mimetypes: ['text/x-code-binary']
});
