/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { createHotClass } from '../../../../base/common/hotReloadHelpers.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorunWithStore, constObservable, debouncedObservable, derived, observableFromEvent } from '../../../../base/common/observable.js';
import Severity from '../../../../base/common/severity.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { InlineCompletionsController } from '../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ILanguageStatusService } from '../../../services/languageStatus/common/languageStatusService.js';

export class InlineCompletionLanguageStatusBarContribution extends Disposable implements IWorkbenchContribution {
	public static readonly hot = createHotClass(this);

	public static Id = 'vs.contrib.inlineCompletionLanguageStatusBarContribution';
	public static readonly languageStatusBarDisposables = new Set<DisposableStore>();

	private _activeEditor;
	private _state;
	private _sentiment;

	constructor(
		@ILanguageStatusService private readonly _languageStatusService: ILanguageStatusService,
		@IEditorService private readonly _editorService: IEditorService,
	) {
		super();


		this._activeEditor = observableFromEvent(this, _editorService.onDidActiveEditorChange, () => this._editorService.activeTextEditorControl);
		this._sentiment = constObservable({ hidden: false });
		this._state = derived(this, reader => {
			const editor = this._activeEditor.read(reader);
			if (!editor || !isCodeEditor(editor)) {
				return undefined;
			}

			const c = InlineCompletionsController.get(editor);
			const model = c?.model.read(reader);
			if (!model) {
				return undefined;
			}

			return {
				model,
				status: debouncedObservable(model.status, 300),
			};
		});

		this._register(autorunWithStore((reader, store) => {
			// Do not show the Copilot icon in the language status when AI features are disabled
			const sentiment = this._sentiment.read(reader);
			if (sentiment.hidden) {
				return;
			}

			const state = this._state.read(reader);
			if (!state) {
				return;
			}

			const status = state.status.read(reader);

			const statusMap: Record<typeof status, { shortLabel: string; label: string; loading: boolean }> = {
				loading: { shortLabel: '', label: localize('inlineSuggestionLoading', "正在加载..."), loading: true, },
				ghostText: { shortLabel: '$(lightbulb)', label: '$(copilot) ' + localize('inlineCompletionAvailable', "内联完成可用"), loading: false, },
				inlineEdit: { shortLabel: '$(lightbulb-sparkle)', label: '$(copilot) ' + localize('inlineEditAvailable', "内联编辑可用"), loading: false, },
				noSuggestion: { shortLabel: '$(circle-slash)', label: '$(copilot) ' + localize('noInlineSuggestionAvailable', "无内联建议可用"), loading: false, },
			};

			store.add(this._languageStatusService.addStatus({
				accessibilityInfo: undefined,
				busy: statusMap[status].loading,
				command: undefined,
				detail: localize('inlineSuggestionsSmall', "内联建议"),
				id: 'inlineSuggestions',
				label: { value: statusMap[status].label, shortValue: statusMap[status].shortLabel },
				name: localize('inlineSuggestions', "内联建议"),
				selector: { pattern: state.model.textModel.uri.fsPath },
				severity: Severity.Info,
				source: 'inlineSuggestions',
			}));
		}));
	}
}
