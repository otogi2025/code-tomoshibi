/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';

import * as Objects from '../../../../base/common/objects.js';
import * as Strings from '../../../../base/common/strings.js';
import * as Assert from '../../../../base/common/assert.js';
import { join, normalize } from '../../../../base/common/path.js';
import * as Types from '../../../../base/common/types.js';
import * as UUID from '../../../../base/common/uuid.js';
import * as Platform from '../../../../base/common/platform.js';
import Severity from '../../../../base/common/severity.js';
import { URI } from '../../../../base/common/uri.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { ValidationStatus, ValidationState, IProblemReporter, Parser } from '../../../../base/common/parsers.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { asArray } from '../../../../base/common/arrays.js';
import { Schemas as NetworkSchemas } from '../../../../base/common/network.js';

import { IMarkerData, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { ExtensionsRegistry, ExtensionMessageCollector } from '../../../services/extensions/common/extensionsRegistry.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { FileType, IFileService, IFileStatWithPartialMetadata, IFileSystemProvider } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export enum FileLocationKind {
	Default,
	Relative,
	Absolute,
	AutoDetect,
	Search
}

export namespace FileLocationKind {
	export function fromString(value: string): FileLocationKind | undefined {
		value = value.toLowerCase();
		if (value === 'absolute') {
			return FileLocationKind.Absolute;
		} else if (value === 'relative') {
			return FileLocationKind.Relative;
		} else if (value === 'autodetect') {
			return FileLocationKind.AutoDetect;
		} else if (value === 'search') {
			return FileLocationKind.Search;
		} else {
			return undefined;
		}
	}
}

export enum ProblemLocationKind {
	File,
	Location
}

export namespace ProblemLocationKind {
	export function fromString(value: string): ProblemLocationKind | undefined {
		value = value.toLowerCase();
		if (value === 'file') {
			return ProblemLocationKind.File;
		} else if (value === 'location') {
			return ProblemLocationKind.Location;
		} else {
			return undefined;
		}
	}
}

export interface IProblemPattern {
	regexp: RegExp;

	kind?: ProblemLocationKind;

	file?: number;

	message?: number;

	location?: number;

	line?: number;

	character?: number;

	endLine?: number;

	endCharacter?: number;

	code?: number;

	severity?: number;

	loop?: boolean;
}

export interface INamedProblemPattern extends IProblemPattern {
	name: string;
}

export type MultiLineProblemPattern = IProblemPattern[];

export interface IWatchingPattern {
	regexp: RegExp;
	file?: number;
}

export interface IWatchingMatcher {
	activeOnStart: boolean;
	beginsPattern: IWatchingPattern;
	endsPattern: IWatchingPattern;
}

export enum ApplyToKind {
	allDocuments,
	openDocuments,
	closedDocuments
}

export namespace ApplyToKind {
	export function fromString(value: string): ApplyToKind | undefined {
		value = value.toLowerCase();
		if (value === 'alldocuments') {
			return ApplyToKind.allDocuments;
		} else if (value === 'opendocuments') {
			return ApplyToKind.openDocuments;
		} else if (value === 'closeddocuments') {
			return ApplyToKind.closedDocuments;
		} else {
			return undefined;
		}
	}
}

export interface ProblemMatcher {
	owner: string;
	source?: string;
	applyTo: ApplyToKind;
	fileLocation: FileLocationKind;
	filePrefix?: string | Config.SearchFileLocationArgs;
	pattern: Types.SingleOrMany<IProblemPattern>;
	severity?: Severity;
	watching?: IWatchingMatcher;
	uriProvider?: (path: string) => URI;
}

export interface INamedProblemMatcher extends ProblemMatcher {
	name: string;
	label: string;
	deprecated?: boolean;
}

export interface INamedMultiLineProblemPattern {
	name: string;
	label: string;
	patterns: MultiLineProblemPattern;
}

export function isNamedProblemMatcher(value: ProblemMatcher | undefined): value is INamedProblemMatcher {
	return value && Types.isString((<INamedProblemMatcher>value).name) ? true : false;
}

interface ILocation {
	startLineNumber: number;
	startCharacter: number;
	endLineNumber: number;
	endCharacter: number;
}

interface IProblemData {
	kind?: ProblemLocationKind;
	file?: string;
	location?: string;
	line?: string;
	character?: string;
	endLine?: string;
	endCharacter?: string;
	message?: string;
	severity?: string;
	code?: string;
}

export interface IProblemMatch {
	resource: Promise<URI>;
	marker: IMarkerData;
	description: ProblemMatcher;
}

export interface IHandleResult {
	match: IProblemMatch | null;
	continue: boolean;
}


export async function getResource(filename: string, matcher: ProblemMatcher, fileService?: IFileService): Promise<URI> {
	const kind = matcher.fileLocation;
	let fullPath: string | undefined;
	if (kind === FileLocationKind.Absolute) {
		fullPath = filename;
	} else if ((kind === FileLocationKind.Relative) && matcher.filePrefix && Types.isString(matcher.filePrefix)) {
		fullPath = join(matcher.filePrefix, filename);
	} else if (kind === FileLocationKind.AutoDetect) {
		const matcherClone = Objects.deepClone(matcher);
		matcherClone.fileLocation = FileLocationKind.Relative;
		if (fileService) {
			const relative = await getResource(filename, matcherClone);
			let stat: IFileStatWithPartialMetadata | undefined = undefined;
			try {
				stat = await fileService.stat(relative);
			} catch (ex) {
				// Do nothing, we just need to catch file resolution errors.
			}
			if (stat) {
				return relative;
			}
		}

		matcherClone.fileLocation = FileLocationKind.Absolute;
		return getResource(filename, matcherClone);
	} else if (kind === FileLocationKind.Search && fileService) {
		const fsProvider = fileService.getProvider(NetworkSchemas.file);
		if (fsProvider) {
			const uri = await searchForFileLocation(filename, fsProvider, matcher.filePrefix as Config.SearchFileLocationArgs);
			fullPath = uri?.path;
		}

		if (!fullPath) {
			const absoluteMatcher = Objects.deepClone(matcher);
			absoluteMatcher.fileLocation = FileLocationKind.Absolute;
			return getResource(filename, absoluteMatcher);
		}
	}
	if (fullPath === undefined) {
		throw new Error('FileLocationKind is not actionable. Does the matcher have a filePrefix? This should never happen.');
	}
	fullPath = normalize(fullPath);
	fullPath = fullPath.replace(/\\/g, '/');
	if (fullPath[0] !== '/') {
		fullPath = '/' + fullPath;
	}
	if (matcher.uriProvider !== undefined) {
		return matcher.uriProvider(fullPath);
	} else {
		return URI.file(fullPath);
	}
}

async function searchForFileLocation(filename: string, fsProvider: IFileSystemProvider, args: Config.SearchFileLocationArgs): Promise<URI | undefined> {
	const exclusions = new Set(asArray(args.exclude || []).map(x => URI.file(x).path));
	async function search(dir: URI): Promise<URI | undefined> {
		if (exclusions.has(dir.path)) {
			return undefined;
		}

		const entries = await fsProvider.readdir(dir);
		const subdirs: URI[] = [];

		for (const [name, fileType] of entries) {
			if (fileType === FileType.Directory) {
				subdirs.push(URI.joinPath(dir, name));
				continue;
			}

			if (fileType === FileType.File) {
				/**
				 * Note that sometimes the given `filename` could be a relative
				 * path (not just the "name.ext" part). For example, the
				 * `filename` can be "/subdir/name.ext". So, just comparing
				 * `name` as `filename` is not sufficient. The workaround here
				 * is to form the URI with `dir` and `name` and check if it ends
				 * with the given `filename`.
				 */
				const fullUri = URI.joinPath(dir, name);
				if (fullUri.path.endsWith(filename)) {
					return fullUri;
				}
			}
		}

		for (const subdir of subdirs) {
			const result = await search(subdir);
			if (result) {
				return result;
			}
		}
		return undefined;
	}

	for (const dir of asArray(args.include || [])) {
		const hit = await search(URI.file(dir));
		if (hit) {
			return hit;
		}
	}
	return undefined;
}

