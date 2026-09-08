/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { LoggerGroup } from '../../../../platform/log/common/log.js';

export const windowLogId = 'rendererLog';
export const windowLogGroup: LoggerGroup = { id: windowLogId, name: localize('window', "窗口") };
export const showWindowLogActionId = 'workbench.action.showWindowLog';
