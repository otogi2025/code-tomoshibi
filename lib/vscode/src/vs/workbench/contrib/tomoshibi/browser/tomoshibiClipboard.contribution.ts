/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { registerWorkbenchContribution2, type IWorkbenchContribution, WorkbenchPhase } from '../../../common/contributions.js';
import { ITomoshibiClipboardHistoryService } from '../../../services/clipboard/common/tomoshibiClipboardHistory.js';
import { tomoshibiClipboardIcon, tomoshibiNoteIcon } from './tomoshibiIcons.js';
import { TomoshibiClipboardView } from './tomoshibiClipboardView.js';
import { TomoshibiNoteView } from './tomoshibiNoteView.js';

// Side effect imports: the insert command and the notes singleton have no exported symbol this
// file needs, but both have to be registered for the two views to work.
import './tomoshibiInsertText.js';
import './tomoshibiNoteService.js';

import './media/tomoshibiClipboard.css';

/**
 * The two activity bar entries of requirement 7-1.
 *
 * They are real sidebar view containers rather than hand drawn buttons, so collapsing the
 * sidebar by tapping the selected icon, remembering which one was open across reloads and the
 * pane header all come from the workbench for free. `activitybarPart.ts` has to list their ids
 * in its filter, otherwise the pared down activity bar would hide them.
 *
 * The three settings they read (`tomoshibi.clipboard.history.enabled`,
 * `tomoshibi.clipboard.history.limit`, `tomoshibi.notes.syncToServer`) are registered by the
 * settings page contribution, not here; the services read them with a literal default so the
 * order the two contributions load in does not matter.
 */

const CLIPBOARD_VIEW_CONTAINER_ID = 'workbench.view.tomoshibiClipboard';
const NOTE_VIEW_CONTAINER_ID = 'workbench.view.tomoshibiNote';

const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

const clipboardViewContainer = viewContainersRegistry.registerViewContainer({
	id: CLIPBOARD_VIEW_CONTAINER_ID,
	title: localize2('tomoshibi.clipboard.container', "剪贴板历史"),
	// mergeViewWithContainerWhenSingleView false keeps the pane header row, which is where the
	// entry count and the "this device only" note are printed.
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [CLIPBOARD_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: false }]),
	icon: tomoshibiClipboardIcon,
	order: 2,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

const noteViewContainer = viewContainersRegistry.registerViewContainer({
	id: NOTE_VIEW_CONTAINER_ID,
	title: localize2('tomoshibi.note.container', "临时便签"),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [NOTE_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: false }]),
	icon: tomoshibiNoteIcon,
	order: 3,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });

const clipboardViewDescriptor: IViewDescriptor = {
	id: TomoshibiClipboardView.ID,
	name: localize2('tomoshibi.clipboard.view', "剪贴板历史"),
	containerIcon: tomoshibiClipboardIcon,
	ctorDescriptor: new SyncDescriptor(TomoshibiClipboardView),
	canToggleVisibility: false,
	canMoveView: false,
};

const noteViewDescriptor: IViewDescriptor = {
	id: TomoshibiNoteView.ID,
	name: localize2('tomoshibi.note.view', "临时便签"),
	containerIcon: tomoshibiNoteIcon,
	ctorDescriptor: new SyncDescriptor(TomoshibiNoteView),
	canToggleVisibility: false,
	canMoveView: false,
};

viewsRegistry.registerViews([clipboardViewDescriptor], clipboardViewContainer);
viewsRegistry.registerViews([noteViewDescriptor], noteViewContainer);

/**
 * The history service is a delayed singleton, so on its own nothing would instantiate it (and
 * attach the per-window copy/cut listeners) before the sidebar view is first opened. Touching
 * it once the workbench is restored makes the iPad's native long-press "Copy" land in the
 * history from the first tap, without putting the service on the startup critical path.
 */
class TomoshibiClipboardHistoryStarter implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.tomoshibiClipboardHistoryStarter';

	constructor(@ITomoshibiClipboardHistoryService public readonly clipboardHistoryService: ITomoshibiClipboardHistoryService) { }
}

registerWorkbenchContribution2(TomoshibiClipboardHistoryStarter.ID, TomoshibiClipboardHistoryStarter, WorkbenchPhase.AfterRestored);
