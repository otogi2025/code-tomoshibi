/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { darken, inputBackground, editorWidgetBackground, lighten, registerColor, textLinkForeground, contrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { localize } from '../../../../nls.js';

// Seprate from main module to break dependency cycles between welcomePage and gettingStarted.
export const welcomePageBackground = registerColor('welcomePage.background', null, localize('welcomePage.background', '欢迎页面的背景色。'));

export const welcomePageTileBackground = registerColor('welcomePage.tileBackground', { dark: editorWidgetBackground, light: editorWidgetBackground, hcDark: '#000', hcLight: editorWidgetBackground }, localize('welcomePage.tileBackground', '“欢迎”页面上磁贴的背景色。'));
export const welcomePageTileHoverBackground = registerColor('welcomePage.tileHoverBackground', { dark: lighten(editorWidgetBackground, .2), light: darken(editorWidgetBackground, .1), hcDark: null, hcLight: null }, localize('welcomePage.tileHoverBackground', '“欢迎”页面上磁贴的悬停背景色。'));
export const welcomePageTileBorder = registerColor('welcomePage.tileBorder', { dark: '#ffffff1a', light: '#0000001a', hcDark: contrastBorder, hcLight: contrastBorder }, localize('welcomePage.tileBorder', '“欢迎”页面上磁贴的边框颜色。'));


export const welcomePageProgressBackground = registerColor('welcomePage.progress.background', inputBackground, localize('welcomePage.progress.background', '欢迎页面进度栏的前景色。'));
export const welcomePageProgressForeground = registerColor('welcomePage.progress.foreground', textLinkForeground, localize('welcomePage.progress.foreground', '欢迎页面进度栏的背景色。'));

export const walkthroughStepTitleForeground = registerColor('walkthrough.stepTitle.foreground', { light: '#000000', dark: '#ffffff', hcDark: null, hcLight: null }, localize('walkthrough.stepTitle.foreground', '每个演练步骤标题的前景色'));
