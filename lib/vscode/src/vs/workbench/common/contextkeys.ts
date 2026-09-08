/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { DisposableStore } from '../../base/common/lifecycle.js';
import { URI } from '../../base/common/uri.js';
import { localize } from '../../nls.js';
import { IContextKeyService, IContextKey, RawContextKey } from '../../platform/contextkey/common/contextkey.js';
import { basename, dirname, extname, isEqual } from '../../base/common/resources.js';
import { ILanguageService } from '../../editor/common/languages/language.js';
import { IFileService } from '../../platform/files/common/files.js';
import { IModelService } from '../../editor/common/services/model.js';
import { Schemas } from '../../base/common/network.js';
import { EditorInput } from './editor/editorInput.js';
import { IEditorResolverService } from '../services/editor/common/editorResolverService.js';
import { DEFAULT_EDITOR_ASSOCIATION, isDiffEditorInput } from './editor.js';

//#region < --- Workbench --- >

export const WorkbenchStateContext = new RawContextKey<string>('workbenchState', undefined, { type: 'string', description: localize('workbenchState', "窗口中打开的工作区类型:“空”(无工作区)、“文件夹”(单个文件夹)或“工作区”(多根工作区)") });
export const WorkspaceFolderCountContext = new RawContextKey<number>('workspaceFolderCount', 0, localize('workspaceFolderCount', "工作区中根文件夹的数量"));

export const OpenFolderWorkspaceSupportContext = new RawContextKey<boolean>('openFolderWorkspaceSupport', true, true);
export const EnterMultiRootWorkspaceSupportContext = new RawContextKey<boolean>('enterMultiRootWorkspaceSupport', true, true);
export const EmptyWorkspaceSupportContext = new RawContextKey<boolean>('emptyWorkspaceSupport', true, true);

export const DirtyWorkingCopiesContext = new RawContextKey<boolean>('dirtyWorkingCopies', false, localize('dirtyWorkingCopies', "是否有具有未保存更改的工作副本"));

export const RemoteNameContext = new RawContextKey<string>('remoteName', '', localize('remoteName', "窗口连接到的远程项的名称；如果未连接到任何远程项，则为空字符串"));

export const VirtualWorkspaceContext = new RawContextKey<string>('virtualWorkspace', '', localize('virtualWorkspace', "当前工作区的方案来自虚拟文件系统或空字符串。"));
export const TemporaryWorkspaceContext = new RawContextKey<boolean>('temporaryWorkspace', false, localize('temporaryWorkspace', "当前工作区的方案来自临时文件系统。"));

export const IsSessionsWindowContext = new RawContextKey<boolean>('isSessionsWindow', false, localize('isSessionsWindow', "当前窗口是否为代理会话窗口。"));

export const HasWebFileSystemAccess = new RawContextKey<boolean>('hasWebFileSystemAccess', false, true); // Support for FileSystemAccess web APIs (https://wicg.github.io/file-system-access)

export const EmbedderIdentifierContext = new RawContextKey<string | undefined>('embedderIdentifier', undefined, localize('embedderIdentifier', '根据产品服务的嵌入器标识符(如果已定义)'));

export const InAutomationContext = new RawContextKey<boolean>('inAutomation', false, localize('inAutomation', "VS Code 是否在自动化或烟雾测试中运行"));

export const IsEnabledFileDownloads = new RawContextKey<boolean>('isEnabledFileDownloads', true, true);
export const IsEnabledFileUploads = new RawContextKey<boolean>('isEnabledFileUploads', true, true);
export const IsEnabledCoderGettingStarted = new RawContextKey<boolean>('isEnabledCoderGettingStarted', true, true);

//#endregion

//#region < --- Window --- >

export const IsMainWindowFullscreenContext = new RawContextKey<boolean>('isFullscreen', false, localize('isFullscreen', "主窗口是否处于全屏模式"));
export const IsAuxiliaryWindowFocusedContext = new RawContextKey<boolean>('isAuxiliaryWindowFocusedContext', false, localize('isAuxiliaryWindowFocusedContext', "辅助窗口是否成为焦点"));

export const IsWindowAlwaysOnTopContext = new RawContextKey<boolean>('isWindowAlwaysOnTop', false, localize('isWindowAlwaysOnTop', "窗口是否始终前端显示"));

