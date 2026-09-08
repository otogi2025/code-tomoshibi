/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../nls.js';
import { IWindowOpenable } from '../../../platform/window/common/window.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { MenuRegistry, MenuId, Action2, registerAction2 } from '../../../platform/actions/common/actions.js';
import { KeyChord, KeyCode, KeyMod } from '../../../base/common/keyCodes.js';
import { IsMacNativeContext, IsDevelopmentContext, IsWebContext } from '../../../platform/contextkey/common/contextkeys.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickInputButton, IQuickInputService, IQuickPickSeparator, IKeyMods, IQuickPickItem } from '../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, IWorkspaceIdentifier, isWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier } from '../../../platform/workspace/common/workspace.js';
import { ILabelService, Verbosity } from '../../../platform/label/common/label.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { IRecent, isRecentFolder, isRecentWorkspace, IWorkspacesService } from '../../../platform/workspaces/common/workspaces.js';
import { URI } from '../../../base/common/uri.js';
import { getIconClasses } from '../../../editor/common/services/getIconClasses.js';
import { FileKind } from '../../../platform/files/common/files.js';
import { splitRecentLabel } from '../../../base/common/labels.js';
import { isMacintosh, isWeb, isWindows } from '../../../base/common/platform.js';
import { ContextKeyExpr } from '../../../platform/contextkey/common/contextkey.js';
import { inQuickPickContext, getQuickNavigateHandler } from '../quickaccess.js';
import { IHostService } from '../../services/host/browser/host.js';
import { ResourceMap } from '../../../base/common/map.js';
import { Codicon } from '../../../base/common/codicons.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { isFolderBackupInfo, isWorkspaceBackupInfo } from '../../../platform/backup/common/backup.js';
import { getActiveElement, getActiveWindow, isHTMLElement } from '../../../base/browser/dom.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { isEqual } from '../../../base/common/resources.js';

export const inRecentFilesPickerContextKey = 'inRecentFilesPicker';

interface IRecentlyOpenedPick extends IQuickPickItem {
	resource: URI;
	openable: IWindowOpenable;
	remoteAuthority: string | undefined;
}

abstract class BaseOpenRecentAction extends Action2 {

	private readonly removeFromRecentlyOpened: IQuickInputButton = {
		iconClass: ThemeIcon.asClassName(Codicon.removeClose),
		tooltip: localize('remove', "从最近打开中删除")
	};

	private readonly dirtyRecentlyOpenedFolder: IQuickInputButton = {
		iconClass: 'dirty-workspace ' + ThemeIcon.asClassName(Codicon.closeDirty),
		tooltip: localize('dirtyRecentlyOpenedFolder', "包含未保存的文件的文件夹"),
		alwaysVisible: true
	};

	private readonly dirtyRecentlyOpenedWorkspace: IQuickInputButton = {
		...this.dirtyRecentlyOpenedFolder,
		tooltip: localize('dirtyRecentlyOpenedWorkspace', "包含未保存的文件的工作区"),
	};

	private readonly windowOpenedRecentlyOpenedFolder: IQuickInputButton = {
		iconClass: 'opened-workspace ' + ThemeIcon.asClassName(Codicon.window),
		tooltip: localize('openedRecentlyOpenedFolder', "已在窗口中打开文件夹"),
		alwaysVisible: true
	};

	private readonly windowOpenedRecentlyOpenedWorkspace: IQuickInputButton = {
		...this.windowOpenedRecentlyOpenedFolder,
		tooltip: localize('openedRecentlyOpenedWorkspace', "已在窗口中打开工作区"),
	};

	private readonly activeWindowOpenedRecentlyOpenedFolder: IQuickInputButton = {
		iconClass: 'opened-workspace ' + ThemeIcon.asClassName(Codicon.windowActive),
		tooltip: localize('activeOpenedRecentlyOpenedFolder', "已在活动窗口中打开文件夹"),
		alwaysVisible: true
	};

