/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { extname, basename } from '../../../../base/common/resources.js';
import { areFunctions } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { Language } from '../../../../base/common/platform.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { IFileEditorInput, EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EndOfLineSequence } from '../../../../editor/common/model.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService, FILES_ASSOCIATIONS_CONFIG } from '../../../../platform/files/common/files.js';
import { ILanguageService, ILanguageSelection } from '../../../../editor/common/languages/language.js';
import { EncodingMode, IEncodingSupport, ILanguageSupport, ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { SUPPORTED_ENCODINGS } from '../../../services/textfile/common/encoding.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { deepClone } from '../../../../base/common/objects.js';
import { getCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { Schemas } from '../../../../base/common/network.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from '../../../../platform/quickinput/common/quickInput.js';
import { getIconClassesForLanguageId } from '../../../../editor/common/services/getIconClasses.js';
import { Promises, timeout } from '../../../../base/common/async.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { SideBySideEditorInput } from '../../../common/editor/sideBySideEditorInput.js';
import { AutomaticLanguageDetectionLikelyWrongClassification, AutomaticLanguageDetectionLikelyWrongId, IAutomaticLanguageDetectionLikelyWrongData, ILanguageDetectionService } from '../../../services/languageDetection/common/languageDetectionWorkerService.js';
import { Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyChord, KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';

class SideBySideEditorEncodingSupport implements IEncodingSupport {
	constructor(private primary: IEncodingSupport, private secondary: IEncodingSupport) { }

	getEncoding(): string | undefined {
		return this.primary.getEncoding(); // always report from modified (right hand) side
	}

	async setEncoding(encoding: string, mode: EncodingMode): Promise<void> {
		await Promises.settled([this.primary, this.secondary].map(editor => editor.setEncoding(encoding, mode)));
	}
}

class SideBySideEditorLanguageSupport implements ILanguageSupport {

	constructor(private primary: ILanguageSupport, private secondary: ILanguageSupport) { }

	setLanguageId(languageId: string, source?: string): void {
		[this.primary, this.secondary].forEach(editor => editor.setLanguageId(languageId, source));
	}
}

function toEditorWithEncodingSupport(input: EditorInput): IEncodingSupport | null {

	// Untitled Text Editor
	if (input instanceof UntitledTextEditorInput) {
		return input;
	}

	// Side by Side (diff) Editor
	if (input instanceof SideBySideEditorInput) {
		const primaryEncodingSupport = toEditorWithEncodingSupport(input.primary);
		const secondaryEncodingSupport = toEditorWithEncodingSupport(input.secondary);

		if (primaryEncodingSupport && secondaryEncodingSupport) {
			return new SideBySideEditorEncodingSupport(primaryEncodingSupport, secondaryEncodingSupport);
		}

		return primaryEncodingSupport;
	}

	// File or Resource Editor
	const encodingSupport = input as IFileEditorInput;
	if (areFunctions(encodingSupport.setEncoding, encodingSupport.getEncoding)) {
		return encodingSupport;
	}

	// Unsupported for any other editor
	return null;
}

function toEditorWithLanguageSupport(input: EditorInput): ILanguageSupport | null {

	// Untitled Text Editor
	if (input instanceof UntitledTextEditorInput) {
		return input;
	}

	// Side by Side (diff) Editor
	if (input instanceof SideBySideEditorInput) {
		const primaryLanguageSupport = toEditorWithLanguageSupport(input.primary);
		const secondaryLanguageSupport = toEditorWithLanguageSupport(input.secondary);

		if (primaryLanguageSupport && secondaryLanguageSupport) {
			return new SideBySideEditorLanguageSupport(primaryLanguageSupport, secondaryLanguageSupport);
		}

		return primaryLanguageSupport;
	}

	// File or Resource Editor
	const languageSupport = input as IFileEditorInput;
	if (typeof languageSupport.setLanguageId === 'function') {
		return languageSupport;
	}

	// Unsupported for any other editor
	return null;
}

const nlsEOLLF = localize('endOfLineLineFeed', "LF");
const nlsEOLCRLF = localize('endOfLineCarriageReturnLineFeed', "CRLF");

export class ChangeLanguageAction extends Action2 {

	static readonly ID = 'workbench.action.editor.changeLanguageMode';

	constructor() {
		super({
			id: ChangeLanguageAction.ID,
			title: localize2('changeMode', '更改语言模式'),
			f1: true,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyM)
			},
			metadata: {
				description: localize('changeLanguageMode.description', "更改活动文本编辑器的语言模式。"),
				args: [
					{
						name: localize('changeLanguageMode.arg.name', "要更改到的语言模式名称。"),
						constraint: (value: unknown) => typeof value === 'string',
					}
				]
			}
		});
	}

	override async run(accessor: ServicesAccessor, languageMode?: string): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const editorService = accessor.get(IEditorService);
		const languageService = accessor.get(ILanguageService);
		const languageDetectionService = accessor.get(ILanguageDetectionService);
		const textFileService = accessor.get(ITextFileService);
		const preferencesService = accessor.get(IPreferencesService);
		const configurationService = accessor.get(IConfigurationService);
		const telemetryService = accessor.get(ITelemetryService);

		const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
		if (!activeTextEditorControl) {
			await quickInputService.pick([{ label: localize('noEditor', "当前没有活动的文本编辑器") }]);
			return;
		}

		const textModel = activeTextEditorControl.getModel();
		const resource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });

		// Compute language
		let currentLanguageName: string | undefined;
		let currentLanguageId: string | undefined;
		if (textModel) {
			currentLanguageId = textModel.getLanguageId();
			currentLanguageName = languageService.getLanguageName(currentLanguageId) ?? undefined;
		}

		let hasLanguageSupport = !!resource;
		if (resource?.scheme === Schemas.untitled && !textFileService.untitled.get(resource)?.hasAssociatedFilePath) {
			hasLanguageSupport = false; // no configuration for untitled resources (e.g. "Untitled-1")
		}

		// All languages are valid picks
		const languages = languageService.getSortedRegisteredLanguageNames();
		const picks: QuickPickInput[] = languages
			.map(({ languageName, languageId }) => {
				const extensions = languageService.getExtensions(languageId).join(' ');
				let description: string;
				if (currentLanguageName === languageName) {
					description = localize('languageDescription', "({0}) - 已配置语言", languageId);
				} else {
					description = localize('languageDescriptionConfigured', "({0})", languageId);
				}

				return {
					id: languageId,
					label: languageName,
					meta: extensions,
					iconClasses: getIconClassesForLanguageId(languageId),
					description
				};
			});

		picks.unshift({ type: 'separator', label: localize('languagesPicks', "语言（标识符）") });

		// Offer action to configure via settings
		let configureLanguageAssociations: IQuickPickItem | undefined;
		let configureLanguageSettings: IQuickPickItem | undefined;
		if (hasLanguageSupport && resource) {
			// Code-Tomoshibi: the marketplace UI is gone, so the "search the marketplace for '.ext'
			// extensions" pick was dropped - there is nowhere for it to open.
			const ext = extname(resource) || basename(resource);

			configureLanguageSettings = { label: localize('configureModeSettings', "配置基于 '{0}' 语言的设置…", currentLanguageName) };
			picks.unshift(configureLanguageSettings);
			configureLanguageAssociations = { label: localize('configureAssociationsExt', "配置 '{0}' 的文件关联…", ext) };
			picks.unshift(configureLanguageAssociations);
		}

		// Offer to "Auto Detect", but only if the document is not empty.
		const autoDetectLanguage: IQuickPickItem = { label: localize('autoDetect', "自动检测") };
		if (textModel && textModel.getValueLength() > 0) {
			picks.unshift(autoDetectLanguage);
		}

		const pick = typeof languageMode === 'string' ? { label: languageMode } : await quickInputService.pick(picks, { placeHolder: localize('pickLanguage', "选择语言模式"), matchOnDescription: true });
		if (!pick) {
			return;
		}

		// User decided to permanently configure associations, return right after
		if (pick === configureLanguageAssociations) {
			if (resource) {
				this.configureFileAssociation(resource, languageService, quickInputService, configurationService);
			}
			return;
		}

		// User decided to configure settings for current language
		if (pick === configureLanguageSettings) {
			preferencesService.openUserSettings({ jsonEditor: true, revealSetting: { key: `[${currentLanguageId ?? null}]`, edit: true } });
			return;
		}

		// Change language for active editor
		const activeEditor = editorService.activeEditor;
		if (activeEditor) {
			const languageSupport = toEditorWithLanguageSupport(activeEditor);
			if (languageSupport) {

				// Find language
				let languageSelection: ILanguageSelection | undefined;
				let detectedLanguage: string | undefined;
				if (pick === autoDetectLanguage) {
					if (textModel) {
						const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
						if (resource) {
							// Detect languages since we are in an untitled file
							let languageId: string | undefined = languageService.guessLanguageIdByFilepathOrFirstLine(resource, textModel.getLineContent(1)) ?? undefined;
							if (!languageId || languageId === 'unknown') {
								detectedLanguage = await languageDetectionService.detectLanguage(resource);
								languageId = detectedLanguage;
							}
							if (languageId) {
								languageSelection = languageService.createById(languageId);
							}
						}
					}
				} else {
					languageSelection = languageService.createById(pick.id);

					if (resource) {
						// fire and forget to not slow things down
						languageDetectionService.detectLanguage(resource).then(detectedLanguageId => {
							const chosenLanguageId = languageService.getLanguageIdByLanguageName(pick.label) || 'unknown';
							if (detectedLanguageId === currentLanguageId && currentLanguageId !== chosenLanguageId) {
								// If they didn't choose the detected language (which should also be the active language if automatic detection is enabled)
								// then the automatic language detection was likely wrong and the user is correcting it. In this case, we want telemetry.
								// Keep track of what model was preferred and length of input to help track down potential differences between the result quality across models and content size.
								const modelPreference = configurationService.getValue<boolean>('workbench.editor.preferHistoryBasedLanguageDetection') ? 'history' : 'classic';
								telemetryService.publicLog2<IAutomaticLanguageDetectionLikelyWrongData, AutomaticLanguageDetectionLikelyWrongClassification>(AutomaticLanguageDetectionLikelyWrongId, {
									currentLanguageId: currentLanguageName ?? 'unknown',
									nextLanguageId: pick.label,
									lineCount: textModel?.getLineCount() ?? -1,
									modelPreference,
								});
							}
						});
					}
				}

				// Change language
				if (typeof languageSelection !== 'undefined') {
					languageSupport.setLanguageId(languageSelection.languageId, ChangeLanguageAction.ID);

					if (resource?.scheme === Schemas.untitled) {
						type SetUntitledDocumentLanguageEvent = { to: string; from: string; modelPreference: string };
						type SetUntitledDocumentLanguageClassification = {
							owner: 'TylerLeonhardt';
							comment: 'Helps understand what the automatic language detection does for untitled files';
							to: {
								classification: 'SystemMetaData';
								purpose: 'FeatureInsight';
								owner: 'TylerLeonhardt';
								comment: 'Help understand effectiveness of automatic language detection';
							};
							from: {
								classification: 'SystemMetaData';
								purpose: 'FeatureInsight';
								owner: 'TylerLeonhardt';
								comment: 'Help understand effectiveness of automatic language detection';
							};
							modelPreference: {
								classification: 'SystemMetaData';
								purpose: 'FeatureInsight';
								owner: 'TylerLeonhardt';
								comment: 'Help understand effectiveness of automatic language detection';
							};
						};
						const modelPreference = configurationService.getValue<boolean>('workbench.editor.preferHistoryBasedLanguageDetection') ? 'history' : 'classic';
						telemetryService.publicLog2<SetUntitledDocumentLanguageEvent, SetUntitledDocumentLanguageClassification>('setUntitledDocumentLanguage', {
							to: languageSelection.languageId,
							from: currentLanguageId ?? 'none',
							modelPreference,
						});
					}
				}
			}

			activeTextEditorControl.focus();
		}
	}

	private configureFileAssociation(resource: URI, languageService: ILanguageService, quickInputService: IQuickInputService, configurationService: IConfigurationService): void {
		const extension = extname(resource);
		const base = basename(resource);
		const currentAssociation = languageService.guessLanguageIdByFilepathOrFirstLine(URI.file(base));

		const languages = languageService.getSortedRegisteredLanguageNames();
		const picks: IQuickPickItem[] = languages.map(({ languageName, languageId }) => {
			return {
				id: languageId,
				label: languageName,
				iconClasses: getIconClassesForLanguageId(languageId),
				description: (languageId === currentAssociation) ? localize('currentAssociation', "当前关联") : undefined
			};
		});

		setTimeout(async () => {
			const language = await quickInputService.pick(picks, { placeHolder: localize('pickLanguageToConfigure', "选择要与 '{0}' 关联的语言模式", extension || base) });
			if (language) {
				const fileAssociationsConfig = configurationService.inspect<{}>(FILES_ASSOCIATIONS_CONFIG);

				let associationKey: string;
				if (extension && base[0] !== '.') {
					associationKey = `*${extension}`; // only use "*.ext" if the file path is in the form of <name>.<ext>
				} else {
					associationKey = base; // otherwise use the basename (e.g. .gitignore, Dockerfile)
				}

				// If the association is already being made in the workspace, make sure to target workspace settings
				let target = ConfigurationTarget.USER;
				if (fileAssociationsConfig.workspaceValue?.[associationKey as keyof typeof fileAssociationsConfig.workspaceValue]) {
					target = ConfigurationTarget.WORKSPACE;
				}

				// Make sure to write into the value of the target and not the merged value from USER and WORKSPACE config
				const currentAssociations = deepClone((target === ConfigurationTarget.WORKSPACE) ? fileAssociationsConfig.workspaceValue : fileAssociationsConfig.userValue) || Object.create(null);
				currentAssociations[associationKey] = language.id;

				configurationService.updateValue(FILES_ASSOCIATIONS_CONFIG, currentAssociations, target);
			}
		}, 50 /* quick input is sensitive to being opened so soon after another */);
	}
}