export const IsAuxiliaryWindowContext = new RawContextKey<boolean>('isAuxiliaryWindow', false, localize('isAuxiliaryWindow', "窗口是辅助窗口"));


//#endregion


//#region < --- Editor --- >

// Editor State Context Keys
export const ActiveEditorDirtyContext = new RawContextKey<boolean>('activeEditorIsDirty', false, localize('activeEditorIsDirty', "活动编辑器是否具有未保存的更改"));
export const ActiveEditorPinnedContext = new RawContextKey<boolean>('activeEditorIsNotPreview', false, localize('activeEditorIsNotPreview', "活动编辑器是否未在预览模式下"));
export const ActiveEditorFirstInGroupContext = new RawContextKey<boolean>('activeEditorIsFirstInGroup', false, localize('activeEditorIsFirstInGroup', "活动编辑器是否为其组中的第一个编辑器"));
export const ActiveEditorLastInGroupContext = new RawContextKey<boolean>('activeEditorIsLastInGroup', false, localize('activeEditorIsLastInGroup', "活动编辑器是否是其组中的最后一个编辑器"));
export const ActiveEditorStickyContext = new RawContextKey<boolean>('activeEditorIsPinned', false, localize('activeEditorIsPinned', "活动编辑器是否已固定"));
export const ActiveEditorReadonlyContext = new RawContextKey<boolean>('activeEditorIsReadonly', false, localize('activeEditorIsReadonly', "活动编辑器是否只读"));
export const ActiveCompareEditorCanSwapContext = new RawContextKey<boolean>('activeCompareEditorCanSwap', false, localize('activeCompareEditorCanSwap', "活动比较编辑器是否可以交换两侧"));
export const ActiveEditorCanToggleReadonlyContext = new RawContextKey<boolean>('activeEditorCanToggleReadonly', true, localize('activeEditorCanToggleReadonly', "活动编辑器是否可以在只读或可写之间切换"));
export const ActiveEditorCanRevertContext = new RawContextKey<boolean>('activeEditorCanRevert', false, localize('activeEditorCanRevert', "活动编辑器是否可以还原"));
export const ActiveEditorCanSplitInGroupContext = new RawContextKey<boolean>('activeEditorCanSplitInGroup', true);

// Editor Kind Context Keys
export const ActiveEditorContext = new RawContextKey<string | null>('activeEditor', null, { type: 'string', description: localize('activeEditor', "活动编辑器的标识符") });
export const ActiveEditorAvailableEditorIdsContext = new RawContextKey<string>('activeEditorAvailableEditorIds', '', localize('activeEditorAvailableEditorIds', "可用于活动编辑器的可用编辑器标识符"));
export const TextCompareEditorVisibleContext = new RawContextKey<boolean>('textCompareEditorVisible', false, localize('textCompareEditorVisible', "文本比较编辑器是否可见"));
export const TextCompareEditorActiveContext = new RawContextKey<boolean>('textCompareEditorActive', false, localize('textCompareEditorActive', "文本比较编辑器是否处于活动状态"));
export const SideBySideEditorActiveContext = new RawContextKey<boolean>('sideBySideEditorActive', false, localize('sideBySideEditorActive', "并行编辑器是否处于活动状态"));
export const ActiveCustomEditorDiffCanToggleLayoutContext = new RawContextKey<boolean>('activeCustomEditorDiffCanToggleLayout', false, localize('activeCustomEditorDiffCanToggleLayout', "活动自定义编辑器差异是否可在内联与并排布局之间切换"));
export const ActiveCustomEditorTextDiffContext = new RawContextKey<boolean>('activeCustomEditorTextDiff', false, localize('activeCustomEditorTextDiff', "活动自定义编辑器差异是否由文本文档支持"));

