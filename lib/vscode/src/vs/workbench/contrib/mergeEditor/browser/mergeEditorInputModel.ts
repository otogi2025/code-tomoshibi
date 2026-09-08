/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { assertFn } from '../../../../base/common/assert.js';
import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore, IDisposable, IReference } from '../../../../base/common/lifecycle.js';
import { derived, IObservable, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import Severity from '../../../../base/common/severity.js';
import { URI } from '../../../../base/common/uri.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { ConfirmResult, IDialogService, IPromptButton } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IRevertOptions, SaveSourceRegistry } from '../../../common/editor.js';
import { EditorModel } from '../../../common/editor/editorModel.js';
import { MergeEditorInputData } from './mergeEditorInput.js';
import { conflictMarkers } from './mergeMarkers/mergeMarkersController.js';
import { MergeDiffComputer } from './model/diffComputer.js';
import { InputData, MergeEditorModel } from './model/mergeEditorModel.js';
import { MergeEditorTelemetry } from './telemetry.js';
import { StorageCloseWithConflicts } from '../common/mergeEditor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITextFileEditorModel, ITextFileSaveOptions, ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';

export interface MergeEditorArgs {
	base: URI;
	input1: MergeEditorInputData;
	input2: MergeEditorInputData;
	result: URI;
}

export interface IMergeEditorInputModelFactory {
	createInputModel(args: MergeEditorArgs): Promise<IMergeEditorInputModel>;
}

export interface IMergeEditorInputModel extends IDisposable {
	readonly resultUri: URI;

	readonly model: MergeEditorModel;
	readonly isDirty: IObservable<boolean>;

	save(options?: ITextFileSaveOptions): Promise<void>;

	/**
	 * If save resets the dirty state, revert must do so too.
	*/
	revert(options?: IRevertOptions): Promise<void>;

	shouldConfirmClose(): boolean;

	confirmClose(inputModels: IMergeEditorInputModel[]): Promise<ConfirmResult>;

	/**
	 * Marks the merge as done. The merge editor must be closed afterwards.
	*/
	accept(): Promise<void>;
}

/* ================ Temp File ================ */

export class TempFileMergeEditorModeFactory implements IMergeEditorInputModelFactory {
	constructor(
		private readonly _mergeEditorTelemetry: MergeEditorTelemetry,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@IModelService private readonly _modelService: IModelService,
	) {
	}

	async createInputModel(args: MergeEditorArgs): Promise<IMergeEditorInputModel> {
		const store = new DisposableStore();

		const [
			base,
			result,
			input1Data,
			input2Data,
		] = await Promise.all([
			this._textModelService.createModelReference(args.base),
			this._textModelService.createModelReference(args.result),
			toInputData(args.input1, this._textModelService, store),
			toInputData(args.input2, this._textModelService, store),
		]);

		store.add(base);
		store.add(result);

		const tempResultUri = result.object.textEditorModel.uri.with({ scheme: 'merge-result' });

		const temporaryResultModel = this._modelService.createModel(
			'',
			{
				languageId: result.object.textEditorModel.getLanguageId(),
				onDidChange: Event.None,
			},
			tempResultUri,
		);
		store.add(temporaryResultModel);

		const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);
		const model = this._instantiationService.createInstance(
			MergeEditorModel,
			base.object.textEditorModel,
			input1Data,
			input2Data,
			temporaryResultModel,
			mergeDiffComputer,
			{
				resetResult: true,
			},
			this._mergeEditorTelemetry,
		);
		store.add(model);

		await model.onInitialized;

		return this._instantiationService.createInstance(TempFileMergeEditorInputModel, model, store, result.object, args.result);
	}
}

class TempFileMergeEditorInputModel extends EditorModel implements IMergeEditorInputModel {
	private readonly savedAltVersionId;
	private readonly altVersionId;

	public readonly isDirty;

	private finished;

	constructor(
		public readonly model: MergeEditorModel,
		private readonly disposable: IDisposable,
		private readonly result: IResolvedTextEditorModel,
		public readonly resultUri: URI,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IDialogService private readonly dialogService: IDialogService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this.savedAltVersionId = observableValue(this, this.model.resultTextModel.getAlternativeVersionId());
		this.altVersionId = observableFromEvent(this,
			e => this.model.resultTextModel.onDidChangeContent(e),
			() => /** @description getAlternativeVersionId */ this.model.resultTextModel.getAlternativeVersionId()
		);
		this.isDirty = derived(this, (reader) => this.altVersionId.read(reader) !== this.savedAltVersionId.read(reader));
		this.finished = false;
	}