interface IChangeEOLEntry extends IQuickPickItem {
	eol: EndOfLineSequence;
}

export class ChangeEOLAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.editor.changeEOL',
			title: localize2('changeEndOfLine', '更改行尾序列'),
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);

		const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
		if (!activeTextEditorControl) {
			await quickInputService.pick([{ label: localize('noEditor', "当前没有活动的文本编辑器") }]);
			return;
		}

		if (editorService.activeEditor?.isReadonly()) {
			await quickInputService.pick([{ label: localize('noWritableCodeEditor', "活动代码编辑器为只读。") }]);
			return;
		}

		let textModel = activeTextEditorControl.getModel();

		const EOLOptions: IChangeEOLEntry[] = [
			{ label: nlsEOLLF, eol: EndOfLineSequence.LF },
			{ label: nlsEOLCRLF, eol: EndOfLineSequence.CRLF },
		];

		const selectedIndex = (textModel?.getEOL() === '\n') ? 0 : 1;

		const eol = await quickInputService.pick(EOLOptions, { placeHolder: localize('pickEndOfLine', "选择行尾序列"), activeItem: EOLOptions[selectedIndex] });
		if (eol) {
			const activeCodeEditor = getCodeEditor(editorService.activeTextEditorControl);
			if (activeCodeEditor?.hasModel() && !editorService.activeEditor?.isReadonly()) {
				textModel = activeCodeEditor.getModel();
				textModel.pushStackElement();
				textModel.pushEOL(eol.eol);
				textModel.pushStackElement();
			}
		}

		activeTextEditorControl.focus();
	}
}

