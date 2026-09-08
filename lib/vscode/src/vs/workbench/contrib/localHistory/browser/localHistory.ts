/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { language } from '../../../../base/common/platform.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { safeIntl } from '../../../../base/common/date.js';

interface ILocalHistoryDateFormatter {
	format: (timestamp: number) => string;
}

let localHistoryDateFormatter: ILocalHistoryDateFormatter | undefined = undefined;

export function getLocalHistoryDateFormatter(): ILocalHistoryDateFormatter {
	if (!localHistoryDateFormatter) {
		const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
		const formatter = safeIntl.DateTimeFormat(language, options).value;
		localHistoryDateFormatter = {
			format: date => formatter.format(date)
		};
	}

	return localHistoryDateFormatter;
}

export const LOCAL_HISTORY_MENU_CONTEXT_VALUE = 'localHistory:item';
export const LOCAL_HISTORY_MENU_CONTEXT_KEY = ContextKeyExpr.equals('timelineItem', LOCAL_HISTORY_MENU_CONTEXT_VALUE);

export const LOCAL_HISTORY_ICON_ENTRY = registerIcon('localHistory-icon', Codicon.circleOutline, localize('localHistoryIcon', "日程表视图中本地历史记录条目的图标。"));
export const LOCAL_HISTORY_ICON_RESTORE = registerIcon('localHistory-restore', Codicon.check, localize('localHistoryRestore', "用于还原本地历史记录条目的内容的图标。"));
