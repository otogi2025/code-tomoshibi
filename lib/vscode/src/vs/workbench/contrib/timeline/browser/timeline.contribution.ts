/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewsRegistry, IViewDescriptor, Extensions as ViewExtensions } from '../../../common/views.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { ITimelineService, TimelinePaneId } from '../common/timeline.js';
import { TimelineHasProviderContext } from '../common/timelineService.js';
import { TimelinePane } from './timelinePane.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ISubmenuItem, MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ICommandHandler, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ExplorerFolderContext } from '../../files/common/files.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { URI } from '../../../../base/common/uri.js';

const timelineViewIcon = registerIcon('timeline-view-icon', Codicon.history, localize('timelineViewIcon', '查看时间线视图的图标。'));
const timelineOpenIcon = registerIcon('timeline-open', Codicon.history, localize('timelineOpenIcon', '“打开时间线”操作的图标。'));

export class TimelinePaneDescriptor implements IViewDescriptor {
	readonly id = TimelinePaneId;
	readonly name: ILocalizedString = TimelinePane.TITLE;
	readonly containerIcon = timelineViewIcon;
	readonly ctorDescriptor = new SyncDescriptor(TimelinePane);
	readonly order = 2;
	readonly weight = 30;
	readonly collapsed = true;
	readonly canToggleVisibility = true;
	readonly hideByDefault = false;
	readonly canMoveView = true;
	readonly when = TimelineHasProviderContext;

	focusCommand = { id: 'timeline.focus' };
}

// Configuration
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'timeline',
	order: 1001,
	title: localize('timelineConfigurationTitle', "时间线"),
	type: 'object',
	properties: {
		'timeline.pageSize': {
			type: ['number', 'null'],
			default: 50,
			markdownDescription: localize('timeline.pageSize', "默认情况下以及在加载更多项目时在日程表视图中显示的项目数。如果设置为 \"null\"，则将根据日程表视图的可见区域自动选择一个页面大小。"),
		},
		'timeline.pageOnScroll': {
			type: 'boolean',
			default: true,
			description: localize('timeline.pageOnScroll', "控制在滚动到列表结尾时，日程表视图是否将加载下一页的项目。"),
		},
	}
});

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([new TimelinePaneDescriptor()], VIEW_CONTAINER);

namespace OpenTimelineAction {

	export const ID = 'files.openTimeline';
	export const LABEL = localize('files.openTimeline', "打开时间线");

	export function handler(): ICommandHandler {
		return (accessor, arg) => {
			const service = accessor.get(ITimelineService);

			if (URI.isUri(arg)) {
				return service.setUri(arg);
			}
		};
	}
}

CommandsRegistry.registerCommand(OpenTimelineAction.ID, OpenTimelineAction.handler());

MenuRegistry.appendMenuItem(MenuId.ExplorerContext, ({
	group: '4_timeline',
	order: 1,
	command: {
		id: OpenTimelineAction.ID,
		title: OpenTimelineAction.LABEL,
		icon: timelineOpenIcon
	},
	when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource, TimelineHasProviderContext)
}));

const timelineFilter = registerIcon('timeline-filter', Codicon.filter, localize('timelineFilter', '筛选器时间线操作的图标。'));

MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
	submenu: MenuId.TimelineFilterSubMenu,
	title: localize('filterTimeline', "筛选器时间线"),
	group: 'navigation',
	order: 100,
	icon: timelineFilter
} satisfies ISubmenuItem);
