/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

/**
 * Trust Context Keys
 */

export const WorkspaceTrustContext = {
	IsEnabled: new RawContextKey<boolean>('isWorkspaceTrustEnabled', false, localize('workspaceTrustEnabledCtx', "是否已启用工作区信任功能。")),
	IsTrusted: new RawContextKey<boolean>('isWorkspaceTrusted', false, localize('workspaceTrustedCtx', "用户是否已信任当前工作区。"))
};

export const MANAGE_TRUST_COMMAND_ID = 'workbench.trust.manage';