	private readonly activeWindowOpenedRecentlyOpenedWorkspace: IQuickInputButton = {
		...this.activeWindowOpenedRecentlyOpenedFolder,
		tooltip: localize('activeOpenedRecentlyOpenedWorkspace', "已在活动窗口中打开工作区"),
	};

	protected abstract isQuickNavigate(): boolean;

	override async run(accessor: ServicesAccessor): Promise<void> {
		const workspacesService = accessor.get(IWorkspacesService);
		const quickInputService = accessor.get(IQuickInputService);
		const contextService = accessor.get(IWorkspaceContextService);
		const labelService = accessor.get(ILabelService);
		const keybindingService = accessor.get(IKeybindingService);
		const modelService = accessor.get(IModelService);
		const languageService = accessor.get(ILanguageService);
		const hostService = accessor.get(IHostService);
		const dialogService = accessor.get(IDialogService);
		const environmentService = accessor.get(IWorkbenchEnvironmentService);

		const [mainWindows, recentlyOpened, dirtyWorkspacesAndFolders] = await Promise.all([
			hostService.getWindows({ includeAuxiliaryWindows: false }),
			workspacesService.getRecentlyOpened(),
			workspacesService.getDirtyWorkspaces()
		]);

		let hasWorkspaces = false;

		// Identify all folders and workspaces with unsaved files
		const dirtyFolders = new ResourceMap<boolean>();
		const dirtyWorkspaces = new ResourceMap<IWorkspaceIdentifier>();
		for (const dirtyWorkspace of dirtyWorkspacesAndFolders) {
			if (isFolderBackupInfo(dirtyWorkspace)) {
				dirtyFolders.set(dirtyWorkspace.folderUri, true);
			} else {
				dirtyWorkspaces.set(dirtyWorkspace.workspace.configPath, dirtyWorkspace.workspace);
				hasWorkspaces = true;
			}
		}

		// Identify all folders and workspaces opened in main windows
		const activeWindowId = getActiveWindow().vscodeWindowId;
		const openedInWindows = new ResourceMap<{ isActive: boolean }>();
		for (const window of mainWindows) {
			const isActive = window.id === activeWindowId;
			if (isSingleFolderWorkspaceIdentifier(window.workspace)) {
				openedInWindows.set(window.workspace.uri, { isActive });
			} else if (isWorkspaceIdentifier(window.workspace)) {
				openedInWindows.set(window.workspace.configPath, { isActive });
			}
		}

		// Identify all recently opened folders and workspaces
		const recentFolders = new ResourceMap<boolean>();
		const recentWorkspaces = new ResourceMap<IWorkspaceIdentifier>();
		for (const recent of recentlyOpened.workspaces) {
			if (isRecentFolder(recent)) {
				recentFolders.set(recent.folderUri, true);
			} else {
				recentWorkspaces.set(recent.workspace.configPath, recent.workspace);
				hasWorkspaces = true;
			}
		}

		// Fill in all known recently opened workspaces
		const workspacePicks: IRecentlyOpenedPick[] = [];
		for (const recent of recentlyOpened.workspaces) {
			const isDirty = isRecentFolder(recent) ? dirtyFolders.has(recent.folderUri) : dirtyWorkspaces.has(recent.workspace.configPath);
			const windowState = isRecentFolder(recent) ? openedInWindows.get(recent.folderUri) : openedInWindows.get(recent.workspace.configPath);

			workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, environmentService, recent, { isDirty, windowState }));
		}

		// Fill any backup workspace that is not yet shown at the end
		for (const dirtyWorkspaceOrFolder of dirtyWorkspacesAndFolders) {
			if (isFolderBackupInfo(dirtyWorkspaceOrFolder) && !recentFolders.has(dirtyWorkspaceOrFolder.folderUri)) {
				workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, environmentService, dirtyWorkspaceOrFolder, { isDirty: true, windowState: undefined }));
			} else if (isWorkspaceBackupInfo(dirtyWorkspaceOrFolder) && !recentWorkspaces.has(dirtyWorkspaceOrFolder.workspace.configPath)) {
				workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, environmentService, dirtyWorkspaceOrFolder, { isDirty: true, windowState: undefined }));
			}
		}

		const filePicks = recentlyOpened.files.map(p => this.toQuickPick(modelService, languageService, labelService, environmentService, p, { isDirty: false, windowState: undefined }));

		// Focus the second entry when the first one represents the current workspace.
		const firstEntry = recentlyOpened.workspaces[0];
		const autoFocusSecondEntry: boolean = firstEntry && (
			contextService.isCurrentWorkspace(isRecentWorkspace(firstEntry) ? firstEntry.workspace : firstEntry.folderUri)
			|| (isRecentWorkspace(firstEntry) && isEqual(firstEntry.workspace.configPath, environmentService.agentSessionsWorkspace))
		);

		let keyMods: IKeyMods | undefined;

		const workspaceSeparator: IQuickPickSeparator = { type: 'separator', label: hasWorkspaces ? localize('workspacesAndFolders', "文件夹和工作区") : localize('folders', "文件夹") };
		const fileSeparator: IQuickPickSeparator = { type: 'separator', label: localize('files', "文件") };
		const picks = [workspaceSeparator, ...workspacePicks, fileSeparator, ...filePicks];

		const pick = await quickInputService.pick(picks, {
			contextKey: inRecentFilesPickerContextKey,
			activeItem: [...workspacePicks, ...filePicks][autoFocusSecondEntry ? 1 : 0],
			placeHolder: isMacintosh ? localize('openRecentPlaceholderMac', "选中以打开(按 Cmd 键强制打开新窗口，或按 Option 键打开同一窗口)") : localize('openRecentPlaceholder', "选中以打开(按 Ctrl 键强制打开新窗口，或按 Alt 键打开同一窗口)"),
			matchOnDescription: true,
			sortByLabel: false,
			onKeyMods: mods => keyMods = mods,
			quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : undefined,
			hideInput: this.isQuickNavigate(),
			onDidTriggerItemButton: async context => {

				// Remove
				if (context.button === this.removeFromRecentlyOpened || context.button === this.windowOpenedRecentlyOpenedFolder || context.button === this.windowOpenedRecentlyOpenedWorkspace) {
					await workspacesService.removeRecentlyOpened([context.item.resource]);
					context.removeItem();
				}

				// Dirty Folder/Workspace
				else if (context.button === this.dirtyRecentlyOpenedFolder || context.button === this.dirtyRecentlyOpenedWorkspace) {
					const isDirtyWorkspace = context.button === this.dirtyRecentlyOpenedWorkspace;
					const { confirmed } = await dialogService.confirm({
						title: isDirtyWorkspace ? localize('dirtyWorkspace', "包含未保存的文件的工作区") : localize('dirtyFolder', "包含未保存的文件的文件夹"),
						message: isDirtyWorkspace ? localize('dirtyWorkspaceConfirm', "是否要打开工作区以查看未保存的文件?") : localize('dirtyFolderConfirm', "是否要打开文件夹以查看未保存的文件?"),
						detail: isDirtyWorkspace ? localize('dirtyWorkspaceConfirmDetail', "在保存或还原所有未保存的文件之前，无法删除包含未保存的文件的工作区。") : localize('dirtyFolderConfirmDetail', "在保存或还原所有未保存的文件之前，无法删除包含未保存的文件的文件夹。")
					});

					if (confirmed) {
						hostService.openWindow(
							[context.item.openable], {
							remoteAuthority: context.item.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
						});
						quickInputService.cancel();
					}
				}
			}
		});

		if (pick) {
			return hostService.openWindow([pick.openable], {
				forceNewWindow: keyMods?.ctrlCmd,
				forceReuseWindow: keyMods?.alt,
				remoteAuthority: pick.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
			});
		}
	}

	private toQuickPick(modelService: IModelService, languageService: ILanguageService, labelService: ILabelService, environmentService: IWorkbenchEnvironmentService, recent: IRecent, kind: { isDirty: boolean; windowState?: { isActive: boolean } }): IRecentlyOpenedPick {
		let openable: IWindowOpenable | undefined;
		let iconClasses: string[];
		let fullLabel: string | undefined;
		let resource: URI | undefined;
		let isWorkspace = false;

		// Folder
		if (isRecentFolder(recent)) {
			resource = recent.folderUri;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FOLDER);
			openable = { folderUri: resource };
			fullLabel = recent.label || labelService.getWorkspaceLabel(resource, { verbose: Verbosity.LONG });
		}

		// Workspace
		else if (isRecentWorkspace(recent)) {
			resource = recent.workspace.configPath;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.ROOT_FOLDER);
			openable = { workspaceUri: resource };
			fullLabel = recent.label || labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
			isWorkspace = true;
		}

		// File
		else {
			resource = recent.fileUri;
			iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FILE);
			openable = { fileUri: resource };
			fullLabel = recent.label || labelService.getUriLabel(resource, { appendWorkspaceSuffix: true });
		}

		const { name, parentPath } = isRecentWorkspace(recent) && isEqual(recent.workspace.configPath, environmentService.agentSessionsWorkspace)
			? { name: fullLabel, parentPath: undefined }
			: splitRecentLabel(fullLabel);

		const buttons: IQuickInputButton[] = [];
		if (kind.isDirty) {
			buttons.push(isWorkspace ? this.dirtyRecentlyOpenedWorkspace : this.dirtyRecentlyOpenedFolder);
		} else if (kind.windowState) {
			if (kind.windowState.isActive) {
				buttons.push(isWorkspace ? this.activeWindowOpenedRecentlyOpenedWorkspace : this.activeWindowOpenedRecentlyOpenedFolder);
			} else {
				buttons.push(isWorkspace ? this.windowOpenedRecentlyOpenedWorkspace : this.windowOpenedRecentlyOpenedFolder);
			}
		} else {
			buttons.push(this.removeFromRecentlyOpened);
		}

		return {
			iconClasses,
			label: name,
			ariaLabel: kind.isDirty ? isWorkspace ? localize('recentDirtyWorkspaceAriaLabel', "{0}，包含未保存的更改的工作区", name) : localize('recentDirtyFolderAriaLabel', "{0}，包含未保存的更改的文件夹", name) : name,
			description: parentPath,
			buttons,
			openable,
			resource,
			remoteAuthority: recent.remoteAuthority
		};
	}
}

