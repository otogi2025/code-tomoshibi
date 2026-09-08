/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IJSONSchemaSnippet } from '../../../base/common/jsonSchema.js';
import { diffEditorDefaultOptions } from './diffEditor.js';
import { editorOptionsRegistry } from './editorOptions.js';
import { EDITOR_MODEL_DEFAULTS } from '../core/misc/textModelDefaults.js';
import * as nls from '../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../platform/registry/common/platform.js';

export const editorConfigurationBaseNode = Object.freeze<IConfigurationNode>({
	id: 'editor',
	order: 5,
	type: 'object',
	title: nls.localize('editorConfigurationTitle', "编辑器"),
	scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
});

const editorConfiguration: IConfigurationNode = {
	...editorConfigurationBaseNode,
	properties: {
		'editor.tabSize': {
			type: 'number',
			default: EDITOR_MODEL_DEFAULTS.tabSize,
			minimum: 1,
			maximum: 100,
			markdownDescription: nls.localize('tabSize', "一个制表符等于的空格数。当 {0} 打开时，将根据文件内容替代此设置。", '`#editor.detectIndentation#`')
		},
		'editor.indentSize': {
			'anyOf': [
				{
					type: 'string',
					enum: ['tabSize']
				},
				{
					type: 'number',
					minimum: 1
				}
			],
			default: 'tabSize',
			markdownDescription: nls.localize('indentSize', "用于缩进或 `\"tabSize\"` 的空格数，可使用 `#editor.tabSize#` 中的值。当 `#editor.detectIndentation#` 处于打开状态时，将根据文件内容替代此设置。")
		},
		'editor.insertSpaces': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.insertSpaces,
			markdownDescription: nls.localize('insertSpaces', "按 `Tab` 时插入空格。当 {0} 打开时，将根据文件内容替代此设置。", '`#editor.detectIndentation#`')
		},
		'editor.detectIndentation': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.detectIndentation,
			markdownDescription: nls.localize('detectIndentation', "控制在基于文件内容打开文件时是否自动检测 {0} 和 {1}。", '`#editor.tabSize#`', '`#editor.insertSpaces#`')
		},
		'editor.trimAutoWhitespace': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
			description: nls.localize('trimAutoWhitespace', "删除自动插入的尾随空白符号。")
		},
		'editor.largeFileOptimizations': {
			type: 'boolean',
			default: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
			description: nls.localize('largeFileOptimizations', "对大型文件进行特殊处理，禁用某些内存密集型功能。")
		},
		'editor.wordBasedSuggestions': {
			enum: ['off', 'offWithInlineSuggestions', 'currentDocument', 'matchingDocuments', 'allDocuments'],
			default: 'offWithInlineSuggestions',
			enumDescriptions: [
				nls.localize('wordBasedSuggestions.off', '关闭基于字词的建议。'),
				nls.localize('wordBasedSuggestions.offWithInlineSuggestions', '存在内联建议时关闭基于 Word 的建议。'),
				nls.localize('wordBasedSuggestions.currentDocument', '仅建议活动文档中的字词。'),
				nls.localize('wordBasedSuggestions.matchingDocuments', '建议使用同一语言的所有打开的文档中的字词。'),
				nls.localize('wordBasedSuggestions.allDocuments', '建议所有打开的文档中的字词。'),
			],
			description: nls.localize('wordBasedSuggestions', "控制是否应根据文档中的字词计算补全，以及从哪些文档中计算补全。"),
			experiment: { mode: 'auto' },
		},
		'editor.semanticHighlighting.enabled': {
			enum: [true, false, 'configuredByTheme'],
			enumDescriptions: [
				nls.localize('semanticHighlighting.true', '对所有颜色主题启用语义突出显示。'),
				nls.localize('semanticHighlighting.false', '对所有颜色主题禁用语义突出显示。'),
				nls.localize('semanticHighlighting.configuredByTheme', '语义突出显示是由当前颜色主题的 "semanticHighlighting" 设置配置的。')
			],
			default: 'configuredByTheme',
			description: nls.localize('semanticHighlighting.enabled', "控制是否为支持它的语言显示语义突出显示。")
		},
		'editor.stablePeek': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('stablePeek', "保持速览编辑器处于打开状态，即使双击其中的内容或者点击 `Escape` 键也是如此。")
		},
		'editor.maxTokenizationLineLength': {
			type: 'integer',
			default: 20_000,
			description: nls.localize('maxTokenizationLineLength', "由于性能原因，超过这个长度的行将不会被标记")
		},
		'editor.experimental.asyncTokenization': {
			type: 'boolean',
			default: true,
			description: nls.localize('editor.experimental.asyncTokenization', "控制是否应在 Web 辅助进程上异步进行标记化。"),
			tags: ['experimental'],
		},
		'editor.experimental.asyncTokenizationLogging': {
			type: 'boolean',
			default: false,
			description: nls.localize('editor.experimental.asyncTokenizationLogging', "控制是否应记录异步词汇切分。仅用于调试。"),
		},
		'editor.experimental.asyncTokenizationVerification': {
			type: 'boolean',
			default: false,
			description: nls.localize('editor.experimental.asyncTokenizationVerification', "控制是否应对旧版后台令牌化验证异步令牌化。可能会减慢令牌化速度。仅用于调试。"),
			tags: ['experimental'],
		},
		'editor.experimental.treeSitterTelemetry': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.treeSitterTelemetry', "控制是否应启用树 sitter 分析和收集遥测数据。设置 `#editor.experimental.preferTreeSitter#` 以优先使用特定语言。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.css': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.css', "控制是否应为 css 启用 Tree Sitter 分析。对于 css，此操作将优先于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.typescript': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.typescript', "控制是否应为 Typescript 启用 tree sitter 分析。对于 Typescript，此操作将优先于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.ini': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.ini', "控制是否应为 ini 启用 tree sitter 分析。对于 ini，此操作将优先于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.experimental.preferTreeSitter.regex': {
			type: 'boolean',
			default: false,
			markdownDescription: nls.localize('editor.experimental.preferTreeSitter.regex', "控制是否应为正则表达式启用 tree sitter 分析。对于正则表达式，此操作将优先于 `#editor.experimental.treeSitterTelemetry#`。"),
			tags: ['experimental'],
			experiment: {
				mode: 'auto'
			}
		},
		'editor.language.brackets': {
			type: ['array', 'null'],
			default: null, // We want to distinguish the empty array from not configured.
			description: nls.localize('schema.brackets', '定义增加和减少缩进的括号。'),
			items: {
				type: 'array',
				items: [
					{
						type: 'string',
						description: nls.localize('schema.openBracket', '左方括号字符或字符串序列。')
					},
					{
						type: 'string',
						description: nls.localize('schema.closeBracket', '右方括号字符或字符串序列。')
					}
				]
			}
		},
		'editor.language.colorizedBracketPairs': {
			type: ['array', 'null'],
			default: null, // We want to distinguish the empty array from not configured.
			description: nls.localize('schema.colorizedBracketPairs', '如果启用方括号对着色，则按照其嵌套级别定义已着色的方括号对。'),
			items: {
				type: 'array',
				items: [
					{
						type: 'string',
						description: nls.localize('schema.openBracket', '左方括号字符或字符串序列。')
					},
					{
						type: 'string',
						description: nls.localize('schema.closeBracket', '右方括号字符或字符串序列。')
					}
				]
			}
		},
		'diffEditor.maxComputationTime': {
			type: 'number',
			default: diffEditorDefaultOptions.maxComputationTime,
			description: nls.localize('maxComputationTime', "超时(以毫秒为单位)，之后将取消差异计算。使用0表示没有超时。")
		},
		'diffEditor.maxFileSize': {
			type: 'number',
			default: diffEditorDefaultOptions.maxFileSize,
			description: nls.localize('maxFileSize', "要为其计算差异的最大文件大小(MB)。使用 0 表示无限制。")
		},
		'diffEditor.renderSideBySide': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderSideBySide,
			description: nls.localize('sideBySide', "控制差异编辑器的显示方式是并排还是内联。"),
			agentsWindow: { default: true },
		},
		'diffEditor.renderSideBySideInlineBreakpoint': {
			type: 'number',
			default: diffEditorDefaultOptions.renderSideBySideInlineBreakpoint,
			description: nls.localize('renderSideBySideInlineBreakpoint', "如果差异编辑器宽度小于此值，则使用内联视图。")
		},
		'diffEditor.useInlineViewWhenSpaceIsLimited': {
			type: 'boolean',
			default: diffEditorDefaultOptions.useInlineViewWhenSpaceIsLimited,
			description: nls.localize('useInlineViewWhenSpaceIsLimited', "如果启用并且编辑器宽度太小，则使用内联视图。"),
			agentsWindow: { default: true },
		},
		'diffEditor.renderMarginRevertIcon': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderMarginRevertIcon,
			description: nls.localize('renderMarginRevertIcon', "启用后，差异编辑器会在其字形边距中显示箭头以还原更改。"),
			agentsWindow: { default: false },
		},
		'diffEditor.renderGutterMenu': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderGutterMenu,
			description: nls.localize('renderGutterMenu', "启用后，差异编辑器将显示用于还原和阶段操作的特殊装订线。"),
			agentsWindow: { default: false },
		},
		'diffEditor.ignoreTrimWhitespace': {
			type: 'boolean',
			default: diffEditorDefaultOptions.ignoreTrimWhitespace,
			description: nls.localize('ignoreTrimWhitespace', "启用后，差异编辑器将忽略前导空格或尾随空格中的更改。")
		},
		'diffEditor.renderIndicators': {
			type: 'boolean',
			default: diffEditorDefaultOptions.renderIndicators,
			description: nls.localize('renderIndicators', "控制差异编辑器是否为添加/删除的更改显示 +/- 指示符号。"),
			agentsWindow: { default: false },
		},
		'diffEditor.codeLens': {
			type: 'boolean',
			default: diffEditorDefaultOptions.diffCodeLens,
			description: nls.localize('codeLens', "控制是否在编辑器中显示 CodeLens。")
		},
		'diffEditor.wordWrap': {
			type: 'string',
			enum: ['off', 'on', 'inherit'],
			default: diffEditorDefaultOptions.diffWordWrap,
			markdownEnumDescriptions: [
				nls.localize('wordWrap.off', "永不换行。"),
				nls.localize('wordWrap.on', "将在视区宽度处换行。"),
				nls.localize('wordWrap.inherit', "行将根据 {0} 设置进行换行。", '`#editor.wordWrap#`'),
			]
		},
		'diffEditor.diffAlgorithm': {
			type: 'string',
			enum: ['legacy', 'advanced', 'advanced-external', 'advanced-wasm'],
			default: diffEditorDefaultOptions.diffAlgorithm,
			markdownEnumDescriptions: [
				nls.localize('diffAlgorithm.legacy', "使用旧差异算法。"),
				nls.localize('diffAlgorithm.advanced', "使用高级差异算法。"),
				nls.localize('diffAlgorithm.advancedExternal', "使用外部 `@vscode/diff` 包提供的高级差异算法(纯 JavaScript)。"),
				nls.localize('diffAlgorithm.advancedWasm', "使用外部 `@vscode/diff` 包提供的高级差异算法(WebAssembly)。"),
			]
		},
		'diffEditor.hideUnchangedRegions.enabled': {
			type: 'boolean',
			default: diffEditorDefaultOptions.hideUnchangedRegions.enabled,
			markdownDescription: nls.localize('hideUnchangedRegions.enabled', "控制差异编辑器是否显示未更改的区域。"),
			agentsWindow: { default: true },
		},
		'diffEditor.hideUnchangedRegions.revealLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.revealLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.revealLineCount', "控制用于未更改区域的行数。"),
			minimum: 1,
		},
		'diffEditor.hideUnchangedRegions.minimumLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.minimumLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.minimumLineCount', "控制将多少行用作未更改区域的最小值。"),
			minimum: 1,
		},
		'diffEditor.hideUnchangedRegions.contextLineCount': {
			type: 'integer',
			default: diffEditorDefaultOptions.hideUnchangedRegions.contextLineCount,
			markdownDescription: nls.localize('hideUnchangedRegions.contextLineCount', "控制在比较未改变的区域时使用多少行作为上下文。"),
			minimum: 1,
		},
		'diffEditor.experimental.showMoves': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.showMoves,
			markdownDescription: nls.localize('showMoves', "控制差异编辑器是否应显示检测到的代码移动。")
		},
		'diffEditor.experimental.showEmptyDecorations': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.showEmptyDecorations,
			description: nls.localize('showEmptyDecorations', "控制差异编辑器是否显示空修饰，以查看插入或删除字符的位置。"),
		},
		'diffEditor.experimental.useTrueInlineView': {
			type: 'boolean',
			default: diffEditorDefaultOptions.experimental.useTrueInlineView,
			description: nls.localize('useTrueInlineView', "如果已启用并且编辑器使用内联视图，则将以内联方式呈现字词更改。"),
		},
	}
};

