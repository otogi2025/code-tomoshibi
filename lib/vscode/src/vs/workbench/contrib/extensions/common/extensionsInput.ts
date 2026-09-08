/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { ExtensionEditorTab } from './extensions.js';

export interface IExtensionEditorOptions extends IEditorOptions {
	showPreReleaseVersion?: boolean;
	tab?: ExtensionEditorTab;
	feature?: string;
	sideByside?: boolean;
}
