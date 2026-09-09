/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Registry } from '../../../../platform/registry/common/platform.js';
import { localize, localize2 } from '../../../../nls.js';
import { IEditorPaneRegistry, EditorPaneDescriptor } from '../../editor.js';
import { IEditorFactoryRegistry, EditorExtensions } from '../../../common/editor.js';
import {
	TextCompareEditorActiveContext, ActiveEditorPinnedContext, EditorGroupEditorsCountContext, ActiveEditorStickyContext, ActiveEditorAvailableEditorIdsContext,
	EditorPartMultipleEditorGroupsContext, ActiveEditorDirtyContext, ActiveEditorGroupLockedContext, ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext,
	EditorTabsVisibleContext, ActiveEditorLastInGroupContext, EditorPartMaximizedEditorGroupContext, MultipleEditorGroupsContext, InEditorZenModeContext,
	IsAuxiliaryWindowContext, ActiveCompareEditorCanSwapContext, MultipleEditorsSelectedInGroupContext, SplitEditorsVertically,
	IsSessionsWindowContext, ActiveCustomEditorDiffCanToggleLayoutContext, ActiveCustomEditorTextDiffContext, EditorPartModalContext
} from '../../../common/contextkeys.js';
import { SideBySideEditorInput, SideBySideEditorInputSerializer } from '../../../common/editor/sideBySideEditorInput.js';
import { TextResourceEditor } from './textResourceEditor.js';
import { SideBySideEditor } from './sideBySideEditor.js';
import { DiffEditorInput, DiffEditorInputSerializer } from '../../../common/editor/diffEditorInput.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { TextResourceEditorInput } from '../../../common/editor/textResourceEditorInput.js';
import { TextDiffEditor } from './textDiffEditor.js';
import { BinaryResourceDiffEditor } from './binaryDiffEditor.js';
import { ChangeEncodingAction, ChangeEOLAction, ChangeLanguageAction } from './editorStatus.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { MenuRegistry, MenuId, IMenuItem, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import {
	CloseEditorsInOtherGroupsAction, CloseAllEditorsAction, MoveGroupLeftAction, MoveGroupRightAction, SplitEditorAction, JoinTwoGroupsAction, RevertAndCloseEditorAction,
	NavigateBetweenGroupsAction, FocusActiveGroupAction, FocusFirstGroupAction, ResetGroupSizesAction, MinimizeOtherGroupsAction, FocusPreviousGroup, FocusNextGroup,
	CloseLeftEditorsInGroupAction, OpenNextEditor, OpenPreviousEditor, NavigateBackwardsAction, NavigateForwardAction, NavigatePreviousAction, ReopenClosedEditorAction,
	QuickAccessPreviousRecentlyUsedEditorInGroupAction, QuickAccessPreviousEditorFromHistoryAction, ShowAllEditorsByAppearanceAction, ClearEditorHistoryAction, MoveEditorRightInGroupAction, OpenNextEditorInGroup,
	OpenPreviousEditorInGroup, OpenNextRecentlyUsedEditorAction, OpenPreviousRecentlyUsedEditorAction, MoveEditorToPreviousGroupAction,
	MoveEditorToNextGroupAction, MoveEditorToFirstGroupAction, MoveEditorLeftInGroupAction, MoveEditorToStartAction, MoveEditorToEndAction, ClearRecentFilesAction, OpenLastEditorInGroup,
	ShowEditorsInActiveGroupByMostRecentlyUsedAction, MoveEditorToLastGroupAction, OpenFirstEditorInGroup, MoveGroupUpAction, MoveGroupDownAction, FocusLastGroupAction, SplitEditorLeftAction, SplitEditorRightAction,
	SplitEditorUpAction, SplitEditorDownAction, MoveEditorToLeftGroupAction, MoveEditorToRightGroupAction, MoveEditorToAboveGroupAction, MoveEditorToBelowGroupAction, CloseAllEditorGroupsAction,
	JoinAllGroupsAction, FocusLeftGroup, FocusAboveGroup, FocusRightGroup, FocusBelowGroup, EditorLayoutSingleAction, EditorLayoutTwoColumnsAction, EditorLayoutThreeColumnsAction, EditorLayoutTwoByTwoGridAction,
	EditorLayoutTwoRowsAction, EditorLayoutThreeRowsAction, EditorLayoutTwoColumnsBottomAction, EditorLayoutTwoRowsRightAction, NewEditorGroupLeftAction, NewEditorGroupRightAction,
	NewEditorGroupAboveAction, NewEditorGroupBelowAction, SplitEditorOrthogonalAction, CloseEditorInAllGroupsAction, NavigateToLastEditLocationAction, ToggleGroupSizesAction, ShowAllEditorsByMostRecentlyUsedAction,
	QuickAccessPreviousRecentlyUsedEditorAction, OpenPreviousRecentlyUsedEditorInGroupAction, OpenNextRecentlyUsedEditorInGroupAction, QuickAccessLeastRecentlyUsedEditorAction, QuickAccessLeastRecentlyUsedEditorInGroupAction,
	ReOpenInTextEditorAction, DuplicateGroupDownAction, DuplicateGroupLeftAction, DuplicateGroupRightAction, DuplicateGroupUpAction, ToggleEditorTypeAction, SplitEditorToAboveGroupAction, SplitEditorToBelowGroupAction,
	SplitEditorToFirstGroupAction, SplitEditorToLastGroupAction, SplitEditorToLeftGroupAction, SplitEditorToNextGroupAction, SplitEditorToPreviousGroupAction, SplitEditorToRightGroupAction, NavigateForwardInEditsAction,
	NavigateBackwardsInEditsAction, NavigateForwardInNavigationsAction, NavigateBackwardsInNavigationsAction, NavigatePreviousInNavigationsAction, NavigatePreviousInEditsAction, NavigateToLastNavigationLocationAction,
	MaximizeGroupHideSidebarAction, MoveEditorToNewWindowAction, CopyEditorToNewindowAction, RestoreEditorsToMainWindowAction, ToggleMaximizeEditorGroupAction, MinimizeOtherGroupsHideSidebarAction, CopyEditorGroupToNewWindowAction,
	MoveEditorGroupToNewWindowAction, NewEmptyEditorWindowAction,
	ClearEditorHistoryWithoutConfirmAction
} from './editorActions.js';
import {
	CLOSE_EDITORS_AND_GROUP_COMMAND_ID, CLOSE_EDITORS_IN_GROUP_COMMAND_ID, CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, CLOSE_EDITOR_COMMAND_ID, CLOSE_EDITOR_GROUP_COMMAND_ID, CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
	CLOSE_PINNED_EDITOR_COMMAND_ID, CLOSE_SAVED_EDITORS_COMMAND_ID, KEEP_EDITOR_COMMAND_ID, PIN_EDITOR_COMMAND_ID, SHOW_EDITORS_IN_GROUP, SPLIT_EDITOR_DOWN, SPLIT_EDITOR_LEFT,
	SPLIT_EDITOR_RIGHT, SPLIT_EDITOR_UP, TOGGLE_KEEP_EDITORS_COMMAND_ID, UNPIN_EDITOR_COMMAND_ID, setup as registerEditorCommands, REOPEN_WITH_COMMAND_ID,
	TOGGLE_LOCK_GROUP_COMMAND_ID, UNLOCK_GROUP_COMMAND_ID, SPLIT_EDITOR_IN_GROUP, JOIN_EDITOR_IN_GROUP, FOCUS_FIRST_SIDE_EDITOR, FOCUS_SECOND_SIDE_EDITOR, TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT, LOCK_GROUP_COMMAND_ID,
	SPLIT_EDITOR, TOGGLE_MAXIMIZE_EDITOR_GROUP, MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID,
	NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID, MOVE_EDITOR_INTO_RIGHT_GROUP, MOVE_EDITOR_INTO_LEFT_GROUP, MOVE_EDITOR_INTO_ABOVE_GROUP, MOVE_EDITOR_INTO_BELOW_GROUP
} from './editorCommands.js';
import { GOTO_NEXT_CHANGE, GOTO_PREVIOUS_CHANGE, TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE, TOGGLE_DIFF_SIDE_BY_SIDE, DIFF_SWAP_SIDES } from './diffEditorCommands.js';
import { inQuickPickContext, getQuickNavigateHandler } from '../../quickaccess.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ContextKeyExpr, ContextKeyExpression } from '../../../../platform/contextkey/common/contextkey.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorAutoSave } from './editorAutoSave.js';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { ActiveGroupEditorsByMostRecentlyUsedQuickAccess, AllEditorsByAppearanceQuickAccess, AllEditorsByMostRecentlyUsedQuickAccess } from './editorQuickAccess.js';
import { FileAccess } from '../../../../base/common/network.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { UntitledTextEditorInputSerializer, UntitledTextEditorWorkingCopyEditorHandler } from '../../../services/untitled/common/untitledTextEditorHandler.js';
import { DynamicEditorConfigurations } from './editorConfiguration.js';
import { ConfigureEditorAction, ConfigureEditorTabsAction, EditorActionsDefaultAction, EditorActionsTitleBarAction, HideEditorActionsAction, HideEditorTabsAction, ShowMultipleEditorTabsAction, ShowSingleEditorTabAction, ZenHideEditorTabsAction, ZenShowMultipleEditorTabsAction, ZenShowSingleEditorTabAction } from '../../actions/layoutActions.js';
import { ICommandAction } from '../../../../platform/action/common/action.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { getFontSnippets } from '../../../../base/browser/fonts.js';
import { registerEditorFontConfigurations } from '../../../../editor/common/config/editorConfigurationSchema.js';

