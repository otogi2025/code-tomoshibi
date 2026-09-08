/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { normalizeDriveLetter } from '../../../../base/common/labels.js';
import * as path from '../../../../base/common/path.js';
import { dirname } from '../../../../base/common/resources.js';
import { commonPrefixLength, getLeadingWhitespace, isFalsyOrWhitespace, splitLines } from '../../../../base/common/strings.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Selection } from '../../../common/core/selection.js';
import { ITextModel } from '../../../common/model.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { Text, Variable, VariableResolver } from './snippetParser.js';
import { OvertypingCapturer } from '../../suggest/browser/suggestOvertypingCapturer.js';
import * as nls from '../../../../nls.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { WORKSPACE_EXTENSION, isSingleFolderWorkspaceIdentifier, toWorkspaceIdentifier, IWorkspaceContextService, ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier, isEmptyWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';

export const KnownSnippetVariableNames = Object.freeze<{ [key: string]: true }>({
	'CURRENT_YEAR': true,
	'CURRENT_YEAR_SHORT': true,
	'CURRENT_MONTH': true,
	'CURRENT_DATE': true,
	'CURRENT_HOUR': true,
	'CURRENT_MINUTE': true,
	'CURRENT_SECOND': true,
	'CURRENT_MILLISECOND': true,
	'CURRENT_DAY_NAME': true,
	'CURRENT_DAY_NAME_SHORT': true,
	'CURRENT_MONTH_NAME': true,
	'CURRENT_MONTH_NAME_SHORT': true,
	'CURRENT_SECONDS_UNIX': true,
	'CURRENT_MILLISECONDS_UNIX': true,
	'CURRENT_TIMEZONE_OFFSET': true,
	'CURRENT_TIMEZONE_NAME': true,
	'SELECTION': true,
	'CLIPBOARD': true,
	'TM_SELECTED_TEXT': true,
	'TM_CURRENT_LINE': true,
	'TM_CURRENT_WORD': true,
	'TM_LINE_INDEX': true,
	'TM_LINE_NUMBER': true,
	'TM_FILENAME': true,
	'TM_FILENAME_BASE': true,
	'TM_DIRECTORY': true,
	'TM_DIRECTORY_BASE': true,
	'TM_FILEPATH': true,
	'CURSOR_INDEX': true, // 0-offset
	'CURSOR_NUMBER': true, // 1-offset
	'RELATIVE_FILEPATH': true,
	'BLOCK_COMMENT_START': true,
	'BLOCK_COMMENT_END': true,
	'LINE_COMMENT': true,
	'WORKSPACE_NAME': true,
	'WORKSPACE_FOLDER': true,
	'RANDOM': true,
	'RANDOM_HEX': true,
	'UUID': true
});

export class CompositeSnippetVariableResolver implements VariableResolver {

	constructor(private readonly _delegates: VariableResolver[]) {
		//
	}

	resolve(variable: Variable): string | undefined {
		for (const delegate of this._delegates) {
			const value = delegate.resolve(variable);
			if (value !== undefined) {
				return value;
			}
		}
		return undefined;
	}
}

export class SelectionBasedVariableResolver implements VariableResolver {

	constructor(
		private readonly _model: ITextModel,
		private readonly _selection: Selection,
		private readonly _selectionIdx: number,
		private readonly _overtypingCapturer: OvertypingCapturer | undefined
	) {
		//
	}

