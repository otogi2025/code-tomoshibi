/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

// Import the effects we need
import { registerColor, transparent } from '../colorUtils.js';

// Import the colors we need
import { foreground } from './baseColors.js';


export const searchResultsInfoForeground = registerColor('search.resultsInfoForeground',
	{ light: foreground, dark: transparent(foreground, 0.65), hcDark: foreground, hcLight: foreground },
	nls.localize('search.resultsInfoForeground', "搜索 Viewlet 完成消息中文本的颜色。"));