//#region Editor Registrations

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		TextResourceEditor,
		TextResourceEditor.ID,
		localize('textEditor', "文本编辑器"),
	),
	[
		new SyncDescriptor(UntitledTextEditorInput),
		new SyncDescriptor(TextResourceEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		TextDiffEditor,
		TextDiffEditor.ID,
		localize('textDiffEditor', "文本差异编辑器")
	),
	[
		new SyncDescriptor(DiffEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		BinaryResourceDiffEditor,
		BinaryResourceDiffEditor.ID,
		localize('binaryDiffEditor', "二进制差异编辑器")
	),
	[
		new SyncDescriptor(DiffEditorInput)
	]
);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		SideBySideEditor,
		SideBySideEditor.ID,
		localize('sideBySideEditor', "并排编辑器")
	),
	[
		new SyncDescriptor(SideBySideEditorInput)
	]
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(UntitledTextEditorInput.ID, UntitledTextEditorInputSerializer);
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(SideBySideEditorInput.ID, SideBySideEditorInputSerializer);
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(DiffEditorInput.ID, DiffEditorInputSerializer);

//#endregion

//#region Workbench Contributions

registerWorkbenchContribution2(EditorAutoSave.ID, EditorAutoSave, WorkbenchPhase.BlockRestore);
// Code-Tomoshibi：编辑器状态栏那一套（原 EditorStatusContribution / EditorStatus）已整个删除，
// 见 editorStatus.js —— 它算出来的九个条目 id 全是 `status.editor.*`，一个都过不了状态栏白名单
// （statusbarPart.ts 的 isTomoshibiStatusbarEntry），却要在光标每动一次时把选区字符数完整数一遍、
// 再排一帧 animation frame 去更新九个根本不存在的 DOM 条目，全压在用户输入的关键路径上。
// 该文件现在只留 ChangeLanguageAction / ChangeEOLAction / ChangeEncodingAction 三个 Action2，
// 命令面板那条路不受影响。
registerWorkbenchContribution2(UntitledTextEditorWorkingCopyEditorHandler.ID, UntitledTextEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(DynamicEditorConfigurations.ID, DynamicEditorConfigurations, WorkbenchPhase.BlockRestore);

//#endregion

//#region Quick Access

const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);
const editorPickerContextKey = 'inEditorsPicker';
const editorPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(editorPickerContextKey));

quickAccessRegistry.registerQuickAccessProvider({
	ctor: ActiveGroupEditorsByMostRecentlyUsedQuickAccess,
	prefix: ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX,
	contextKey: editorPickerContextKey,
	placeholder: localize('editorQuickAccessPlaceholder', "输入编辑器名称以打开它。"),
	helpEntries: [{ description: localize('activeGroupEditorsByMostRecentlyUsedQuickAccess', "按最近使用顺序显示活动组中的编辑器"), commandId: ShowEditorsInActiveGroupByMostRecentlyUsedAction.ID }]
});

quickAccessRegistry.registerQuickAccessProvider({
	ctor: AllEditorsByAppearanceQuickAccess,
	prefix: AllEditorsByAppearanceQuickAccess.PREFIX,
	contextKey: editorPickerContextKey,
	placeholder: localize('editorQuickAccessPlaceholder', "输入编辑器名称以打开它。"),
	helpEntries: [{ description: localize('allEditorsByAppearanceQuickAccess', "按打开顺序显示所有已打开的编辑器"), commandId: ShowAllEditorsByAppearanceAction.ID }]
});

quickAccessRegistry.registerQuickAccessProvider({
	ctor: AllEditorsByMostRecentlyUsedQuickAccess,
	prefix: AllEditorsByMostRecentlyUsedQuickAccess.PREFIX,
	contextKey: editorPickerContextKey,
	placeholder: localize('editorQuickAccessPlaceholder', "输入编辑器名称以打开它。"),
	helpEntries: [{ description: localize('allEditorsByMostRecentlyUsedQuickAccess', "按最近使用顺序显示所有已打开的编辑器"), commandId: ShowAllEditorsByMostRecentlyUsedAction.ID }]
});