// Editor Group Context Keys
export const EditorGroupEditorsCountContext = new RawContextKey<number>('groupEditorsCount', 0, localize('groupEditorsCount', "打开的编辑器组数"));
export const IsTopRightEditorGroupContext = new RawContextKey<boolean>('isTopRightEditorGroup', false, localize('isTopRightEditorGroup', "编辑器组是否为编辑器部件中的右上角编辑器组"));
export const ActiveEditorGroupEmptyContext = new RawContextKey<boolean>('activeEditorGroupEmpty', false, localize('activeEditorGroupEmpty', "活动编辑器组是否为空"));
export const ActiveEditorGroupIndexContext = new RawContextKey<number>('activeEditorGroupIndex', 0, localize('activeEditorGroupIndex', "活动编辑器组的索引"));
export const ActiveEditorGroupLastContext = new RawContextKey<boolean>('activeEditorGroupLast', false, localize('activeEditorGroupLast', "活动编辑器组是否为最后一个组"));
export const ActiveEditorGroupLockedContext = new RawContextKey<boolean>('activeEditorGroupLocked', false, localize('activeEditorGroupLocked', "活动编辑器组是否已锁定"));
export const MultipleEditorGroupsContext = new RawContextKey<boolean>('multipleEditorGroups', false, localize('multipleEditorGroups', "是否打开了多个编辑器组"));
export const SingleEditorGroupsContext = MultipleEditorGroupsContext.toNegated();
export const MultipleEditorsSelectedInGroupContext = new RawContextKey<boolean>('multipleEditorsSelectedInGroup', false, localize('multipleEditorsSelectedInGroup', "编辑器组中是否已选择多个编辑器"));
export const TwoEditorsSelectedInGroupContext = new RawContextKey<boolean>('twoEditorsSelectedInGroup', false, localize('twoEditorsSelectedInGroup', "编辑器组中是否恰好选择了两个编辑器"));
export const SelectedEditorsInGroupFileOrUntitledResourceContextKey = new RawContextKey<boolean>('SelectedEditorsInGroupFileOrUntitledResourceContextKey', true, localize('SelectedEditorsInGroupFileOrUntitledResourceContextKey', "组中的所有选定编辑器是否都具有关联的文件或无标题资源"));

// Editor Part Context Keys
export const EditorPartMultipleEditorGroupsContext = new RawContextKey<boolean>('editorPartMultipleEditorGroups', false, localize('editorPartMultipleEditorGroups', "编辑器部件中是否打开了多个编辑器组"));
export const EditorPartSingleEditorGroupsContext = EditorPartMultipleEditorGroupsContext.toNegated();
export const EditorPartMaximizedEditorGroupContext = new RawContextKey<boolean>('editorPartMaximizedEditorGroup', false, localize('editorPartEditorGroupMaximized', "编辑器部件具有最大化组"));

export const EditorPartModalContext = new RawContextKey<boolean>('editorPartModal', false, localize('editorPartModal', "焦点是否位于模式编辑器部件中"));
export const EditorPartModalVisibleContext = new RawContextKey<boolean>('editorPartModalVisible', false, localize('editorPartModalVisible', "Whether a modal editor part is visible"));
export const EditorPartModalMaximizedContext = new RawContextKey<boolean>('editorPartModalMaximized', false, localize('editorPartModalMaximized', "模式编辑器部件是否最大化"));
export const EditorPartModalNavigationContext = new RawContextKey<boolean>('editorPartModalNavigation', false, localize('editorPartModalNavigation', "模式编辑器部件是否具有导航上下文"));
export const EditorPartModalSidebarContext = new RawContextKey<boolean>('editorPartModalSidebar', false, localize('editorPartModalSidebar', "模式编辑器部件是否包含边栏"));
export const EditorPartModalSidebarVisibleContext = new RawContextKey<boolean>('editorPartModalSidebarVisible', false, localize('editorPartModalSidebarVisible', "模式编辑器部件边栏是否可见"));

// Editor Layout Context Keys
export const EditorsVisibleContext = new RawContextKey<boolean>('editorIsOpen', false, localize('editorIsOpen', "编辑器是否打开"));
export const EditorAreaFocusContext = new RawContextKey<boolean>('editorAreaFocus', false, localize('editorAreaFocus', "编辑器区域(任何编辑器部件)是否具有键盘焦点"));
export const InEditorZenModeContext = new RawContextKey<boolean>('inZenMode', false, localize('inZenMode', "是否已启用 Zen 模式"));
export const IsMainEditorCenteredLayoutContext = new RawContextKey<boolean>('isCenteredLayout', false, localize('isMainEditorCenteredLayout', "是否为主编辑器启用了居中布局"));
export const SplitEditorsVertically = new RawContextKey<boolean>('splitEditorsVertically', false, localize('splitEditorsVertically', "编辑器是否垂直拆分"));
export const MainEditorAreaVisibleContext = new RawContextKey<boolean>('mainEditorAreaVisible', true, localize('mainEditorAreaVisible', "主窗口中的编辑器区域是否可见"));
export const EditorTabsVisibleContext = new RawContextKey<boolean>('editorTabsVisible', true, localize('editorTabsVisible', "编辑器选项卡是否可见"));

