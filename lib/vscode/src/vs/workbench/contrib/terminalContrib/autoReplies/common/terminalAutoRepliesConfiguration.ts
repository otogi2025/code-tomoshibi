/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { IStringDictionary } from '../../../../../base/common/collections.js';
import { localize } from '../../../../../nls.js';
import type { IConfigurationPropertySchema } from '../../../../../platform/configuration/common/configurationRegistry.js';

export const enum TerminalAutoRepliesSettingId {
	AutoReplies = 'terminal.integrated.autoReplies',
}

export interface ITerminalAutoRepliesConfiguration {
	autoReplies: { [key: string]: string };
}

export const terminalAutoRepliesConfiguration: IStringDictionary<IConfigurationPropertySchema> = {
	[TerminalAutoRepliesSettingId.AutoReplies]: {
		markdownDescription: localize('terminal.integrated.autoReplies', "在终端中遇到一组消息时，将自动响应这组消息。如果消息足够具体，这可能有助于自动执行常见响应。\r\n\r\n备注:\r\n\r\n- 使用 {0} 自动响应 Windows 上的终止批处理作业提示。\r\n- 消息包括转义序列，因此可能无法使用带样式的文本进行回复。\r\n- 每秒只能进行一次回复。\r\n- 在回复中使用 {1} 来表示 Enter 键。\r\n- 要取消设置默认键，请将该值设置为 null。\r\n- 如果新的不适用，请重启 VS Code。", '`"Terminate batch job (Y/N)": "Y\\r"`', '`"\\r"`'),
		type: 'object',
		additionalProperties: {
			oneOf: [{
				type: 'string',
				description: localize('terminal.integrated.autoReplies.reply', "要发送到流程的回复。")
			},
			{ type: 'null' }]
		},
		restricted: true,
		default: {}
	},
};