export interface ILineMatcher {
	matchLength: number;
	next(line: string): IProblemMatch | null;
	handle(lines: string[], start?: number): IHandleResult;
}

export function createLineMatcher(matcher: ProblemMatcher, fileService?: IFileService, logService?: ILogService): ILineMatcher {
	const pattern = matcher.pattern;
	if (Array.isArray(pattern)) {
		return new MultiLineMatcher(matcher, fileService, logService);
	} else {
		return new SingleLineMatcher(matcher, fileService, logService);
	}
}

const endOfLine: string = Platform.OS === Platform.OperatingSystem.Windows ? '\r\n' : '\n';

abstract class AbstractLineMatcher implements ILineMatcher {
	private matcher: ProblemMatcher;
	private fileService?: IFileService;
	private logService?: ILogService;

	constructor(matcher: ProblemMatcher, fileService?: IFileService, logService?: ILogService) {
		this.matcher = matcher;
		this.fileService = fileService;
		this.logService = logService;
	}

	public handle(lines: string[], start: number = 0): IHandleResult {
		return { match: null, continue: false };
	}

	public next(line: string): IProblemMatch | null {
		return null;
	}

	public abstract get matchLength(): number;

	protected regexpExec(regexp: RegExp, line: string): RegExpExecArray | null {
		const start = Date.now();
		const result = regexp.exec(line);
		const elapsed = Date.now() - start;
		if (elapsed > 5) {
			this.logService?.trace(`ProblemMatcher: slow regexp took ${elapsed}ms to execute`, regexp.source);
		}
		return result;
	}

	protected fillProblemData(data: IProblemData | undefined, pattern: IProblemPattern, matches: RegExpExecArray): data is IProblemData {
		if (data) {
			this.fillProperty(data, 'file', pattern, matches, true);
			this.appendProperty(data, 'message', pattern, matches, true);
			this.fillProperty(data, 'code', pattern, matches, true);
			this.fillProperty(data, 'severity', pattern, matches, true);
			this.fillProperty(data, 'location', pattern, matches, true);
			this.fillProperty(data, 'line', pattern, matches);
			this.fillProperty(data, 'character', pattern, matches);
			this.fillProperty(data, 'endLine', pattern, matches);
			this.fillProperty(data, 'endCharacter', pattern, matches);
			return true;
		} else {
			return false;
		}
	}

	private appendProperty(data: IProblemData, property: keyof IProblemData, pattern: IProblemPattern, matches: RegExpExecArray, trim: boolean = false): void {
		const patternProperty = pattern[property];
		if (Types.isUndefined(data[property])) {
			this.fillProperty(data, property, pattern, matches, trim);
		}
		else if (!Types.isUndefined(patternProperty) && patternProperty < matches.length) {
			let value = matches[patternProperty];
			if (trim) {
				value = Strings.trim(value)!;
			}
			(data as Record<string, string | undefined>)[property] = data[property]! + endOfLine + value;
		}
	}

	private fillProperty(data: IProblemData, property: keyof IProblemData, pattern: IProblemPattern, matches: RegExpExecArray, trim: boolean = false): void {
		const patternAtProperty = pattern[property];
		if (Types.isUndefined(data[property]) && !Types.isUndefined(patternAtProperty) && patternAtProperty < matches.length) {
			let value = matches[patternAtProperty];
			if (value !== undefined) {
				if (trim) {
					value = Strings.trim(value)!;
				}
				(data as Record<string, string | undefined>)[property] = value;
			}
		}
	}

	protected getMarkerMatch(data: IProblemData): IProblemMatch | undefined {
		try {
			const location = this.getLocation(data);
			if (data.file && location && data.message) {
				const marker: IMarkerData = {
					severity: this.getSeverity(data),
					startLineNumber: location.startLineNumber,
					startColumn: location.startCharacter,
					endLineNumber: location.endLineNumber,
					endColumn: location.endCharacter,
					message: data.message
				};
				if (data.code !== undefined) {
					marker.code = data.code;
				}
				if (this.matcher.source !== undefined) {
					marker.source = this.matcher.source;
				}
				return {
					description: this.matcher,
					resource: this.getResource(data.file),
					marker: marker
				};
			}
		} catch (err) {
			console.error(`Failed to convert problem data into match: ${JSON.stringify(data)}`);
		}
		return undefined;
	}

	protected getResource(filename: string): Promise<URI> {
		return getResource(filename, this.matcher, this.fileService);
	}

	private getLocation(data: IProblemData): ILocation | null {
		if (data.kind === ProblemLocationKind.File) {
			return this.createLocation(0, 0, 0, 0);
		}
		if (data.location) {
			return this.parseLocationInfo(data.location);
		}
		if (!data.line) {
			return null;
		}
		const startLine = parseInt(data.line);
		const startColumn = data.character ? parseInt(data.character) : undefined;
		const endLine = data.endLine ? parseInt(data.endLine) : undefined;
		const endColumn = data.endCharacter ? parseInt(data.endCharacter) : undefined;
		return this.createLocation(startLine, startColumn, endLine, endColumn);
	}

	private parseLocationInfo(value: string): ILocation | null {
		if (!value || !value.match(/(\d+|\d+,\d+|\d+,\d+,\d+,\d+)/)) {
			return null;
		}
		const parts = value.split(',');
		const startLine = parseInt(parts[0]);
		const startColumn = parts.length > 1 ? parseInt(parts[1]) : undefined;
		if (parts.length > 3) {
			return this.createLocation(startLine, startColumn, parseInt(parts[2]), parseInt(parts[3]));
		} else {
			return this.createLocation(startLine, startColumn, undefined, undefined);
		}
	}

	private createLocation(startLine: number, startColumn: number | undefined, endLine: number | undefined, endColumn: number | undefined): ILocation {
		if (startColumn !== undefined && endColumn !== undefined) {
			return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: endLine || startLine, endCharacter: endColumn };
		}
		if (startColumn !== undefined) {
			return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: startLine, endCharacter: startColumn };
		}
		return { startLineNumber: startLine, startCharacter: 1, endLineNumber: startLine, endCharacter: 2 ** 31 - 1 }; // See https://github.com/microsoft/vscode/issues/80288#issuecomment-650636442 for discussion
	}

	private getSeverity(data: IProblemData): MarkerSeverity {
		let result: Severity | null = null;
		if (data.severity) {
			const value = data.severity;
			if (value) {
				result = Severity.fromValue(value);
				if (result === Severity.Ignore) {
					if (value === 'E') {
						result = Severity.Error;
					} else if (value === 'W') {
						result = Severity.Warning;
					} else if (value === 'I') {
						result = Severity.Info;
					} else if (Strings.equalsIgnoreCase(value, 'hint')) {
						result = Severity.Info;
					} else if (Strings.equalsIgnoreCase(value, 'note')) {
						result = Severity.Info;
					}
				}
			}
		}
		if (result === null || result === Severity.Ignore) {
			result = this.matcher.severity || Severity.Error;
		}
		return MarkerSeverity.fromSeverity(result);
	}
}

class SingleLineMatcher extends AbstractLineMatcher {

	private pattern: IProblemPattern;

	constructor(matcher: ProblemMatcher, fileService?: IFileService, logService?: ILogService) {
		super(matcher, fileService, logService);
		this.pattern = <IProblemPattern>matcher.pattern;
	}

	public get matchLength(): number {
		return 1;
	}

	public override handle(lines: string[], start: number = 0): IHandleResult {
		Assert.ok(lines.length - start === 1);
		const data: IProblemData = Object.create(null);
		if (this.pattern.kind !== undefined) {
			data.kind = this.pattern.kind;
		}
		const matches = this.regexpExec(this.pattern.regexp, lines[start]);
		if (matches) {
			this.fillProblemData(data, this.pattern, matches);
			if (data.kind === ProblemLocationKind.Location && !data.location && !data.line && data.file) {
				data.kind = ProblemLocationKind.File;
			}
			const match = this.getMarkerMatch(data);
			if (match) {
				return { match: match, continue: false };
			}
		}
		return { match: null, continue: false };
	}

	public override next(line: string): IProblemMatch | null {
		return null;
	}
}

class MultiLineMatcher extends AbstractLineMatcher {

	private patterns: IProblemPattern[];
	private data: IProblemData | undefined;