//#endregion


//#region < --- Side Bar --- >

export const SideBarVisibleContext = new RawContextKey<boolean>('sideBarVisible', false, localize('sideBarVisible', "侧栏是否可见"));
export const SidebarFocusContext = new RawContextKey<boolean>('sideBarFocus', false, localize('sideBarFocus', "键盘焦点是否在侧栏上"));
export const ActiveViewletContext = new RawContextKey<string>('activeViewlet', '', localize('activeViewlet', "活动 viewlet 的标识符"));

//#endregion


//#region < --- Status Bar --- >

export const StatusBarFocused = new RawContextKey<boolean>('statusBarFocused', false, localize('statusBarFocused', "键盘焦点是否在状态栏上"));

//#endregion

//#region < --- Title Bar --- >

export const TitleBarStyleContext = new RawContextKey<string>('titleBarStyle', 'custom', localize('titleBarStyle', "窗口标题栏的样式"));
export const TitleBarVisibleContext = new RawContextKey<boolean>('titleBarVisible', false, localize('titleBarVisible', "标题栏是否可见"));
export const IsCompactTitleBarContext = new RawContextKey<boolean>('isCompactTitleBar', false, localize('isCompactTitleBar', "标题栏处于紧密模式"));

//#endregion


//#region < --- Banner --- >

export const BannerFocused = new RawContextKey<boolean>('bannerFocused', false, localize('bannerFocused', "键盘焦点是否在横幅上"));

//#endregion


//#region < --- Notifications --- >

export const NotificationFocusedContext = new RawContextKey<boolean>('notificationFocus', true, localize('notificationFocus', "键盘焦点是否在通知上"));
export const NotificationsCenterVisibleContext = new RawContextKey<boolean>('notificationCenterVisible', false, localize('notificationCenterVisible', "通知中心是否可见"));
export const NotificationsToastsVisibleContext = new RawContextKey<boolean>('notificationToastsVisible', false, localize('notificationToastsVisible', "通知 toast 是否可见"));

//#endregion


//#region < --- Auxiliary Bar --- >

export const ActiveAuxiliaryContext = new RawContextKey<string>('activeAuxiliary', '', localize('activeAuxiliary', "活动辅助面板的标识符"));
export const AuxiliaryBarFocusContext = new RawContextKey<boolean>('auxiliaryBarFocus', false, localize('auxiliaryBarFocus', "辅助栏是否具有键盘焦点"));
export const AuxiliaryBarVisibleContext = new RawContextKey<boolean>('auxiliaryBarVisible', false, localize('auxiliaryBarVisible', "辅助栏是否可见"));
export const SecondarySideBarVisibleContext = new RawContextKey<boolean>('secondarySideBarVisible', false, localize('secondarySideBarVisible', "Whether the layout surface representing the secondary side bar is visible"));
export const AuxiliaryBarMaximizedContext = new RawContextKey<boolean>('auxiliaryBarMaximized', false, localize('auxiliaryBarMaximized', "辅助栏是否最大化"));

//#endregion


//#region < --- Panel --- >

export const ActivePanelContext = new RawContextKey<string>('activePanel', '', localize('activePanel', "活动面板的标识符"));
export const PanelFocusContext = new RawContextKey<boolean>('panelFocus', false, localize('panelFocus', "键盘焦点是否在面板上"));
export const PanelPositionContext = new RawContextKey<string>('panelPosition', 'bottom', localize('panelPosition', "面板的位置，始终为“底部”"));
export const PanelAlignmentContext = new RawContextKey<string>('panelAlignment', 'center', localize('panelAlignment', "面板的对齐方式:“居中”、“向左对齐”、“向右对齐”或“两端对齐”"));
export const PanelVisibleContext = new RawContextKey<boolean>('panelVisible', false, localize('panelVisible', "面板是否可见"));
export const PanelMaximizedContext = new RawContextKey<boolean>('panelMaximized', false, localize('panelMaximized', "面板是否已最大化"));

