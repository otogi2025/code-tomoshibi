/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { JSONSchemaType } from '../../../../base/common/jsonSchema.js';
import { Color } from '../../../../base/common/color.js';
import { isObject, isUndefinedOrNull, isString, isStringArray } from '../../../../base/common/types.js';
import { IConfigurationPropertySchema } from '../../../../platform/configuration/common/configurationRegistry.js';

type Validator<T> = { enabled: boolean; isValid: (value: T) => boolean; message: string };

function canBeType(propTypes: (string | undefined)[], ...types: JSONSchemaType[]): boolean {
	return types.some(t => propTypes.includes(t));
}

function isNullOrEmpty(value: unknown): boolean {
	return value === '' || isUndefinedOrNull(value);
}

export function createValidator(prop: IConfigurationPropertySchema): (value: any) => (string | null) {
	const type: (string | undefined)[] = Array.isArray(prop.type) ? prop.type : [prop.type];
	const isNullable = canBeType(type, 'null');
	const isNumeric = (canBeType(type, 'number') || canBeType(type, 'integer')) && (type.length === 1 || type.length === 2 && isNullable);

	const numericValidations = getNumericValidators(prop);
	const stringValidations = getStringValidators(prop);
	const arrayValidator = getArrayValidator(prop);
	const objectValidator = getObjectValidator(prop);

	return value => {
		if (isNullable && isNullOrEmpty(value)) { return ''; }

		const errors: string[] = [];
		if (arrayValidator) {
			const err = arrayValidator(value);
			if (err) {
				errors.push(err);
			}
		}

		if (objectValidator) {
			const err = objectValidator(value);
			if (err) {
				errors.push(err);
			}
		}

		if (prop.type === 'boolean' && value !== true && value !== false) {
			errors.push(nls.localize('validations.booleanIncorrectType', '类型错误，预期为“布尔”。'));
		}

		if (isNumeric) {
			if (isNullOrEmpty(value) || typeof value === 'boolean' || Array.isArray(value) || isNaN(+value)) {
				errors.push(nls.localize('validations.expectedNumeric', "值必须为数字。"));
			} else {
				errors.push(...numericValidations.filter(validator => !validator.isValid(+value)).map(validator => validator.message));
			}
		}

		if (prop.type === 'string') {
			if (prop.enum && !isStringArray(prop.enum)) {
				errors.push(nls.localize('validations.stringIncorrectEnumOptions', '枚举选项应为字符串，但有一个非字符串选项。请向扩展作者提交问题。'));
			} else if (!isString(value)) {
				errors.push(nls.localize('validations.stringIncorrectType', '类型不正确。应为“字符串”'));
			} else {
				errors.push(...stringValidations.filter(validator => !validator.isValid(value)).map(validator => validator.message));
			}
		}

		if (errors.length) {
			return prop.errorMessage ? [prop.errorMessage, ...errors].join(' ') : errors.join(' ');
		}

		return '';
	};
}

/**
 * Returns an error string if the value is invalid and can't be displayed in the settings UI for the given type.
 */
export function getInvalidTypeError(value: any, type: undefined | string | string[]): string | undefined {
	if (typeof type === 'undefined') {
		return;
	}

	const typeArr = Array.isArray(type) ? type : [type];
	if (!typeArr.some(_type => valueValidatesAsType(value, _type))) {
		return nls.localize('invalidTypeError', "设置的类型无效，应为 {0}。请使用 JSON 格式进行修复。", JSON.stringify(type));
	}

	return;
}

function valueValidatesAsType(value: any, type: string): boolean {
	const valueType = typeof value;
	if (type === 'boolean') {
		return valueType === 'boolean';
	} else if (type === 'object') {
		return value && !Array.isArray(value) && valueType === 'object';
	} else if (type === 'null') {
		return value === null;
	} else if (type === 'array') {
		return Array.isArray(value);
	} else if (type === 'string') {
		return valueType === 'string';
	} else if (type === 'number' || type === 'integer') {
		return valueType === 'number';
	}

	return true;
}

function toRegExp(pattern: string): RegExp {
	try {
		// The u flag allows support for better Unicode matching,
		// but deprecates some patterns such as [\s-9]
		// Ref https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_class#description
		return new RegExp(pattern, 'u');
	} catch (e) {
		try {
			return new RegExp(pattern);
		} catch (e) {
			// If the pattern can't be parsed even without the 'u' flag,
			// just log the error to avoid rendering the entire Settings editor blank.
			// Ref https://github.com/microsoft/vscode/issues/195054
			console.error(nls.localize('regexParsingError', "分析以下正则表达式（包含和不包含 u 标志）时出错："), pattern);
			return /.*/;
		}
	}
}

