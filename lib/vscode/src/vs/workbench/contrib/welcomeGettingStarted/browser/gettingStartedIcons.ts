/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js'; import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const gettingStartedUncheckedCodicon = registerIcon('getting-started-step-unchecked', Codicon.circleLargeOutline, localize('gettingStartedUnchecked', "用于表示尚未完成的演练步骤"));
export const gettingStartedCheckedCodicon = registerIcon('getting-started-step-checked', Codicon.passFilled, localize('gettingStartedChecked', "用于表示已完成的演练步骤"));