//#endregion


//#region < --- Views --- >

export const FocusedViewContext = new RawContextKey<string>('focusedView', '', localize('focusedView', "具有键盘焦点的视图的标识符"));
export function getVisbileViewContextKey(viewId: string): string { return `view.${viewId}.visible`; }

//#endregion


//#region < --- Resources --- >

abstract class AbstractResourceContextKey {

	// NOTE: DO NOT CHANGE THE DEFAULT VALUE TO ANYTHING BUT
	// UNDEFINED! IT IS IMPORTANT THAT DEFAULTS ARE INHERITED
	// FROM THE PARENT CONTEXT AND ONLY UNDEFINED DOES THIS

	static readonly Scheme = new RawContextKey<string>('resourceScheme', undefined, { type: 'string', description: localize('resourceScheme', "资源的方案") });
	static readonly Filename = new RawContextKey<string>('resourceFilename', undefined, { type: 'string', description: localize('resourceFilename', "资源的文件名") });
	static readonly Dirname = new RawContextKey<string>('resourceDirname', undefined, { type: 'string', description: localize('resourceDirname', "资源所在的文件夹的名称") });
	static readonly Path = new RawContextKey<string>('resourcePath', undefined, { type: 'string', description: localize('resourcePath', "资源的完整路径") });
	static readonly LangId = new RawContextKey<string>('resourceLangId', undefined, { type: 'string', description: localize('resourceLangId', "资源的语言标识符") });
	static readonly Resource = new RawContextKey<string>('resource', undefined, { type: 'URI', description: localize('resource', "包含方案和路径的资源的完整值") });
	static readonly Extension = new RawContextKey<string>('resourceExtname', undefined, { type: 'string', description: localize('resourceExtname', "资源的扩展名") });
	static readonly HasResource = new RawContextKey<boolean>('resourceSet', undefined, { type: 'boolean', description: localize('resourceSet', "资源是否存在") });
	static readonly IsFileSystemResource = new RawContextKey<boolean>('isFileSystemResource', undefined, { type: 'boolean', description: localize('isFileSystemResource', "资源是否由文件系统提供程序支持") });

	protected _value: URI | undefined;
	protected readonly _resourceKey: IContextKey<string | null>;
	protected readonly _schemeKey: IContextKey<string | null>;
	protected readonly _filenameKey: IContextKey<string | null>;
	protected readonly _dirnameKey: IContextKey<string | null>;
	protected readonly _pathKey: IContextKey<string | null>;
	protected readonly _langIdKey: IContextKey<string | null>;
	protected readonly _extensionKey: IContextKey<string | null>;
	protected readonly _hasResource: IContextKey<boolean>;
	protected readonly _isFileSystemResource: IContextKey<boolean>;

	constructor(
		@IContextKeyService protected readonly _contextKeyService: IContextKeyService,
		@IFileService protected readonly _fileService: IFileService,
		@ILanguageService protected readonly _languageService: ILanguageService,
		@IModelService protected readonly _modelService: IModelService
	) {
		this._schemeKey = AbstractResourceContextKey.Scheme.bindTo(this._contextKeyService);
		this._filenameKey = AbstractResourceContextKey.Filename.bindTo(this._contextKeyService);
		this._dirnameKey = AbstractResourceContextKey.Dirname.bindTo(this._contextKeyService);
		this._pathKey = AbstractResourceContextKey.Path.bindTo(this._contextKeyService);
		this._langIdKey = AbstractResourceContextKey.LangId.bindTo(this._contextKeyService);
		this._resourceKey = AbstractResourceContextKey.Resource.bindTo(this._contextKeyService);
		this._extensionKey = AbstractResourceContextKey.Extension.bindTo(this._contextKeyService);
		this._hasResource = AbstractResourceContextKey.HasResource.bindTo(this._contextKeyService);
		this._isFileSystemResource = AbstractResourceContextKey.IsFileSystemResource.bindTo(this._contextKeyService);
	}

