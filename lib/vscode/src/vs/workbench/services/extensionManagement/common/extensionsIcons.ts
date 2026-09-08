/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerColor, textLinkForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const extensionDefaultIcon = registerIcon('extension-default-icon', Codicon.extensionsLarge, localize('extensionDefault', '用于在扩展视图和编辑器中显示默认扩展的图标。'));
export const verifiedPublisherIcon = registerIcon('extensions-verified-publisher', Codicon.verifiedFilled, localize('verifiedPublisher', '用于扩展视图和编辑器中已验证扩展发布服务器的图标。'));
export const extensionVerifiedPublisherIconColor = registerColor('extensionIcon.verifiedForeground', textLinkForeground, localize('extensionIconVerifiedForeground', "已验证扩展的发布服务器图标颜色。"), false);