	constructor(matcher: ProblemMatcher, fileService?: IFileService, logService?: ILogService) {
		super(matcher, fileService, logService);
		this.patterns = <IProblemPattern[]>matcher.pattern;
	}

	public get matchLength(): number {
		return this.patterns.length;
	}

	public override handle(lines: string[], start: number = 0): IHandleResult {
		Assert.ok(lines.length - start === this.patterns.length);
		this.data = Object.create(null);
		let data = this.data!;
		data.kind = this.patterns[0].kind;
		for (let i = 0; i < this.patterns.length; i++) {
			const pattern = this.patterns[i];
			const matches = this.regexpExec(pattern.regexp, lines[i + start]);
			if (!matches) {
				return { match: null, continue: false };
			} else {
				// Only the last pattern can loop
				if (pattern.loop && i === this.patterns.length - 1) {
					data = Objects.deepClone(data);
				}
				this.fillProblemData(data, pattern, matches);
			}
		}
		const loop = !!this.patterns[this.patterns.length - 1].loop;
		if (!loop) {
			this.data = undefined;
		}
		const markerMatch = data ? this.getMarkerMatch(data) : null;
		return { match: markerMatch ? markerMatch : null, continue: loop };
	}

	public override next(line: string): IProblemMatch | null {
		const pattern = this.patterns[this.patterns.length - 1];
		Assert.ok(pattern.loop === true && this.data !== null);
		const matches = this.regexpExec(pattern.regexp, line);
		if (!matches) {
			this.data = undefined;
			return null;
		}
		const data = Objects.deepClone(this.data);
		let problemMatch: IProblemMatch | undefined;
		if (this.fillProblemData(data, pattern, matches)) {
			problemMatch = this.getMarkerMatch(data);
		}
		return problemMatch ? problemMatch : null;
	}
}

export namespace Config {

	export interface IProblemPattern {

		/**
		* The regular expression to find a problem in the console output of an
		* executed task.
		*/
		regexp?: string;

		/**
		* Whether the pattern matches a whole file, or a location (file/line)
		*
		* The default is to match for a location. Only valid on the
		* first problem pattern in a multi line problem matcher.
		*/
		kind?: string;

		/**
		* The match group index of the filename.
		* If omitted 1 is used.
		*/
		file?: number;

		/**
		* The match group index of the problem's location. Valid location
		* patterns are: (line), (line,column) and (startLine,startColumn,endLine,endColumn).
		* If omitted the line and column properties are used.
		*/
		location?: number;

		/**
		* The match group index of the problem's line in the source file.
		*
		* Defaults to 2.
		*/
		line?: number;

		/**
		* The match group index of the problem's column in the source file.
		*
		* Defaults to 3.
		*/
		column?: number;

		/**
		* The match group index of the problem's end line in the source file.
		*
		* Defaults to undefined. No end line is captured.
		*/
		endLine?: number;

		/**
		* The match group index of the problem's end column in the source file.
		*
		* Defaults to undefined. No end column is captured.
		*/
		endColumn?: number;

		/**
		* The match group index of the problem's severity.
		*
		* Defaults to undefined. In this case the problem matcher's severity
		* is used.
		*/
		severity?: number;

		/**
		* The match group index of the problem's code.
		*
		* Defaults to undefined. No code is captured.
		*/
		code?: number;

		/**
		* The match group index of the message. If omitted it defaults
		* to 4 if location is specified. Otherwise it defaults to 5.
		*/
		message?: number;

		/**
		* Specifies if the last pattern in a multi line problem matcher should
		* loop as long as it does match a line consequently. Only valid on the
		* last problem pattern in a multi line problem matcher.
		*/
		loop?: boolean;
	}

	export interface ICheckedProblemPattern extends IProblemPattern {
		/**
		* The regular expression to find a problem in the console output of an
		* executed task.
		*/
		regexp: string;
	}

	export namespace CheckedProblemPattern {
		export function is(value: unknown): value is ICheckedProblemPattern {
			const candidate: IProblemPattern = value as IProblemPattern;
			return candidate && Types.isString(candidate.regexp);
		}
	}

	export interface INamedProblemPattern extends IProblemPattern {
		/**
		 * The name of the problem pattern.
		 */
		name: string;

		/**
		 * A human readable label
		 */
		label?: string;
	}

	export namespace NamedProblemPattern {
		export function is(value: unknown): value is INamedProblemPattern {
			const candidate: INamedProblemPattern = value as INamedProblemPattern;
			return candidate && Types.isString(candidate.name);
		}
	}

	export interface INamedCheckedProblemPattern extends INamedProblemPattern {
		/**
		* The regular expression to find a problem in the console output of an
		* executed task.
		*/
		regexp: string;
	}

	export namespace NamedCheckedProblemPattern {
		export function is(value: unknown): value is INamedCheckedProblemPattern {
			const candidate: INamedProblemPattern = value as INamedProblemPattern;
			return candidate && NamedProblemPattern.is(candidate) && Types.isString(candidate.regexp);
		}
	}

	export type MultiLineProblemPattern = IProblemPattern[];

	export namespace MultiLineProblemPattern {
		export function is(value: unknown): value is MultiLineProblemPattern {
			return Array.isArray(value);
		}
	}

	export type MultiLineCheckedProblemPattern = ICheckedProblemPattern[];

	export namespace MultiLineCheckedProblemPattern {
		export function is(value: unknown): value is MultiLineCheckedProblemPattern {
			if (!MultiLineProblemPattern.is(value)) {
				return false;
			}
			for (const element of value) {
				if (!Config.CheckedProblemPattern.is(element)) {
					return false;
				}
			}
			return true;
		}
	}

	export interface INamedMultiLineCheckedProblemPattern {
		/**
		 * The name of the problem pattern.
		 */
		name: string;

		/**
		 * A human readable label
		 */
		label?: string;

		/**
		 * The actual patterns
		 */
		patterns: MultiLineCheckedProblemPattern;
	}

	export namespace NamedMultiLineCheckedProblemPattern {
		export function is(value: unknown): value is INamedMultiLineCheckedProblemPattern {
			const candidate = value as INamedMultiLineCheckedProblemPattern;
			return candidate && Types.isString(candidate.name) && Array.isArray(candidate.patterns) && MultiLineCheckedProblemPattern.is(candidate.patterns);
		}
	}

	export type NamedProblemPatterns = (Config.INamedProblemPattern | Config.INamedMultiLineCheckedProblemPattern)[];

	/**
	* A watching pattern
	*/
	export interface IWatchingPattern {
		/**
		* The actual regular expression
		*/
		regexp?: string;

		/**
		* The match group index of the filename. If provided the expression
		* is matched for that file only.
		*/
		file?: number;
	}

	/**
	* A description to track the start and end of a watching task.
	*/
	export interface IBackgroundMonitor {

		/**
		* If set to true the watcher starts in active mode. This is the
		* same as outputting a line that matches beginsPattern when the
		* task starts.
		*/
		activeOnStart?: boolean;

		/**
		* If matched in the output the start of a watching task is signaled.
		*/
		beginsPattern?: string | IWatchingPattern;

		/**
		* If matched in the output the end of a watching task is signaled.
		*/
		endsPattern?: string | IWatchingPattern;
	}

	/**
	* A description of a problem matcher that detects problems
	* in build output.
	*/
	export interface ProblemMatcher {

		/**
		 * The name of a base problem matcher to use. If specified the
		 * base problem matcher will be used as a template and properties
		 * specified here will replace properties of the base problem
		 * matcher
		 */
		base?: string;

		/**
		 * The owner of the produced VSCode problem. This is typically
		 * the identifier of a VSCode language service if the problems are
		 * to be merged with the one produced by the language service
		 * or a generated internal id. Defaults to the generated internal id.
		 */
		owner?: string;

		/**
		 * A human-readable string describing the source of this problem.
		 * E.g. 'typescript' or 'super lint'.
		 */
		source?: string;

		/**
		* Specifies to which kind of documents the problems found by this
		* matcher are applied. Valid values are:
		*
		*   "allDocuments": problems found in all documents are applied.
		*   "openDocuments": problems found in documents that are open
		*   are applied.
		*   "closedDocuments": problems found in closed documents are
		*   applied.
		*/
		applyTo?: string;