	override dispose(): void {
		this.disposable.dispose();
		super.dispose();
	}

	async accept(): Promise<void> {
		const value = await this.model.resultTextModel.getValue();
		this.result.textEditorModel.setValue(value);
		this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), undefined);
		await this.textFileService.save(this.result.textEditorModel.uri);
		this.finished = true;
	}

	private async _discard(): Promise<void> {
		await this.textFileService.revert(this.model.resultTextModel.uri);
		this.savedAltVersionId.set(this.model.resultTextModel.getAlternativeVersionId(), undefined);
		this.finished = true;
	}

	public shouldConfirmClose(): boolean {
		return true;
	}

	public async confirmClose(inputModels: TempFileMergeEditorInputModel[]): Promise<ConfirmResult> {
		assertFn(
			() => inputModels.some((m) => m === this)
		);

		const someDirty = inputModels.some((m) => m.isDirty.get());
		let choice: ConfirmResult;
		if (someDirty) {
			const isMany = inputModels.length > 1;

			const message = isMany
				? localize('messageN', '是否要保留 {0} 个文件的合并结果?', inputModels.length)
				: localize('message1', '是否要保留 {0} 的合并结果?', basename(inputModels[0].model.resultTextModel.uri));

			const hasUnhandledConflicts = inputModels.some((m) => m.model.hasUnhandledConflicts.get());

			const buttons: IPromptButton<ConfirmResult>[] = [
				{
					label: hasUnhandledConflicts ?
						localize({ key: 'saveWithConflict', comment: ['&& denotes a mnemonic'] }, "保存(存在冲突)(&&S)") :
						localize({ key: 'save', comment: ['&& denotes a mnemonic'] }, "保存(&&S)"),
					run: () => ConfirmResult.SAVE
				},
				{
					label: localize({ key: 'discard', comment: ['&& denotes a mnemonic'] }, "不保存(&&N)"),
					run: () => ConfirmResult.DONT_SAVE
				}
			];

			choice = (await this.dialogService.prompt<ConfirmResult>({
				type: Severity.Info,
				message,
				detail:
					hasUnhandledConflicts
						? isMany
							? localize('detailNConflicts', "文件包含未处理的冲突。如果不保存合并结果，合并结果将丢失。")
							: localize('detail1Conflicts', "该文件包含未处理的冲突。如果不保存合并结果，合并结果将丢失。")
						: isMany
							? localize('detailN', "如果不保存合并结果，合并结果将丢失。")
							: localize('detail1', "如果不保存合并结果，合并结果将丢失。"),
				buttons,
				cancelButton: {
					run: () => ConfirmResult.CANCEL
				}
			})).result;
		} else {
			choice = ConfirmResult.DONT_SAVE;
		}

		if (choice === ConfirmResult.SAVE) {
			// save with conflicts
			await Promise.all(inputModels.map(m => m.accept()));
		} else if (choice === ConfirmResult.DONT_SAVE) {
			// discard changes
			await Promise.all(inputModels.map(m => m._discard()));
		} else {
			// cancel: stay in editor
		}
		return choice;
	}

	public async save(options?: ITextFileSaveOptions): Promise<void> {
		if (this.finished) {
			return;
		}
		// It does not make sense to save anything in the temp file mode.
		// The file stays dirty from the first edit on.

		(async () => {
			const { confirmed } = await this.dialogService.confirm({
				message: localize(
					'saveTempFile.message',
					"是否接受合并结果?"
				),
				detail: localize(
					'saveTempFile.detail',
					"这会将合并结果写入原始文件并关闭合并编辑器。"
				),
				primaryButton: localize({ key: 'acceptMerge', comment: ['&& denotes a mnemonic'] }, '接受合并(&&A)')
			});

			if (confirmed) {
				await this.accept();
				const editors = this.editorService.findEditors(this.resultUri).filter(e => e.editor.typeId === 'mergeEditor.Input');
				await this.editorService.closeEditors(editors);
			}
		})();
	}

	public async revert(options?: IRevertOptions): Promise<void> {
		// no op
	}
}

/* ================ Workspace ================ */

export class WorkspaceMergeEditorModeFactory implements IMergeEditorInputModelFactory {
	constructor(
		private readonly _mergeEditorTelemetry: MergeEditorTelemetry,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
	) {
	}

	private static readonly FILE_SAVED_SOURCE = SaveSourceRegistry.registerSource('merge-editor.source', localize('merge-editor.source', "在合并编辑器中解决冲突之前"));

