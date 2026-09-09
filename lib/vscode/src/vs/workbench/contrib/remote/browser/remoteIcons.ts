/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const getStartedIcon = registerIcon('remote-explorer-get-started', Codicon.star, nls.localize('getStartedIcon', '远程资源管理器视图中的入门图标。'));
export const documentationIcon = registerIcon('remote-explorer-documentation', Codicon.book, nls.localize('documentationIcon', '远程资源管理器视图中的文档图标。'));
export const feedbackIcon = registerIcon('remote-explorer-feedback', Codicon.twitter, nls.localize('feedbackIcon', '远程资源管理器视图中的反馈图标。'));
export const reviewIssuesIcon = registerIcon('remote-explorer-review-issues', Codicon.issues, nls.localize('reviewIssuesIcon', '远程资源管理器视图中的“审阅问题”图标。'));
export const remoteExplorerViewIcon = registerIcon('remote-explorer-view-icon', Codicon.remoteExplorer, nls.localize('remoteExplorerViewIcon', '查看远程资源管理器视图的图标。'));

export const portsViewIcon = registerIcon('ports-view-icon', Codicon.plug, nls.localize('portsViewIcon', '查看远程端口视图的图标。'));
export const portIcon = registerIcon('ports-view-icon', Codicon.plug, nls.localize('portIcon', '表示一个远程端口的图标。'));
export const privatePortIcon = registerIcon('private-ports-view-icon', Codicon.lock, nls.localize('privatePortIcon', '表示一个私有远程端口的图标。'));

export const forwardPortIcon = registerIcon('ports-forward-icon', Codicon.plus, nls.localize('forwardPortIcon', '“前进”操作的图标。'));
export const stopForwardIcon = registerIcon('ports-stop-forward-icon', Codicon.x, nls.localize('stopForwardIcon', '“停止转发”操作的图标。'));
export const openBrowserIcon = registerIcon('ports-open-browser-icon', Codicon.globe, nls.localize('openBrowserIcon', '“打开浏览器”操作的图标。'));
export const openPreviewIcon = registerIcon('ports-open-preview-icon', Codicon.openPreview, nls.localize('openPreviewIcon', '“打开预览”操作的图标。'));
export const copyAddressIcon = registerIcon('ports-copy-address-icon', Codicon.clippy, nls.localize('copyAddressIcon', '“复制本地地址”操作的图标。'));
export const labelPortIcon = registerIcon('ports-label-icon', Codicon.tag, nls.localize('labelPortIcon', '“标记端口”操作的图标。'));
export const forwardedPortWithoutProcessIcon = registerIcon('ports-forwarded-without-process-icon', Codicon.circleOutline, nls.localize('forwardedPortWithoutProcessIcon', '没有正在运行的进程的转发端口图标。'));
export const forwardedPortWithProcessIcon = registerIcon('ports-forwarded-with-process-icon', Codicon.circleFilled, nls.localize('forwardedPortWithProcessIcon', '具有正在运行的进程的转发端口图标。'));