		/**
		* The severity of the VSCode problem produced by this problem matcher.
		*
		* Valid values are:
		*   "error": to produce errors.
		*   "warning": to produce warnings.
		*   "info": to produce infos.
		*
		* The value is used if a pattern doesn't specify a severity match group.
		* Defaults to "error" if omitted.
		*/
		severity?: string;

		/**
		* Defines how filename reported in a problem pattern
		* should be read. Valid values are:
		*  - "absolute": the filename is always treated absolute.
		*  - "relative": the filename is always treated relative to
		*    the current working directory. This is the default.
		*  - ["relative", "path value"]: the filename is always
		*    treated relative to the given path value.
		*  - "autodetect": the filename is treated relative to
		*    the current workspace directory, and if the file
		*    does not exist, it is treated as absolute.
		*  - ["autodetect", "path value"]: the filename is treated
		*    relative to the given path value, and if it does not
		*    exist, it is treated as absolute.
		*  - ["search", { include?: "" | []; exclude?: "" | [] }]: The filename
		*    needs to be searched under the directories named by the "include"
		*    property and their nested subdirectories. With "exclude" property
		*    present, the directories should be removed from the search. When
		*    `include` is not unprovided, the current workspace directory should
		*    be used as the default.
		*/
		fileLocation?: Types.SingleOrMany<string> | ['search', SearchFileLocationArgs];

		/**
		* The name of a predefined problem pattern, the inline definition
		* of a problem pattern or an array of problem patterns to match
		* problems spread over multiple lines.
		*/
		pattern?: string | Types.SingleOrMany<IProblemPattern>;

		/**
		* A regular expression signaling that a watched tasks begins executing
		* triggered through file watching.
		*/
		watchedTaskBeginsRegExp?: string;

		/**
		* A regular expression signaling that a watched tasks ends executing.
		*/
		watchedTaskEndsRegExp?: string;

		/**
		 * @deprecated Use background instead.
		 */
		watching?: IBackgroundMonitor;
		background?: IBackgroundMonitor;
	}

	export type SearchFileLocationArgs = {
		include?: Types.SingleOrMany<string>;
		exclude?: Types.SingleOrMany<string>;
	};

	export type ProblemMatcherType = string | ProblemMatcher | Array<string | ProblemMatcher>;

	export interface INamedProblemMatcher extends ProblemMatcher {
		/**
		* This name can be used to refer to the
		* problem matcher from within a task.
		*/
		name: string;

		/**
		 * A human readable label.
		 */
		label?: string;
	}

	export function isNamedProblemMatcher(value: ProblemMatcher): value is INamedProblemMatcher {
		return Types.isString((<INamedProblemMatcher>value).name);
	}
}

export class ProblemPatternParser extends Parser {

	constructor(logger: IProblemReporter) {
		super(logger);
	}

	public parse(value: Config.IProblemPattern): IProblemPattern;
	public parse(value: Config.MultiLineProblemPattern): MultiLineProblemPattern;
	public parse(value: Config.INamedProblemPattern): INamedProblemPattern;
	public parse(value: Config.INamedMultiLineCheckedProblemPattern): INamedMultiLineProblemPattern;
	public parse(value: Config.IProblemPattern | Config.MultiLineProblemPattern | Config.INamedProblemPattern | Config.INamedMultiLineCheckedProblemPattern): IProblemPattern | MultiLineProblemPattern | INamedProblemPattern | INamedMultiLineProblemPattern | null {
		if (Config.NamedMultiLineCheckedProblemPattern.is(value)) {
			return this.createNamedMultiLineProblemPattern(value);
		} else if (Config.MultiLineCheckedProblemPattern.is(value)) {
			return this.createMultiLineProblemPattern(value);
		} else if (Config.NamedCheckedProblemPattern.is(value)) {
			const result = this.createSingleProblemPattern(value) as INamedProblemPattern;
			result.name = value.name;
			return result;
		} else if (Config.CheckedProblemPattern.is(value)) {
			return this.createSingleProblemPattern(value);
		} else {
			this.error(localize('ProblemPatternParser.problemPattern.missingRegExp', '问题模式缺少正则表达式。'));
			return null;
		}
	}

	private createSingleProblemPattern(value: Config.ICheckedProblemPattern): IProblemPattern | null {
		const result = this.doCreateSingleProblemPattern(value, true);
		if (result === undefined) {
			return null;
		} else if (result.kind === undefined) {
			result.kind = ProblemLocationKind.Location;
		}
		return this.validateProblemPattern([result]) ? result : null;
	}

	private createNamedMultiLineProblemPattern(value: Config.INamedMultiLineCheckedProblemPattern): INamedMultiLineProblemPattern | null {
		const validPatterns = this.createMultiLineProblemPattern(value.patterns);
		if (!validPatterns) {
			return null;
		}
		const result = {
			name: value.name,
			label: value.label ? value.label : value.name,
			patterns: validPatterns
		};
		return result;
	}

	private createMultiLineProblemPattern(values: Config.MultiLineCheckedProblemPattern): MultiLineProblemPattern | null {
		const result: MultiLineProblemPattern = [];
		for (let i = 0; i < values.length; i++) {
			const pattern = this.doCreateSingleProblemPattern(values[i], false);
			if (pattern === undefined) {
				return null;
			}
			if (i < values.length - 1) {
				if (!Types.isUndefined(pattern.loop) && pattern.loop) {
					pattern.loop = false;
					this.error(localize('ProblemPatternParser.loopProperty.notLast', '循环属性仅在最一个行匹配程序上受支持。'));
				}
			}
			result.push(pattern);
		}
		if (!result || result.length === 0) {
			this.error(localize('ProblemPatternParser.problemPattern.emptyPattern', '问题模式无效。至少必须包含一个模式。'));
			return null;
		}
		if (result[0].kind === undefined) {
			result[0].kind = ProblemLocationKind.Location;
		}
		return this.validateProblemPattern(result) ? result : null;
	}

	private doCreateSingleProblemPattern(value: Config.ICheckedProblemPattern, setDefaults: boolean): IProblemPattern | undefined {
		const regexp = this.createRegularExpression(value.regexp);
		if (regexp === undefined) {
			return undefined;
		}
		let result: IProblemPattern = { regexp };
		if (value.kind) {
			result.kind = ProblemLocationKind.fromString(value.kind);
		}

		function copyProperty(result: IProblemPattern, source: Config.IProblemPattern, resultKey: keyof IProblemPattern, sourceKey: keyof Config.IProblemPattern) {
			const value = source[sourceKey];
			if (typeof value === 'number') {
				(result as unknown as Record<string, unknown>)[resultKey] = value;
			}
		}
		copyProperty(result, value, 'file', 'file');
		copyProperty(result, value, 'location', 'location');
		copyProperty(result, value, 'line', 'line');
		copyProperty(result, value, 'character', 'column');
		copyProperty(result, value, 'endLine', 'endLine');
		copyProperty(result, value, 'endCharacter', 'endColumn');
		copyProperty(result, value, 'severity', 'severity');
		copyProperty(result, value, 'code', 'code');
		copyProperty(result, value, 'message', 'message');
		if (value.loop === true || value.loop === false) {
			result.loop = value.loop;
		}
		if (setDefaults) {
			if (result.location || result.kind === ProblemLocationKind.File) {
				const defaultValue: Partial<IProblemPattern> = {
					file: 1,
					message: 0
				};
				result = Objects.mixin(result, defaultValue, false);
			} else {
				const defaultValue: Partial<IProblemPattern> = {
					file: 1,
					line: 2,
					character: 3,
					message: 0
				};
				result = Objects.mixin(result, defaultValue, false);
			}
		}
		return result;
	}