	public async createInputModel(args: MergeEditorArgs): Promise<IMergeEditorInputModel> {
		const store = new DisposableStore();

		let [
			base,
			result,
			input1Data,
			input2Data,
		] = await Promise.all([
			this._textModelService.createModelReference(args.base).then<IReference<ITextModel>>(v => ({
				object: v.object.textEditorModel,
				dispose: () => v.dispose(),
			})).catch(e => {
				onUnexpectedError(e);
				console.error(e); // Only file not found error should be handled ideally
				return undefined;
			}),
			this._textModelService.createModelReference(args.result),
			toInputData(args.input1, this._textModelService, store),
			toInputData(args.input2, this._textModelService, store),
		]);

		if (base === undefined) {
			const tm = this._modelService.createModel('', this._languageService.createById(result.object.getLanguageId()));
			base = {
				dispose: () => { tm.dispose(); },
				object: tm
			};
		}

		store.add(base);
		store.add(result);

		const resultTextFileModel = this.textFileService.files.models.find(m =>
			m.resource.toString() === result.object.textEditorModel.uri.toString()
		);
		if (!resultTextFileModel) {
			throw new BugIndicatingError();
		}
		// So that "Don't save" does revert the file
		await resultTextFileModel.save({ source: WorkspaceMergeEditorModeFactory.FILE_SAVED_SOURCE });

		const lines = resultTextFileModel.textEditorModel!.getLinesContent();
		const hasConflictMarkers = lines.some(l => l.startsWith(conflictMarkers.start));
		const resetResult = hasConflictMarkers;

		const mergeDiffComputer = this._instantiationService.createInstance(MergeDiffComputer);

		const model = this._instantiationService.createInstance(
			MergeEditorModel,
			base.object,
			input1Data,
			input2Data,
			result.object.textEditorModel,
			mergeDiffComputer,
			{
				resetResult
			},
			this._mergeEditorTelemetry,
		);
		store.add(model);

		await model.onInitialized;

		return this._instantiationService.createInstance(WorkspaceMergeEditorInputModel, model, store, resultTextFileModel, this._mergeEditorTelemetry);
	}
}

class WorkspaceMergeEditorInputModel extends EditorModel implements IMergeEditorInputModel {
	public readonly isDirty;

	private reported;
	private readonly dateTimeOpened;

	constructor(
		public readonly model: MergeEditorModel,
		private readonly disposableStore: DisposableStore,
		private readonly resultTextFileModel: ITextFileEditorModel,
		private readonly telemetry: MergeEditorTelemetry,
		@IDialogService private readonly _dialogService: IDialogService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this.isDirty = observableFromEvent(this,
			Event.any(this.resultTextFileModel.onDidChangeDirty, this.resultTextFileModel.onDidSaveError),
			() => /** @description isDirty */ this.resultTextFileModel.isDirty()
		);
		this.reported = false;
		this.dateTimeOpened = new Date();
	}

	public override dispose(): void {
		this.disposableStore.dispose();
		super.dispose();

		this.reportClose(false);
	}

	private reportClose(accepted: boolean): void {
		if (!this.reported) {
			const remainingConflictCount = this.model.unhandledConflictsCount.get();
			const durationOpenedMs = new Date().getTime() - this.dateTimeOpened.getTime();
			this.telemetry.reportMergeEditorClosed({
				durationOpenedSecs: durationOpenedMs / 1000,
				remainingConflictCount,
				accepted,

				conflictCount: this.model.conflictCount,
				combinableConflictCount: this.model.combinableConflictCount,

				conflictsResolvedWithBase: this.model.conflictsResolvedWithBase,
				conflictsResolvedWithInput1: this.model.conflictsResolvedWithInput1,
				conflictsResolvedWithInput2: this.model.conflictsResolvedWithInput2,
				conflictsResolvedWithSmartCombination: this.model.conflictsResolvedWithSmartCombination,

				manuallySolvedConflictCountThatEqualNone: this.model.manuallySolvedConflictCountThatEqualNone,
				manuallySolvedConflictCountThatEqualSmartCombine: this.model.manuallySolvedConflictCountThatEqualSmartCombine,
				manuallySolvedConflictCountThatEqualInput1: this.model.manuallySolvedConflictCountThatEqualInput1,
				manuallySolvedConflictCountThatEqualInput2: this.model.manuallySolvedConflictCountThatEqualInput2,

				manuallySolvedConflictCountThatEqualNoneAndStartedWithBase: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBase,
				manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput1,
				manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithInput2,
				manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothNonSmart,
				manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart: this.model.manuallySolvedConflictCountThatEqualNoneAndStartedWithBothSmart,
			});
			this.reported = true;
		}
	}

