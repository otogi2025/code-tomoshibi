/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ParseError, parse, getNodeType } from '../../../../base/common/json.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import * as types from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { CharacterPair, CommentRule, EnterAction, ExplicitLanguageConfiguration, FoldingMarkers, FoldingRules, IAutoClosingPair, IAutoClosingPairConditional, IndentAction, IndentationRule, OnEnterRule } from '../../../../editor/common/languages/languageConfiguration.js';
import { ILanguageConfigurationService } from '../../../../editor/common/languages/languageConfigurationRegistry.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { Extensions, IJSONContributionRegistry } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { getParseErrorMessage } from '../../../../base/common/jsonErrorMessages.js';
import { IExtensionResourceLoaderService } from '../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { hash } from '../../../../base/common/hash.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

interface IRegExp {
	pattern: string;
	flags?: string;
}

interface IIndentationRules {
	decreaseIndentPattern: string | IRegExp;
	increaseIndentPattern: string | IRegExp;
	indentNextLinePattern?: string | IRegExp;
	unIndentedLinePattern?: string | IRegExp;
}

interface IEnterAction {
	indent: 'none' | 'indent' | 'indentOutdent' | 'outdent';
	appendText?: string;
	removeText?: number;
}

interface IOnEnterRule {
	beforeText: string | IRegExp;
	afterText?: string | IRegExp;
	previousLineText?: string | IRegExp;
	action: IEnterAction;
}

/**
 * Serialized form of a language configuration
 */
export interface ILanguageConfiguration {
	comments?: CommentRule;
	brackets?: CharacterPair[];
	autoClosingPairs?: Array<CharacterPair | IAutoClosingPairConditional>;
	surroundingPairs?: Array<CharacterPair | IAutoClosingPair>;
	colorizedBracketPairs?: Array<CharacterPair>;
	wordPattern?: string | IRegExp;
	indentationRules?: IIndentationRules;
	folding?: {
		offSide?: boolean;
		markers?: {
			start?: string | IRegExp;
			end?: string | IRegExp;
		};
	};
	autoCloseBefore?: string;
	onEnterRules?: IOnEnterRule[];
}

function isStringArr(something: string[] | null): something is string[] {
	if (!Array.isArray(something)) {
		return false;
	}
	for (let i = 0, len = something.length; i < len; i++) {
		if (typeof something[i] !== 'string') {
			return false;
		}
	}
	return true;

}

function isCharacterPair(something: CharacterPair | null): boolean {
	return (
		isStringArr(something)
		&& something.length === 2
	);
}

export class LanguageConfigurationFileHandler extends Disposable {

	/**
	 * A map from language id to a hash computed from the config files locations.
	 */
	private readonly _done = new Map<string, number>();

	constructor(
		@ILanguageService private readonly _languageService: ILanguageService,
		@IExtensionResourceLoaderService private readonly _extensionResourceLoaderService: IExtensionResourceLoaderService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@ILanguageConfigurationService private readonly _languageConfigurationService: ILanguageConfigurationService,
	) {
		super();

		this._register(this._languageService.onDidRequestBasicLanguageFeatures(async (languageIdentifier) => {
			// Modes can be instantiated before the extension points have finished registering
			this._extensionService.whenInstalledExtensionsRegistered().then(() => {
				this._loadConfigurationsForMode(languageIdentifier);
			});
		}));
		this._register(this._languageService.onDidChange(() => {
			// reload language configurations as necessary
			for (const [languageId] of this._done) {
				this._loadConfigurationsForMode(languageId);
			}
		}));
	}

	private async _loadConfigurationsForMode(languageId: string): Promise<void> {
		const configurationFiles = this._languageService.getConfigurationFiles(languageId);
		const configurationHash = hash(configurationFiles.map(uri => uri.toString()));

		if (this._done.get(languageId) === configurationHash) {
			return;
		}
		this._done.set(languageId, configurationHash);

		const configs = await Promise.all(configurationFiles.map(configFile => this._readConfigFile(configFile)));
		for (const config of configs) {
			this._handleConfig(languageId, config);
		}
	}