function getStringValidators(prop: IConfigurationPropertySchema) {
	const uriRegex = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
	let patternRegex: RegExp | undefined;
	if (typeof prop.pattern === 'string') {
		patternRegex = toRegExp(prop.pattern);
	}

	return [
		{
			enabled: prop.maxLength !== undefined,
			isValid: ((value: { length: number }) => value.length <= prop.maxLength!),
			message: nls.localize('validations.maxLength', "值的长度必须小于或等于 {0} 个字符。", prop.maxLength)
		},
		{
			enabled: prop.minLength !== undefined,
			isValid: ((value: { length: number }) => value.length >= prop.minLength!),
			message: nls.localize('validations.minLength', "值的长度不能少于 {0} 个字符。", prop.minLength)
		},
		{
			enabled: patternRegex !== undefined,
			isValid: ((value: string) => patternRegex!.test(value)),
			message: prop.patternErrorMessage || nls.localize('validations.regex', "值必须匹配 regex “{0}”。", prop.pattern)
		},
		{
			enabled: prop.format === 'color-hex',
			isValid: ((value: string) => Color.Format.CSS.parseHex(value)),
			message: nls.localize('validations.colorFormat', "颜色格式无效。请使用 #RGB、#RGBA、#RRGGBB 或 #RRGGBBAA。")
		},
		{
			enabled: prop.format === 'uri' || prop.format === 'uri-reference',
			isValid: ((value: string) => !!value.length),
			message: nls.localize('validations.uriEmpty', "需要 URI。")
		},
		{
			enabled: prop.format === 'uri' || prop.format === 'uri-reference',
			isValid: ((value: string) => uriRegex.test(value)),
			message: nls.localize('validations.uriMissing', "需要 URI。")
		},
		{
			enabled: prop.format === 'uri',
			isValid: ((value: string) => {
				const matches = value.match(uriRegex);
				return !!(matches && matches[2]);
			}),
			message: nls.localize('validations.uriSchemeMissing', "需要包含架构的 URI。")
		},
		{
			enabled: prop.enum !== undefined,
			isValid: ((value: string) => {
				return prop.enum!.includes(value);
			}),
			message: nls.localize('validations.invalidStringEnumValue', "值不被接受。有效值: {0}。",
				prop.enum ? prop.enum.map(key => `"${key}"`).join(', ') : '[]')
		}
	].filter(validation => validation.enabled);
}

function getNumericValidators(prop: IConfigurationPropertySchema): Validator<number>[] {
	const type: (string | undefined)[] = Array.isArray(prop.type) ? prop.type : [prop.type];

	const isNullable = canBeType(type, 'null');
	const isIntegral = (canBeType(type, 'integer')) && (type.length === 1 || type.length === 2 && isNullable);
	const isNumeric = canBeType(type, 'number', 'integer') && (type.length === 1 || type.length === 2 && isNullable);
	if (!isNumeric) {
		return [];
	}

	let exclusiveMax: number | undefined;
	let exclusiveMin: number | undefined;

	if (typeof prop.exclusiveMaximum === 'boolean') {
		exclusiveMax = prop.exclusiveMaximum ? prop.maximum : undefined;
	} else {
		exclusiveMax = prop.exclusiveMaximum;
	}

	if (typeof prop.exclusiveMinimum === 'boolean') {
		exclusiveMin = prop.exclusiveMinimum ? prop.minimum : undefined;
	} else {
		exclusiveMin = prop.exclusiveMinimum;
	}

	return [
		{
			enabled: exclusiveMax !== undefined && (prop.maximum === undefined || exclusiveMax <= prop.maximum),
			isValid: ((value: number) => value < exclusiveMax!),
			message: nls.localize('validations.exclusiveMax', "值必须严格小于 {0}。", exclusiveMax)
		},
		{
			enabled: exclusiveMin !== undefined && (prop.minimum === undefined || exclusiveMin >= prop.minimum),
			isValid: ((value: number) => value > exclusiveMin!),
			message: nls.localize('validations.exclusiveMin', "值必须严格大于 {0}。", exclusiveMin)
		},
		{
			enabled: prop.maximum !== undefined && (exclusiveMax === undefined || exclusiveMax > prop.maximum),
			isValid: ((value: number) => value <= prop.maximum!),
			message: nls.localize('validations.max', "值必须小于或等于 {0}。", prop.maximum)
		},
		{
			enabled: prop.minimum !== undefined && (exclusiveMin === undefined || exclusiveMin < prop.minimum),
			isValid: ((value: number) => value >= prop.minimum!),
			message: nls.localize('validations.min', "值必须大于或等于 {0}。", prop.minimum)
		},
		{
			enabled: prop.multipleOf !== undefined,
			isValid: ((value: number) => value % prop.multipleOf! === 0),
			message: nls.localize('validations.multipleOf', "值必须是 {0} 的倍数。", prop.multipleOf)
		},
		{
			enabled: isIntegral,
			isValid: ((value: number) => value % 1 === 0),
			message: nls.localize('validations.expectedInteger', "值必须为整数。")
		},
	].filter(validation => validation.enabled);
}