//#endregion

//#region Actions & Commands

registerAction2(ChangeLanguageAction);
registerAction2(ChangeEOLAction);
registerAction2(ChangeEncodingAction);

registerAction2(NavigateForwardAction);
registerAction2(NavigateBackwardsAction);

registerAction2(OpenNextEditor);
registerAction2(OpenPreviousEditor);
registerAction2(OpenNextEditorInGroup);
registerAction2(OpenPreviousEditorInGroup);
registerAction2(OpenFirstEditorInGroup);
registerAction2(OpenLastEditorInGroup);

registerAction2(OpenNextRecentlyUsedEditorAction);
registerAction2(OpenPreviousRecentlyUsedEditorAction);
registerAction2(OpenNextRecentlyUsedEditorInGroupAction);
registerAction2(OpenPreviousRecentlyUsedEditorInGroupAction);

registerAction2(ReopenClosedEditorAction);
registerAction2(ClearRecentFilesAction);

registerAction2(ShowAllEditorsByAppearanceAction);
registerAction2(ShowAllEditorsByMostRecentlyUsedAction);
registerAction2(ShowEditorsInActiveGroupByMostRecentlyUsedAction);

registerAction2(CloseAllEditorsAction);
registerAction2(CloseAllEditorGroupsAction);
registerAction2(CloseLeftEditorsInGroupAction);
registerAction2(CloseEditorsInOtherGroupsAction);
registerAction2(CloseEditorInAllGroupsAction);
registerAction2(RevertAndCloseEditorAction);

registerAction2(SplitEditorAction);
registerAction2(SplitEditorOrthogonalAction);

registerAction2(SplitEditorLeftAction);
registerAction2(SplitEditorRightAction);
registerAction2(SplitEditorUpAction);
registerAction2(SplitEditorDownAction);

registerAction2(JoinTwoGroupsAction);
registerAction2(JoinAllGroupsAction);

registerAction2(NavigateBetweenGroupsAction);

registerAction2(ResetGroupSizesAction);
registerAction2(ToggleGroupSizesAction);
registerAction2(MaximizeGroupHideSidebarAction);
registerAction2(ToggleMaximizeEditorGroupAction);
registerAction2(MinimizeOtherGroupsAction);
registerAction2(MinimizeOtherGroupsHideSidebarAction);

registerAction2(MoveEditorLeftInGroupAction);
registerAction2(MoveEditorRightInGroupAction);
registerAction2(MoveEditorToStartAction);
registerAction2(MoveEditorToEndAction);

registerAction2(MoveGroupLeftAction);
registerAction2(MoveGroupRightAction);
registerAction2(MoveGroupUpAction);
registerAction2(MoveGroupDownAction);

registerAction2(DuplicateGroupLeftAction);
registerAction2(DuplicateGroupRightAction);
registerAction2(DuplicateGroupUpAction);
registerAction2(DuplicateGroupDownAction);

registerAction2(MoveEditorToPreviousGroupAction);
registerAction2(MoveEditorToNextGroupAction);
registerAction2(MoveEditorToFirstGroupAction);
registerAction2(MoveEditorToLastGroupAction);
registerAction2(MoveEditorToLeftGroupAction);
registerAction2(MoveEditorToRightGroupAction);
registerAction2(MoveEditorToAboveGroupAction);
registerAction2(MoveEditorToBelowGroupAction);

registerAction2(SplitEditorToPreviousGroupAction);
registerAction2(SplitEditorToNextGroupAction);
registerAction2(SplitEditorToFirstGroupAction);
registerAction2(SplitEditorToLastGroupAction);
registerAction2(SplitEditorToLeftGroupAction);
registerAction2(SplitEditorToRightGroupAction);
registerAction2(SplitEditorToAboveGroupAction);
registerAction2(SplitEditorToBelowGroupAction);

registerAction2(FocusActiveGroupAction);
registerAction2(FocusFirstGroupAction);
registerAction2(FocusLastGroupAction);
registerAction2(FocusPreviousGroup);
registerAction2(FocusNextGroup);
registerAction2(FocusLeftGroup);
registerAction2(FocusRightGroup);
registerAction2(FocusAboveGroup);
registerAction2(FocusBelowGroup);

registerAction2(NewEditorGroupLeftAction);
registerAction2(NewEditorGroupRightAction);
registerAction2(NewEditorGroupAboveAction);
registerAction2(NewEditorGroupBelowAction);

registerAction2(NavigatePreviousAction);
registerAction2(NavigateForwardInEditsAction);
registerAction2(NavigateBackwardsInEditsAction);
registerAction2(NavigatePreviousInEditsAction);
registerAction2(NavigateToLastEditLocationAction);
registerAction2(NavigateForwardInNavigationsAction);
registerAction2(NavigateBackwardsInNavigationsAction);
registerAction2(NavigatePreviousInNavigationsAction);
registerAction2(NavigateToLastNavigationLocationAction);
registerAction2(ClearEditorHistoryAction);
registerAction2(ClearEditorHistoryWithoutConfirmAction);

registerAction2(EditorLayoutSingleAction);
registerAction2(EditorLayoutTwoColumnsAction);
registerAction2(EditorLayoutThreeColumnsAction);
registerAction2(EditorLayoutTwoRowsAction);
registerAction2(EditorLayoutThreeRowsAction);
registerAction2(EditorLayoutTwoByTwoGridAction);
registerAction2(EditorLayoutTwoRowsRightAction);
registerAction2(EditorLayoutTwoColumnsBottomAction);

registerAction2(ToggleEditorTypeAction);
registerAction2(ReOpenInTextEditorAction);

registerAction2(QuickAccessPreviousRecentlyUsedEditorAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorAction);
registerAction2(QuickAccessPreviousRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessLeastRecentlyUsedEditorInGroupAction);
registerAction2(QuickAccessPreviousEditorFromHistoryAction);

registerAction2(MoveEditorToNewWindowAction);
registerAction2(CopyEditorToNewindowAction);
registerAction2(MoveEditorGroupToNewWindowAction);
registerAction2(CopyEditorGroupToNewWindowAction);
registerAction2(RestoreEditorsToMainWindowAction);
registerAction2(NewEmptyEditorWindowAction);

const quickAccessNavigateNextInEditorPickerId = 'workbench.action.quickOpenNavigateNextInEditorPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickAccessNavigateNextInEditorPickerId,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickAccessNavigateNextInEditorPickerId, true),
	when: editorPickerContext,
	primary: KeyMod.CtrlCmd | KeyCode.Tab,
	mac: { primary: KeyMod.WinCtrl | KeyCode.Tab }
});