	private async _readConfigFile(configFileLocation: URI): Promise<ILanguageConfiguration> {
		try {
			const contents = await this._extensionResourceLoaderService.readExtensionResource(configFileLocation);
			const errors: ParseError[] = [];
			let configuration = <ILanguageConfiguration>parse(contents, errors);
			if (errors.length) {
				console.error(nls.localize('parseErrors', "错误分析 {0}: {1}", configFileLocation.toString(), errors.map(e => (`[${e.offset}, ${e.length}] ${getParseErrorMessage(e.error)}`)).join('\n')));
			}
			if (getNodeType(configuration) !== 'object') {
				console.error(nls.localize('formatError', "{0}: 格式无效，应为 JSON 对象。", configFileLocation.toString()));
				configuration = {};
			}
			return configuration;
		} catch (err) {
			console.error(err);
			return {};
		}
	}

	private static _extractValidCommentRule(languageId: string, configuration: ILanguageConfiguration): CommentRule | undefined {
		const source = configuration.comments;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!types.isObject(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`comments\` to be an object.`);
			return undefined;
		}

		let result: CommentRule | undefined = undefined;
		if (typeof source.lineComment !== 'undefined') {
			if (typeof source.lineComment === 'string') {
				result = result || {};
				result.lineComment = source.lineComment;
			} else if (types.isObject(source.lineComment)) {
				const lineCommentObj = source.lineComment;
				if (typeof lineCommentObj.comment === 'string') {
					result = result || {};
					result.lineComment = {
						comment: lineCommentObj.comment,
						noIndent: lineCommentObj.noIndent
					};
				} else {
					console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment.comment\` to be a string.`);
				}
			} else {
				console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment\` to be a string or an object with comment property.`);
			}
		}
		if (typeof source.blockComment !== 'undefined') {
			if (!isCharacterPair(source.blockComment)) {
				console.warn(`[${languageId}]: language configuration: expected \`comments.blockComment\` to be an array of two strings.`);
			} else {
				result = result || {};
				result.blockComment = source.blockComment;
			}
		}
		return result;
	}

	private static _extractValidBrackets(languageId: string, configuration: ILanguageConfiguration): CharacterPair[] | undefined {
		const source = configuration.brackets;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!Array.isArray(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`brackets\` to be an array.`);
			return undefined;
		}

		let result: CharacterPair[] | undefined = undefined;
		for (let i = 0, len = source.length; i < len; i++) {
			const pair = source[i];
			if (!isCharacterPair(pair)) {
				console.warn(`[${languageId}]: language configuration: expected \`brackets[${i}]\` to be an array of two strings.`);
				continue;
			}

			result = result || [];
			result.push(pair);
		}
		return result;
	}

	private static _extractValidAutoClosingPairs(languageId: string, configuration: ILanguageConfiguration): IAutoClosingPairConditional[] | undefined {
		const source = configuration.autoClosingPairs;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!Array.isArray(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
			return undefined;
		}

		let result: IAutoClosingPairConditional[] | undefined = undefined;
		for (let i = 0, len = source.length; i < len; i++) {
			const pair = source[i];
			if (Array.isArray(pair)) {
				if (!isCharacterPair(pair)) {
					console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
					continue;
				}
				result = result || [];
				result.push({ open: pair[0], close: pair[1] });
			} else {
				if (!types.isObject(pair)) {
					console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
					continue;
				}
				if (typeof pair.open !== 'string') {
					console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`);
					continue;
				}
				if (typeof pair.close !== 'string') {
					console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`);
					continue;
				}
				if (typeof pair.notIn !== 'undefined') {
					if (!isStringArr(pair.notIn)) {
						console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`);
						continue;
					}
				}
				result = result || [];
				result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
			}
		}
		return result;
	}

	private static _extractValidSurroundingPairs(languageId: string, configuration: ILanguageConfiguration): IAutoClosingPair[] | undefined {
		const source = configuration.surroundingPairs;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!Array.isArray(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs\` to be an array.`);
			return undefined;
		}

		let result: IAutoClosingPair[] | undefined = undefined;
		for (let i = 0, len = source.length; i < len; i++) {
			const pair = source[i];
			if (Array.isArray(pair)) {
				if (!isCharacterPair(pair)) {
					console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
					continue;
				}
				result = result || [];
				result.push({ open: pair[0], close: pair[1] });
			} else {
				if (!types.isObject(pair)) {
					console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
					continue;
				}
				if (typeof pair.open !== 'string') {
					console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
					continue;
				}
				if (typeof pair.close !== 'string') {
					console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
					continue;
				}
				result = result || [];
				result.push({ open: pair.open, close: pair.close });
			}
		}
		return result;
	}

	private static _extractValidColorizedBracketPairs(languageId: string, configuration: ILanguageConfiguration): CharacterPair[] | undefined {
		const source = configuration.colorizedBracketPairs;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!Array.isArray(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs\` to be an array.`);
			return undefined;
		}

		const result: CharacterPair[] = [];
		for (let i = 0, len = source.length; i < len; i++) {
			const pair = source[i];
			if (!isCharacterPair(pair)) {
				console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs[${i}]\` to be an array of two strings.`);
				continue;
			}
			result.push([pair[0], pair[1]]);

		}
		return result;
	}

	private static _extractValidOnEnterRules(languageId: string, configuration: ILanguageConfiguration): OnEnterRule[] | undefined {
		const source = configuration.onEnterRules;
		if (typeof source === 'undefined') {
			return undefined;
		}
		if (!Array.isArray(source)) {
			console.warn(`[${languageId}]: language configuration: expected \`onEnterRules\` to be an array.`);
			return undefined;
		}

		let result: OnEnterRule[] | undefined = undefined;
		for (let i = 0, len = source.length; i < len; i++) {
			const onEnterRule = source[i];
			if (!types.isObject(onEnterRule)) {
				console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}]\` to be an object.`);
				continue;
			}
			if (!types.isObject(onEnterRule.action)) {
				console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action\` to be an object.`);
				continue;
			}
			let indentAction: IndentAction;
			if (onEnterRule.action.indent === 'none') {
				indentAction = IndentAction.None;
			} else if (onEnterRule.action.indent === 'indent') {
				indentAction = IndentAction.Indent;
			} else if (onEnterRule.action.indent === 'indentOutdent') {
				indentAction = IndentAction.IndentOutdent;
			} else if (onEnterRule.action.indent === 'outdent') {
				indentAction = IndentAction.Outdent;
			} else {
				console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.indent\` to be 'none', 'indent', 'indentOutdent' or 'outdent'.`);
				continue;
			}
			const action: EnterAction = { indentAction };
			if (onEnterRule.action.appendText) {
				if (typeof onEnterRule.action.appendText === 'string') {
					action.appendText = onEnterRule.action.appendText;
				} else {
					console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.appendText\` to be undefined or a string.`);
				}
			}
			if (onEnterRule.action.removeText) {
				if (typeof onEnterRule.action.removeText === 'number') {
					action.removeText = onEnterRule.action.removeText;
				} else {
					console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.removeText\` to be undefined or a number.`);
				}
			}
			const beforeText = this._parseRegex(languageId, `onEnterRules[${i}].beforeText`, onEnterRule.beforeText);
			if (!beforeText) {
				continue;
			}
			const resultingOnEnterRule: OnEnterRule = { beforeText, action };
			if (onEnterRule.afterText) {
				const afterText = this._parseRegex(languageId, `onEnterRules[${i}].afterText`, onEnterRule.afterText);
				if (afterText) {
					resultingOnEnterRule.afterText = afterText;
				}
			}
			if (onEnterRule.previousLineText) {
				const previousLineText = this._parseRegex(languageId, `onEnterRules[${i}].previousLineText`, onEnterRule.previousLineText);
				if (previousLineText) {
					resultingOnEnterRule.previousLineText = previousLineText;
				}
			}
			result = result || [];
			result.push(resultingOnEnterRule);
		}

		return result;
	}

	public static extractValidConfig(languageId: string, configuration: ILanguageConfiguration): ExplicitLanguageConfiguration {

		const comments = this._extractValidCommentRule(languageId, configuration);
		const brackets = this._extractValidBrackets(languageId, configuration);
		const autoClosingPairs = this._extractValidAutoClosingPairs(languageId, configuration);
		const surroundingPairs = this._extractValidSurroundingPairs(languageId, configuration);
		const colorizedBracketPairs = this._extractValidColorizedBracketPairs(languageId, configuration);
		const autoCloseBefore = (typeof configuration.autoCloseBefore === 'string' ? configuration.autoCloseBefore : undefined);
		const wordPattern = (configuration.wordPattern ? this._parseRegex(languageId, `wordPattern`, configuration.wordPattern) : undefined);
		const indentationRules = (configuration.indentationRules ? this._mapIndentationRules(languageId, configuration.indentationRules) : undefined);
		let folding: FoldingRules | undefined = undefined;
		if (configuration.folding) {
			const rawMarkers = configuration.folding.markers;
			const startMarker = (rawMarkers && rawMarkers.start ? this._parseRegex(languageId, `folding.markers.start`, rawMarkers.start) : undefined);
			const endMarker = (rawMarkers && rawMarkers.end ? this._parseRegex(languageId, `folding.markers.end`, rawMarkers.end) : undefined);
			const markers: FoldingMarkers | undefined = (startMarker && endMarker ? { start: startMarker, end: endMarker } : undefined);
			folding = {
				offSide: configuration.folding.offSide,
				markers
			};
		}
		const onEnterRules = this._extractValidOnEnterRules(languageId, configuration);

		const richEditConfig: ExplicitLanguageConfiguration = {
			comments,
			brackets,
			wordPattern,
			indentationRules,
			onEnterRules,
			autoClosingPairs,
			surroundingPairs,
			colorizedBracketPairs,
			autoCloseBefore,
			folding,
			__electricCharacterSupport: undefined,
		};
		return richEditConfig;
	}

	private _handleConfig(languageId: string, configuration: ILanguageConfiguration): void {
		const richEditConfig = LanguageConfigurationFileHandler.extractValidConfig(languageId, configuration);
		this._languageConfigurationService.register(languageId, richEditConfig, 50);
	}

	private static _parseRegex(languageId: string, confPath: string, value: string | IRegExp): RegExp | undefined {
		if (typeof value === 'string') {
			try {
				return new RegExp(value, '');
			} catch (err) {
				console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
				return undefined;
			}
		}
		if (types.isObject(value)) {
			if (typeof value.pattern !== 'string') {
				console.warn(`[${languageId}]: language configuration: expected \`${confPath}.pattern\` to be a string.`);
				return undefined;
			}
			if (typeof value.flags !== 'undefined' && typeof value.flags !== 'string') {
				console.warn(`[${languageId}]: language configuration: expected \`${confPath}.flags\` to be a string.`);
				return undefined;
			}
			try {
				return new RegExp(value.pattern, value.flags);
			} catch (err) {
				console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
				return undefined;
			}
		}
		console.warn(`[${languageId}]: language configuration: expected \`${confPath}\` to be a string or an object.`);
		return undefined;
	}

	private static _mapIndentationRules(languageId: string, indentationRules: IIndentationRules): IndentationRule | undefined {
		const increaseIndentPattern = this._parseRegex(languageId, `indentationRules.increaseIndentPattern`, indentationRules.increaseIndentPattern);
		if (!increaseIndentPattern) {
			return undefined;
		}
		const decreaseIndentPattern = this._parseRegex(languageId, `indentationRules.decreaseIndentPattern`, indentationRules.decreaseIndentPattern);
		if (!decreaseIndentPattern) {
			return undefined;
		}

		const result: IndentationRule = {
			increaseIndentPattern: increaseIndentPattern,
			decreaseIndentPattern: decreaseIndentPattern
		};

		if (indentationRules.indentNextLinePattern) {
			result.indentNextLinePattern = this._parseRegex(languageId, `indentationRules.indentNextLinePattern`, indentationRules.indentNextLinePattern);
		}
		if (indentationRules.unIndentedLinePattern) {
			result.unIndentedLinePattern = this._parseRegex(languageId, `indentationRules.unIndentedLinePattern`, indentationRules.unIndentedLinePattern);
		}

		return result;
	}
}

