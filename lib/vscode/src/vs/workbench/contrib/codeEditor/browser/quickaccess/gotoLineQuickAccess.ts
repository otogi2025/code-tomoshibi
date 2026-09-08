/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Event } from '../../../../../base/common/event.js';
import { localize, localize2 } from '../../../../../nls.js';
import { IKeyMods, IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { IRange } from '../../../../../editor/common/core/range.js';
import { AbstractGotoLineQuickAccessProvider } from '../../../../../editor/contrib/quickAccess/browser/gotoLineQuickAccess.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from '../../../../../platform/quickinput/common/quickAccess.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IWorkbenchEditorConfiguration } from '../../../../common/editor.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickAccessTextEditorContext } from '../../../../../editor/contrib/quickAccess/browser/editorNavigationQuickAccess.js';
import { ITextEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';

export class GotoLineQuickAccessProvider extends AbstractGotoLineQuickAccessProvider {

	protected readonly onDidActiveTextEditorControlChange: Event<void>;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService protected override readonly storageService: IStorageService
	) {
		super();
		this.onDidActiveTextEditorControlChange = this.editorService.onDidActiveEditorChange;
	}

	private get configuration() {
		const editorConfig = this.configurationService.getValue<IWorkbenchEditorConfiguration>().workbench?.editor;

		return {
			openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview
		};
	}

	protected get activeTextEditorControl() {
		return this.editorService.activeTextEditorControl;
	}

	protected override gotoLocation(context: IQuickAccessTextEditorContext, options: { range: IRange; keyMods: IKeyMods; forceSideBySide?: boolean; preserveFocus?: boolean }): void {

		// Check for sideBySide use
		if ((options.keyMods.alt || (this.configuration.openEditorPinned && options.keyMods.ctrlCmd) || options.forceSideBySide) && this.editorService.activeEditor) {
			context.restoreViewState?.(); // since we open to the side, restore view state in this editor

			const editorOptions: ITextEditorOptions = {
				selection: options.range,
				pinned: options.keyMods.ctrlCmd || this.configuration.openEditorPinned,
				preserveFocus: options.preserveFocus
			};

			this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP);
		}

		// Otherwise let parent handle it
		else {
			super.gotoLocation(context, options);
		}
	}
}

class GotoLineAction extends Action2 {

	static readonly ID = 'workbench.action.gotoLine';

	constructor() {
		super({
			id: GotoLineAction.ID,
			title: localize2('gotoLine', '转到行/列...'),
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: null,
				primary: KeyMod.CtrlCmd | KeyCode.KeyG,
				mac: { primary: KeyMod.WinCtrl | KeyCode.KeyG }
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_LINE_PREFIX);
	}
}

registerAction2(GotoLineAction);

Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
	ctor: GotoLineQuickAccessProvider,
	prefix: AbstractGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX,
	placeholder: localize('gotoLineQuickAccessPlaceholder', "键入要转到的行号和可选列(例如，42:5 表示第 42 行和第 5 列)。输入 :: 可跳转到字符偏移位置(例如，::1024 表示从文件开头起第 1024 个字符)。使用负值可向后导航。"),
	helpEntries: [{ description: localize('gotoLineQuickAccess', "转到行/列"), commandId: GotoLineAction.ID }]
});

class GotoOffsetAction extends Action2 {

	static readonly ID = 'workbench.action.gotoOffset';

	constructor() {
		super({
			id: GotoOffsetAction.ID,
			title: localize2('gotoOffset', '转到偏移...'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX);
	}
}

registerAction2(GotoOffsetAction);

Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
	ctor: GotoLineQuickAccessProvider,
	prefix: GotoLineQuickAccessProvider.GO_TO_OFFSET_PREFIX,
	placeholder: localize('gotoLineQuickAccessPlaceholder', "键入要转到的行号和可选列(例如，42:5 表示第 42 行和第 5 列)。输入 :: 可跳转到字符偏移位置(例如，::1024 表示从文件开头起第 1024 个字符)。使用负值可向后导航。"),
	helpEntries: [{ description: localize('gotoOffsetQuickAccess', "转到偏移"), commandId: GotoOffsetAction.ID }]
});
