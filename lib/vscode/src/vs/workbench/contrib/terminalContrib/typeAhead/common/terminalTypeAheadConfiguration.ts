/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const DEFAULT_LOCAL_ECHO_EXCLUDE: ReadonlyArray<string> = ['vim', 'vi', 'nano', 'tmux'];

export const enum TerminalTypeAheadSettingId {
	LocalEchoLatencyThreshold = 'terminal.integrated.localEchoLatencyThreshold',
	LocalEchoEnabled = 'terminal.integrated.localEchoEnabled',
	LocalEchoExcludePrograms = 'terminal.integrated.localEchoExcludePrograms',
	LocalEchoStyle = 'terminal.integrated.localEchoStyle',
}

export interface ITerminalTypeAheadConfiguration {
	localEchoLatencyThreshold: number;
	localEchoExcludePrograms: ReadonlyArray<string>;
	localEchoEnabled: 'auto' | 'on' | 'off';
	localEchoStyle: 'bold' | 'dim' | 'italic' | 'underlined' | 'inverted' | string;
}

export const terminalTypeAheadConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalTypeAheadSettingId.LocalEchoLatencyThreshold]: {
		description: localize('terminal.integrated.localEchoLatencyThreshold', "网络延迟的长度(以毫秒为单位)，其中本地编辑将在终端上回显，无需等待服务器承认。如果为 '0'，则本地回显将始终开启，如果为 '-1'，则将禁用。"),
		type: 'integer',
		minimum: -1,
		default: 30,
		tags: ['preview'],
	},
	[TerminalTypeAheadSettingId.LocalEchoEnabled]: {
		markdownDescription: localize('terminal.integrated.localEchoEnabled', "何时应启用本地回显。这将替代 {0}", '`#terminal.integrated.localEchoLatencyThreshold#`'),
		type: 'string',
		enum: ['on', 'off', 'auto'],
		enumDescriptions: [
			localize('terminal.integrated.localEchoEnabled.on', "始终启用"),
			localize('terminal.integrated.localEchoEnabled.off', "始终禁用"),
			localize('terminal.integrated.localEchoEnabled.auto', "仅对远程工作区启用")
		],
		default: 'off',
		tags: ['preview'],
	},
	[TerminalTypeAheadSettingId.LocalEchoExcludePrograms]: {
		description: localize('terminal.integrated.localEchoExcludePrograms', "当在终端标题中找到其中一个程序名称时，将禁用本地回显。"),
		type: 'array',
		items: {
			type: 'string',
			uniqueItems: true
		},
		default: DEFAULT_LOCAL_ECHO_EXCLUDE,
		tags: ['preview'],
	},
	[TerminalTypeAheadSettingId.LocalEchoStyle]: {
		description: localize('terminal.integrated.localEchoStyle', "本地回显文本的终端样式；字体样式或 RGB 颜色。"),
		default: 'dim',
		anyOf: [
			{
				enum: ['bold', 'dim', 'italic', 'underlined', 'inverted', '#ff0000'],
			},
			{
				type: 'string',
				format: 'color-hex',
			}
		],
		tags: ['preview'],
	},
};
