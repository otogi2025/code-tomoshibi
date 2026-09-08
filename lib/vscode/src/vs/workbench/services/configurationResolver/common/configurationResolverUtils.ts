/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file
import * as nls from '../../../../nls.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

export function applyDeprecatedVariableMessage(schema: IJSONSchema) {
	schema.pattern = schema.pattern || '^(?!.*\\$\\{(env|config|command)\\.)';
	schema.patternErrorMessage = schema.patternErrorMessage ||
		nls.localize('deprecatedVariables', "“env.”、“config.”和“command.”已弃用，请改用“env:”、“config:”和“command:”。");
}