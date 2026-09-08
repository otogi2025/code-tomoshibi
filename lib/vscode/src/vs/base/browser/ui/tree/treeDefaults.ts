/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { AsyncDataTree } from './asyncDataTree.js';
import { Action } from '../../../common/actions.js';
import * as nls from '../../../../nls.js';

export class CollapseAllAction<TInput, T, TFilterData = void> extends Action {

	constructor(private viewer: AsyncDataTree<TInput, T, TFilterData>, enabled: boolean) {
		super('vs.tree.collapse', nls.localize('collapse all', "全部折叠"), 'collapse-all', enabled);
	}

	override async run(): Promise<void> {
		this.viewer.collapseAll();
		this.viewer.setSelection([]);
		this.viewer.setFocus([]);
	}
}
