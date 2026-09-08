/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ViewAction } from '../../../browser/parts/views/viewPane.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ctxAllCollapsed, ctxFilterOnType, ctxFollowsCursor, ctxSortMode, IOutlinePane, OutlineSortOrder } from './outline.js';


// --- commands

registerAction2(class CollapseAll extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.collapse',
			title: localize('collapse', "全部折叠"),
			f1: false,
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', IOutlinePane.Id), ctxAllCollapsed.isEqualTo(false))
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.collapseAll();
	}
});

registerAction2(class ExpandAll extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.expand',
			title: localize('expand', "全部展开"),
			f1: false,
			icon: Codicon.expandAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', IOutlinePane.Id), ctxAllCollapsed.isEqualTo(true))
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.expandAll();
	}
});

registerAction2(class FollowCursor extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.followCursor',
			title: localize('followCur', "跟随光标"),
			f1: false,
			toggled: ctxFollowsCursor,
			menu: {
				id: MenuId.ViewTitle,
				group: 'config',
				order: 1,
				when: ContextKeyExpr.equals('view', IOutlinePane.Id)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.outlineViewState.followCursor = !view.outlineViewState.followCursor;
	}
});

registerAction2(class FilterOnType extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.filterOnType',
			title: localize('filterOnType', "在输入时筛选"),
			f1: false,
			toggled: ctxFilterOnType,
			menu: {
				id: MenuId.ViewTitle,
				group: 'config',
				order: 2,
				when: ContextKeyExpr.equals('view', IOutlinePane.Id)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.outlineViewState.filterOnType = !view.outlineViewState.filterOnType;
	}
});


registerAction2(class SortByPosition extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.sortByPosition',
			title: localize('sortByPosition', "排序依据 : 位置"),
			f1: false,
			toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByPosition),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 1,
				when: ContextKeyExpr.equals('view', IOutlinePane.Id)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByPosition;
	}
});

registerAction2(class SortByName extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.sortByName',
			title: localize('sortByName', "排序依据 : 名称"),
			f1: false,
			toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByName),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 2,
				when: ContextKeyExpr.equals('view', IOutlinePane.Id)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByName;
	}
});

registerAction2(class SortByKind extends ViewAction<IOutlinePane> {
	constructor() {
		super({
			viewId: IOutlinePane.Id,
			id: 'outline.sortByKind',
			title: localize('sortByKind', "排序方式 : 类别"),
			f1: false,
			toggled: ctxSortMode.isEqualTo(OutlineSortOrder.ByKind),
			menu: {
				id: MenuId.ViewTitle,
				group: 'sort',
				order: 3,
				when: ContextKeyExpr.equals('view', IOutlinePane.Id)
			}
		});
	}
	runInView(_accessor: ServicesAccessor, view: IOutlinePane) {
		view.outlineViewState.sortBy = OutlineSortOrder.ByKind;
	}
});