export class ChangeEncodingAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.editor.changeEncoding',
			title: localize2('changeEncoding', '更改文件编码'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const fileService = accessor.get(IFileService);
		const textFileService = accessor.get(ITextFileService);
		const textResourceConfigurationService = accessor.get(ITextResourceConfigurationService);
		const dialogService = accessor.get(IDialogService);

		const activeTextEditorControl = getCodeEditor(editorService.activeTextEditorControl);
		if (!activeTextEditorControl) {
			await quickInputService.pick([{ label: localize('noEditor', "当前没有活动的文本编辑器") }]);
			return;
		}

		const activeEditorPane = editorService.activeEditorPane;
		if (!activeEditorPane) {
			await quickInputService.pick([{ label: localize('noEditor', "当前没有活动的文本编辑器") }]);
			return;
		}

		const encodingSupport: IEncodingSupport | null = toEditorWithEncodingSupport(activeEditorPane.input);
		if (!encodingSupport) {
			await quickInputService.pick([{ label: localize('noFileEditor', "当前没有活动的文件") }]);
			return;
		}

		const saveWithEncodingPick: IQuickPickItem = { label: localize('saveWithEncoding', "使用指定编码保存") };
		const reopenWithEncodingPick: IQuickPickItem = { label: localize('reopenWithEncoding', "使用指定编码重新打开") };

		if (!Language.isDefaultVariant()) {
			const saveWithEncodingAlias = 'Save with Encoding';
			if (saveWithEncodingAlias !== saveWithEncodingPick.label) {
				saveWithEncodingPick.detail = saveWithEncodingAlias;
			}

			const reopenWithEncodingAlias = 'Reopen with Encoding';
			if (reopenWithEncodingAlias !== reopenWithEncodingPick.label) {
				reopenWithEncodingPick.detail = reopenWithEncodingAlias;
			}
		}

		let action: IQuickPickItem | undefined;
		if (encodingSupport instanceof UntitledTextEditorInput) {
			action = saveWithEncodingPick;
		} else if (activeEditorPane.input.isReadonly()) {
			action = reopenWithEncodingPick;
		} else {
			action = await quickInputService.pick([reopenWithEncodingPick, saveWithEncodingPick], { placeHolder: localize('pickAction', "选择操作"), matchOnDetail: true });
		}

		if (!action) {
			return;
		}

		await timeout(50); // quick input is sensitive to being opened so soon after another

		const resource = EditorResourceAccessor.getOriginalUri(activeEditorPane.input, { supportSideBySide: SideBySideEditor.PRIMARY });
		if (!resource || (!fileService.hasProvider(resource) && resource.scheme !== Schemas.untitled)) {
			return; // encoding detection only possible for resources the file service can handle or that are untitled
		}

		let guessedEncoding: string | undefined = undefined;
		if (fileService.hasProvider(resource)) {
			const content = await textFileService.readStream(resource, {
				autoGuessEncoding: true,
				candidateGuessEncodings: textResourceConfigurationService.getValue(resource, 'files.candidateGuessEncodings')
			});
			guessedEncoding = content.encoding;
		}

		const isReopenWithEncoding = (action === reopenWithEncodingPick);

		const configuredEncoding = textResourceConfigurationService.getValue(resource, 'files.encoding');

		let directMatchIndex: number | undefined;
		let aliasMatchIndex: number | undefined;

		// All encodings are valid picks
		const picks: QuickPickInput[] = Object.keys(SUPPORTED_ENCODINGS)
			.sort((k1, k2) => {
				if (k1 === configuredEncoding) {
					return -1;
				} else if (k2 === configuredEncoding) {
					return 1;
				}

				return SUPPORTED_ENCODINGS[k1].order - SUPPORTED_ENCODINGS[k2].order;
			})
			.filter(k => {
				if (k === guessedEncoding && guessedEncoding !== configuredEncoding) {
					return false; // do not show encoding if it is the guessed encoding that does not match the configured
				}

				return !isReopenWithEncoding || !SUPPORTED_ENCODINGS[k].encodeOnly; // hide those that can only be used for encoding if we are about to decode
			})
			.map((key, index) => {
				if (key === encodingSupport.getEncoding()) {
					directMatchIndex = index;
				} else if (SUPPORTED_ENCODINGS[key].alias === encodingSupport.getEncoding()) {
					aliasMatchIndex = index;
				}

				return { id: key, label: SUPPORTED_ENCODINGS[key].labelLong, description: key };
			});

		const items = picks.slice() as IQuickPickItem[];

		// If we have a guessed encoding, show it first unless it matches the configured encoding
		if (guessedEncoding && configuredEncoding !== guessedEncoding && SUPPORTED_ENCODINGS[guessedEncoding]) {
			picks.unshift({ type: 'separator' });
			picks.unshift({ id: guessedEncoding, label: SUPPORTED_ENCODINGS[guessedEncoding].labelLong, description: localize('guessedEncoding', "根据内容推测") });
		}

		const encoding = await quickInputService.pick(picks, {
			placeHolder: isReopenWithEncoding ? localize('pickEncodingForReopen', "选择重新打开文件所用的编码") : localize('pickEncodingForSave', "选择保存文件所用的编码"),
			activeItem: items[typeof directMatchIndex === 'number' ? directMatchIndex : typeof aliasMatchIndex === 'number' ? aliasMatchIndex : -1]
		});

		if (!encoding) {
			return;
		}

		if (!editorService.activeEditorPane) {
			return;
		}

		const activeEncodingSupport = toEditorWithEncodingSupport(editorService.activeEditorPane.input);
		if (typeof encoding.id !== 'undefined' && activeEncodingSupport) {

			// Re-open with encoding does not work on dirty editors, ask to revert
			if (isReopenWithEncoding && editorService.activeEditorPane.input.isDirty()) {
				const { confirmed } = await dialogService.confirm({
					message: localize('reopenWithEncodingWarning', "是否要还原活动文本编辑器并使用其他编码重新打开？"),
					detail: localize('reopenWithEncodingDetail', "这将放弃所有未保存的更改。"),
					primaryButton: localize('reopen', "放弃更改并重新打开")
				});

				if (!confirmed) {
					return;
				}

				await editorService.activeEditorPane.input.revert(editorService.activeEditorPane.group.id);
			}

			// Set new encoding
			await activeEncodingSupport.setEncoding(encoding.id, isReopenWithEncoding ? EncodingMode.Decode : EncodingMode.Encode);
		}

		activeTextEditorControl.focus();
	}
}
