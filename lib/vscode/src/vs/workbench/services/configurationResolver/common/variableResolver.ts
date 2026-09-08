/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { IStringDictionary } from '../../../../base/common/collections.js';
import { normalizeDriveLetter } from '../../../../base/common/labels.js';
import * as paths from '../../../../base/common/path.js';
import { IProcessEnvironment, isWindows } from '../../../../base/common/platform.js';
import * as process from '../../../../base/common/process.js';
import * as types from '../../../../base/common/types.js';
import { URI as uri } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceFolderData } from '../../../../platform/workspace/common/workspace.js';
import { allVariableKinds, IConfigurationResolverService, VariableError, VariableKind } from './configurationResolver.js';
import { ConfigurationResolverExpression, IResolvedValue, Replacement } from './configurationResolverExpression.js';

interface IVariableResolveContext {
	getFolderUri(folderName: string): uri | undefined;
	getWorkspaceFolderCount(): number;
	getConfigurationValue(folderUri: uri | undefined, section: string): string | undefined;
	getAppRoot(): string | undefined;
	getExecPath(): string | undefined;
	getFilePath(): string | undefined;
	getWorkspaceFolderPathForFile?(): string | undefined;
	getSelectedText(): string | undefined;
	getLineNumber(): string | undefined;
	getColumnNumber(): string | undefined;
	getExtension(id: string): Promise<{ readonly extensionLocation: uri } | undefined>;
}

type Environment = { env: IProcessEnvironment | undefined; userHome: string | undefined };

export abstract class AbstractVariableResolverService implements IConfigurationResolverService {

	declare readonly _serviceBrand: undefined;

	private _context: IVariableResolveContext;
	private _labelService?: ILabelService;
	private _envVariablesPromise?: Promise<IProcessEnvironment>;
	private _userHomePromise?: Promise<string>;
	protected _contributedVariables: Map<string, () => Promise<string | undefined>> = new Map();

	public readonly resolvableVariables = new Set<string>(allVariableKinds);

	constructor(_context: IVariableResolveContext, _labelService?: ILabelService, _userHomePromise?: Promise<string>, _envVariablesPromise?: Promise<IProcessEnvironment>) {
		this._context = _context;
		this._labelService = _labelService;
		this._userHomePromise = _userHomePromise;
		if (_envVariablesPromise) {
			this._envVariablesPromise = _envVariablesPromise.then(envVariables => {
				return this.prepareEnv(envVariables);
			});
		}
	}

	private prepareEnv(envVariables: IProcessEnvironment): IProcessEnvironment {
		// windows env variables are case insensitive
		if (isWindows) {
			const ev: IProcessEnvironment = Object.create(null);
			Object.keys(envVariables).forEach(key => {
				ev[key.toLowerCase()] = envVariables[key];
			});
			return ev;
		}
		return envVariables;
	}

	public async resolveWithEnvironment(environment: IProcessEnvironment, folder: IWorkspaceFolderData | undefined, value: string): Promise<string> {
		const expr = ConfigurationResolverExpression.parse(value);

		for (const replacement of expr.unresolved()) {
			const resolvedValue = await this.evaluateSingleVariable(replacement, folder?.uri, environment);
			if (resolvedValue !== undefined) {
				expr.resolve(replacement, String(resolvedValue));
			}
		}

		return expr.toObject();
	}

	public async resolveAsync<T>(folder: IWorkspaceFolderData | undefined, config: T): Promise<T extends ConfigurationResolverExpression<infer R> ? R : T> {
		const expr = ConfigurationResolverExpression.parse(config);

		for (const replacement of expr.unresolved()) {
			const resolvedValue = await this.evaluateSingleVariable(replacement, folder?.uri);
			if (resolvedValue !== undefined) {
				expr.resolve(replacement, String(resolvedValue));
			}
		}

		return expr.toObject() as (T extends ConfigurationResolverExpression<infer R> ? R : T);
	}

	public resolveWithInteractionReplace(folder: IWorkspaceFolderData | undefined, config: unknown): Promise<unknown> {
		throw new Error('resolveWithInteractionReplace not implemented.');
	}

	public resolveWithInteraction(folder: IWorkspaceFolderData | undefined, config: unknown): Promise<Map<string, string> | undefined> {
		throw new Error('resolveWithInteraction not implemented.');
	}

	public contributeVariable(variable: string, resolution: () => Promise<string | undefined>): void {
		if (this._contributedVariables.has(variable)) {
			throw new Error('Variable ' + variable + ' is contributed twice.');
		} else {
			this.resolvableVariables.add(variable);
			this._contributedVariables.set(variable, resolution);
		}
	}