export class OpenRecentAction extends BaseOpenRecentAction {

	static ID = 'workbench.action.openRecent';

	constructor() {
		super({
			id: OpenRecentAction.ID,
			title: {
				...localize2('openRecent', "打开最近的文件…"),
				mnemonicTitle: localize({ key: 'miMore', comment: ['&& denotes a mnemonic'] }, "更多(&&M)..."),
			},
			category: Categories.File,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyR,
				mac: { primary: KeyMod.WinCtrl | KeyCode.KeyR }
			},
			menu: {
				id: MenuId.MenubarRecentMenu,
				group: 'y_more',
				order: 1
			}
		});
	}

	protected isQuickNavigate(): boolean {
		return false;
	}
}

class QuickPickRecentAction extends BaseOpenRecentAction {

	constructor() {
		super({
			id: 'workbench.action.quickOpenRecent',
			title: localize2('quickOpenRecent', '快速打开最近的文件…'),
			category: Categories.File,
			f1: false // hide quick pickers from command palette to not confuse with the other entry that shows a input field
		});
	}

	protected isQuickNavigate(): boolean {
		return true;
	}
}

export class ReloadWindowAction extends Action2 {

	static readonly ID = 'workbench.action.reloadWindow';

	constructor() {
		super({
			id: ReloadWindowAction.ID,
			title: localize2('reloadWindow', '重新加载窗口'),
			category: Categories.Developer,
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib + 50,
				when: IsDevelopmentContext,
				primary: KeyMod.CtrlCmd | KeyCode.KeyR
			}
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const hostService = accessor.get(IHostService);

		return hostService.reload();
	}
}

class ShowAboutDialogAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.showAboutDialog',
			title: {
				...localize2('about', "关于"),
				mnemonicTitle: localize({ key: 'miAbout', comment: ['&& denotes a mnemonic'] }, "关于(&&A)"),
			},
			category: Categories.Help,
			f1: true,
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: 'z_about',
				order: 1,
				when: IsMacNativeContext.toNegated()
			}
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		const dialogService = accessor.get(IDialogService);

		return dialogService.about();
	}
}

class NewWindowAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.newWindow',
			title: {
				...localize2('newWindow', "新建窗口"),
				mnemonicTitle: localize({ key: 'miNewWindow', comment: ['&& denotes a mnemonic'] }, "新建窗口(&&W)"),
			},
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: isWeb ? (isWindows ? KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.Shift | KeyCode.KeyN) : KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.KeyN) : KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN,
				secondary: isWeb ? [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyN] : undefined
			},
			menu: {
				id: MenuId.MenubarFileMenu,
				group: '1_new',
				order: 3,
			}
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		const hostService = accessor.get(IHostService);

		return hostService.openWindow({ remoteAuthority: null });
	}
}

class BlurAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.blur',
			title: localize2('blur', '从具有焦点的元素中删除键盘焦点')
		});
	}

	run(): void {
		const activeElement = getActiveElement();
		if (isHTMLElement(activeElement)) {
			activeElement.blur();
		}
	}
}

// --- Actions Registration

registerAction2(NewWindowAction);
registerAction2(QuickPickRecentAction);
registerAction2(OpenRecentAction);
registerAction2(ReloadWindowAction);
registerAction2(ShowAboutDialogAction);
registerAction2(BlurAction);

// --- Commands/Keybindings Registration

const recentFilesPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(inRecentFilesPickerContextKey));