const quickAccessNavigatePreviousInEditorPickerId = 'workbench.action.quickOpenNavigatePreviousInEditorPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickAccessNavigatePreviousInEditorPickerId,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickAccessNavigatePreviousInEditorPickerId, false),
	when: editorPickerContext,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Tab,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.Tab }
});

registerEditorCommands();

//#endregion

//#region Menus

// macOS: Touchbar
if (isMacintosh) {
	MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
		command: { id: NavigateBackwardsAction.ID, title: NavigateBackwardsAction.LABEL, icon: { dark: FileAccess.asFileUri('vs/workbench/browser/parts/editor/media/back-tb.png') } },
		group: 'navigation',
		order: 0
	});

	MenuRegistry.appendMenuItem(MenuId.TouchBarContext, {
		command: { id: NavigateForwardAction.ID, title: NavigateForwardAction.LABEL, icon: { dark: FileAccess.asFileUri('vs/workbench/browser/parts/editor/media/forward-tb.png') } },
		group: 'navigation',
		order: 1
	});
}

// Empty Editor Group Toolbar
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: LOCK_GROUP_COMMAND_ID, title: localize('lockGroupAction', "锁定编辑器组"), icon: Codicon.unlock }, group: 'navigation', order: 10, when: ContextKeyExpr.and(IsAuxiliaryWindowContext, ActiveEditorGroupLockedContext.toNegated()) });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: UNLOCK_GROUP_COMMAND_ID, title: localize('unlockGroupAction', "取消锁定编辑器组"), icon: Codicon.lock, toggled: ContextKeyExpr.true() }, group: 'navigation', order: 10, when: ActiveEditorGroupLockedContext });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroup, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize('closeGroupAction', "关闭编辑器组"), icon: Codicon.close }, group: 'navigation', order: 20, when: ContextKeyExpr.or(IsAuxiliaryWindowContext, EditorPartMultipleEditorGroupsContext) });

// Empty Editor Group Context Menu
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "向上拆分") }, group: '2_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "向下拆分") }, group: '2_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "向左拆分") }, group: '2_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "向右拆分") }, group: '2_split', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID, title: localize('newWindow', "新建窗口") }, group: '3_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize('toggleLockGroup', "锁定编辑器组"), toggled: ActiveEditorGroupLockedContext }, group: '4_lock', order: 10, when: IsAuxiliaryWindowContext.toNegated() /* already a primary action for aux windows */ });
MenuRegistry.appendMenuItem(MenuId.EmptyEditorGroupContext, { command: { id: CLOSE_EDITOR_GROUP_COMMAND_ID, title: localize('close', "关闭") }, group: '5_close', order: 10, when: MultipleEditorGroupsContext });

// Editor Tab Container Context Menu
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "向上拆分") }, group: '2_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "向下拆分") }, group: '2_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "向左拆分") }, group: '2_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "向右拆分") }, group: '2_split', order: 40 });

MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize('moveEditorGroupToNewWindow', "移动到新窗口") }, group: '3_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID, title: localize('copyEditorGroupToNewWindow', "复制到新窗口") }, group: '3_window', order: 20 });

MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsSubmenu, title: localize('tabBar', "标签栏"), group: '4_config', order: 10, when: InEditorZenModeContext.negate() });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowMultipleEditorTabsAction.ID, title: localize('multipleTabs', "多个标签"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'multiple') }, group: '1_config', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: ShowSingleEditorTabAction.ID, title: localize('singleTab', "单个标签"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'single') }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsSubmenu, { command: { id: HideEditorTabsAction.ID, title: localize('hideTabs', "隐藏"), toggled: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none') }, group: '1_config', order: 30 });

MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorTabsBarShowTabsZenModeSubmenu, title: localize('tabBar', "标签栏"), group: '4_config', order: 10, when: InEditorZenModeContext });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowMultipleEditorTabsAction.ID, title: localize('multipleTabs', "多个标签"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'multiple') }, group: '1_config', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenShowSingleEditorTabAction.ID, title: localize('singleTab', "单个标签"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'single') }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTabsBarShowTabsZenModeSubmenu, { command: { id: ZenHideEditorTabsAction.ID, title: localize('hideTabs', "隐藏"), toggled: ContextKeyExpr.equals('config.zenMode.showTabs', 'none') }, group: '1_config', order: 30 });

MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { submenu: MenuId.EditorActionsPositionSubmenu, title: localize('editorActionsPosition', "编辑器操作位置"), group: '4_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsDefaultAction.ID, title: localize('tabBar', "标签栏"), toggled: ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'default') }, group: '1_config', order: 10, when: ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none').negate() });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: EditorActionsTitleBarAction.ID, title: localize('titleBar', "标题栏"), toggled: ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'titleBar'), ContextKeyExpr.and(ContextKeyExpr.equals('config.workbench.editor.showTabs', 'none'), ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'default'))) }, group: '1_config', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorActionsPositionSubmenu, { command: { id: HideEditorActionsAction.ID, title: localize('hidden', "隐藏"), toggled: ContextKeyExpr.equals('config.workbench.editor.editorActionsLocation', 'hidden') }, group: '1_config', order: 30 });

MenuRegistry.appendMenuItem(MenuId.EditorTabsBarContext, { command: { id: ConfigureEditorTabsAction.ID, title: localize('configureTabs', "配置标签") }, group: '9_configure', order: 10 });

// Editor Title Context Menu
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize('close', "关闭") }, group: '1_close', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeOthers', "关闭其他"), precondition: EditorGroupEditorsCountContext.notEqualsTo('1') }, group: '1_close', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize('closeRight', "关闭右侧"), precondition: ContextKeyExpr.and(ActiveEditorLastInGroupContext.toNegated(), MultipleEditorsSelectedInGroupContext.negate()) }, group: '1_close', order: 30, when: EditorTabsVisibleContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize('closeAllSaved', "关闭已保存") }, group: '1_close', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeAll', "关闭全部") }, group: '1_close', order: 50 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize('reopenWith', "用其他编辑器打开…") }, group: '1_open', order: 10, when: ActiveEditorAvailableEditorIdsContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize('keepOpen', "保持打开"), precondition: ActiveEditorPinnedContext.toNegated() }, group: '3_preview', order: 10, when: ContextKeyExpr.has('config.workbench.editor.enablePreview') });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize('pin', "固定") }, group: '3_preview', order: 20, when: ActiveEditorStickyContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize('unpin', "取消固定") }, group: '3_preview', order: 20, when: ActiveEditorStickyContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR, title: localize('splitRight', "向右拆分") }, group: '5_split', order: 10, when: SplitEditorsVertically.negate() });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: SPLIT_EDITOR, title: localize('splitDown', "向下拆分") }, group: '5_split', order: 10, when: SplitEditorsVertically });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { submenu: MenuId.EditorSplitMoveSubmenu, title: localize('splitAndMoveEditor', "拆分和移动"), group: '5_split', order: 15 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize('moveToNewWindow', "移动到新窗口") }, group: '7_new_window', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { command: { id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID, title: localize('copyToNewWindow', "复制到新窗口") }, group: '7_new_window', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, { submenu: MenuId.EditorTitleContextShare, title: localize('share', "共享"), group: '11_share', order: -1, when: MultipleEditorsSelectedInGroupContext.negate() });