	resolve(variable: Variable): string | undefined {

		const { name } = variable;

		if (name === 'SELECTION' || name === 'TM_SELECTED_TEXT') {
			let value = this._model.getValueInRange(this._selection) || undefined;
			let isMultiline = this._selection.startLineNumber !== this._selection.endLineNumber;

			// If there was no selected text, try to get last overtyped text
			if (!value && this._overtypingCapturer) {
				const info = this._overtypingCapturer.getLastOvertypedInfo(this._selectionIdx);
				if (info) {
					value = info.value;
					isMultiline = info.multiline;
				}
			}

			if (value && isMultiline && variable.snippet) {
				// Selection is a multiline string which we indentation we now
				// need to adjust. We compare the indentation of this variable
				// with the indentation at the editor position and add potential
				// extra indentation to the value

				const line = this._model.getLineContent(this._selection.startLineNumber);
				const lineLeadingWhitespace = getLeadingWhitespace(line, 0, this._selection.startColumn - 1);

				let varLeadingWhitespace = lineLeadingWhitespace;
				variable.snippet.walk(marker => {
					if (marker === variable) {
						return false;
					}
					if (marker instanceof Text) {
						varLeadingWhitespace = getLeadingWhitespace(splitLines(marker.value).pop()!);
					}
					return true;
				});
				const whitespaceCommonLength = commonPrefixLength(varLeadingWhitespace, lineLeadingWhitespace);

				value = value.replace(
					/(\r\n|\r|\n)(.*)/g,
					(m, newline, rest) => `${newline}${varLeadingWhitespace.substr(whitespaceCommonLength)}${rest}`
				);
			}
			return value;

		} else if (name === 'TM_CURRENT_LINE') {
			return this._model.getLineContent(this._selection.positionLineNumber);

		} else if (name === 'TM_CURRENT_WORD') {
			const info = this._model.getWordAtPosition({
				lineNumber: this._selection.positionLineNumber,
				column: this._selection.positionColumn
			});
			return info && info.word || undefined;

		} else if (name === 'TM_LINE_INDEX') {
			return String(this._selection.positionLineNumber - 1);

		} else if (name === 'TM_LINE_NUMBER') {
			return String(this._selection.positionLineNumber);

		} else if (name === 'CURSOR_INDEX') {
			return String(this._selectionIdx);

		} else if (name === 'CURSOR_NUMBER') {
			return String(this._selectionIdx + 1);
		}
		return undefined;
	}
}

export class ModelBasedVariableResolver implements VariableResolver {

	constructor(
		private readonly _labelService: ILabelService,
		private readonly _model: ITextModel
	) {
		//
	}

	resolve(variable: Variable): string | undefined {

		const { name } = variable;

		if (name === 'TM_FILENAME') {
			return path.basename(this._model.uri.fsPath);

		} else if (name === 'TM_FILENAME_BASE') {
			const name = path.basename(this._model.uri.fsPath);
			const idx = name.lastIndexOf('.');
			if (idx <= 0) {
				return name;
			} else {
				return name.slice(0, idx);
			}

		} else if (name === 'TM_DIRECTORY') {
			if (path.dirname(this._model.uri.fsPath) === '.') {
				return '';
			}
			return this._labelService.getUriLabel(dirname(this._model.uri));

		} else if (name === 'TM_DIRECTORY_BASE') {
			if (path.dirname(this._model.uri.fsPath) === '.') {
				return '';
			}
			return path.basename(path.dirname(this._model.uri.fsPath));

		} else if (name === 'TM_FILEPATH') {
			return this._labelService.getUriLabel(this._model.uri);
		} else if (name === 'RELATIVE_FILEPATH') {
			return this._labelService.getUriLabel(this._model.uri, { relative: true, noPrefix: true });
		}

		return undefined;
	}
}

export interface IReadClipboardText {
	(): string | undefined;
}

export class ClipboardBasedVariableResolver implements VariableResolver {

	constructor(
		private readonly _readClipboardText: IReadClipboardText,
		private readonly _selectionIdx: number,
		private readonly _selectionCount: number,
		private readonly _spread: boolean
	) {
		//
	}

