/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { registerColor, editorBackground } from '../../../../platform/theme/common/colorRegistry.js';

export const multiDiffEditorHeaderBackground = registerColor(
	'multiDiffEditor.headerBackground',
	{ dark: '#262626', light: 'tab.inactiveBackground', hcDark: 'tab.inactiveBackground', hcLight: 'tab.inactiveBackground', },
	localize('multiDiffEditor.headerBackground', '差异编辑器标题的背景色')
);

export const multiDiffEditorBackground = registerColor(
	'multiDiffEditor.background',
	editorBackground,
	localize('multiDiffEditor.background', '多文件差异编辑器的背景色')
);

export const multiDiffEditorBorder = registerColor(
	'multiDiffEditor.border',
	{ dark: 'sideBarSectionHeader.border', light: '#cccccc', hcDark: 'sideBarSectionHeader.border', hcLight: '#cccccc', },
	localize('multiDiffEditor.border', '多文件差异编辑器的边框颜色')
);