function isConfigurationPropertySchema(x: IConfigurationPropertySchema | { [path: string]: IConfigurationPropertySchema }): x is IConfigurationPropertySchema {
	return (typeof x.type !== 'undefined' || typeof x.anyOf !== 'undefined');
}

// Add properties from the Editor Option Registry
for (const editorOption of editorOptionsRegistry) {
	const schema = editorOption.schema;
	if (typeof schema !== 'undefined') {
		if (isConfigurationPropertySchema(schema)) {
			// This is a single schema contribution
			editorConfiguration.properties![`editor.${editorOption.name}`] = schema;
		} else {
			for (const key in schema) {
				if (Object.hasOwnProperty.call(schema, key)) {
					editorConfiguration.properties![key] = schema[key];
				}
			}
		}
	}
}

let cachedEditorConfigurationKeys: { [key: string]: boolean } | null = null;
function getEditorConfigurationKeys(): { [key: string]: boolean } {
	if (cachedEditorConfigurationKeys === null) {
		cachedEditorConfigurationKeys = <{ [key: string]: boolean }>Object.create(null);
		Object.keys(editorConfiguration.properties!).forEach((prop) => {
			cachedEditorConfigurationKeys![prop] = true;
		});
	}
	return cachedEditorConfigurationKeys;
}

export function isEditorConfigurationKey(key: string): boolean {
	const editorConfigurationKeys = getEditorConfigurationKeys();
	return (editorConfigurationKeys[`editor.${key}`] || false);
}

export function isDiffEditorConfigurationKey(key: string): boolean {
	const editorConfigurationKeys = getEditorConfigurationKeys();
	return (editorConfigurationKeys[`diffEditor.${key}`] || false);
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration(editorConfiguration);

export async function registerEditorFontConfigurations(getFontSnippets: () => Promise<IJSONSchemaSnippet[]>) {
	const editorKeysWithFont = ['editor.fontFamily'];
	const fontSnippets = await getFontSnippets();
	for (const key of editorKeysWithFont) {
		if (
			editorConfiguration.properties && editorConfiguration.properties[key]
		) {
			editorConfiguration.properties[key].defaultSnippets = fontSnippets;
		}
	}
}