function getArrayValidator(prop: IConfigurationPropertySchema): ((value: any) => (string | null)) | null {
	if (prop.type === 'array' && prop.items && !Array.isArray(prop.items)) {
		const propItems = prop.items;
		if (propItems && !Array.isArray(propItems.type)) {
			const withQuotes = (s: string) => `'` + s + `'`;
			return value => {
				if (!value) {
					return null;
				}

				let message = '';

				if (!Array.isArray(value)) {
					message += nls.localize('validations.arrayIncorrectType', '类型不正确。应为数组。');
					message += '\n';
					return message;
				}

				const arrayValue = value as unknown[];
				if (prop.uniqueItems) {
					if (new Set(arrayValue).size < arrayValue.length) {
						message += nls.localize('validations.stringArrayUniqueItems', '数组具有重复项');
						message += '\n';
					}
				}

				if (prop.minItems && arrayValue.length < prop.minItems) {
					message += nls.localize('validations.stringArrayMinItem', '数组必须至少有 {0} 项', prop.minItems);
					message += '\n';
				}

				if (prop.maxItems && arrayValue.length > prop.maxItems) {
					message += nls.localize('validations.stringArrayMaxItem', '数组必须最多有 {0} 项', prop.maxItems);
					message += '\n';
				}

				if (propItems.type === 'string') {
					if (!isStringArray(arrayValue)) {
						message += nls.localize('validations.stringArrayIncorrectType', '类型不正确。应为字符串数组。');
						message += '\n';
						return message;
					}

					if (typeof propItems.pattern === 'string') {
						const patternRegex = toRegExp(propItems.pattern);
						arrayValue.forEach(v => {
							if (!patternRegex.test(v)) {
								message +=
									propItems.patternErrorMessage ||
									nls.localize(
										'validations.stringArrayItemPattern',
										'值 {0} 必须与 regex {1} 匹配。',
										withQuotes(v),
										withQuotes(propItems.pattern!)
									);
							}
						});
					}

					const propItemsEnum = propItems.enum;
					if (propItemsEnum) {
						arrayValue.forEach(v => {
							if (propItemsEnum.indexOf(v) === -1) {
								message += nls.localize(
									'validations.stringArrayItemEnum',
									'值 {0} 不是 {1} 其中之一',
									withQuotes(v),
									'[' + propItemsEnum.map(withQuotes).join(', ') + ']'
								);
								message += '\n';
							}
						});
					}
				} else if (propItems.type === 'integer' || propItems.type === 'number') {
					arrayValue.forEach(v => {
						const errorMessage = getErrorsForSchema(propItems, v);
						if (errorMessage) {
							message += `${v}: ${errorMessage}\n`;
						}
					});
				}

				return message;
			};
		}
	}

	return null;
}

function getObjectValidator(prop: IConfigurationPropertySchema): ((value: any) => (string | null)) | null {
	if (prop.type === 'object') {
		const { properties, patternProperties, additionalProperties, propertyNames } = prop;
		return value => {
			if (!value) {
				return null;
			}

			const errors: string[] = [];
			let propertyNamesErrorShown = false;

			if (!isObject(value)) {
				errors.push(nls.localize('validations.objectIncorrectType', '类型不正确。应为对象。'));
			} else {
				Object.keys(value).forEach((key: string) => {
					const data = value[key];

					// Validate propertyNames.pattern - show error message once
					if (propertyNames?.pattern && !propertyNamesErrorShown) {
						const patternRegex = toRegExp(propertyNames.pattern);
						if (!patternRegex.test(key)) {
							const errorMessage = propertyNames.patternErrorMessage ||
								nls.localize('validations.propertyNamePattern', '属性名称必须匹配模式 `{0}`。', propertyNames.pattern);
							errors.push(errorMessage + '\n');
							propertyNamesErrorShown = true;
						}
					}

					if (properties && key in properties) {
						const errorMessage = getErrorsForSchema(properties[key], data);
						if (errorMessage) {
							errors.push(`${key}: ${errorMessage}\n`);
						}
						return;
					}

					if (patternProperties) {
						for (const pattern in patternProperties) {
							if (RegExp(pattern).test(key)) {
								const errorMessage = getErrorsForSchema(patternProperties[pattern], data);
								if (errorMessage) {
									errors.push(`${key}: ${errorMessage}\n`);
								}
								return;
							}
						}
					}

					if (additionalProperties === false) {
						errors.push(nls.localize('validations.objectPattern', '不允许使用属性{0}。\r\n', key));
					} else if (typeof additionalProperties === 'object') {
						const errorMessage = getErrorsForSchema(additionalProperties, data);
						if (errorMessage) {
							errors.push(`${key}: ${errorMessage}\n`);
						}
					}
				});
			}

			if (errors.length) {
				return prop.errorMessage ? [prop.errorMessage, ...errors].join(' ') : errors.join(' ');
			}

			return '';
		};
	}

	return null;
}

/**
 * Validates a single property name against the propertyNames.pattern schema.
 * Returns true if the key is valid, false otherwise.
 */
export function validatePropertyName(propertyNames: IConfigurationPropertySchema['propertyNames'], key: string): boolean {
	if (!propertyNames?.pattern) {
		return true;
	}
	const patternRegex = toRegExp(propertyNames.pattern);
	return patternRegex.test(key);
}

function getErrorsForSchema(propertySchema: IConfigurationPropertySchema, data: any): string | null {
	const validator = createValidator(propertySchema);
	const errorMessage = validator(data);
	return errorMessage;
}