	resolve(variable: Variable): string | undefined {
		if (variable.name !== 'CLIPBOARD') {
			return undefined;
		}

		const clipboardText = this._readClipboardText();
		if (!clipboardText) {
			return undefined;
		}

		// `spread` is assigning each cursor a line of the clipboard
		// text whenever there the line count equals the cursor count
		// and when enabled
		if (this._spread) {
			const lines = clipboardText.split(/\r\n|\n|\r/).filter(s => !isFalsyOrWhitespace(s));
			if (lines.length === this._selectionCount) {
				return lines[this._selectionIdx];
			}
		}
		return clipboardText;
	}
}
export class CommentBasedVariableResolver implements VariableResolver {
	constructor(
		private readonly _model: ITextModel,
		private readonly _selection: Selection,
		@ILanguageConfigurationService private readonly _languageConfigurationService: ILanguageConfigurationService
	) {
		//
	}
	resolve(variable: Variable): string | undefined {
		const { name } = variable;
		const langId = this._model.getLanguageIdAtPosition(this._selection.selectionStartLineNumber, this._selection.selectionStartColumn);
		const config = this._languageConfigurationService.getLanguageConfiguration(langId).comments;
		if (!config) {
			return undefined;
		}
		if (name === 'LINE_COMMENT') {
			return config.lineCommentToken || undefined;
		} else if (name === 'BLOCK_COMMENT_START') {
			return config.blockCommentStartToken || undefined;
		} else if (name === 'BLOCK_COMMENT_END') {
			return config.blockCommentEndToken || undefined;
		}
		return undefined;
	}
}
export class TimeBasedVariableResolver implements VariableResolver {

	private static readonly dayNames = [nls.localize('Sunday', "星期天"), nls.localize('Monday', "星期一"), nls.localize('Tuesday', "星期二"), nls.localize('Wednesday', "星期三"), nls.localize('Thursday', "星期四"), nls.localize('Friday', "星期五"), nls.localize('Saturday', "星期六")];
	private static readonly dayNamesShort = [nls.localize('SundayShort', "周日"), nls.localize('MondayShort', "周一"), nls.localize('TuesdayShort', "周二"), nls.localize('WednesdayShort', "周三"), nls.localize('ThursdayShort', "周四"), nls.localize('FridayShort', "周五"), nls.localize('SaturdayShort', "周六")];
	private static readonly monthNames = [nls.localize('January', "一月"), nls.localize('February', "二月"), nls.localize('March', "三月"), nls.localize('April', "四月"), nls.localize('May', "5月"), nls.localize('June', "六月"), nls.localize('July', "七月"), nls.localize('August', "八月"), nls.localize('September', "九月"), nls.localize('October', "十月"), nls.localize('November', "十一月"), nls.localize('December', "十二月")];
	private static readonly monthNamesShort = [nls.localize('JanuaryShort', "1月"), nls.localize('FebruaryShort', "2月"), nls.localize('MarchShort', "3月"), nls.localize('AprilShort', "4月"), nls.localize('MayShort', "5月"), nls.localize('JuneShort', "6月"), nls.localize('JulyShort', "7月"), nls.localize('AugustShort', "8月"), nls.localize('SeptemberShort', "9月"), nls.localize('OctoberShort', "10月"), nls.localize('NovemberShort', "11 月"), nls.localize('DecemberShort', "12月")];

	private readonly _date = new Date();
	private _timezoneName: string | undefined;

