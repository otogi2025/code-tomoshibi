/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';

/**
 * These are some predefined strings that we test during smoke testing that they are localized
 * correctly. Don't change these strings!!
 */

const open: string = nls.localize('open', '打开');
const close: string = nls.localize('close', '关闭');
const find: string = nls.localize('find', '查找');

export default {
	open: open,
	close: close,
	find: find
};