	private validateProblemPattern(values: IProblemPattern[]): boolean {
		if (!values || values.length === 0) {
			this.error(localize('ProblemPatternParser.problemPattern.emptyPattern', '问题模式无效。至少必须包含一个模式。'));
			return false;
		}
		let file: boolean = false, message: boolean = false, location: boolean = false, line: boolean = false;
		const locationKind = (values[0].kind === undefined) ? ProblemLocationKind.Location : values[0].kind;

		values.forEach((pattern, i) => {
			if (i !== 0 && pattern.kind) {
				this.error(localize('ProblemPatternParser.problemPattern.kindProperty.notFirst', '问题模式无效。"kind" 属性必须提供，且仅能为第一个元素'));
			}
			file = file || !Types.isUndefined(pattern.file);
			message = message || !Types.isUndefined(pattern.message);
			location = location || !Types.isUndefined(pattern.location);
			line = line || !Types.isUndefined(pattern.line);
		});
		if (!(file && message)) {
			this.error(localize('ProblemPatternParser.problemPattern.missingProperty', '问题模式无效。必须至少包含一个文件和一条消息。'));
			return false;
		}
		if (locationKind === ProblemLocationKind.Location && !(location || line)) {
			this.error(localize('ProblemPatternParser.problemPattern.missingLocation', '问题模式无效。它必须为“file”，代码行或消息匹配组其中的一项。'));
			return false;
		}
		return true;
	}

	private createRegularExpression(value: string): RegExp | undefined {
		let result: RegExp | undefined;
		try {
			result = new RegExp(value);
		} catch (err) {
			this.error(localize('ProblemPatternParser.invalidRegexp', '错误: 字符串 {0} 不是有效的正则表达式。\r\n', value));
		}
		return result;
	}
}

export class ExtensionRegistryReporter implements IProblemReporter {
	constructor(private _collector: ExtensionMessageCollector, private _validationStatus: ValidationStatus = new ValidationStatus()) {
	}

	public info(message: string): void {
		this._validationStatus.state = ValidationState.Info;
		this._collector.info(message);
	}

	public warn(message: string): void {
		this._validationStatus.state = ValidationState.Warning;
		this._collector.warn(message);
	}

	public error(message: string): void {
		this._validationStatus.state = ValidationState.Error;
		this._collector.error(message);
	}

	public fatal(message: string): void {
		this._validationStatus.state = ValidationState.Fatal;
		this._collector.error(message);
	}

	public get status(): ValidationStatus {
		return this._validationStatus;
	}
}

export namespace Schemas {

	export const ProblemPattern: IJSONSchema = {
		default: {
			regexp: '^([^\\\\s].*)\\\\((\\\\d+,\\\\d+)\\\\):\\\\s*(.*)$',
			file: 1,
			location: 2,
			message: 3
		},
		type: 'object',
		additionalProperties: false,
		properties: {
			regexp: {
				type: 'string',
				description: localize('ProblemPatternSchema.regexp', '用于在输出中查找错误、警告或信息的正则表达式。')
			},
			kind: {
				type: 'string',
				description: localize('ProblemPatternSchema.kind', '模式匹配的是一个位置 (文件、一行) 还是仅为一个文件。')
			},
			file: {
				type: 'integer',
				description: localize('ProblemPatternSchema.file', '文件名的匹配组索引。如果省略，则使用 1。')
			},
			location: {
				type: 'integer',
				description: localize('ProblemPatternSchema.location', '问题位置的匹配组索引。有效的位置模式为(line)、(line,column)和(startLine,startColumn,endLine,endColumn)。如果省略了，将假定(line,column)。')
			},
			line: {
				type: 'integer',
				description: localize('ProblemPatternSchema.line', '问题行的匹配组索引。默认值为 2')
			},
			column: {
				type: 'integer',
				description: localize('ProblemPatternSchema.column', '问题行字符的匹配组索引。默认值为 3')
			},
			endLine: {
				type: 'integer',
				description: localize('ProblemPatternSchema.endLine', '问题结束行的匹配组索引。默认为 undefined')
			},
			endColumn: {
				type: 'integer',
				description: localize('ProblemPatternSchema.endColumn', '问题结束行字符的匹配组索引。默认为 undefined')
			},
			severity: {
				type: 'integer',
				description: localize('ProblemPatternSchema.severity', '问题严重性的匹配组索引。默认为 undefined')
			},
			code: {
				type: 'integer',
				description: localize('ProblemPatternSchema.code', '问题代码的匹配组索引。默认为 undefined')
			},
			message: {
				type: 'integer',
				description: localize('ProblemPatternSchema.message', '消息的匹配组索引。如果省略，则在指定了位置时默认值为 4，在其他情况下默认值为 5。')
			},
			loop: {
				type: 'boolean',
				description: localize('ProblemPatternSchema.loop', '在多行中，匹配程序循环指示是否只要匹配就在循环中执行此模式。只能在多行模式的最后一个模式上指定。')
			}
		}
	};

	export const NamedProblemPattern: IJSONSchema = Objects.deepClone(ProblemPattern);
	NamedProblemPattern.properties = Objects.deepClone(NamedProblemPattern.properties) || {};
	NamedProblemPattern.properties['name'] = {
		type: 'string',
		description: localize('NamedProblemPatternSchema.name', '问题模式的名称。')
	};

	export const MultiLineProblemPattern: IJSONSchema = {
		type: 'array',
		items: ProblemPattern
	};

