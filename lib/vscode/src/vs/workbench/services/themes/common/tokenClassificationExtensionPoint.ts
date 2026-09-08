/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ExtensionsRegistry, ExtensionMessageCollector } from '../../extensions/common/extensionsRegistry.js';
import { getTokenClassificationRegistry, ITokenClassificationRegistry, typeAndModifierIdPattern } from '../../../../platform/theme/common/tokenClassificationRegistry.js';

interface ITokenTypeExtensionPoint {
	id: string;
	description: string;
	superType?: string;
}

interface ITokenModifierExtensionPoint {
	id: string;
	description: string;
}

interface ITokenStyleDefaultExtensionPoint {
	language?: string;
	scopes: { [selector: string]: string[] };
}

const tokenClassificationRegistry: ITokenClassificationRegistry = getTokenClassificationRegistry();

const tokenTypeExtPoint = ExtensionsRegistry.registerExtensionPoint<ITokenTypeExtensionPoint[]>({
	extensionPoint: 'semanticTokenTypes',
	jsonSchema: {
		description: nls.localize('contributes.semanticTokenTypes', '贡献语义令牌类型。'),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: nls.localize('contributes.semanticTokenTypes.id', '语义令牌类型的标识符'),
					pattern: typeAndModifierIdPattern,
					patternErrorMessage: nls.localize('contributes.semanticTokenTypes.id.format', '标识符的格式应为letterOrDigit[_-letterOrDigit]*'),
				},
				superType: {
					type: 'string',
					description: nls.localize('contributes.semanticTokenTypes.superType', '语义令牌类型的超类型'),
					pattern: typeAndModifierIdPattern,
					patternErrorMessage: nls.localize('contributes.semanticTokenTypes.superType.format', '超类型的格式应为 letterOrDigit[_-letterOrDigit]*'),
				},
				description: {
					type: 'string',
					description: nls.localize('contributes.color.description', '语义标记类型的说明'),
				}
			}
		}
	}
});

const tokenModifierExtPoint = ExtensionsRegistry.registerExtensionPoint<ITokenModifierExtensionPoint[]>({
	extensionPoint: 'semanticTokenModifiers',
	jsonSchema: {
		description: nls.localize('contributes.semanticTokenModifiers', '提供语义标记修饰符。'),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: nls.localize('contributes.semanticTokenModifiers.id', '语义令牌修饰符的标识符'),
					pattern: typeAndModifierIdPattern,
					patternErrorMessage: nls.localize('contributes.semanticTokenModifiers.id.format', '标识符的格式应为letterOrDigit[_-letterOrDigit]*')
				},
				description: {
					description: nls.localize('contributes.semanticTokenModifiers.description', '语义令牌修饰符的说明')
				}
			}
		}
	}
});

const tokenStyleDefaultsExtPoint = ExtensionsRegistry.registerExtensionPoint<ITokenStyleDefaultExtensionPoint[]>({
	extensionPoint: 'semanticTokenScopes',
	jsonSchema: {
		description: nls.localize('contributes.semanticTokenScopes', '提供语义令牌范围映射。'),
		type: 'array',
		items: {
			type: 'object',
			properties: {
				language: {
					description: nls.localize('contributes.semanticTokenScopes.languages', '列出默认语言。'),
					type: 'string'
				},
				scopes: {
					description: nls.localize('contributes.semanticTokenScopes.scopes', '将语义令牌(由语义令牌选择器描述)映射到用于表示该令牌的一个或多个 textMate 作用域。'),
					type: 'object',
					additionalProperties: {
						type: 'array',
						items: {
							type: 'string'
						}
					}
				}
			}
		}
	}
});


export class TokenClassificationExtensionPoints {

