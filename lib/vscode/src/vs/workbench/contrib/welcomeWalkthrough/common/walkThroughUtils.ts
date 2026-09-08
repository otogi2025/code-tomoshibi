/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { localize } from '../../../../nls.js';
import { Color, RGBA } from '../../../../base/common/color.js';

export const embeddedEditorBackground = registerColor('walkThrough.embeddedEditorBackground', { dark: new Color(new RGBA(0, 0, 0, .4)), light: '#f4f4f4', hcDark: null, hcLight: null }, localize('walkThrough.embeddedEditorBackground', '嵌入于交互式演练场中的编辑器的背景颜色。'));