	export const NamedMultiLineProblemPattern: IJSONSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			name: {
				type: 'string',
				description: localize('NamedMultiLineProblemPatternSchema.name', '问题多行问题模式的名称。')
			},
			patterns: {
				type: 'array',
				description: localize('NamedMultiLineProblemPatternSchema.patterns', '实际模式。'),
				items: ProblemPattern
			}
		}
	};

	export const WatchingPattern: IJSONSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			regexp: {
				type: 'string',
				description: localize('WatchingPatternSchema.regexp', '用于检测后台任务开始或结束的正则表达式。')
			},
			file: {
				type: 'integer',
				description: localize('WatchingPatternSchema.file', '文件名的匹配组索引。可以省略。')
			},
		}
	};

	export const PatternType: IJSONSchema = {
		anyOf: [
			{
				type: 'string',
				description: localize('PatternTypeSchema.name', '所提供或预定义模式的名称')
			},
			Schemas.ProblemPattern,
			Schemas.MultiLineProblemPattern
		],
		description: localize('PatternTypeSchema.description', '问题模式或者所提供或预定义问题模式的名称。如果已指定基准，则可以省略。')
	};

	export const ProblemMatcher: IJSONSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			base: {
				type: 'string',
				description: localize('ProblemMatcherSchema.base', '要使用的基问题匹配程序的名称。')
			},
			owner: {
				type: 'string',
				description: localize('ProblemMatcherSchema.owner', '代码内问题的所有者。如果指定了基准，则可省略。如果省略，并且未指定基准，则默认值为“外部”。')
			},
			source: {
				type: 'string',
				description: localize('ProblemMatcherSchema.source', '描述此诊断信息来源的人类可读字符串。如，"typescript" 或 "super lint"。')
			},
			severity: {
				type: 'string',
				enum: ['error', 'warning', 'info'],
				description: localize('ProblemMatcherSchema.severity', '捕获问题的默认严重性。如果模式未定义严重性的匹配组，则使用。')
			},
			applyTo: {
				type: 'string',
				enum: ['allDocuments', 'openDocuments', 'closedDocuments'],
				description: localize('ProblemMatcherSchema.applyTo', '控制文本文档上报告的问题是否仅应用于打开、关闭或所有文档。')
			},
			pattern: PatternType,
			fileLocation: {
				oneOf: [
					{
						type: 'string',
						enum: ['absolute', 'relative', 'autoDetect', 'search']
					},
					{
						type: 'array',
						prefixItems: [
							{
								type: 'string',
								enum: ['absolute', 'relative', 'autoDetect', 'search']
							},
						],
						minItems: 1,
						maxItems: 1,
						additionalItems: false
					},
					{
						type: 'array',
						prefixItems: [
							{ type: 'string', enum: ['relative', 'autoDetect'] },
							{ type: 'string' },
						],
						minItems: 2,
						maxItems: 2,
						additionalItems: false,
						examples: [
							['relative', '${workspaceFolder}'],
							['autoDetect', '${workspaceFolder}'],
						]
					},
					{
						type: 'array',
						prefixItems: [
							{ type: 'string', enum: ['search'] },
							{
								type: 'object',
								properties: {
									'include': {
										oneOf: [
											{ type: 'string' },
											{ type: 'array', items: { type: 'string' } }
										]
									},
									'exclude': {
										oneOf: [
											{ type: 'string' },
											{ type: 'array', items: { type: 'string' } }
										]
									},
								},
								required: ['include']
							}
						],
						minItems: 2,
						maxItems: 2,
						additionalItems: false,
						examples: [
							['search', { 'include': ['${workspaceFolder}'] }],
							['search', { 'include': ['${workspaceFolder}'], 'exclude': [] }]
						],
					}
				],
				description: localize('ProblemMatcherSchema.fileLocation', '定义应如何解释问题模式中报告的文件名。相对 fileLocation 可以是数组，其中数组的第二个元素是相对文件位置的路径。搜索 fileLocation 模式会在由第二个元素的 include/exclude 属性指定的目录(如果未指定，则为当前工作区目录)中执行深层(而且可能是大量的)文件系统搜索。')
			},
			background: {
				type: 'object',
				additionalProperties: false,
				description: localize('ProblemMatcherSchema.background', '用于跟踪在后台任务上激活的匹配程序的开始和结束的模式。'),
				properties: {
					activeOnStart: {
						type: 'boolean',
						description: localize('ProblemMatcherSchema.background.activeOnStart', '如果设置为 true，则后台监视器将在活动模式下启动。这与任务启动时输出与 beginsPattern 匹配的行相同。')
					},
					beginsPattern: {
						oneOf: [
							{
								type: 'string'
							},
							Schemas.WatchingPattern
						],
						description: localize('ProblemMatcherSchema.background.beginsPattern', '如果在输出内匹配，则会发出后台任务开始的信号。')
					},
					endsPattern: {
						oneOf: [
							{
								type: 'string'
							},
							Schemas.WatchingPattern
						],
						description: localize('ProblemMatcherSchema.background.endsPattern', '如果在输出内匹配，则会发出后台任务结束的信号。')
					}
				}
			},
			watching: {
				type: 'object',
				additionalProperties: false,
				deprecationMessage: localize('ProblemMatcherSchema.watching.deprecated', '"watching" 属性已被弃用，请改用 "background"。'),
				description: localize('ProblemMatcherSchema.watching', '用于跟踪监视匹配程序开始和结束的模式。'),
				properties: {
					activeOnStart: {
						type: 'boolean',
						description: localize('ProblemMatcherSchema.watching.activeOnStart', '如果设置为 true，则观察程序将在活动模式下启动。这与任务启动时输出与 beginsPattern 匹配的行相同。')
					},
					beginsPattern: {
						oneOf: [
							{
								type: 'string'
							},
							Schemas.WatchingPattern
						],
						description: localize('ProblemMatcherSchema.watching.beginsPattern', '如果在输出内匹配，则在监视任务开始时会发出信号。')
					},
					endsPattern: {
						oneOf: [
							{
								type: 'string'
							},
							Schemas.WatchingPattern
						],
						description: localize('ProblemMatcherSchema.watching.endsPattern', '如果在输出内匹配，则在监视任务结束时会发出信号。')
					}
				}
			}
		}
	};

	export const LegacyProblemMatcher: IJSONSchema = Objects.deepClone(ProblemMatcher);
	LegacyProblemMatcher.properties = Objects.deepClone(LegacyProblemMatcher.properties) || {};
	LegacyProblemMatcher.properties['watchedTaskBeginsRegExp'] = {
		type: 'string',
		deprecationMessage: localize('LegacyProblemMatcherSchema.watchedBegin.deprecated', '此属性已弃用。请改用观看属性。'),
		description: localize('LegacyProblemMatcherSchema.watchedBegin', '一个正则表达式，发出受监视任务开始执行(通过文件监视触发)的信号。')
	};
	LegacyProblemMatcher.properties['watchedTaskEndsRegExp'] = {
		type: 'string',
		deprecationMessage: localize('LegacyProblemMatcherSchema.watchedEnd.deprecated', '此属性已弃用。请改用观看属性。'),
		description: localize('LegacyProblemMatcherSchema.watchedEnd', '一个正则表达式，发出受监视任务结束执行的信号。')
	};

	export const NamedProblemMatcher: IJSONSchema = Objects.deepClone(ProblemMatcher);
	NamedProblemMatcher.properties = Objects.deepClone(NamedProblemMatcher.properties) || {};
	NamedProblemMatcher.properties.name = {
		type: 'string',
		description: localize('NamedProblemMatcherSchema.name', '要引用的问题匹配程序的名称。')
	};
	NamedProblemMatcher.properties.label = {
		type: 'string',
		description: localize('NamedProblemMatcherSchema.label', '问题匹配程序的人类可读标签。')
	};
}

const problemPatternExtPoint = ExtensionsRegistry.registerExtensionPoint<Config.NamedProblemPatterns>({
	extensionPoint: 'problemPatterns',
	jsonSchema: {
		description: localize('ProblemPatternExtPoint', '提供问题模式'),
		type: 'array',
		items: {
			anyOf: [
				Schemas.NamedProblemPattern,
				Schemas.NamedMultiLineProblemPattern
			]
		}
	}
});

export interface IProblemPatternRegistry {
	onReady(): Promise<void>;

	get(key: string): IProblemPattern | MultiLineProblemPattern;
}

class ProblemPatternRegistryImpl implements IProblemPatternRegistry {

	private patterns: IStringDictionary<Types.SingleOrMany<IProblemPattern>>;
	private readyPromise: Promise<void>;

	constructor() {
		this.patterns = Object.create(null);
		this.fillDefaults();
		this.readyPromise = new Promise<void>((resolve, reject) => {
			problemPatternExtPoint.setHandler((extensions, delta) => {
				// We get all statically know extension during startup in one batch
				try {
					delta.removed.forEach(extension => {
						const problemPatterns = extension.value as Config.NamedProblemPatterns;
						for (const pattern of problemPatterns) {
							if (this.patterns[pattern.name]) {
								delete this.patterns[pattern.name];
							}
						}
					});
					delta.added.forEach(extension => {
						const problemPatterns = extension.value as Config.NamedProblemPatterns;
						const parser = new ProblemPatternParser(new ExtensionRegistryReporter(extension.collector));
						for (const pattern of problemPatterns) {
							if (Config.NamedMultiLineCheckedProblemPattern.is(pattern)) {
								const result = parser.parse(pattern);
								if (parser.problemReporter.status.state < ValidationState.Error) {
									this.add(result.name, result.patterns);
								} else {
									extension.collector.error(localize('ProblemPatternRegistry.error', '无效问题模式。此模式将被忽略。'));
									extension.collector.error(JSON.stringify(pattern, undefined, 4));
								}
							}
							else if (Config.NamedProblemPattern.is(pattern)) {
								const result = parser.parse(pattern);
								if (parser.problemReporter.status.state < ValidationState.Error) {
									this.add(pattern.name, result);
								} else {
									extension.collector.error(localize('ProblemPatternRegistry.error', '无效问题模式。此模式将被忽略。'));
									extension.collector.error(JSON.stringify(pattern, undefined, 4));
								}
							}
							parser.reset();
						}
					});
				} catch (error) {
					// Do nothing
				}
				resolve(undefined);
			});
		});
	}

	public onReady(): Promise<void> {
		return this.readyPromise;
	}

	public add(key: string, value: Types.SingleOrMany<IProblemPattern>): void {
		this.patterns[key] = value;
	}

	public get(key: string): Types.SingleOrMany<IProblemPattern> {
		return this.patterns[key];
	}