// Editor Title Context Menu: Split & Move Editor Submenu
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: SPLIT_EDITOR_UP, title: localize('splitUp', "向上拆分") }, group: '1_split', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: SPLIT_EDITOR_DOWN, title: localize('splitDown', "向下拆分") }, group: '1_split', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: SPLIT_EDITOR_LEFT, title: localize('splitLeft', "向左拆分") }, group: '1_split', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: SPLIT_EDITOR_RIGHT, title: localize('splitRight', "向右拆分") }, group: '1_split', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: MOVE_EDITOR_INTO_ABOVE_GROUP, title: localize('moveAbove', "向上移动") }, group: '2_move', order: 10 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: MOVE_EDITOR_INTO_BELOW_GROUP, title: localize('moveBelow', "向下移动") }, group: '2_move', order: 20 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: MOVE_EDITOR_INTO_LEFT_GROUP, title: localize('moveLeft', "向左移动") }, group: '2_move', order: 30 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: MOVE_EDITOR_INTO_RIGHT_GROUP, title: localize('moveRight', "向右移动") }, group: '2_move', order: 40 });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: SPLIT_EDITOR_IN_GROUP, title: localize('splitInGroup', "在组内拆分"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: '3_split_in_group', order: 10, when: ActiveEditorCanSplitInGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorSplitMoveSubmenu, { command: { id: JOIN_EDITOR_IN_GROUP, title: localize('joinInGroup', "在组内合并"), precondition: MultipleEditorsSelectedInGroupContext.negate() }, group: '3_split_in_group', order: 10, when: SideBySideEditorActiveContext });

// Editor Title Menu
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_DIFF_SIDE_BY_SIDE, title: localize('inlineView', "内联视图"), toggled: ContextKeyExpr.equals('config.diffEditor.renderSideBySide', false) }, group: '1_diff', order: 10, when: ContextKeyExpr.or(ContextKeyExpr.has('isInDiffEditor'), ActiveCustomEditorDiffCanToggleLayoutContext) });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: SHOW_EDITORS_IN_GROUP, title: localize('showOpenedEditors', "显示已打开的编辑器") }, group: '3_open', order: 10, when: EditorPartModalContext.toNegated() /* not applicable to modal editor */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize('closeAll', "关闭全部") }, group: '5_close', order: 10, when: EditorPartModalContext.toNegated() /* not applicable to modal editor */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize('closeAllSaved', "关闭已保存") }, group: '5_close', order: 20, when: EditorPartModalContext.toNegated() /* not applicable to modal editor */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_KEEP_EDITORS_COMMAND_ID, title: localize('togglePreviewMode', "启用预览编辑器"), toggled: ContextKeyExpr.has('config.workbench.editor.enablePreview') }, group: '7_settings', order: 10, when: EditorPartModalContext.toNegated() /* not applicable to modal editor */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize('maximizeGroup', "最大化编辑器组") }, group: '8_group_operations', order: 5, when: ContextKeyExpr.and(EditorPartMaximizedEditorGroupContext.negate(), EditorPartMultipleEditorGroupsContext) });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_MAXIMIZE_EDITOR_GROUP, title: localize('unmaximizeGroup', "还原编辑器组") }, group: '8_group_operations', order: 5, when: EditorPartMaximizedEditorGroupContext });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: TOGGLE_LOCK_GROUP_COMMAND_ID, title: localize('lockGroup', "锁定编辑器组"), toggled: ActiveEditorGroupLockedContext }, group: '8_group_operations', order: 10, when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), EditorPartModalContext.toNegated()) /* already a primary action for aux windows, not applicable to modal editor */ });
MenuRegistry.appendMenuItem(MenuId.EditorTitle, { command: { id: ConfigureEditorAction.ID, title: localize('configureEditors', "配置编辑器") }, group: '9_configure', order: 10, when: EditorPartModalContext.toNegated() /* not applicable to modal editor */ });

function appendEditorToolItem(primary: ICommandAction, when: ContextKeyExpression | undefined, order: number, alternative?: ICommandAction, precondition?: ContextKeyExpression | undefined, enableInCompactMode?: boolean, enableInModalMode?: boolean): void {
	const item: IMenuItem = {
		command: {
			id: primary.id,
			title: primary.title,
			icon: primary.icon,
			toggled: primary.toggled,
			precondition
		},
		group: 'navigation',
		when,
		order
	};

	if (alternative) {
		item.alt = {
			id: alternative.id,
			title: alternative.title,
			icon: alternative.icon
		};
	}

	MenuRegistry.appendMenuItem(MenuId.EditorTitle, item);
	if (enableInCompactMode) {
		MenuRegistry.appendMenuItem(MenuId.CompactWindowEditorTitle, item);
	}
	if (enableInModalMode) {
		MenuRegistry.appendMenuItem(MenuId.ModalEditorEditorTitle, item);
	}
}

const SPLIT_ORDER = 100000;  // towards the end
const CLOSE_ORDER = 1000000; // towards the far end

// Editor Title Menu: Split Editor
// In the agents window the split editor action is moved into the overflow (...)
// menu (see below) rather than being shown as a primary toolbar icon.
appendEditorToolItem(
	{
		id: SPLIT_EDITOR,
		title: localize('splitEditorRight', "向右拆分编辑器"),
		icon: Codicon.splitHorizontal
	},
	ContextKeyExpr.and(SplitEditorsVertically.negate(), IsSessionsWindowContext.toNegated()),
	SPLIT_ORDER,
	{
		id: SPLIT_EDITOR_DOWN,
		title: localize('splitEditorDown', "向下拆分编辑器"),
		icon: Codicon.splitVertical
	}
);

appendEditorToolItem(
	{
		id: SPLIT_EDITOR,
		title: localize('splitEditorDown', "向下拆分编辑器"),
		icon: Codicon.splitVertical
	},
	ContextKeyExpr.and(SplitEditorsVertically, IsSessionsWindowContext.toNegated()),
	SPLIT_ORDER,
	{
		id: SPLIT_EDITOR_RIGHT,
		title: localize('splitEditorRight', "向右拆分编辑器"),
		icon: Codicon.splitHorizontal
	}
);

