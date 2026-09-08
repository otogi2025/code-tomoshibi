/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import './media/notificationsActions.css';
import { INotificationViewItem, NotificationsPosition } from '../../../common/notifications.js';
import { localize } from '../../../../nls.js';
import { Action } from '../../../../base/common/actions.js';
import { CLEAR_NOTIFICATION, EXPAND_NOTIFICATION, COLLAPSE_NOTIFICATION, CLEAR_ALL_NOTIFICATIONS, HIDE_NOTIFICATIONS_CENTER, TOGGLE_DO_NOT_DISTURB_MODE, TOGGLE_DO_NOT_DISTURB_MODE_BY_SOURCE } from './notificationsCommands.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

const clearIcon = registerIcon('notifications-clear', Codicon.close, localize('clearIcon', '通知中“清除”操作的图标。'));
const clearAllIcon = registerIcon('notifications-clear-all', Codicon.clearAll, localize('clearAllIcon', '通知中“全部清除”操作的图标。'));
export const hideIcon = registerIcon('notifications-hide', Codicon.chevronDown, localize('hideIcon', '通知中“隐藏”操作的图标。'));
export const hideUpIcon = registerIcon('notifications-hide-up', Codicon.chevronUp, localize('hideUpIcon', '位于顶部时通知中隐藏操作的图标。'));
const expandIcon = registerIcon('notifications-expand', Codicon.chevronUp, localize('expandIcon', '通知中“展开”操作的图标。'));
const expandDownIcon = registerIcon('notifications-expand-down', Codicon.chevronDown, localize('expandDownIcon', '通知中心位于顶部时通知中展开操作的图标。'));
const collapseIcon = registerIcon('notifications-collapse', Codicon.chevronDown, localize('collapseIcon', '通知中“折叠”操作的图标。'));
const collapseUpIcon = registerIcon('notifications-collapse-up', Codicon.chevronUp, localize('collapseUpIcon', '通知中心位于顶部时通知中折叠操作的图标。'));
const configureIcon = registerIcon('notifications-configure', Codicon.gear, localize('configureIcon', '通知中“配置”操作的图标。'));
const doNotDisturbIcon = registerIcon('notifications-do-not-disturb', Codicon.bellSlash, localize('doNotDisturbIcon', '通知中“静音全部操作”的图标。'));
export const positionIcon = registerIcon('notifications-position', Codicon.arrowSwap, localize('positionIcon', '通知中位置操作的图标。'));

export function getNotificationExpandIcon(position: NotificationsPosition): ThemeIcon {
	return position === NotificationsPosition.TOP_RIGHT ? expandDownIcon : expandIcon;
}

export function getNotificationCollapseIcon(position: NotificationsPosition): ThemeIcon {
	return position === NotificationsPosition.TOP_RIGHT ? collapseUpIcon : collapseIcon;
}

export class ClearNotificationAction extends Action {

	static readonly ID = CLEAR_NOTIFICATION;
	static readonly LABEL = localize('clearNotification', "清除通知");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(clearIcon));
	}

	override async run(notification: INotificationViewItem): Promise<void> {
		this.commandService.executeCommand(CLEAR_NOTIFICATION, notification);
	}
}

export class ClearAllNotificationsAction extends Action {

	static readonly ID = CLEAR_ALL_NOTIFICATIONS;
	static readonly LABEL = localize('clearNotifications', "清除所有通知");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(clearAllIcon));
	}

	override async run(): Promise<void> {
		this.commandService.executeCommand(CLEAR_ALL_NOTIFICATIONS);
	}
}

export class ToggleDoNotDisturbAction extends Action {

	static readonly ID = TOGGLE_DO_NOT_DISTURB_MODE;
	static readonly LABEL = localize('toggleDoNotDisturbMode', "切换“请勿打扰”模式");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(doNotDisturbIcon));
	}

	override async run(): Promise<void> {
		this.commandService.executeCommand(TOGGLE_DO_NOT_DISTURB_MODE);
	}
}

export class ToggleDoNotDisturbBySourceAction extends Action {

	static readonly ID = TOGGLE_DO_NOT_DISTURB_MODE_BY_SOURCE;
	static readonly LABEL = localize('toggleDoNotDisturbModeBySource', "按源切换“请勿打扰”模式...");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		this.commandService.executeCommand(TOGGLE_DO_NOT_DISTURB_MODE_BY_SOURCE);
	}
}

export class ConfigureDoNotDisturbAction extends Action {

	static readonly ID = 'workbench.action.configureDoNotDisturbMode';
	static readonly LABEL = localize('configureDoNotDisturbMode', "配置“请勿打扰”...");

	constructor(
		id: string,
		label: string
	) {
		super(id, label, ThemeIcon.asClassName(doNotDisturbIcon));
	}
}

export class ConfigureNotificationsPositionAction extends Action {

	static readonly ID = 'workbench.action.configureNotificationsPosition';
	static readonly LABEL = localize('configureNotificationsPosition', "配置通知位置...");

	constructor(
		id: string,
		label: string
	) {
		super(id, label, ThemeIcon.asClassName(positionIcon));
	}
}

export class HideNotificationsCenterAction extends Action {

	static readonly ID = HIDE_NOTIFICATIONS_CENTER;
	static readonly LABEL = localize('hideNotificationsCenter', "隐藏通知");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(hideIcon));
	}

	override async run(): Promise<void> {
		this.commandService.executeCommand(HIDE_NOTIFICATIONS_CENTER);
	}
}

export class ExpandNotificationAction extends Action {

	static readonly ID = EXPAND_NOTIFICATION;
	static readonly LABEL = localize('expandNotification', "展开通知");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(expandIcon));
	}

	override async run(notification: INotificationViewItem): Promise<void> {
		this.commandService.executeCommand(EXPAND_NOTIFICATION, notification);
	}
}

export class CollapseNotificationAction extends Action {

	static readonly ID = COLLAPSE_NOTIFICATION;
	static readonly LABEL = localize('collapseNotification', "折叠通知");

	constructor(
		id: string,
		label: string,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(id, label, ThemeIcon.asClassName(collapseIcon));
	}

	override async run(notification: INotificationViewItem): Promise<void> {
		this.commandService.executeCommand(COLLAPSE_NOTIFICATION, notification);
	}
}

export class ConfigureNotificationAction extends Action {

	static readonly ID = 'workbench.action.configureNotification';
	static readonly LABEL = localize('configureNotification', "更多操作...");

	constructor(
		id: string,
		label: string,
		readonly notification: INotificationViewItem
	) {
		super(id, label, ThemeIcon.asClassName(configureIcon));
	}
}

export class CopyNotificationMessageAction extends Action {

	static readonly ID = 'workbench.action.copyNotificationMessage';
	static readonly LABEL = localize('copyNotification', "复制文本");

	constructor(
		id: string,
		label: string,
		@IClipboardService private readonly clipboardService: IClipboardService
	) {
		super(id, label);
	}

	override run(notification: INotificationViewItem): Promise<void> {
		return this.clipboardService.writeText(notification.message.raw);
	}
}