	private fsPath(displayUri: uri): string {
		return this._labelService ? this._labelService.getUriLabel(displayUri, { noPrefix: true }) : displayUri.fsPath;
	}

	protected async evaluateSingleVariable(replacement: Replacement, folderUri: uri | undefined, processEnvironment?: IProcessEnvironment, commandValueMapping?: IStringDictionary<IResolvedValue>): Promise<IResolvedValue | string | undefined> {


		const environment: Environment = {
			env: (processEnvironment !== undefined) ? this.prepareEnv(processEnvironment) : await this._envVariablesPromise,
			userHome: (processEnvironment !== undefined) ? undefined : await this._userHomePromise
		};

		const { name: variable, arg: argument } = replacement;

		// common error handling for all variables that require an open editor
		const getFilePath = (variableKind: VariableKind): string => {
			const filePath = this._context.getFilePath();
			if (filePath) {
				return normalizeDriveLetter(filePath);
			}
			throw new VariableError(variableKind, (localize('canNotResolveFile', "无法解析变量 {0}。请打开一个编辑器。", replacement.id)));
		};

		// common error handling for all variables that require an open editor
		const getFolderPathForFile = (variableKind: VariableKind): string => {
			const filePath = getFilePath(variableKind);		// throws error if no editor open
			if (this._context.getWorkspaceFolderPathForFile) {
				const folderPath = this._context.getWorkspaceFolderPathForFile();
				if (folderPath) {
					return normalizeDriveLetter(folderPath);
				}
			}
			throw new VariableError(variableKind, localize('canNotResolveFolderForFile', "变量 {0}: 找不到 \"{1}\" 的工作区文件夹。", replacement.id, paths.basename(filePath)));
		};

		// common error handling for all variables that require an open folder and accept a folder name argument
		const getFolderUri = (variableKind: VariableKind): uri => {
			if (argument) {
				const folder = this._context.getFolderUri(argument);
				if (folder) {
					return folder;
				}
				throw new VariableError(variableKind, localize('canNotFindFolder', "找不到文件夹“{1}”，因此无法解析变量 {0}。", variableKind, argument));
			}

			if (folderUri) {
				return folderUri;
			}

			if (this._context.getWorkspaceFolderCount() > 1) {
				throw new VariableError(variableKind, localize('canNotResolveWorkspaceFolderMultiRoot', "无法在多文件夹工作区中解析变量 {0}。使用 \":\" 和工作区文件夹名称来限定此变量的作用域。", variableKind));
			}
			throw new VariableError(variableKind, localize('canNotResolveWorkspaceFolder', "无法解析变量 {0}。请打开一个文件夹。", variableKind));
		};

		switch (variable) {
			case 'env':
				if (argument) {
					if (environment.env) {
						const env = environment.env[isWindows ? argument.toLowerCase() : argument];
						if (types.isString(env)) {
							return env;
						}
					}
					return '';
				}
				throw new VariableError(VariableKind.Env, localize('missingEnvVarName', "未给出环境变量名称，因此无法解析变量 {0}。", replacement.id));

			case 'config':
				if (argument) {
					const config = this._context.getConfigurationValue(folderUri, argument);
					if (types.isUndefinedOrNull(config)) {
						throw new VariableError(VariableKind.Config, localize('configNotFound', "未能找到设置“{1}”，因此无法解析变量 {0}。", replacement.id, argument));
					}
					if (types.isObject(config)) {
						throw new VariableError(VariableKind.Config, localize('configNoString', "\"{1}\" 为结构类型值，因此无法解析变量 {0}。", replacement.id, argument));
					}
					return config;
				}
				throw new VariableError(VariableKind.Config, localize('missingConfigName', "未给出设置名称，因此无法解析变量 {0}。", replacement.id));

			case 'command':
				return this.resolveFromMap(VariableKind.Command, replacement.id, argument, commandValueMapping, 'command');

			case 'input':
				return this.resolveFromMap(VariableKind.Input, replacement.id, argument, commandValueMapping, 'input');

			case 'extensionInstallFolder':
				if (argument) {
					const ext = await this._context.getExtension(argument);
					if (!ext) {
						throw new VariableError(VariableKind.ExtensionInstallFolder, localize('extensionNotInstalled', "无法解析变量 {0}，因为未安装扩展 {1}。", replacement.id, argument));
					}
					return this.fsPath(ext.extensionLocation);
				}
				throw new VariableError(VariableKind.ExtensionInstallFolder, localize('missingExtensionName', "无法解析变量 {0}，因为未给出扩展名。", replacement.id));

			default: {
				switch (variable) {
					case 'workspaceRoot':
					case 'workspaceFolder': {
						const uri = getFolderUri(VariableKind.WorkspaceFolder);
						return uri ? normalizeDriveLetter(this.fsPath(uri)) : undefined;
					}

					case 'cwd': {
						if (!folderUri && !argument) {
							return process.cwd();
						}
						const uri = getFolderUri(VariableKind.Cwd);
						return uri ? normalizeDriveLetter(this.fsPath(uri)) : undefined;
					}

					case 'workspaceRootFolderName':
					case 'workspaceFolderBasename': {
						const uri = getFolderUri(VariableKind.WorkspaceFolderBasename);
						return uri ? normalizeDriveLetter(paths.basename(this.fsPath(uri))) : undefined;
					}

					case 'userHome':
						if (environment.userHome) {
							return environment.userHome;
						}
						throw new VariableError(VariableKind.UserHome, localize('canNotResolveUserHome', "无法解析 {0} 变量。未定义 UserHome 路径", replacement.id));

					case 'lineNumber': {
						const lineNumber = this._context.getLineNumber();
						if (lineNumber) {
							return lineNumber;
						}
						throw new VariableError(VariableKind.LineNumber, localize('canNotResolveLineNumber', "无法解析变量 {0}。请确保已在活动编辑器中选择一行内容。", replacement.id));
					}

					case 'columnNumber': {
						const columnNumber = this._context.getColumnNumber();
						if (columnNumber) {
							return columnNumber;
						}
						throw new Error(localize('canNotResolveColumnNumber', "无法解析变量 {0}。请确保已在活动编辑器中选择一列内容。", replacement.id));
					}

					case 'selectedText': {
						const selectedText = this._context.getSelectedText();
						if (selectedText) {
							return selectedText;
						}
						throw new VariableError(VariableKind.SelectedText, localize('canNotResolveSelectedText', "无法解析变量 {0}。请确保已在活动编辑器中选择一些文字。", replacement.id));
					}

					case 'file':
						return getFilePath(VariableKind.File);

					case 'fileWorkspaceFolder':
						return getFolderPathForFile(VariableKind.FileWorkspaceFolder);

					case 'fileWorkspaceFolderBasename':
						return paths.basename(getFolderPathForFile(VariableKind.FileWorkspaceFolderBasename));

					case 'relativeFile':
						if (folderUri || argument) {
							return paths.relative(this.fsPath(getFolderUri(VariableKind.RelativeFile)), getFilePath(VariableKind.RelativeFile));
						}
						return getFilePath(VariableKind.RelativeFile);

					case 'relativeFileDirname': {
						const dirname = paths.dirname(getFilePath(VariableKind.RelativeFileDirname));
						if (folderUri || argument) {
							const relative = paths.relative(this.fsPath(getFolderUri(VariableKind.RelativeFileDirname)), dirname);
							return relative.length === 0 ? '.' : relative;
						}
						return dirname;
					}

					case 'fileDirname':
						return paths.dirname(getFilePath(VariableKind.FileDirname));

					case 'fileExtname':
						return paths.extname(getFilePath(VariableKind.FileExtname));

					case 'fileBasename':
						return paths.basename(getFilePath(VariableKind.FileBasename));

					case 'fileBasenameNoExtension': {
						const basename = paths.basename(getFilePath(VariableKind.FileBasenameNoExtension));
						return (basename.slice(0, basename.length - paths.extname(basename).length));
					}

					case 'fileDirnameBasename':
						return paths.basename(paths.dirname(getFilePath(VariableKind.FileDirnameBasename)));

					case 'execPath': {
						const ep = this._context.getExecPath();
						if (ep) {
							return ep;
						}
						return replacement.id;
					}

					case 'execInstallFolder': {
						const ar = this._context.getAppRoot();
						if (ar) {
							return ar;
						}
						return replacement.id;
					}

					case 'pathSeparator':
					case '/':
						return paths.sep;

					default: {
						try {
							return this.resolveFromMap(VariableKind.Unknown, replacement.id, argument, commandValueMapping, undefined);
						} catch {
							return replacement.id;
						}
					}
				}
			}
		}
	}

	private resolveFromMap(variableKind: VariableKind, match: string, argument: string | undefined, commandValueMapping: IStringDictionary<IResolvedValue> | undefined, prefix: string | undefined): string {
		if (argument && commandValueMapping) {
			const v = (prefix === undefined) ? commandValueMapping[argument] : commandValueMapping[prefix + ':' + argument];
			if (typeof v === 'string') {
				return v;
			}
			throw new VariableError(variableKind, localize('noValueForCommand', "命令不含值，因此无法解析变量 {0}。", match));
		}
		return match;
	}
}