	protected _setLangId(): void {
		const value = this.get();
		if (!value) {
			this._langIdKey.set(null);
			return;
		}
		const langId = this._modelService.getModel(value)?.getLanguageId() ?? this._languageService.guessLanguageIdByFilepathOrFirstLine(value);
		this._langIdKey.set(langId);
	}

	set(value: URI | null | undefined) {
		value = value ?? undefined;
		if (isEqual(this._value, value)) {
			return;
		}
		this._value = value;
		this._contextKeyService.bufferChangeEvents(() => {
			this._resourceKey.set(value ? value.toString() : null);
			this._schemeKey.set(value ? value.scheme : null);
			this._filenameKey.set(value ? basename(value) : null);
			this._dirnameKey.set(value ? this.uriToPath(dirname(value)) : null);
			this._pathKey.set(value ? this.uriToPath(value) : null);
			this._setLangId();
			this._extensionKey.set(value ? extname(value) : null);
			this._hasResource.set(Boolean(value));
			this._isFileSystemResource.set(value ? this._fileService.hasProvider(value) : false);
		});
	}

	protected uriToPath(uri: URI): string {
		if (uri.scheme === Schemas.file) {
			return uri.fsPath;
		}
		return uri.path;
	}

	reset(): void {
		this._value = undefined;
		this._contextKeyService.bufferChangeEvents(() => {
			this._resourceKey.reset();
			this._schemeKey.reset();
			this._filenameKey.reset();
			this._dirnameKey.reset();
			this._pathKey.reset();
			this._langIdKey.reset();
			this._extensionKey.reset();
			this._hasResource.reset();
			this._isFileSystemResource.reset();
		});
	}

	get(): URI | undefined {
		return this._value;
	}
}

export class ResourceContextKey extends AbstractResourceContextKey {

	private readonly _disposables = new DisposableStore();

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IFileService fileService: IFileService,
		@ILanguageService languageService: ILanguageService,
		@IModelService modelService: IModelService
	) {
		super(contextKeyService, fileService, languageService, modelService);
		this._disposables.add(fileService.onDidChangeFileSystemProviderRegistrations(() => {
			const resource = this.get();
			this._isFileSystemResource.set(Boolean(resource && fileService.hasProvider(resource)));
		}));
		this._disposables.add(modelService.onModelAdded(model => {
			if (isEqual(model.uri, this.get())) {
				this._setLangId();
			}
		}));
		this._disposables.add(modelService.onModelLanguageChanged(e => {
			if (isEqual(e.model.uri, this.get())) {
				this._setLangId();
			}
		}));
	}

	dispose(): void {
		this._disposables.dispose();
	}
}

/**
 * This is a version of ResourceContextKey that is not disposable and has no listeners for model change events.
 * It will configure itself for the state/presence of a model only when created and not update.
 */
export class StaticResourceContextKey extends AbstractResourceContextKey { }


//#endregion

export function applyAvailableEditorIds(contextKey: IContextKey<string>, editor: EditorInput | undefined | null, editorResolverService: IEditorResolverService): void {
	if (!editor) {
		contextKey.set('');
		return;
	}

	const editors = getAvailableEditorIds(editor, editorResolverService);
	contextKey.set(editors.join(','));
}

function getAvailableEditorIds(editor: EditorInput, editorResolverService: IEditorResolverService): string[] {
	// Non text editor untitled files cannot be easily serialized between
	// extensions so instead we disable this context key to prevent common
	// commands that act on the active editor.
	if (editor.resource?.scheme === Schemas.untitled && editor.editorId !== DEFAULT_EDITOR_ASSOCIATION.id) {
		return [];
	}

	// Diff editors. The original and modified resources of a diff editor
	// *should* be the same, but calculate the set intersection just to be safe.
	if (isDiffEditorInput(editor)) {
		const original = getAvailableEditorIds(editor.original, editorResolverService);
		const modified = new Set(getAvailableEditorIds(editor.modified, editorResolverService));
		return original.filter(editor => modified.has(editor));
	}

	// Normal editors.
	if (editor.resource) {
		return editorResolverService.getEditors(editor.resource).map(editor => editor.id);
	}

	return [];
}
