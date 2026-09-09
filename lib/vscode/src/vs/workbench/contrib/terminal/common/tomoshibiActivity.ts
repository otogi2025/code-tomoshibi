/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

/**
 * Numbered choice lines, as Claude Code and Codex render their permission prompts.
 *
 * 共用的原因：终端层（`terminalContrib/tomoshibiActivity`）拿它认「屏幕上有个确认框」，服务层
 * （`tomoshibiSessionService`）拿它把真正的 shell 提示符和 agent 停在选中项上的那个箭头分开
 * （`❯ ` 是提示符，`❯ 1. Yes` 是选项）。两边必须用同一条，否则同一行会被一边判成
 * 「在等你回答」、另一边判成「已经跑完了」。
 */
export const TOMOSHIBI_OPTION_LINE = /^\s*(❯|>|›)?\s*\d+[.)]\s+(Yes|No|Allow|Deny|是|否)/i;
