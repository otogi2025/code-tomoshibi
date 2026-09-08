/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

/**
 * Extracted from json.ts to keep json nls free.
 */
import { localize } from '../../nls.js';
import { ParseErrorCode } from './json.js';

export function getParseErrorMessage(errorCode: ParseErrorCode): string {
	switch (errorCode) {
		case ParseErrorCode.InvalidSymbol: return localize('error.invalidSymbol', '无效符号');
		case ParseErrorCode.InvalidNumberFormat: return localize('error.invalidNumberFormat', '数字格式无效');
		case ParseErrorCode.PropertyNameExpected: return localize('error.propertyNameExpected', '需要属性名');
		case ParseErrorCode.ValueExpected: return localize('error.valueExpected', '需要值');
		case ParseErrorCode.ColonExpected: return localize('error.colonExpected', '需要冒号');
		case ParseErrorCode.CommaExpected: return localize('error.commaExpected', '需要逗号');
		case ParseErrorCode.CloseBraceExpected: return localize('error.closeBraceExpected', '需要右大括号');
		case ParseErrorCode.CloseBracketExpected: return localize('error.closeBracketExpected', '需要右括号');
		case ParseErrorCode.EndOfFileExpected: return localize('error.endOfFileExpected', '文件应结束');
		default:
			return '';
	}
}