	private fillDefaults(): void {
		this.add('msCompile', {
			regexp: /^\s*(?:\s*\d+>)?(\S.*?)(?:\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\))?\s*:\s+(?:(\S+)\s+)?((?:fatal +)?error|warning|info)\s+(\w+\d+)?\s*:\s*(.*)$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			location: 2,
			severity: 4,
			code: 5,
			message: 6
		});
		this.add('gulp-tsc', {
			regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(\d+)\s+(.*)$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			location: 2,
			code: 3,
			message: 4
		});
		this.add('cpp', {
			regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(C\d+)\s*:\s*(.*)$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			location: 2,
			severity: 3,
			code: 4,
			message: 5
		});
		this.add('csc', {
			regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(CS\d+)\s*:\s*(.*)$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			location: 2,
			severity: 3,
			code: 4,
			message: 5
		});
		this.add('vb', {
			regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(BC\d+)\s*:\s*(.*)$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			location: 2,
			severity: 3,
			code: 4,
			message: 5
		});
		this.add('lessCompile', {
			regexp: /^\s*(.*) in file (.*) line no. (\d+)$/,
			kind: ProblemLocationKind.Location,
			message: 1,
			file: 2,
			line: 3
		});
		this.add('jshint', {
			regexp: /^(.*):\s+line\s+(\d+),\s+col\s+(\d+),\s(.+?)(?:\s+\((\w)(\d+)\))?$/,
			kind: ProblemLocationKind.Location,
			file: 1,
			line: 2,
			character: 3,
			message: 4,
			severity: 5,
			code: 6
		});
		this.add('jshint-stylish', [
			{
				regexp: /^(.+)$/,
				kind: ProblemLocationKind.Location,
				file: 1
			},
			{
				regexp: /^\s+line\s+(\d+)\s+col\s+(\d+)\s+(.+?)(?:\s+\((\w)(\d+)\))?$/,
				line: 1,
				character: 2,
				message: 3,
				severity: 4,
				code: 5,
				loop: true
			}
		]);
		this.add('eslint-compact', {
			regexp: /^(.+):\sline\s(\d+),\scol\s(\d+),\s(Error|Warning|Info)\s-\s(.+)\s\((.+)\)$/,
			file: 1,
			kind: ProblemLocationKind.Location,
			line: 2,
			character: 3,
			severity: 4,
			message: 5,
			code: 6
		});
		this.add('eslint-stylish', [
			{
				regexp: /^((?:[a-zA-Z]:)*[./\\]+.*?)$/,
				kind: ProblemLocationKind.Location,
				file: 1
			},
			{
				regexp: /^\s+(\d+):(\d+)\s+(error|warning|info)\s+(.+?)(?:\s\s+(.*))?$/,
				line: 1,
				character: 2,
				severity: 3,
				message: 4,
				code: 5,
				loop: true
			}
		]);
		this.add('go', {
			regexp: /^([^:]*: )?((.:)?[^:]*):(\d+)(:(\d+))?: (.*)$/,
			kind: ProblemLocationKind.Location,
			file: 2,
			line: 4,
			character: 6,
			message: 7
		});
	}
}

export const ProblemPatternRegistry: IProblemPatternRegistry = new ProblemPatternRegistryImpl();

export class ProblemMatcherParser extends Parser {

	constructor(logger: IProblemReporter) {
		super(logger);
	}

	public parse(json: Config.ProblemMatcher): ProblemMatcher | undefined {
		const result = this.createProblemMatcher(json);
		if (!this.checkProblemMatcherValid(json, result)) {
			return undefined;
		}
		this.addWatchingMatcher(json, result);

		return result;
	}

	private checkProblemMatcherValid(externalProblemMatcher: Config.ProblemMatcher, problemMatcher: ProblemMatcher | null): problemMatcher is ProblemMatcher {
		if (!problemMatcher) {
			this.error(localize('ProblemMatcherParser.noProblemMatcher', '错误: 说明无法转换为问题匹配器:\r\n{0}\r\n', JSON.stringify(externalProblemMatcher, null, 4)));
			return false;
		}
		if (!problemMatcher.pattern) {
			this.error(localize('ProblemMatcherParser.noProblemPattern', '错误: 说明未定义有效的问题模式:\r\n{0}\r\n', JSON.stringify(externalProblemMatcher, null, 4)));
			return false;
		}
		if (!problemMatcher.owner) {
			this.error(localize('ProblemMatcherParser.noOwner', '错误: 说明未定义所有者:\r\n{0}\r\n', JSON.stringify(externalProblemMatcher, null, 4)));
			return false;
		}
		if (Types.isUndefined(problemMatcher.fileLocation)) {
			this.error(localize('ProblemMatcherParser.noFileLocation', '错误: 说明未定义文件位置:\r\n{0}\r\n', JSON.stringify(externalProblemMatcher, null, 4)));
			return false;
		}
		return true;
	}

	private createProblemMatcher(description: Config.ProblemMatcher): ProblemMatcher | null {
		let result: ProblemMatcher | null = null;

		const owner = Types.isString(description.owner) ? description.owner : UUID.generateUuid();
		const source = Types.isString(description.source) ? description.source : undefined;
		let applyTo = Types.isString(description.applyTo) ? ApplyToKind.fromString(description.applyTo) : ApplyToKind.allDocuments;
		if (!applyTo) {
			applyTo = ApplyToKind.allDocuments;
		}
		let fileLocation: FileLocationKind | undefined = undefined;
		let filePrefix: string | Config.SearchFileLocationArgs | undefined = undefined;

		let kind: FileLocationKind | undefined;
		if (Types.isUndefined(description.fileLocation)) {
			fileLocation = FileLocationKind.Relative;
			filePrefix = '${workspaceFolder}';
		} else if (Types.isString(description.fileLocation)) {
			kind = FileLocationKind.fromString(<string>description.fileLocation);
			if (kind) {
				fileLocation = kind;
				if ((kind === FileLocationKind.Relative) || (kind === FileLocationKind.AutoDetect)) {
					filePrefix = '${workspaceFolder}';
				} else if (kind === FileLocationKind.Search) {
					filePrefix = { include: ['${workspaceFolder}'] };
				}
			}
		} else if (Types.isStringArray(description.fileLocation)) {
			const values = <string[]>description.fileLocation;
			if (values.length > 0) {
				kind = FileLocationKind.fromString(values[0]);
				if (values.length === 1 && kind === FileLocationKind.Absolute) {
					fileLocation = kind;
				} else if (values.length === 2 && (kind === FileLocationKind.Relative || kind === FileLocationKind.AutoDetect) && values[1]) {
					fileLocation = kind;
					filePrefix = values[1];
				}
			}
		} else if (Array.isArray(description.fileLocation)) {
			const kind = FileLocationKind.fromString(description.fileLocation[0]);
			if (kind === FileLocationKind.Search) {
				fileLocation = FileLocationKind.Search;
				filePrefix = description.fileLocation[1] ?? { include: ['${workspaceFolder}'] };
			}
		}

		const pattern = description.pattern ? this.createProblemPattern(description.pattern) : undefined;

		let severity = description.severity ? Severity.fromValue(description.severity) : undefined;
		if (severity === Severity.Ignore) {
			this.info(localize('ProblemMatcherParser.unknownSeverity', '信息: 未知的严重性 {0}。有效值为“错误”、“警告”和“信息”。\r\n', description.severity));
			severity = Severity.Error;
		}

		if (Types.isString(description.base)) {
			const variableName = <string>description.base;
			if (variableName.length > 1 && variableName[0] === '$') {
				const base = ProblemMatcherRegistry.get(variableName.substring(1));
				if (base) {
					result = Objects.deepClone(base);
					if (description.owner !== undefined && owner !== undefined) {
						result.owner = owner;
					}
					if (description.source !== undefined && source !== undefined) {
						result.source = source;
					}
					if (description.fileLocation !== undefined && fileLocation !== undefined) {
						result.fileLocation = fileLocation;
						result.filePrefix = filePrefix;
					}
					if (description.pattern !== undefined && pattern !== undefined && pattern !== null) {
						result.pattern = pattern;
					}
					if (description.severity !== undefined && severity !== undefined) {
						result.severity = severity;
					}
					if (description.applyTo !== undefined && applyTo !== undefined) {
						result.applyTo = applyTo;
					}
				}
			}
		} else if (fileLocation && pattern) {
			result = {
				owner: owner,
				applyTo: applyTo,
				fileLocation: fileLocation,
				pattern: pattern,
			};
			if (source) {
				result.source = source;
			}
			if (filePrefix) {
				result.filePrefix = filePrefix;
			}
			if (severity) {
				result.severity = severity;
			}
		}
		if (Config.isNamedProblemMatcher(description)) {
			(result as INamedProblemMatcher).name = description.name;
			(result as INamedProblemMatcher).label = Types.isString(description.label) ? description.label : description.name;
		}
		return result;
	}

