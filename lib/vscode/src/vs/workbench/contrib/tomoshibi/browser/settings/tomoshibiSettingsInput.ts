/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

/**
 * 设置页的公共标识：命令 id 和分区名。
 *
 * 这个文件曾经放着一个 EditorInput（设置那时是编辑器区的一个标签页），设置改成浮层弹窗之后
 * 那个类没有任何引用了，已经删掉。文件名保留是因为 contrib/remote 下的两个文件按这条路径
 * 引 `TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID`，改名会牵动本次改动清单之外的文件。
 */

/**
 * The command that opens the settings overlay. Exported here, on the leaf module, so the places
 * outside the tomoshibi folder that point at the settings page (the ports status bar entry, the
 * forwarded ports toggle) can name it without importing a contribution module for its side effects.
 */
export const TOMOSHIBI_OPEN_SETTINGS_COMMAND_ID = 'tomoshibi.openSettings';

/** The seven pages of the Code-Tomoshibi settings, in navigation order. */
export type SettingsSection = 'ui' | 'term' | 'ports' | 'clip' | 'upload' | 'perf' | 'acct';

export const settingsSections: readonly SettingsSection[] = ['ui', 'term', 'ports', 'clip', 'upload', 'perf', 'acct'];

export function isSettingsSection(candidate: unknown): candidate is SettingsSection {
	return typeof candidate === 'string' && (settingsSections as readonly string[]).includes(candidate);
}