	constructor() {
		function validateTypeOrModifier(contribution: ITokenTypeExtensionPoint | ITokenModifierExtensionPoint, extensionPoint: string, collector: ExtensionMessageCollector): boolean {
			if (typeof contribution.id !== 'string' || contribution.id.length === 0) {
				collector.error(nls.localize('invalid.id', "必须定义 \"configuration.{0}.id\" 且它不可为空", extensionPoint));
				return false;
			}
			if (!contribution.id.match(typeAndModifierIdPattern)) {
				collector.error(nls.localize('invalid.id.format', "\"configuration.{0}.id\" 必须采用 letterOrDigit[-_letterOrDigit]* 模式", extensionPoint));
				return false;
			}
			const superType = (contribution as ITokenTypeExtensionPoint).superType;
			if (superType && !superType.match(typeAndModifierIdPattern)) {
				collector.error(nls.localize('invalid.superType.format', "“ configuration.{0}.superType”必须遵循格式 letterOrDigit [-_letterOrDigit] *", extensionPoint));
				return false;
			}
			if (typeof contribution.description !== 'string' || contribution.id.length === 0) {
				collector.error(nls.localize('invalid.description', "必须定义 \"configuration.{0}.description\" 且它不可为空", extensionPoint));
				return false;
			}
			return true;
		}

		tokenTypeExtPoint.setHandler((extensions, delta) => {
			for (const extension of delta.added) {
				const extensionValue = <ITokenTypeExtensionPoint[]>extension.value;
				const collector = extension.collector;

				if (!extensionValue || !Array.isArray(extensionValue)) {
					collector.error(nls.localize('invalid.semanticTokenTypeConfiguration', "“configuration.semanticTokenType”必须是数组"));
					return;
				}
				for (const contribution of extensionValue) {
					if (validateTypeOrModifier(contribution, 'semanticTokenType', collector)) {
						tokenClassificationRegistry.registerTokenType(contribution.id, contribution.description, contribution.superType);
					}
				}
			}
			for (const extension of delta.removed) {
				const extensionValue = <ITokenTypeExtensionPoint[]>extension.value;
				for (const contribution of extensionValue) {
					tokenClassificationRegistry.deregisterTokenType(contribution.id);
				}
			}
		});
		tokenModifierExtPoint.setHandler((extensions, delta) => {
			for (const extension of delta.added) {
				const extensionValue = <ITokenModifierExtensionPoint[]>extension.value;
				const collector = extension.collector;

				if (!extensionValue || !Array.isArray(extensionValue)) {
					collector.error(nls.localize('invalid.semanticTokenModifierConfiguration', "“configuration.semanticTokenModifier” 必须是数组"));
					return;
				}
				for (const contribution of extensionValue) {
					if (validateTypeOrModifier(contribution, 'semanticTokenModifier', collector)) {
						tokenClassificationRegistry.registerTokenModifier(contribution.id, contribution.description);
					}
				}
			}
			for (const extension of delta.removed) {
				const extensionValue = <ITokenModifierExtensionPoint[]>extension.value;
				for (const contribution of extensionValue) {
					tokenClassificationRegistry.deregisterTokenModifier(contribution.id);
				}
			}
		});
		tokenStyleDefaultsExtPoint.setHandler((extensions, delta) => {
			for (const extension of delta.added) {
				const extensionValue = <ITokenStyleDefaultExtensionPoint[]>extension.value;
				const collector = extension.collector;

				if (!extensionValue || !Array.isArray(extensionValue)) {
					collector.error(nls.localize('invalid.semanticTokenScopes.configuration', "\"configuration.semanticTokenScopes\" 必须是一个数组"));
					return;
				}
				for (const contribution of extensionValue) {
					if (contribution.language && typeof contribution.language !== 'string') {
						collector.error(nls.localize('invalid.semanticTokenScopes.language', "\"configuration.semanticTokenScopes.language\" 的值必须是字符串"));
						continue;
					}
					if (!contribution.scopes || typeof contribution.scopes !== 'object') {
						collector.error(nls.localize('invalid.semanticTokenScopes.scopes', "\"configuration.semanticTokenScopes.scopes\" 必须定义为对象"));
						continue;
					}
					for (const selectorString in contribution.scopes) {
						const tmScopes = contribution.scopes[selectorString];
						if (!Array.isArray(tmScopes) || tmScopes.some(l => typeof l !== 'string')) {
							collector.error(nls.localize('invalid.semanticTokenScopes.scopes.value', "\"configuration.semanticTokenScopes.scopes\" 的值必须是字符串数组"));
							continue;
						}
						try {
							const selector = tokenClassificationRegistry.parseTokenSelector(selectorString, contribution.language);
							tokenClassificationRegistry.registerTokenStyleDefault(selector, { scopesToProbe: tmScopes.map(s => s.split(' ')) });
						} catch (e) {
							collector.error(nls.localize('invalid.semanticTokenScopes.scopes.selector', "\"configuration.semanticTokenScopes.scopes\": 解析选择器{0}时出现问题。", selectorString));
							// invalid selector, ignore
						}
					}
				}
			}
			for (const extension of delta.removed) {
				const extensionValue = <ITokenStyleDefaultExtensionPoint[]>extension.value;
				for (const contribution of extensionValue) {
					for (const selectorString in contribution.scopes) {
						const tmScopes = contribution.scopes[selectorString];
						try {
							const selector = tokenClassificationRegistry.parseTokenSelector(selectorString, contribution.language);
							tokenClassificationRegistry.registerTokenStyleDefault(selector, { scopesToProbe: tmScopes.map(s => s.split(' ')) });
						} catch (e) {
							// invalid selector, ignore
						}
					}
				}
			}
		});
	}
}



