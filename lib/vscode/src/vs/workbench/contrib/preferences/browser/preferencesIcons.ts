/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const settingsScopeDropDownIcon = registerIcon('settings-folder-dropdown', Codicon.chevronDown, localize('settingsScopeDropDownIcon', '“拆分 JSON 设置”编辑器中“文件夹”下拉按钮的图标。'));
export const settingsMoreActionIcon = registerIcon('settings-more-action', Codicon.gear, localize('settingsMoreActionIcon', '设置 UI 中“更多操作”操作的图标。'));

export const keybindingsRecordKeysIcon = registerIcon('keybindings-record-keys', Codicon.recordKeys, localize('keybindingsRecordKeysIcon', '键绑定 UI 中“记录密钥”操作的图标。'));
export const keybindingsSortIcon = registerIcon('keybindings-sort', Codicon.sortPrecedence, localize('keybindingsSortIcon', '键绑定 UI 中“按优先级排序”切换开关的图标。'));

export const keybindingsEditIcon = registerIcon('keybindings-edit', Codicon.edit, localize('keybindingsEditIcon', '键绑定 UI 中“编辑”操作的图标。'));
export const keybindingsAddIcon = registerIcon('keybindings-add', Codicon.add, localize('keybindingsAddIcon', '键绑定 UI 中“添加”操作的图标。'));

export const settingsEditIcon = registerIcon('settings-edit', Codicon.edit, localize('settingsEditIcon', '设置 UI 中“编辑”操作的图标。'));

export const settingsRemoveIcon = registerIcon('settings-remove', Codicon.close, localize('settingsRemoveIcon', '设置 UI 中“删除”操作的图标。'));
export const settingsDiscardIcon = registerIcon('settings-discard', Codicon.discard, localize('preferencesDiscardIcon', '设置 UI 中“放弃”操作的图标。'));

export const preferencesClearInputIcon = registerIcon('preferences-clear-input', Codicon.clearAll, localize('preferencesClearInput', '设置和键绑定 UI 中的“清除输入”图标。'));
export const preferencesFilterIcon = registerIcon('preferences-filter', Codicon.filter, localize('settingsFilter', '为设置 UI 建议筛选器的按钮的图标。'));
export const preferencesOpenSettingsIcon = registerIcon('preferences-open-settings', Codicon.goToFile, localize('preferencesOpenSettings', '“打开设置”命令的图标。'));