// Agents window: show Split Editor in the editor title overflow (...) menu
// instead of as a primary toolbar icon. Mirror the orientation handling of the
// primary toolbar items so the label/icon match the configured split direction.
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: SPLIT_EDITOR,
		title: localize('splitEditorRight', "向右拆分编辑器"),
		icon: Codicon.splitHorizontal
	},
	group: '4_split',
	order: 10,
	when: ContextKeyExpr.and(IsSessionsWindowContext, SplitEditorsVertically.negate())
});
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: SPLIT_EDITOR,
		title: localize('splitEditorDown', "向下拆分编辑器"),
		icon: Codicon.splitVertical
	},
	group: '4_split',
	order: 10,
	when: ContextKeyExpr.and(IsSessionsWindowContext, SplitEditorsVertically)
});

// Side by side: layout
appendEditorToolItem(
	{
		id: TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
		title: localize('toggleSplitEditorInGroupLayout', "切换布局"),
		icon: Codicon.editorLayout
	},
	SideBySideEditorActiveContext,
	SPLIT_ORDER - 1, // left to split actions
);

// Editor Title Menu: Close (tabs disabled, normal editor)
appendEditorToolItem(
	{
		id: CLOSE_EDITOR_COMMAND_ID,
		title: localize('close', "关闭"),
		icon: Codicon.close
	},
	ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext.toNegated()),
	CLOSE_ORDER,
	{
		id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
		title: localize('closeAll', "关闭全部"),
		icon: Codicon.closeAll
	}
);

// Editor Title Menu: Close (tabs disabled, dirty editor)
appendEditorToolItem(
	{
		id: CLOSE_EDITOR_COMMAND_ID,
		title: localize('close', "关闭"),
		icon: Codicon.closeDirty
	},
	ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext.toNegated()),
	CLOSE_ORDER,
	{
		id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
		title: localize('closeAll', "关闭全部"),
		icon: Codicon.closeAll
	}
);

// Editor Title Menu: Close (tabs disabled, sticky editor)
appendEditorToolItem(
	{
		id: UNPIN_EDITOR_COMMAND_ID,
		title: localize('unpin', "取消固定"),
		icon: Codicon.pinned
	},
	ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext.toNegated(), ActiveEditorStickyContext),
	CLOSE_ORDER,
	{
		id: CLOSE_EDITOR_COMMAND_ID,
		title: localize('close', "关闭"),
		icon: Codicon.close
	}
);

// Editor Title Menu: Close (tabs disabled, dirty & sticky editor)
appendEditorToolItem(
	{
		id: UNPIN_EDITOR_COMMAND_ID,
		title: localize('unpin', "取消固定"),
		icon: Codicon.pinnedDirty
	},
	ContextKeyExpr.and(EditorTabsVisibleContext.toNegated(), ActiveEditorDirtyContext, ActiveEditorStickyContext),
	CLOSE_ORDER,
	{
		id: CLOSE_EDITOR_COMMAND_ID,
		title: localize('close', "关闭"),
		icon: Codicon.close
	}
);

// Lock Group: only on auxiliary window and when group is unlocked
appendEditorToolItem(
	{
		id: LOCK_GROUP_COMMAND_ID,
		title: localize('lockEditorGroup', "锁定编辑器组"),
		icon: Codicon.unlock
	},
	ContextKeyExpr.and(IsAuxiliaryWindowContext, ActiveEditorGroupLockedContext.toNegated()),
	CLOSE_ORDER - 1, // immediately to the left of close action
);

// Unlock Group: only when group is locked
appendEditorToolItem(
	{
		id: UNLOCK_GROUP_COMMAND_ID,
		title: localize('unlockEditorGroup', "取消锁定编辑器组"),
		icon: Codicon.lock,
		toggled: ContextKeyExpr.true()
	},
	ActiveEditorGroupLockedContext,
	CLOSE_ORDER - 1, // immediately to the left of close action
);

// Diff Editor Title Menu: Previous Change
const previousChangeIcon = registerIcon('diff-editor-previous-change', Codicon.arrowUp, localize('previousChangeIcon', '差异编辑器中上一个更改操作的图标'));
appendEditorToolItem(
	{
		id: GOTO_PREVIOUS_CHANGE,
		title: localize('navigate.prev.label', "上一处更改"),
		icon: previousChangeIcon
	},
	TextCompareEditorActiveContext,
	10,
	undefined,
	EditorContextKeys.hasChanges,
	true,
	true
);

// Diff Editor Title Menu: Next Change
const nextChangeIcon = registerIcon('diff-editor-next-change', Codicon.arrowDown, localize('nextChangeIcon', '差异编辑器中下一个更改操作的图标'));
appendEditorToolItem(
	{
		id: GOTO_NEXT_CHANGE,
		title: localize('navigate.next.label', "下一处更改"),
		icon: nextChangeIcon
	},
	TextCompareEditorActiveContext,
	11,
	undefined,
	EditorContextKeys.hasChanges,
	true,
	true
);

// Diff Editor Title Menu: Swap Sides
appendEditorToolItem(
	{
		id: DIFF_SWAP_SIDES,
		title: localize('swapDiffSides', "交换左右两侧"),
		icon: Codicon.arrowSwap
	},
	ContextKeyExpr.and(TextCompareEditorActiveContext, ActiveCompareEditorCanSwapContext),
	15,
	undefined,
	undefined
);

// Custom Text Diff Editor Title Menu: Reopen as Text
appendEditorToolItem(
	{
		id: ReOpenInTextEditorAction.ID,
		title: localize('reopenAsText', "以文本方式重新打开"),
		icon: Codicon.fileCode
	},
	ActiveCustomEditorTextDiffContext,
	16,
	undefined,
	undefined,
	undefined,
	true
);

const toggleWhitespace = registerIcon('diff-editor-toggle-whitespace', Codicon.whitespace, localize('toggleWhitespace', '差异编辑器中“切换空白”操作的图标'));
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
	command: {
		id: TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE,
		title: localize('ignoreTrimWhitespace.label', "显示前导/尾随空白差异"),
		icon: toggleWhitespace,
		precondition: TextCompareEditorActiveContext,
		toggled: ContextKeyExpr.equals('config.diffEditor.ignoreTrimWhitespace', false),
	},
	group: 'navigation',
	when: TextCompareEditorActiveContext,
	order: 20,
});