	resolve(variable: Variable): string | undefined {
		const { name } = variable;

		switch (name) {
			case 'CURRENT_YEAR':
				return String(this._date.getFullYear());
			case 'CURRENT_YEAR_SHORT':
				return String(this._date.getFullYear()).slice(-2);
			case 'CURRENT_MONTH':
				return String(this._date.getMonth().valueOf() + 1).padStart(2, '0');
			case 'CURRENT_DATE':
				return String(this._date.getDate().valueOf()).padStart(2, '0');
			case 'CURRENT_HOUR':
				return String(this._date.getHours().valueOf()).padStart(2, '0');
			case 'CURRENT_MINUTE':
				return String(this._date.getMinutes().valueOf()).padStart(2, '0');
			case 'CURRENT_SECOND':
				return String(this._date.getSeconds().valueOf()).padStart(2, '0');
			case 'CURRENT_MILLISECOND':
				return String(this._date.getMilliseconds().valueOf()).padStart(3, '0');
			case 'CURRENT_DAY_NAME':
				return TimeBasedVariableResolver.dayNames[this._date.getDay()];
			case 'CURRENT_DAY_NAME_SHORT':
				return TimeBasedVariableResolver.dayNamesShort[this._date.getDay()];
			case 'CURRENT_MONTH_NAME':
				return TimeBasedVariableResolver.monthNames[this._date.getMonth()];
			case 'CURRENT_MONTH_NAME_SHORT':
				return TimeBasedVariableResolver.monthNamesShort[this._date.getMonth()];
			case 'CURRENT_SECONDS_UNIX':
				return String(Math.floor(this._date.getTime() / 1000));
			case 'CURRENT_MILLISECONDS_UNIX':
				return String(this._date.getTime());
			case 'CURRENT_TIMEZONE_OFFSET': {
				const rawTimeOffset = this._date.getTimezoneOffset();
				const sign = rawTimeOffset > 0 ? '-' : '+';
				const hours = Math.trunc(Math.abs(rawTimeOffset / 60));
				const hoursString = (hours < 10 ? '0' + hours : hours);
				const minutes = Math.abs(rawTimeOffset) - hours * 60;
				const minutesString = (minutes < 10 ? '0' + minutes : minutes);
				return sign + hoursString + ':' + minutesString;
			}
			case 'CURRENT_TIMEZONE_NAME':
				return this._timezoneName ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
		}

		return undefined;
	}
}

export class WorkspaceBasedVariableResolver implements VariableResolver {
	constructor(
		private readonly _workspaceService: IWorkspaceContextService | undefined,
	) {
		//
	}

	resolve(variable: Variable): string | undefined {
		if (!this._workspaceService) {
			return undefined;
		}

		const workspaceIdentifier = toWorkspaceIdentifier(this._workspaceService.getWorkspace());
		if (isEmptyWorkspaceIdentifier(workspaceIdentifier)) {
			return undefined;
		}

		if (variable.name === 'WORKSPACE_NAME') {
			return this._resolveWorkspaceName(workspaceIdentifier);
		} else if (variable.name === 'WORKSPACE_FOLDER') {
			return this._resoveWorkspacePath(workspaceIdentifier);
		}

		return undefined;
	}
	private _resolveWorkspaceName(workspaceIdentifier: IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier): string | undefined {
		if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
			return path.basename(workspaceIdentifier.uri.path);
		}

		let filename = path.basename(workspaceIdentifier.configPath.path);
		if (filename.endsWith(WORKSPACE_EXTENSION)) {
			filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
		}
		return filename;
	}
	private _resoveWorkspacePath(workspaceIdentifier: IWorkspaceIdentifier | ISingleFolderWorkspaceIdentifier): string | undefined {
		if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
			return normalizeDriveLetter(workspaceIdentifier.uri.fsPath);
		}

		const filename = path.basename(workspaceIdentifier.configPath.path);
		let folderpath = workspaceIdentifier.configPath.fsPath;
		if (folderpath.endsWith(filename)) {
			folderpath = folderpath.substr(0, folderpath.length - filename.length - 1);
		}
		return (folderpath ? normalizeDriveLetter(folderpath) : '/');
	}
}

export class RandomBasedVariableResolver implements VariableResolver {
	resolve(variable: Variable): string | undefined {
		const { name } = variable;

		if (name === 'RANDOM') {
			return Math.random().toString().slice(-6);
		} else if (name === 'RANDOM_HEX') {
			return Math.random().toString(16).slice(-6);
		} else if (name === 'UUID') {
			return generateUuid();
		}

		return undefined;
	}
}
