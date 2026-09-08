/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isIOS, isLinux, isMacintosh, isMobile, isWeb, isWindows } from '../../../base/common/platform.js';
import { localize } from '../../../nls.js';
import { RawContextKey } from './contextkey.js';

export const IsMacContext = new RawContextKey<boolean>('isMac', isMacintosh, localize('isMac', "操作系统是否 macOS"));
export const IsLinuxContext = new RawContextKey<boolean>('isLinux', isLinux, localize('isLinux', "操作系统是否为 Linux"));
export const IsWindowsContext = new RawContextKey<boolean>('isWindows', isWindows, localize('isWindows', "操作系统是否为 Windows"));

export const IsWebContext = new RawContextKey<boolean>('isWeb', isWeb, localize('isWeb', "平台是否为 Web 浏览器"));
export const IsMacNativeContext = new RawContextKey<boolean>('isMacNative', isMacintosh && !isWeb, localize('isMacNative', "操作系统是否是非浏览器平台上的 macOS"));
export const IsIOSContext = new RawContextKey<boolean>('isIOS', isIOS, localize('isIOS', "操作系统是否为 iOS"));
export const IsMobileContext = new RawContextKey<boolean>('isMobile', isMobile, localize('isMobile', "平台是否为 Web 浏览器"));

export const IsDevelopmentContext = new RawContextKey<boolean>('isDevelopment', false, true);
export const ProductQualityContext = new RawContextKey<string>('productQualityType', '', localize('productQualityType', "VS Code 的质量类型"));

export const InputFocusedContextKey = 'inputFocus';
export const InputFocusedContext = new RawContextKey<boolean>(InputFocusedContextKey, false, localize('inputFocus', "键盘焦点是否在输入框中"));