// Editor Commands for Command Palette
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: KEEP_EDITOR_COMMAND_ID, title: localize2('keepEditor', '保留编辑器'), category: Categories.View }, when: ContextKeyExpr.has('config.workbench.editor.enablePreview') });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: PIN_EDITOR_COMMAND_ID, title: localize2('pinEditor', '固定编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: UNPIN_EDITOR_COMMAND_ID, title: localize2('unpinEditor', '取消固定编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITOR_COMMAND_ID, title: localize2('closeEditor', '关闭编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_PINNED_EDITOR_COMMAND_ID, title: localize2('closePinnedEditor', '关闭固定的编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID, title: localize2('closeEditorsInGroup', '关闭组内全部编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_SAVED_EDITORS_COMMAND_ID, title: localize2('closeSavedEditors', '关闭组内已保存的编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, title: localize2('closeOtherEditors', '关闭组内其他编辑器'), category: Categories.View } });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID, title: localize2('closeRightEditors', '关闭组内右侧的编辑器'), category: Categories.View }, when: ActiveEditorLastInGroupContext.toNegated() });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: CLOSE_EDITORS_AND_GROUP_COMMAND_ID, title: localize2('closeEditorGroup', '关闭编辑器组'), category: Categories.View }, when: MultipleEditorGroupsContext });
MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: REOPEN_WITH_COMMAND_ID, title: localize2('reopenWith', "用其他编辑器打开…"), category: Categories.View }, when: ActiveEditorAvailableEditorIdsContext });

// File menu
MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
	group: '1_editor',
	command: {
		id: ReopenClosedEditorAction.ID,
		title: localize({ key: 'miReopenClosedEditor', comment: ['&& denotes a mnemonic'] }, "重新打开已关闭的编辑器"),
		precondition: ContextKeyExpr.has('canReopenClosedEditor')
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarRecentMenu, {
	group: 'z_clear',
	command: {
		id: ClearRecentFilesAction.ID,
		title: localize({ key: 'miClearRecentOpen', comment: ['&& denotes a mnemonic'] }, "清除最近打开的记录…")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	title: localize('miShare', "共享"),
	submenu: MenuId.MenubarShare,
	group: '45_share',
	order: 1,
	when: IsSessionsWindowContext.negate()
});

// Layout menu
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	group: '2_appearance',
	title: localize({ key: 'miEditorLayout', comment: ['&& denotes a mnemonic'] }, "编辑器布局"),
	submenu: MenuId.MenubarLayoutMenu,
	order: 2,
	when: IsSessionsWindowContext.negate()
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '1_split',
	command: {
		id: SPLIT_EDITOR_UP,
		title: {
			...localize2('miSplitEditorUpWithoutMnemonic', "向上拆分"),
			mnemonicTitle: localize({ key: 'miSplitEditorUp', comment: ['&& denotes a mnemonic'] }, "向上拆分"),
		}
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '1_split',
	command: {
		id: SPLIT_EDITOR_DOWN,
		title: {
			...localize2('miSplitEditorDownWithoutMnemonic', "向下拆分"),
			mnemonicTitle: localize({ key: 'miSplitEditorDown', comment: ['&& denotes a mnemonic'] }, "向下拆分"),
		}
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '1_split',
	command: {
		id: SPLIT_EDITOR_LEFT,
		title: {
			...localize2('miSplitEditorLeftWithoutMnemonic', "向左拆分"),
			mnemonicTitle: localize({ key: 'miSplitEditorLeft', comment: ['&& denotes a mnemonic'] }, "向左拆分"),
		}
	},
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '1_split',
	command: {
		id: SPLIT_EDITOR_RIGHT,
		title: {
			...localize2('miSplitEditorRightWithoutMnemonic', "向右拆分"),
			mnemonicTitle: localize({ key: 'miSplitEditorRight', comment: ['&& denotes a mnemonic'] }, "向右拆分"),
		}
	},
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '2_split_in_group',
	command: {
		id: SPLIT_EDITOR_IN_GROUP,
		title: {
			...localize2('miSplitEditorInGroupWithoutMnemonic', "在组内拆分"),
			mnemonicTitle: localize({ key: 'miSplitEditorInGroup', comment: ['&& denotes a mnemonic'] }, "在组内拆分"),
		}
	},
	when: ActiveEditorCanSplitInGroupContext,
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '2_split_in_group',
	command: {
		id: JOIN_EDITOR_IN_GROUP,
		title: {
			...localize2('miJoinEditorInGroupWithoutMnemonic', "在组内合并"),
			mnemonicTitle: localize({ key: 'miJoinEditorInGroup', comment: ['&& denotes a mnemonic'] }, "在组内合并"),
		}
	},
	when: SideBySideEditorActiveContext,
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '3_new_window',
	command: {
		id: MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
		title: {
			...localize2('moveEditorToNewWindow', "将编辑器移动到新窗口"),
			mnemonicTitle: localize({ key: 'miMoveEditorToNewWindow', comment: ['&& denotes a mnemonic'] }, "将编辑器移动到新窗口"),
		}
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '3_new_window',
	command: {
		id: COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID,
		title: {
			...localize2('copyEditorToNewWindow', "将编辑器复制到新窗口"),
			mnemonicTitle: localize({ key: 'miCopyEditorToNewWindow', comment: ['&& denotes a mnemonic'] }, "将编辑器复制到新窗口"),
		}
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutSingleAction.ID,
		title: {
			...localize2('miSingleColumnEditorLayoutWithoutMnemonic', "单列"),
			mnemonicTitle: localize({ key: 'miSingleColumnEditorLayout', comment: ['&& denotes a mnemonic'] }, "单列"),
		}
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutTwoColumnsAction.ID,
		title: {
			...localize2('miTwoColumnsEditorLayoutWithoutMnemonic', "两列"),
			mnemonicTitle: localize({ key: 'miTwoColumnsEditorLayout', comment: ['&& denotes a mnemonic'] }, "两列"),
		}
	},
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutThreeColumnsAction.ID,
		title: {
			...localize2('miThreeColumnsEditorLayoutWithoutMnemonic', "三列"),
			mnemonicTitle: localize({ key: 'miThreeColumnsEditorLayout', comment: ['&& denotes a mnemonic'] }, "三列"),
		}
	},
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutTwoRowsAction.ID,
		title: {
			...localize2('miTwoRowsEditorLayoutWithoutMnemonic', "两行"),
			mnemonicTitle: localize({ key: 'miTwoRowsEditorLayout', comment: ['&& denotes a mnemonic'] }, "两行"),
		}
	},
	order: 5
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutThreeRowsAction.ID,
		title: {
			...localize2('miThreeRowsEditorLayoutWithoutMnemonic', "三行"),
			mnemonicTitle: localize({ key: 'miThreeRowsEditorLayout', comment: ['&& denotes a mnemonic'] }, "三行"),
		}
	},
	order: 6
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutTwoByTwoGridAction.ID,
		title: {
			...localize2('miTwoByTwoGridEditorLayoutWithoutMnemonic', "网格 (2x2)"),
			mnemonicTitle: localize({ key: 'miTwoByTwoGridEditorLayout', comment: ['&& denotes a mnemonic'] }, "网格 (2x2)"),
		}
	},
	order: 7
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutTwoRowsRightAction.ID,
		title: {
			...localize2('miTwoRowsRightEditorLayoutWithoutMnemonic', "右侧两行"),
			mnemonicTitle: localize({ key: 'miTwoRowsRightEditorLayout', comment: ['&& denotes a mnemonic'] }, "右侧两行"),
		}
	},
	order: 8
});