	private createProblemPattern(value: string | Config.IProblemPattern | Config.MultiLineProblemPattern): Types.SingleOrMany<IProblemPattern> | null {
		if (Types.isString(value)) {
			const variableName: string = <string>value;
			if (variableName.length > 1 && variableName[0] === '$') {
				const result = ProblemPatternRegistry.get(variableName.substring(1));
				if (!result) {
					this.error(localize('ProblemMatcherParser.noDefinedPatter', '错误: 标识符为 {0} 的模式不存在。', variableName));
				}
				return result;
			} else {
				if (variableName.length === 0) {
					this.error(localize('ProblemMatcherParser.noIdentifier', '错误: 模式属性引用空标识符。'));
				} else {
					this.error(localize('ProblemMatcherParser.noValidIdentifier', '错误: 模式属性 {0} 是无效的模式变量名。', variableName));
				}
			}
		} else if (value) {
			const problemPatternParser = new ProblemPatternParser(this.problemReporter);
			if (Array.isArray(value)) {
				return problemPatternParser.parse(value);
			} else {
				return problemPatternParser.parse(value);
			}
		}
		return null;
	}

	private addWatchingMatcher(external: Config.ProblemMatcher, internal: ProblemMatcher): void {
		const oldBegins = this.createRegularExpression(external.watchedTaskBeginsRegExp);
		const oldEnds = this.createRegularExpression(external.watchedTaskEndsRegExp);
		if (oldBegins && oldEnds) {
			internal.watching = {
				activeOnStart: false,
				beginsPattern: { regexp: oldBegins },
				endsPattern: { regexp: oldEnds }
			};
			return;
		}
		const backgroundMonitor = external.background || external.watching;
		if (Types.isUndefinedOrNull(backgroundMonitor)) {
			return;
		}
		const begins: IWatchingPattern | null = this.createWatchingPattern(backgroundMonitor.beginsPattern);
		const ends: IWatchingPattern | null = this.createWatchingPattern(backgroundMonitor.endsPattern);
		if (begins && ends) {
			internal.watching = {
				activeOnStart: Types.isBoolean(backgroundMonitor.activeOnStart) ? backgroundMonitor.activeOnStart : false,
				beginsPattern: begins,
				endsPattern: ends
			};
			return;
		}
		if (begins || ends) {
			this.error(localize('ProblemMatcherParser.problemPattern.watchingMatcher', '问题匹配程序必须定义监视的开始模式和结束模式。'));
		}
	}

	private createWatchingPattern(external: string | Config.IWatchingPattern | undefined): IWatchingPattern | null {
		if (Types.isUndefinedOrNull(external)) {
			return null;
		}
		let regexp: RegExp | null;
		let file: number | undefined;
		if (Types.isString(external)) {
			regexp = this.createRegularExpression(external);
		} else {
			regexp = this.createRegularExpression(external.regexp);
			if (Types.isNumber(external.file)) {
				file = external.file;
			}
		}
		if (!regexp) {
			return null;
		}
		return file ? { regexp, file } : { regexp, file: 1 };
	}

	private createRegularExpression(value: string | undefined): RegExp | null {
		let result: RegExp | null = null;
		if (!value) {
			return result;
		}
		try {
			result = new RegExp(value);
		} catch (err) {
			this.error(localize('ProblemMatcherParser.invalidRegexp', '错误: 字符串 {0} 不是有效的正则表达式。\r\n', value));
		}
		return result;
	}
}

const problemMatchersExtPoint = ExtensionsRegistry.registerExtensionPoint<Config.INamedProblemMatcher[]>({
	extensionPoint: 'problemMatchers',
	deps: [problemPatternExtPoint],
	jsonSchema: {
		description: localize('ProblemMatcherExtPoint', '提供问题匹配程序'),
		type: 'array',
		items: Schemas.NamedProblemMatcher
	}
});

export interface IProblemMatcherRegistry {
	onReady(): Promise<void>;
	get(name: string): INamedProblemMatcher;
	keys(): string[];
	readonly onMatcherChanged: Event<void>;
}

class ProblemMatcherRegistryImpl implements IProblemMatcherRegistry {

	private matchers: IStringDictionary<INamedProblemMatcher>;
	private readyPromise: Promise<void>;
	private readonly _onMatchersChanged: Emitter<void> = new Emitter<void>();
	public readonly onMatcherChanged: Event<void> = this._onMatchersChanged.event;


	constructor() {
		this.matchers = Object.create(null);
		this.fillDefaults();
		this.readyPromise = new Promise<void>((resolve, reject) => {
			problemMatchersExtPoint.setHandler((extensions, delta) => {
				try {
					delta.removed.forEach(extension => {
						const problemMatchers = extension.value;
						for (const matcher of problemMatchers) {
							if (this.matchers[matcher.name]) {
								delete this.matchers[matcher.name];
							}
						}
					});
					delta.added.forEach(extension => {
						const problemMatchers = extension.value;
						const parser = new ProblemMatcherParser(new ExtensionRegistryReporter(extension.collector));
						for (const matcher of problemMatchers) {
							const result = parser.parse(matcher);
							if (result && isNamedProblemMatcher(result)) {
								this.add(result);
							}
						}
					});
					if ((delta.removed.length > 0) || (delta.added.length > 0)) {
						this._onMatchersChanged.fire();
					}
				} catch (error) {
				}
				const matcher = this.get('tsc-watch');
				if (matcher) {
					(matcher as unknown as Record<string, unknown>).tscWatch = true;
				}
				resolve(undefined);
			});
		});
	}

	public onReady(): Promise<void> {
		ProblemPatternRegistry.onReady();
		return this.readyPromise;
	}

	public add(matcher: INamedProblemMatcher): void {
		this.matchers[matcher.name] = matcher;
	}

	public get(name: string): INamedProblemMatcher {
		return this.matchers[name];
	}

	public keys(): string[] {
		return Object.keys(this.matchers);
	}

	private fillDefaults(): void {
		this.add({
			name: 'msCompile',
			label: localize('msCompile', '微软编译器问题'),
			owner: 'msCompile',
			source: 'cpp',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			pattern: ProblemPatternRegistry.get('msCompile')
		});

		this.add({
			name: 'lessCompile',
			label: localize('lessCompile', 'Less 问题'),
			deprecated: true,
			owner: 'lessCompile',
			source: 'less',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			pattern: ProblemPatternRegistry.get('lessCompile'),
			severity: Severity.Error
		});

		this.add({
			name: 'gulp-tsc',
			label: localize('gulp-tsc', 'Gulp TSC 问题'),
			owner: 'typescript',
			source: 'ts',
			applyTo: ApplyToKind.closedDocuments,
			fileLocation: FileLocationKind.Relative,
			filePrefix: '${workspaceFolder}',
			pattern: ProblemPatternRegistry.get('gulp-tsc')
		});

		this.add({
			name: 'jshint',
			label: localize('jshint', 'JSHint 问题'),
			owner: 'jshint',
			source: 'jshint',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			pattern: ProblemPatternRegistry.get('jshint')
		});

		this.add({
			name: 'jshint-stylish',
			label: localize('jshint-stylish', 'JSHint stylish 问题'),
			owner: 'jshint',
			source: 'jshint',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			pattern: ProblemPatternRegistry.get('jshint-stylish')
		});

		this.add({
			name: 'eslint-compact',
			label: localize('eslint-compact', 'ESLint compact 问题'),
			owner: 'eslint',
			source: 'eslint',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			filePrefix: '${workspaceFolder}',
			pattern: ProblemPatternRegistry.get('eslint-compact')
		});

		this.add({
			name: 'eslint-stylish',
			label: localize('eslint-stylish', 'ESLint stylish 问题'),
			owner: 'eslint',
			source: 'eslint',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Absolute,
			pattern: ProblemPatternRegistry.get('eslint-stylish')
		});

		this.add({
			name: 'go',
			label: localize('go', 'Go 问题'),
			owner: 'go',
			source: 'go',
			applyTo: ApplyToKind.allDocuments,
			fileLocation: FileLocationKind.Relative,
			filePrefix: '${workspaceFolder}',
			pattern: ProblemPatternRegistry.get('go')
		});
	}
}

export const ProblemMatcherRegistry: IProblemMatcherRegistry = new ProblemMatcherRegistryImpl();