const quickPickNavigateNextInRecentFilesPickerId = 'workbench.action.quickOpenNavigateNextInRecentFilesPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickPickNavigateNextInRecentFilesPickerId,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickPickNavigateNextInRecentFilesPickerId, true),
	when: recentFilesPickerContext,
	primary: KeyMod.CtrlCmd | KeyCode.KeyR,
	mac: { primary: KeyMod.WinCtrl | KeyCode.KeyR }
});

const quickPickNavigatePreviousInRecentFilesPicker = 'workbench.action.quickOpenNavigatePreviousInRecentFilesPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: quickPickNavigatePreviousInRecentFilesPicker,
	weight: KeybindingWeight.WorkbenchContrib + 50,
	handler: getQuickNavigateHandler(quickPickNavigatePreviousInRecentFilesPicker, false),
	when: recentFilesPickerContext,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
	mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyR }
});

CommandsRegistry.registerCommand('workbench.action.toggleConfirmBeforeClose', accessor => {
	const configurationService = accessor.get(IConfigurationService);
	const setting = configurationService.inspect<'always' | 'keyboardOnly' | 'never'>('window.confirmBeforeClose').userValue;

	return configurationService.updateValue('window.confirmBeforeClose', setting === 'never' ? 'keyboardOnly' : 'never');
});

// --- Menu Registration

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	group: 'z_ConfirmClose',
	command: {
		id: 'workbench.action.toggleConfirmBeforeClose',
		title: localize('miConfirmClose', "关闭前确认"),
		toggled: ContextKeyExpr.notEquals('config.window.confirmBeforeClose', 'never')
	},
	order: 1,
	when: IsWebContext
});

MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	title: localize({ key: 'miOpenRecent', comment: ['&& denotes a mnemonic'] }, "打开最近的文件(&&R)"),
	submenu: MenuId.MenubarRecentMenu,
	group: '2_open',
	order: 4,
});