	public async accept(): Promise<void> {
		this.reportClose(true);
		await this.resultTextFileModel.save();
	}

	get resultUri(): URI {
		return this.resultTextFileModel.resource;
	}

	async save(options?: ITextFileSaveOptions): Promise<void> {
		await this.resultTextFileModel.save(options);
	}

	/**
	 * If save resets the dirty state, revert must do so too.
	*/
	async revert(options?: IRevertOptions): Promise<void> {
		await this.resultTextFileModel.revert(options);
	}

	shouldConfirmClose(): boolean {
		// Always confirm
		return true;
	}

	async confirmClose(inputModels: IMergeEditorInputModel[]): Promise<ConfirmResult> {
		const isMany = inputModels.length > 1;
		const someDirty = inputModels.some(m => m.isDirty.get());
		const someUnhandledConflicts = inputModels.some(m => m.model.hasUnhandledConflicts.get());
		if (someDirty) {
			const message = isMany
				? localize('workspace.messageN', '是否要保存对 {0} 文件所做的更改?', inputModels.length)
				: localize('workspace.message1', '是否要保存对 {0} 的更改?', basename(inputModels[0].resultUri));
			const { result } = await this._dialogService.prompt<ConfirmResult>({
				type: Severity.Info,
				message,
				detail:
					someUnhandledConflicts ?
						isMany
							? localize('workspace.detailN.unhandled', "文件包含未经处理的冲突。如果不保存更改，则更改将丢失。")
							: localize('workspace.detail1.unhandled', "文件包含未处理的冲突。如果不保存更改，则更改将丢失。")
						: isMany
							? localize('workspace.detailN.handled', "如果不保存，你的更改将丢失。")
							: localize('workspace.detail1.handled', "如果不保存，你的更改将丢失。"),
				buttons: [
					{
						label: someUnhandledConflicts
							? localize({ key: 'workspace.saveWithConflict', comment: ['&& denotes a mnemonic'] }, '保存(存在冲突)(&&S)')
							: localize({ key: 'workspace.save', comment: ['&& denotes a mnemonic'] }, '保存(&&S)'),
						run: () => ConfirmResult.SAVE
					},
					{
						label: localize({ key: 'workspace.doNotSave', comment: ['&& denotes a mnemonic'] }, "不保存(&&N)"),
						run: () => ConfirmResult.DONT_SAVE
					}
				],
				cancelButton: {
					run: () => ConfirmResult.CANCEL
				}
			});
			return result;

		} else if (someUnhandledConflicts && !this._storageService.getBoolean(StorageCloseWithConflicts, StorageScope.PROFILE, false)) {
			const { confirmed, checkboxChecked } = await this._dialogService.confirm({
				message: isMany
					? localize('workspace.messageN.nonDirty', '是否要关闭 {0} 个合并编辑器?', inputModels.length)
					: localize('workspace.message1.nonDirty', '是否要关闭 {0} 的合并编辑器?', basename(inputModels[0].resultUri)),
				detail: someUnhandledConflicts ?
					isMany
						? localize('workspace.detailN.unhandled.nonDirty', "文件包含未经处理的冲突。")
						: localize('workspace.detail1.unhandled.nonDirty', "文件包含未经处理的冲突。")
					: undefined,
				primaryButton: someUnhandledConflicts
					? localize({ key: 'workspace.closeWithConflicts', comment: ['&& denotes a mnemonic'] }, '关闭(存在冲突)(&&C)')
					: localize({ key: 'workspace.close', comment: ['&& denotes a mnemonic'] }, '关闭(&&C)'),
				checkbox: { label: localize('noMoreWarn', "不再询问") }
			});

			if (checkboxChecked) {
				this._storageService.store(StorageCloseWithConflicts, true, StorageScope.PROFILE, StorageTarget.USER);
			}

			return confirmed ? ConfirmResult.SAVE : ConfirmResult.CANCEL;
		} else {
			// This shouldn't do anything
			return ConfirmResult.SAVE;
		}
	}
}

/* ================= Utils ================== */

async function toInputData(data: MergeEditorInputData, textModelService: ITextModelService, store: DisposableStore): Promise<InputData> {
	const ref = await textModelService.createModelReference(data.uri);
	store.add(ref);
	return {
		textModel: ref.object.textEditorModel,
		title: data.title,
		description: data.description,
		detail: data.detail,
	};
}