MenuRegistry.appendMenuItem(MenuId.MenubarLayoutMenu, {
	group: '4_layouts',
	command: {
		id: EditorLayoutTwoColumnsBottomAction.ID,
		title: {
			...localize2('miTwoColumnsBottomEditorLayoutWithoutMnemonic', "底部两列"),
			mnemonicTitle: localize({ key: 'miTwoColumnsBottomEditorLayout', comment: ['&& denotes a mnemonic'] }, "底部两列"),
		}
	},
	order: 9
});

// Main Menu Bar Contributions:

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '1_history_nav',
	command: {
		id: 'workbench.action.navigateToLastEditLocation',
		title: localize({ key: 'miLastEditLocation', comment: ['&& denotes a mnemonic'] }, "上次编辑位置"),
		precondition: ContextKeyExpr.has('canNavigateToLastEditLocation')
	},
	order: 3
});

// Switch Editor

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '1_sideBySide',
	command: {
		id: FOCUS_FIRST_SIDE_EDITOR,
		title: localize({ key: 'miFirstSideEditor', comment: ['&& denotes a mnemonic'] }, "编辑器中的第一侧")
	},
	when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '1_sideBySide',
	command: {
		id: FOCUS_SECOND_SIDE_EDITOR,
		title: localize({ key: 'miSecondSideEditor', comment: ['&& denotes a mnemonic'] }, "编辑器中的第二侧")
	},
	when: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '2_any',
	command: {
		id: 'workbench.action.nextEditor',
		title: localize({ key: 'miNextEditor', comment: ['&& denotes a mnemonic'] }, "下一个编辑器")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '2_any',
	command: {
		id: 'workbench.action.previousEditor',
		title: localize({ key: 'miPreviousEditor', comment: ['&& denotes a mnemonic'] }, "上一个编辑器")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '3_any_used',
	command: {
		id: 'workbench.action.openNextRecentlyUsedEditor',
		title: localize({ key: 'miNextRecentlyUsedEditor', comment: ['&& denotes a mnemonic'] }, "下一个最近使用的编辑器")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '3_any_used',
	command: {
		id: 'workbench.action.openPreviousRecentlyUsedEditor',
		title: localize({ key: 'miPreviousRecentlyUsedEditor', comment: ['&& denotes a mnemonic'] }, "上一个最近使用的编辑器")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '4_group',
	command: {
		id: 'workbench.action.nextEditorInGroup',
		title: localize({ key: 'miNextEditorInGroup', comment: ['&& denotes a mnemonic'] }, "组内下一个编辑器")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '4_group',
	command: {
		id: 'workbench.action.previousEditorInGroup',
		title: localize({ key: 'miPreviousEditorInGroup', comment: ['&& denotes a mnemonic'] }, "组内上一个编辑器")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '5_group_used',
	command: {
		id: 'workbench.action.openNextRecentlyUsedEditorInGroup',
		title: localize({ key: 'miNextUsedEditorInGroup', comment: ['&& denotes a mnemonic'] }, "组内下一个最近使用的编辑器")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchEditorMenu, {
	group: '5_group_used',
	command: {
		id: 'workbench.action.openPreviousRecentlyUsedEditorInGroup',
		title: localize({ key: 'miPreviousUsedEditorInGroup', comment: ['&& denotes a mnemonic'] }, "组内上一个最近使用的编辑器")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '2_editor_nav',
	title: localize({ key: 'miSwitchEditor', comment: ['&& denotes a mnemonic'] }, "切换编辑器"),
	submenu: MenuId.MenubarSwitchEditorMenu,
	order: 1
});

// Switch Group
MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '1_focus_index',
	command: {
		id: 'workbench.action.focusFirstEditorGroup',
		title: localize({ key: 'miFocusFirstGroup', comment: ['&& denotes a mnemonic'] }, "编辑器组 1")
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '1_focus_index',
	command: {
		id: 'workbench.action.focusSecondEditorGroup',
		title: localize({ key: 'miFocusSecondGroup', comment: ['&& denotes a mnemonic'] }, "编辑器组 2")
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '1_focus_index',
	command: {
		id: 'workbench.action.focusThirdEditorGroup',
		title: localize({ key: 'miFocusThirdGroup', comment: ['&& denotes a mnemonic'] }, "编辑器组 3"),
		precondition: MultipleEditorGroupsContext
	},
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '1_focus_index',
	command: {
		id: 'workbench.action.focusFourthEditorGroup',
		title: localize({ key: 'miFocusFourthGroup', comment: ['&& denotes a mnemonic'] }, "编辑器组 4"),
		precondition: MultipleEditorGroupsContext
	},
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '1_focus_index',
	command: {
		id: 'workbench.action.focusFifthEditorGroup',
		title: localize({ key: 'miFocusFifthGroup', comment: ['&& denotes a mnemonic'] }, "编辑器组 5"),
		precondition: MultipleEditorGroupsContext
	},
	order: 5
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '2_next_prev',
	command: {
		id: 'workbench.action.focusNextGroup',
		title: localize({ key: 'miNextGroup', comment: ['&& denotes a mnemonic'] }, "下一个编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '2_next_prev',
	command: {
		id: 'workbench.action.focusPreviousGroup',
		title: localize({ key: 'miPreviousGroup', comment: ['&& denotes a mnemonic'] }, "上一个编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '3_directional',
	command: {
		id: 'workbench.action.focusLeftGroup',
		title: localize({ key: 'miFocusLeftGroup', comment: ['&& denotes a mnemonic'] }, "左侧编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '3_directional',
	command: {
		id: 'workbench.action.focusRightGroup',
		title: localize({ key: 'miFocusRightGroup', comment: ['&& denotes a mnemonic'] }, "右侧编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '3_directional',
	command: {
		id: 'workbench.action.focusAboveGroup',
		title: localize({ key: 'miFocusAboveGroup', comment: ['&& denotes a mnemonic'] }, "上方编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarSwitchGroupMenu, {
	group: '3_directional',
	command: {
		id: 'workbench.action.focusBelowGroup',
		title: localize({ key: 'miFocusBelowGroup', comment: ['&& denotes a mnemonic'] }, "下方编辑器组"),
		precondition: MultipleEditorGroupsContext
	},
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
	group: '2_editor_nav',
	title: localize({ key: 'miSwitchGroup', comment: ['&& denotes a mnemonic'] }, "切换编辑器组"),
	submenu: MenuId.MenubarSwitchGroupMenu,
	order: 2
});

//#endregion


registerEditorFontConfigurations(getFontSnippets);