const schemaId = 'vscode://schemas/language-configuration';
const schema: IJSONSchema = {
	allowComments: true,
	allowTrailingCommas: true,
	default: {
		comments: {
			blockComment: ['/*', '*/'],
			lineComment: '//'
		},
		brackets: [['(', ')'], ['[', ']'], ['{', '}']],
		autoClosingPairs: [['(', ')'], ['[', ']'], ['{', '}']],
		surroundingPairs: [['(', ')'], ['[', ']'], ['{', '}']]
	},
	definitions: {
		openBracket: {
			type: 'string',
			description: nls.localize('schema.openBracket', '左方括号字符或字符串序列。')
		},
		closeBracket: {
			type: 'string',
			description: nls.localize('schema.closeBracket', '右方括号字符或字符串序列。')
		},
		bracketPair: {
			type: 'array',
			items: [{
				$ref: '#/definitions/openBracket'
			}, {
				$ref: '#/definitions/closeBracket'
			}]
		}
	},
	properties: {
		comments: {
			default: {
				blockComment: ['/*', '*/'],
				lineComment: { comment: '//', noIndent: false }
			},
			description: nls.localize('schema.comments', '定义注释符号'),
			type: 'object',
			properties: {
				blockComment: {
					type: 'array',
					description: nls.localize('schema.blockComments', '定义块注释的标记方式。'),
					items: [{
						type: 'string',
						description: nls.localize('schema.blockComment.begin', '作为块注释开头的字符序列。')
					}, {
						type: 'string',
						description: nls.localize('schema.blockComment.end', '作为块注释结尾的字符序列。')
					}]
				},
				lineComment: {
					type: 'object',
					description: nls.localize('schema.lineComment.object', '行注释的配置。'),
					properties: {
						comment: {
							type: 'string',
							description: nls.localize('schema.lineComment.comment', '作为行注释开头的字符序列。')
						},
						noIndent: {
							type: 'boolean',
							description: nls.localize('schema.lineComment.noIndent', '注释令牌是否不应缩进并放置在第一列。默认为 false。'),
							default: false
						}
					},
					required: ['comment'],
					additionalProperties: false
				}
			}
		},
		brackets: {
			default: [['(', ')'], ['[', ']'], ['{', '}']],
			markdownDescription: nls.localize('schema.brackets', '定义增加或减少缩进的括号符号。当方括号对着色已启用且未定义{0}时，这还将定义按其嵌套级别着色的括号对。', '\`colorizedBracketPairs\`'),
			type: 'array',
			items: {
				$ref: '#/definitions/bracketPair'
			}
		},
		colorizedBracketPairs: {
			default: [['(', ')'], ['[', ']'], ['{', '}']],
			markdownDescription: nls.localize('schema.colorizedBracketPairs', '定义在启用括号对着色时由其嵌套级别着色的括号对。此处包含的任何不包含在{0}中的括号都将自动包含在{0}中。', '\`brackets\`'),
			type: 'array',
			items: {
				$ref: '#/definitions/bracketPair'
			}
		},
		autoClosingPairs: {
			default: [['(', ')'], ['[', ']'], ['{', '}']],
			description: nls.localize('schema.autoClosingPairs', '定义括号对。当输入左方括号时，将自动插入右方括号。'),
			type: 'array',
			items: {
				oneOf: [{
					$ref: '#/definitions/bracketPair'
				}, {
					type: 'object',
					properties: {
						open: {
							$ref: '#/definitions/openBracket'
						},
						close: {
							$ref: '#/definitions/closeBracket'
						},
						notIn: {
							type: 'array',
							description: nls.localize('schema.autoClosingPairs.notIn', '定义禁用了自动配对的作用域列表。'),
							items: {
								enum: ['string', 'comment']
							}
						}
					}
				}]
			}
		},
		autoCloseBefore: {
			default: ';:.,=}])> \n\t',
			description: nls.localize('schema.autoCloseBefore', '在自动闭合设置为 "languageDefined" 时，定义使括号或引号自动闭合的光标后面的字符。通常是不会成为表达式开头的一组字符。'),
			type: 'string',
		},
		surroundingPairs: {
			default: [['(', ')'], ['[', ']'], ['{', '}']],
			description: nls.localize('schema.surroundingPairs', '定义可用于包围所选字符串的括号对。'),
			type: 'array',
			items: {
				oneOf: [{
					$ref: '#/definitions/bracketPair'
				}, {
					type: 'object',
					properties: {
						open: {
							$ref: '#/definitions/openBracket'
						},
						close: {
							$ref: '#/definitions/closeBracket'
						}
					}
				}]
			}
		},
		wordPattern: {
			default: '',
			description: nls.localize('schema.wordPattern', '定义一下在编程语言里什么东西会被当做是一个单词。'),
			type: ['string', 'object'],
			properties: {
				pattern: {
					type: 'string',
					description: nls.localize('schema.wordPattern.pattern', '用于匹配文本的正则表达式模式。'),
					default: '',
				},
				flags: {
					type: 'string',
					description: nls.localize('schema.wordPattern.flags', '用于匹配文本的正则表达式标志。'),
					default: 'g',
					pattern: '^([gimuy]+)$',
					patternErrorMessage: nls.localize('schema.wordPattern.flags.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
				}
			}
		},
		indentationRules: {
			default: {
				increaseIndentPattern: '',
				decreaseIndentPattern: ''
			},
			description: nls.localize('schema.indentationRules', '语言的缩进设置。'),
			type: 'object',
			properties: {
				increaseIndentPattern: {
					type: ['string', 'object'],
					description: nls.localize('schema.indentationRules.increaseIndentPattern', '如果一行文本匹配此模式，则之后所有内容都应被缩进一次(直到匹配其他规则)。'),
					properties: {
						pattern: {
							type: 'string',
							description: nls.localize('schema.indentationRules.increaseIndentPattern.pattern', 'increaseIndentPattern 的正则表达式模式。'),
							default: '',
						},
						flags: {
							type: 'string',
							description: nls.localize('schema.indentationRules.increaseIndentPattern.flags', 'increaseIndentPattern 的正则表达式标志。'),
							default: '',
							pattern: '^([gimuy]+)$',
							patternErrorMessage: nls.localize('schema.indentationRules.increaseIndentPattern.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
						}
					}
				},
				decreaseIndentPattern: {
					type: ['string', 'object'],
					description: nls.localize('schema.indentationRules.decreaseIndentPattern', '如果某行文本匹配此模式，则其后所有行都应被取消缩进一次 (直到匹配其他规则)。'),
					properties: {
						pattern: {
							type: 'string',
							description: nls.localize('schema.indentationRules.decreaseIndentPattern.pattern', 'decreaseIndentPattern 的正则表达式模式。'),
							default: '',
						},
						flags: {
							type: 'string',
							description: nls.localize('schema.indentationRules.decreaseIndentPattern.flags', 'decreaseIndentPattern 的正则表达式标志。'),
							default: '',
							pattern: '^([gimuy]+)$',
							patternErrorMessage: nls.localize('schema.indentationRules.decreaseIndentPattern.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
						}
					}
				},
				indentNextLinePattern: {
					type: ['string', 'object'],
					description: nls.localize('schema.indentationRules.indentNextLinePattern', '如果某一行匹配此模式，那么仅此行之后的**下一行**应缩进一次。'),
					properties: {
						pattern: {
							type: 'string',
							description: nls.localize('schema.indentationRules.indentNextLinePattern.pattern', 'indentNextLinePattern 的正则表达式模式。'),
							default: '',
						},
						flags: {
							type: 'string',
							description: nls.localize('schema.indentationRules.indentNextLinePattern.flags', 'indentNextLinePattern 的正则表达式标志。'),
							default: '',
							pattern: '^([gimuy]+)$',
							patternErrorMessage: nls.localize('schema.indentationRules.indentNextLinePattern.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
						}
					}
				},
				unIndentedLinePattern: {
					type: ['string', 'object'],
					description: nls.localize('schema.indentationRules.unIndentedLinePattern', '如果某一行匹配此模式，那么不应更改此行的缩进，且不应针对其他规则对其进行计算。'),
					properties: {
						pattern: {
							type: 'string',
							description: nls.localize('schema.indentationRules.unIndentedLinePattern.pattern', 'unIndentedLinePattern 的正则表达式模式。'),
							default: '',
						},
						flags: {
							type: 'string',
							description: nls.localize('schema.indentationRules.unIndentedLinePattern.flags', 'unIndentedLinePattern 的正则表达式标志。'),
							default: '',
							pattern: '^([gimuy]+)$',
							patternErrorMessage: nls.localize('schema.indentationRules.unIndentedLinePattern.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
						}
					}
				}
			}
		},
		folding: {
			type: 'object',
			description: nls.localize('schema.folding', '此语言的折叠设置。'),
			properties: {
				offSide: {
					type: 'boolean',
					description: nls.localize('schema.folding.offSide', '若一种语言使用缩进表示其代码块，它将遵循越位规则 (off-side rule)。若设置此项，空白行将属于其之后的代码块。'),
				},
				markers: {
					type: 'object',
					description: nls.localize('schema.folding.markers', '语言特定的折叠标记。例如，"#region" 与 "#endregion"。开始与结束标记的正则表达式需设计得效率高，因其将对每一行的内容进行测试。'),
					properties: {
						start: {
							type: ['string', 'object'],
							description: nls.localize('schema.folding.markers.start', '开始标记的正则表达式模式。其应以 "^" 开始。'),
							properties: {
								pattern: {
									type: 'string',
									description: nls.localize('schema.folding.markers.start.pattern', '开始标记的 RegExp 模式。'),
									default: '',
								},
								flags: {
									type: 'string',
									description: nls.localize('schema.folding.markers.start.flags', '开始标记的 RegExp 标志。'),
									default: '',
									pattern: '^([gimuy]+)$',
									patternErrorMessage: nls.localize('schema.folding.markers.start.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
								}
							}
						},
						end: {
							type: ['string', 'object'],
							description: nls.localize('schema.folding.markers.end', '结束标记的正则表达式模式。其应以 "^" 开始。'),
							properties: {
								pattern: {
									type: 'string',
									description: nls.localize('schema.folding.markers.end.pattern', '结束标记的 RegExp 模式。'),
									default: '',
								},
								flags: {
									type: 'string',
									description: nls.localize('schema.folding.markers.end.flags', '结束标记的 RegExp 标志。'),
									default: '',
									pattern: '^([gimuy]+)$',
									patternErrorMessage: nls.localize('schema.folding.markers.end.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
								}
							}
						},
					}
				}
			}
		},
		onEnterRules: {
			type: 'array',
			description: nls.localize('schema.onEnterRules', '按 Enter 时要评估的语言规则。'),
			items: {
				type: 'object',
				description: nls.localize('schema.onEnterRules', '按 Enter 时要评估的语言规则。'),
				required: ['beforeText', 'action'],
				properties: {
					beforeText: {
						type: ['string', 'object'],
						description: nls.localize('schema.onEnterRules.beforeText', '只有游标前的文本匹配此正则表达式时才会执行此规则。'),
						properties: {
							pattern: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.beforeText.pattern', 'beforeText 的正则表达式模式。'),
								default: '',
							},
							flags: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.beforeText.flags', 'beforeText 的正则表达式标志。'),
								default: '',
								pattern: '^([gimuy]+)$',
								patternErrorMessage: nls.localize('schema.onEnterRules.beforeText.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
							}
						}
					},
					afterText: {
						type: ['string', 'object'],
						description: nls.localize('schema.onEnterRules.afterText', '只有游标后的文本匹配此正则表达式时才会执行此规则。'),
						properties: {
							pattern: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.afterText.pattern', 'afterText 的正则表达式模式。'),
								default: '',
							},
							flags: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.afterText.flags', 'afterText 的正则表达式标志。'),
								default: '',
								pattern: '^([gimuy]+)$',
								patternErrorMessage: nls.localize('schema.onEnterRules.afterText.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
							}
						}
					},
					previousLineText: {
						type: ['string', 'object'],
						description: nls.localize('schema.onEnterRules.previousLineText', '只有该行上方的文本匹配此正则表达式时才会执行此规则。'),
						properties: {
							pattern: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.previousLineText.pattern', 'previousLineText 的正则表达式模式。'),
								default: '',
							},
							flags: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.previousLineText.flags', 'previousLineText 的正则表达式标志。'),
								default: '',
								pattern: '^([gimuy]+)$',
								patternErrorMessage: nls.localize('schema.onEnterRules.previousLineText.errorMessage', '必须匹配模式“/^([gimuy]+)$/”。')
							}
						}
					},
					action: {
						type: ['string', 'object'],
						description: nls.localize('schema.onEnterRules.action', '要执行的操作。'),
						required: ['indent'],
						default: { 'indent': 'indent' },
						properties: {
							indent: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.action.indent', "描述如何处理缩进"),
								default: 'indent',
								enum: ['none', 'indent', 'indentOutdent', 'outdent'],
								markdownEnumDescriptions: [
									nls.localize('schema.onEnterRules.action.indent.none', "插入新行并复制上一行的缩进。"),
									nls.localize('schema.onEnterRules.action.indent.indent', "(相对于上一行的缩进)插入一次新行和缩进。"),
									nls.localize('schema.onEnterRules.action.indent.indentOutdent', "插入两个新行: \r\n - 第一行缩进并将包含游标\r\n - 第二行在同一缩进级别"),
									nls.localize('schema.onEnterRules.action.indent.outdent', "(相对于上一行的缩进)插入一次新行和凸排。")
								]
							},
							appendText: {
								type: 'string',
								description: nls.localize('schema.onEnterRules.action.appendText', '描述要追加到新行后和缩进后的文本。'),
								default: '',
							},
							removeText: {
								type: 'number',
								description: nls.localize('schema.onEnterRules.action.removeText', '描述要从新行的缩进中移除的字符数。'),
								default: 0,
							}
						}
					}
				}
			}
		}

	}
};
const schemaRegistry = Registry.as<IJSONContributionRegistry>(Extensions.JSONContribution);
schemaRegistry.registerSchema(schemaId, schema);
