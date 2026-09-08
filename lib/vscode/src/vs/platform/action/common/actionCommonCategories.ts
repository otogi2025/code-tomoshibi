/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize2 } from '../../../nls.js';

export const Categories = Object.freeze({
	View: localize2('view', '查看'),
	Help: localize2('help', '帮助'),
	Test: localize2('test', '测试'),
	File: localize2('file', '文件'),
	Preferences: localize2('preferences', '首选项'),
	Developer: localize2({ key: 'developer', comment: ['A developer on Code itself or someone diagnosing issues in Code'] }, "开发人员"),
});
