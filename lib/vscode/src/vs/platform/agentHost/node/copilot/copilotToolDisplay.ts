/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import type { PermissionRequest } from '@github/copilot-sdk';
import { hasKey } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { appendEscapedMarkdownInlineCode, escapeMarkdownLinkLabel, MarkdownString } from '../../../../base/common/htmlContent.js';
import { hash } from '../../../../base/common/hash.js';
import { localize } from '../../../../nls.js';
import type { IAgentToolPendingConfirmationSignal } from '../../common/agentService.js';
import { stripRedundantCdPrefix } from '../../common/commandLineHelpers.js';
import { parsePartialToolInput } from '../../common/partialToolInput.js';
import { StringOrMarkdown } from '../../common/state/protocol/state.js';
import { basename } from '../../../../base/common/resources.js';
import { getStreamingCreateMessage, getStreamingInsertMessage, getStreamingPatchMessage, getStreamingReplaceMessage, streamingToolTextLineCount, type ToolPathResolver } from '../../common/streamingToolCallDisplay.js';
import { getServerToolDisplay } from '../shared/serverToolGroups.js';

// =============================================================================
// Copilot CLI built-in tool interfaces
//
// The Copilot CLI (via @github/copilot-sdk) exposes these built-in tools. Tool names
// and parameter shapes are not typed in the SDK -- they come from the CLI server
// as plain strings. These interfaces are derived from observing the CLI's actual
// tool events and the Copilot Chat extension's CLI display table.
//
// Shell tool names follow a pattern per ShellConfig:
//   shellToolName, readShellToolName, writeShellToolName,
//   stopShellToolName, listShellsToolName
// For bash: bash, read_bash, write_bash, stop_bash/bash_shutdown, list_bash
// For powershell: powershell, read_powershell, write_powershell, stop_powershell/powershell_shutdown, list_powershell
// =============================================================================

/**
 * Known Copilot CLI tool names. These are the `toolName` values that appear
 * in `tool.execution_start` events from the SDK.
 */
const enum CopilotToolName {
	StrReplaceEditor = 'str_replace_editor',
	StrReplace = 'str_replace',
	Insert = 'insert',

	Bash = 'bash',
	ReadBash = 'read_bash',
	WriteBash = 'write_bash',
	StopBash = 'stop_bash',
	BashShutdown = 'bash_shutdown',
	ListBash = 'list_bash',

	PowerShell = 'powershell',
	ReadPowerShell = 'read_powershell',
	WritePowerShell = 'write_powershell',
	StopPowerShell = 'stop_powershell',
	PowerShellShutdown = 'powershell_shutdown',
	ListPowerShell = 'list_powershell',

	View = 'view',
	Edit = 'edit',
	Create = 'create',
	Grep = 'grep',
	Rg = 'rg',
	Glob = 'glob',
	SearchCodeSubagent = 'search_code_subagent',
	ReplyToComment = 'reply_to_comment',
	CodeReview = 'code_review',
	ApplyPatch = 'apply_patch',
	GitApplyPatch = 'git_apply_patch',
	WebSearch = 'web_search',
	WebFetch = 'web_fetch',
	AskUser = 'ask_user',
	ReportIntent = 'report_intent',
	Think = 'think',
	ReportProgress = 'report_progress',
	UpdateTodo = 'update_todo',
	ShowFile = 'show_file',
	FetchCopilotCliDocumentation = 'fetch_copilot_cli_documentation',
	ProposeWork = 'propose_work',
	TaskComplete = 'task_complete',
	Skill = 'skill',
	Task = 'task',
	ListAgents = 'list_agents',
	ReadAgent = 'read_agent',
	ExitPlanMode = 'exit_plan_mode',
	Sql = 'sql',
	Lsp = 'lsp',
	CreatePullRequest = 'create_pull_request',
	GhAdvisoryDatabase = 'gh-advisory-database',
	StoreMemory = 'store_memory',
	ParallelValidation = 'parallel_validation',
	WriteAgent = 'write_agent',
	McpReload = 'mcp_reload',
	McpValidate = 'mcp_validate',
	ToolSearchToolRegex = 'tool_search_tool_regex',
	CodeqlChecker = 'codeql_checker',
}

/** Parameters for the `bash` / `powershell` shell tools. */
interface ICopilotShellToolArgs {
	command: string;
	timeout?: number;
}

/** Parameters for file tools (`view`, `edit`, `create`). */
interface ICopilotFileToolArgs {
	path: string;
}

interface ICopilotEditToolArgs extends ICopilotFileToolArgs {
	old_str?: string;
	new_str?: string;
}

interface ICopilotCreateToolArgs extends ICopilotFileToolArgs {
	file_text?: string;
}

interface ICopilotInsertToolArgs extends ICopilotFileToolArgs {
	insert_line?: number;
	new_str?: string;
}

interface ICopilotStrReplaceEditorToolArgs extends ICopilotEditToolArgs, ICopilotCreateToolArgs, ICopilotInsertToolArgs {
	command?: string;
}

/**
 * Parameters for the `view` tool. The Copilot CLI accepts an optional
 * `view_range: [startLine, endLine]` (1-based, inclusive). `endLine` may be
 * `-1` to mean "to end of file".
 */
interface ICopilotViewToolArgs extends ICopilotFileToolArgs {
	view_range?: number[];
}

/**
 * Normalizes a `view_range` array. Returns `undefined` unless the array has
 * exactly two integer elements with `startLine >= 0`. `endLine === -1` is
 * preserved as the "to end of file" sentinel; otherwise `endLine` must be
 * `>= startLine`.
 */
function formatViewRange(view_range: number[] | undefined): { startLine: number; endLine: number } | undefined {
	if (!Array.isArray(view_range) || view_range.length !== 2) {
		return undefined;
	}
	const [startLine, endLine] = view_range;
	if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
		return undefined;
	}
	if (startLine < 0) {
		return undefined;
	}
	if (endLine !== -1 && endLine < startLine) {
		return undefined;
	}
	return { startLine, endLine };
}

/**
 * Parameters for the `grep` tool. The Copilot CLI's `grep` accepts the same
 * rich rg-flag schema as `rg`; the older narrower shape (e.g. `include`) is
 * no longer used.
 */
interface ICopilotGrepToolArgs {
	pattern: string;
	path?: string;
	output_mode?: 'content' | 'files_with_matches' | 'count';
	glob?: string;
	type?: string;
	'-i'?: boolean;
	'-A'?: number;
	'-B'?: number;
	'-C'?: number;
	'-n'?: boolean;
	head_limit?: number;
	multiline?: boolean;
}

/**
 * Parameters for the `rg` tool. Mirrors {@link ICopilotGrepToolArgs} today but
 * is kept as a distinct interface so the two tools can drift independently if
 * the SDK ever differentiates them.
 */
interface ICopilotRgToolArgs {
	pattern: string;
	path?: string;
	output_mode?: 'content' | 'files_with_matches' | 'count';
	glob?: string;
	type?: string;
	'-i'?: boolean;
	'-A'?: number;
	'-B'?: number;
	'-C'?: number;
	'-n'?: boolean;
	head_limit?: number;
	multiline?: boolean;
}

/** Parameters for the `glob` tool. */
interface ICopilotGlobToolArgs {
	pattern: string;
	path?: string;
}

/** Parameters for the `sql` tool. */
interface ICopilotSqlToolArgs {
	description?: string;
	query?: string;
}

/** Parameters for the `web_fetch` tool. */
interface ICopilotWebFetchToolArgs {
	url: string;
}

/**
 * Parameters shared by the agent-coordination tools (`read_agent`,
 * `write_agent`). The Copilot CLI identifies the target agent by its
 * human-readable `agent_id` (e.g. `math-helper`).
 */
interface ICopilotAgentToolArgs {
	agent_id?: string;
}

/**
 * Reads a well-formed `agent_id` from untrusted tool parameters. Since these are
 * parsed from JSON they may not match the expected shape, so the id is returned
 * only when it is a non-empty string and is therefore safe to render as inline
 * markdown code.
 */
function getAgentId(parameters: Record<string, unknown> | undefined): string | undefined {
	const agentId = (parameters as ICopilotAgentToolArgs | undefined)?.agent_id;
	return typeof agentId === 'string' && agentId.length > 0 ? agentId : undefined;
}

/**
 * Parameters for the `apply_patch` / `git_apply_patch` tools. The patch text
 * itself lives in `input` using the V4A diff format (file headers like
 * `*** Update File: <path>`), so file paths must be parsed out of the body
 * rather than read from a top-level field.
 */
interface ICopilotApplyPatchToolArgs {
	input?: string;
	/** Some SDK callers send the patch under `patch` instead of `input`. */
	patch?: string;
	explanation?: string;
}

/**
 * Headers of the V4A patch format the `apply_patch` tool accepts. Tolerates
 * leading whitespace; trims the captured path.
 */
const APPLY_PATCH_FILE_HEADERS = [
	/^\s*\*\*\*\s+Update File:\s*(.+?)\s*$/,
	/^\s*\*\*\*\s+Add File:\s*(.+?)\s*$/,
	/^\s*\*\*\*\s+Delete File:\s*(.+?)\s*$/,
	/^\s*\*\*\*\s+Move to:\s*(.+?)\s*$/,
];

/**
 * Extracts the set of file paths affected by an `apply_patch` payload. Reads
 * the `*** Update File:` / `*** Add File:` / `*** Delete File:` / `*** Move to:`
 * headers from the V4A diff body. Returns paths in document order with
 * duplicates removed.
 *
 * Accepts either a structured args object ({@link ICopilotApplyPatchToolArgs})
 * or a bare patch string. The Copilot SDK delivers `apply_patch` with
 * `arguments` as a raw V4A patch string (custom tool format), not as a JSON
 * object, so the string fallback is the common case for apply_patch.
 */
function getApplyPatchFiles(args: string | ICopilotApplyPatchToolArgs | undefined): string[] {
	const text = typeof args === 'string' ? args : (args?.input ?? args?.patch);
	if (typeof text !== 'string' || text.length === 0) {
		return [];
	}
	const seen = new Set<string>();
	const out: string[] = [];
	for (const line of text.split('\n')) {
		for (const re of APPLY_PATCH_FILE_HEADERS) {
			const m = re.exec(line);
			if (m) {
				const path = m[1];
				if (path && !seen.has(path)) {
					seen.add(path);
					out.push(path);
				}
				break;
			}
		}
	}
	return out;
}

/** Set of tool names that perform file edits. */
const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.Edit,
	CopilotToolName.StrReplace,
	CopilotToolName.Insert,
	CopilotToolName.Create,
	CopilotToolName.ApplyPatch,
	CopilotToolName.GitApplyPatch,
]);

const STR_REPLACE_EDITOR_EDIT_COMMANDS: ReadonlySet<string> = new Set([
	CopilotToolName.Edit,
	CopilotToolName.StrReplace,
	CopilotToolName.Insert,
	CopilotToolName.Create,
]);

/**
 * Returns true if the tool modifies files on disk.
 */
export function isEditTool(toolName: string, command?: string): boolean {
	if (EDIT_TOOL_NAMES.has(toolName)) {
		return true;
	}
	if (toolName === CopilotToolName.StrReplaceEditor) {
		return command !== undefined && STR_REPLACE_EDITOR_EDIT_COMMANDS.has(command);
	}
	return false;
}

/**
 * Extracts the target file path from an edit tool's parameters, if available.
 * For `apply_patch` / `git_apply_patch` the first file in the V4A patch body
 * is returned. Callers that need every affected file (for snapshotting all
 * edits in a multi-file patch) should use {@link getEditFilePaths} instead.
 */
export function getEditFilePath(parameters: unknown): string | undefined {
	return getEditFilePaths(parameters)[0];
}

/**
 * Extracts every file path an edit tool will touch. For `edit` / `create` this
 * is the single `path` parameter; for `apply_patch` / `git_apply_patch` this
 * is the unique set of files declared in the V4A patch body, in document
 * order. Returns an empty array if no paths can be determined.
 */
export function getEditFilePaths(parameters: unknown): string[] {
	if (typeof parameters === 'string') {
		// Could be either a JSON-encoded args object or a raw V4A patch
		// string. Copilot SDK delivers `apply_patch` arguments as a bare
		// patch string (custom tool format), so when JSON parsing fails
		// fall back to treating it as the patch body.
		try {
			parameters = JSON.parse(parameters);
		} catch {
			return getApplyPatchFiles(parameters as string);
		}
		// JSON.parse may have returned a string (e.g. a JSON-encoded patch
		// body that round-trips through tryStringify on the call site).
		if (typeof parameters === 'string') {
			return getApplyPatchFiles(parameters);
		}
	}

	if (!parameters || typeof parameters !== 'object') {
		return [];
	}

	const patchArgs = parameters as ICopilotApplyPatchToolArgs;
	if (typeof patchArgs.input === 'string' || typeof patchArgs.patch === 'string') {
		return getApplyPatchFiles(patchArgs);
	}

	const args = parameters as ICopilotFileToolArgs;
	return typeof args.path === 'string' ? [args.path] : [];
}

/** Set of tool names that execute shell commands (bash or powershell). */
const SHELL_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.Bash,
	CopilotToolName.PowerShell,
]);

/** Set of tool names that write input to an interactive shell session. */
const WRITE_SHELL_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.WriteBash,
	CopilotToolName.WritePowerShell,
]);

/** Set of tool names that read output from an interactive shell session. */
const READ_SHELL_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.ReadBash,
	CopilotToolName.ReadPowerShell,
]);

/** Set of tool names that spawn subagent sessions. */
const SUBAGENT_TOOL_NAMES: ReadonlySet<string> = new Set([
	'task',
]);

/** Set of tool names that perform file/text search. */
const SEARCH_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.Grep,
	CopilotToolName.Rg,
	CopilotToolName.Glob,
]);

/**
 * Tools that should not be shown to the user. These are internal tools
 * used by the CLI for its own purposes (e.g., reporting intent to the model).
 *
 * `skill` is hidden because the SDK already emits a richer `skill.invoked`
 * lifecycle event with the resolved skill file path; the agent session
 * synthesizes a tool-start/complete pair from that event so the UI can
 * render a clickable file link instead of just the skill name. See
 * {@link synthesizeSkillToolCall}.
 */
const HIDDEN_TOOL_NAMES: ReadonlySet<string> = new Set([
	CopilotToolName.ReportIntent,
	CopilotToolName.Skill,
]);

/**
 * Returns true if the tool should be hidden from the UI.
 */
export function isHiddenTool(toolName: string): boolean {
	return HIDDEN_TOOL_NAMES.has(toolName);
}

/**
 * Returns true for the auto-approved agent-coordination tools (list/read/write
 * agents). These are client-contributed tools that never go through the
 * permission flow, so the agent host auto-readies them at start to surface a
 * tailored invocation message instead of the generic fallback.
 */
export function isAgentCoordinationTool(toolName: string): boolean {
	return toolName === CopilotToolName.ListAgents
		|| toolName === CopilotToolName.ReadAgent
		|| toolName === CopilotToolName.WriteAgent;
}

/**
 * Returns true when the tool is Copilot's internal Autopilot completion signal.
 */
export function isTaskCompleteTool(toolName: string): boolean {
	return toolName === CopilotToolName.TaskComplete;
}

/**
 * Extracts the user-facing Autopilot completion summary from the tool output,
 * falling back to the original `summary` argument for older/incomplete events.
 */
export function getTaskCompleteSummary(parameters: Record<string, unknown> | undefined, toolOutput: string | undefined): string | undefined {
	if (toolOutput && toolOutput.trim().length > 0) {
		return toolOutput;
	}
	const summary = parameters?.summary;
	return typeof summary === 'string' && summary.trim().length > 0 ? summary : undefined;
}

/**
 * Formats the Autopilot completion summary as the markdown response part
 * content, including the localized prefix.
 */
export function getTaskCompleteMarkdown(parameters: Record<string, unknown> | undefined, toolOutput: string | undefined): string | undefined {
	const summary = getTaskCompleteSummary(parameters, toolOutput);
	if (!summary) {
		return undefined;
	}
	return '\n\n' + localize('toolMarkdown.taskComplete', "**已完成任务:** {0}", summary);
}

/**
 * Returns true if the tool should render as a markdown response part instead
 * of a tool-call entry.
 */
export function isMarkdownRenderedTool(toolName: string): boolean {
	return isTaskCompleteTool(toolName);
}

/**
 * Returns markdown content for tools rendered as inline markdown response
 * parts.
 */
export function getToolMarkdownContent(toolName: string, parameters: Record<string, unknown> | undefined): string | undefined {
	if (!isMarkdownRenderedTool(toolName)) {
		return undefined;
	}
	const summary = getTaskCompleteSummary(parameters, undefined);
	if (!summary) {
		return undefined;
	}
	return getTaskCompleteMarkdown(parameters, undefined);
}

/**
 * Returns true if the tool executes shell commands.
 */
export function isShellTool(toolName: string): boolean {
	return SHELL_TOOL_NAMES.has(toolName);
}

/**
 * Extracts the intention for a shell tool call from its `description`
 * argument. The Copilot shell tools (`bash`/`powershell`) carry a short
 * human-readable description of what the command does, which matches the
 * model's intention summary. Non-shell tools have no such argument, so this
 * returns `undefined` for them.
 */
export function getShellIntention(toolName: string, parameters: Record<string, unknown> | undefined): string | undefined {
	if (isShellTool(toolName) && typeof parameters?.description === 'string' && parameters.description.length > 0) {
		return parameters.description;
	}
	return undefined;
}

// =============================================================================
// Display helpers
//
// These functions translate Copilot CLI tool names and arguments into
// human-readable display strings. This logic lives here -- in the agent-host
// process -- so the IPC protocol stays agent-agnostic; the renderer never needs
// to know about specific tool names.
// =============================================================================

function truncate(text: string, maxLength: number): string {
	return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

/**
 * Formats a file path as a markdown link `[](file-uri)` so it renders
 * as a clickable file widget in the chat UI.
 */
function formatPathAsMarkdownLink(path: string): string {
	const uri = URI.file(path);
	return `[${escapeMarkdownLinkLabel(basename(uri))}](${uri})`;
}

function formatUrlAsMarkdownLink(url: string): string {
	return new MarkdownString().appendLink(url, truncate(url, 80)).value;
}

/**
 * Wraps a localized message containing a markdown file link into a
 * `StringOrMarkdown` object so the renderer treats it as markdown.
 */
function md(value: string): StringOrMarkdown {
	return { markdown: value };
}

const identityPathResolver: ToolPathResolver = path => path;

export function parseCopilotStreamingToolInput(raw: string): unknown {
	return parsePartialToolInput(raw) ?? raw;
}

export function getToolDisplayName(toolName: string): string {
	const serverDisplay = getServerToolDisplay(toolName, undefined)?.displayName;
	if (serverDisplay !== undefined) {
		return serverDisplay;
	}
	switch (toolName) {
		case CopilotToolName.StrReplaceEditor:
		case CopilotToolName.Edit:
		case CopilotToolName.StrReplace:
		case CopilotToolName.Insert: return localize('toolName.edit', "编辑文件");
		case CopilotToolName.Create: return localize('toolName.create', "创建文件");
		case CopilotToolName.View: return localize('toolName.read', "读取");
		case CopilotToolName.Bash:
		case CopilotToolName.PowerShell: return localize('toolName.shell', "运行 Shell 命令");
		case CopilotToolName.ReadBash:
		case CopilotToolName.ReadPowerShell: return localize('toolName.readTerminal', "读取终端");
		case CopilotToolName.WriteBash: return localize('toolName.writeBash', "写入 Bash");
		case CopilotToolName.WritePowerShell: return localize('toolName.writePowerShell', "写入 PowerShell");
		case CopilotToolName.StopBash:
		case CopilotToolName.StopPowerShell:
		case CopilotToolName.BashShutdown:
		case CopilotToolName.PowerShellShutdown: return localize('toolName.stopShell', "停止终端会话");
		case CopilotToolName.ListBash:
		case CopilotToolName.ListPowerShell: return localize('toolName.listShellSessions', "列出 Shell 会话");
		case CopilotToolName.Grep:
		case CopilotToolName.Rg:
		case CopilotToolName.Glob: return localize('toolName.search', "搜索");
		case CopilotToolName.SearchCodeSubagent: return localize('toolName.searchCode', "搜索代码");
		case CopilotToolName.ApplyPatch: return localize('toolName.applyPatch', "应用修补程序");
		case CopilotToolName.GitApplyPatch: return localize('toolName.patch', "补丁");
		case CopilotToolName.CodeqlChecker: return localize('toolName.codeqlChecker', "CodeQL 安全扫描");
		case CopilotToolName.CodeReview: return localize('toolName.codeReview', "代码评审");
		case CopilotToolName.ReplyToComment: return localize('toolName.replyToComment', "回复评论");
		case CopilotToolName.Think: return localize('toolName.think', "思考");
		case CopilotToolName.ReportIntent: return localize('toolName.reportIntent', "报告意图");
		case CopilotToolName.ReportProgress: return localize('toolName.reportProgress', "进度更新");
		case CopilotToolName.WebSearch: return localize('toolName.webSearch', "Web 搜索");
		case CopilotToolName.WebFetch: return localize('toolName.fetchWebContent', "提取 Web 内容");
		case CopilotToolName.UpdateTodo: return localize('toolName.updateTodo', "更新待办事项");
		case CopilotToolName.ShowFile: return localize('toolName.showFile', "显示文件");
		case CopilotToolName.FetchCopilotCliDocumentation: return localize('toolName.fetchCopilotCliDocumentation', "提取文档");
		case CopilotToolName.ProposeWork: return localize('toolName.proposeWork', "提议工作");
		case CopilotToolName.TaskComplete: return localize('toolName.taskComplete', "任务已完成");
		case CopilotToolName.AskUser: return localize('toolName.askUser', "询问用户");
		case CopilotToolName.Skill: return localize('toolName.invokeSkill', "调用技能");
		case CopilotToolName.Task: return localize('toolName.task', "委派任务");
		case CopilotToolName.ListAgents: return localize('toolName.listAgents', "列出智能体");
		case CopilotToolName.ReadAgent: return localize('toolName.readAgent', "读取智能体");
		case CopilotToolName.ExitPlanMode: return localize('toolName.exitPlanModeFull', "退出计划模式");
		case CopilotToolName.Sql: return localize('toolName.sql', "执行 SQL");
		case CopilotToolName.Lsp: return localize('toolName.lsp', "语言服务器");
		case CopilotToolName.CreatePullRequest: return localize('toolName.createPullRequest', "创建拉取请求");
		case CopilotToolName.GhAdvisoryDatabase: return localize('toolName.ghAdvisoryDatabase', "检查依赖项");
		case CopilotToolName.StoreMemory: return localize('toolName.storeMemory', "存储记忆");
		case CopilotToolName.ParallelValidation: return localize('toolName.parallelValidation', "验证更改");
		case CopilotToolName.WriteAgent: return localize('toolName.writeAgent', "写入智能体");
		case CopilotToolName.McpReload: return localize('toolName.mcpReload', "重新加载 MCP 配置");
		case CopilotToolName.McpValidate: return localize('toolName.mcpValidate', "验证 MCP 配置");
		case CopilotToolName.ToolSearchToolRegex: return localize('toolName.toolSearchToolRegex', "搜索工具");
		default: return toolName;
	}
}

export function getInvocationMessage(toolName: string, displayName: string, parameters: Record<string, unknown> | undefined, resolvePath: ToolPathResolver = identityPathResolver): StringOrMarkdown {
	const serverDisplay = getServerToolDisplay(toolName, parameters)?.invocationMessage;
	if (serverDisplay !== undefined) {
		return serverDisplay;
	}

	if (SHELL_TOOL_NAMES.has(toolName)) {
		const args = parameters as ICopilotShellToolArgs | undefined;
		if (args?.command) {
			const firstLine = args.command.split('\n')[0];
			return md(localize('toolInvoke.shellCmd', "正在运行 {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
		}
		return localize('toolInvoke.shell', "正在运行 {0} 命令", displayName);
	}

	if (WRITE_SHELL_TOOL_NAMES.has(toolName)) {
		const args = parameters as ICopilotShellToolArgs | undefined;
		if (args?.command) {
			const firstLine = args.command.split('\n')[0];
			return md(localize('toolInvoke.writeShellCmd', "Send {0} to shell", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
		}
		return localize('toolInvoke.writeShell', "Send input to shell");
	}

	if (READ_SHELL_TOOL_NAMES.has(toolName)) {
		return localize('toolInvoke.readTerminal', "正在读取终端");
	}

	switch (toolName) {
		case CopilotToolName.View: {
			const args = parameters as ICopilotViewToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				const link = formatPathAsMarkdownLink(resolvePath(args.path));
				const range = formatViewRange(args.view_range);
				if (range) {
					if (range.endLine === -1) {
						return md(localize('toolInvoke.viewFileFromLine', "Read {0}, line {1} to the end", link, range.startLine));
					}
					if (range.endLine !== range.startLine) {
						return md(localize('toolInvoke.viewFileRange', "Read {0}, lines {1} to {2}", link, range.startLine, range.endLine));
					}
					return md(localize('toolInvoke.viewFileLine', "Read {0}, line {1}", link, range.startLine));
				}
				return md(localize('toolInvoke.viewFile', "Read {0}", link));
			}
			return localize('toolInvoke.view', "Read file");
		}
		case CopilotToolName.Edit:
		case CopilotToolName.StrReplace: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolInvoke.editFile', "Edit {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolInvoke.edit', "Edit file");
		}
		case CopilotToolName.Insert: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolInvoke.insertFile', "Insert text in {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolInvoke.insert', "Insert text");
		}
		case CopilotToolName.Create: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolInvoke.createFile', "Create {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolInvoke.create', "Create file");
		}
		case CopilotToolName.StrReplaceEditor: {
			const command = (parameters as ICopilotStrReplaceEditorToolArgs | undefined)?.command;
			switch (command) {
				case 'view':
					return getInvocationMessage(CopilotToolName.View, displayName, parameters, resolvePath);
				case 'create':
					return getInvocationMessage(CopilotToolName.Create, displayName, parameters, resolvePath);
				case 'insert':
					return getInvocationMessage(CopilotToolName.Insert, displayName, parameters, resolvePath);
				case 'edit':
				case 'str_replace':
				default:
					return getInvocationMessage(CopilotToolName.Edit, displayName, parameters, resolvePath);
			}
		}
		case CopilotToolName.Grep: {
			const args = parameters as ICopilotGrepToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolInvoke.grepPattern', "Search for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolInvoke.grep', "Search files");
		}
		case CopilotToolName.Rg: {
			const args = parameters as ICopilotRgToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolInvoke.grepPattern', "Search for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolInvoke.grep', "Search files");
		}
		case CopilotToolName.Glob: {
			const args = parameters as ICopilotGlobToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolInvoke.globPattern', "Find files matching {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolInvoke.glob', "Find files");
		}
		case CopilotToolName.ApplyPatch:
		case CopilotToolName.GitApplyPatch: {
			const files = getEditFilePaths(parameters).map(resolvePath);
			if (files.length === 1) {
				return md(localize('toolInvoke.patchFile', "Edit {0}", formatPathAsMarkdownLink(files[0])));
			}
			if (files.length > 1) {
				return md(localize('toolInvoke.patchFiles', "Edit {0}", files.map(formatPathAsMarkdownLink).join(', ')));
			}
			return localize('toolInvoke.patch', "Edit files");
		}
		case CopilotToolName.Sql: {
			const args = parameters as ICopilotSqlToolArgs | undefined;
			return args?.description || localize('toolInvoke.sql', "Execute SQL query");
		}
		case CopilotToolName.WebFetch: {
			const args = parameters as ICopilotWebFetchToolArgs | undefined;
			if (args?.url) {
				return md(localize('toolInvoke.webFetch', "正在提取 {0}", formatUrlAsMarkdownLink(args.url)));
			}
			return localize('toolInvoke.webFetchGeneric', "正在提取 URL");
		}
		case CopilotToolName.ExitPlanMode:
			return localize('toolInvoke.exitPlanMode', "Present plan");
		case CopilotToolName.Task:
			return localize('toolInvoke.task', "正在委派任务");
		// The agent-coordination tools (list/read/write agents) are fast, so
		// they use a single message for both the running and completed states:
		// the past-tense phrasing. See getPastTenseMessage.
		case CopilotToolName.ListAgents:
		case CopilotToolName.ReadAgent:
		case CopilotToolName.WriteAgent:
			return getPastTenseMessage(toolName, displayName, parameters, true);
		default:
			return displayName;
	}
}

/**
 * Returns the progressively refined message shown while Copilot generates tool input.
 */
export function getStreamingInvocationMessage(toolName: string, displayName: string, parameters: unknown, resolvePath: ToolPathResolver = identityPathResolver): StringOrMarkdown {
	const objectParameters = parameters !== null && typeof parameters === 'object' && !Array.isArray(parameters)
		? parameters as Record<string, unknown>
		: undefined;
	switch (toolName) {
		case CopilotToolName.Edit:
		case CopilotToolName.StrReplace: {
			const args = objectParameters as ICopilotEditToolArgs | undefined;
			return getStreamingReplaceMessage(args?.path, streamingToolTextLineCount(args?.old_str), streamingToolTextLineCount(args?.new_str), resolvePath);
		}
		case CopilotToolName.Create: {
			const args = objectParameters as ICopilotCreateToolArgs | undefined;
			return getStreamingCreateMessage(args?.path, streamingToolTextLineCount(args?.file_text), resolvePath);
		}
		case CopilotToolName.Insert: {
			const args = objectParameters as ICopilotInsertToolArgs | undefined;
			return getStreamingInsertMessage(args?.path, streamingToolTextLineCount(args?.new_str), resolvePath);
		}
		case CopilotToolName.StrReplaceEditor: {
			const args = objectParameters as ICopilotStrReplaceEditorToolArgs | undefined;
			const command = args?.command;
			switch (command) {
				case 'view':
					return getInvocationMessage(CopilotToolName.View, displayName, objectParameters, resolvePath);
				case 'create':
					return getStreamingCreateMessage(args?.path, streamingToolTextLineCount(args?.file_text), resolvePath);
				case 'insert':
					return getStreamingInsertMessage(args?.path, streamingToolTextLineCount(args?.new_str), resolvePath);
				case 'edit':
				case 'str_replace':
				default:
					return getStreamingReplaceMessage(args?.path, streamingToolTextLineCount(args?.old_str), streamingToolTextLineCount(args?.new_str), resolvePath);
			}
		}
		case CopilotToolName.ApplyPatch:
		case CopilotToolName.GitApplyPatch: {
			const args = objectParameters as ICopilotApplyPatchToolArgs | undefined;
			const patch = typeof parameters === 'string' ? parameters : args?.input ?? args?.patch;
			return getStreamingPatchMessage(getEditFilePaths(parameters), streamingToolTextLineCount(patch), resolvePath);
		}
		default:
			return getInvocationMessage(toolName, displayName, objectParameters, resolvePath);
	}
}

export function getPastTenseMessage(toolName: string, displayName: string, parameters: Record<string, unknown> | undefined, success: boolean, resultText?: string, resolvePath: ToolPathResolver = identityPathResolver): StringOrMarkdown {
	if (!success) {
		return localize('toolComplete.failed', "“{0}”失败", displayName);
	}

	const serverDisplay = getServerToolDisplay(toolName, parameters, { text: resultText, success })?.pastTenseMessage;
	if (serverDisplay !== undefined) {
		return serverDisplay;
	}

	if (SHELL_TOOL_NAMES.has(toolName)) {
		const args = parameters as ICopilotShellToolArgs | undefined;
		if (args?.command) {
			const firstLine = args.command.split('\n')[0];
			return md(localize('toolComplete.shellCmd', "已运行 {0}", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
		}
		return localize('toolComplete.shell', "已运行 {0} 命令", displayName);
	}

	if (WRITE_SHELL_TOOL_NAMES.has(toolName)) {
		const args = parameters as ICopilotShellToolArgs | undefined;
		if (args?.command) {
			const firstLine = args.command.split('\n')[0];
			return md(localize('toolComplete.writeShellCmd', "Sent {0} to shell", appendEscapedMarkdownInlineCode(truncate(firstLine, 80))));
		}
		return localize('toolComplete.writeShell', "Sent input to shell");
	}

	if (READ_SHELL_TOOL_NAMES.has(toolName)) {
		return localize('toolComplete.readTerminal', "读取终端");
	}

	switch (toolName) {
		case CopilotToolName.View: {
			const args = parameters as ICopilotViewToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				const link = formatPathAsMarkdownLink(resolvePath(args.path));
				const range = formatViewRange(args.view_range);
				if (range) {
					if (range.endLine === -1) {
						return md(localize('toolComplete.viewFileFromLine', "Read {0}, line {1} to the end", link, range.startLine));
					}
					if (range.endLine !== range.startLine) {
						return md(localize('toolComplete.viewFileRange', "Read {0}, lines {1} to {2}", link, range.startLine, range.endLine));
					}
					return md(localize('toolComplete.viewFileLine', "Read {0}, line {1}", link, range.startLine));
				}
				return md(localize('toolComplete.viewFile', "Read {0}", link));
			}
			return localize('toolComplete.view', "Read file");
		}
		case CopilotToolName.Edit:
		case CopilotToolName.StrReplace: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolComplete.editFile', "Edited {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolComplete.edit', "Edited file");
		}
		case CopilotToolName.Insert: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolComplete.insertFile', "Inserted text in {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolComplete.insert', "Inserted text");
		}
		case CopilotToolName.Create: {
			const args = parameters as ICopilotFileToolArgs | undefined;
			if (typeof args?.path === 'string' && args.path) {
				return md(localize('toolComplete.createFile', "Created {0}", formatPathAsMarkdownLink(resolvePath(args.path))));
			}
			return localize('toolComplete.create', "Created file");
		}
		case CopilotToolName.StrReplaceEditor: {
			const command = (parameters as ICopilotStrReplaceEditorToolArgs | undefined)?.command;
			switch (command) {
				case 'view':
					return getPastTenseMessage(CopilotToolName.View, displayName, parameters, success, resultText, resolvePath);
				case 'create':
					return getPastTenseMessage(CopilotToolName.Create, displayName, parameters, success, resultText, resolvePath);
				case 'insert':
					return getPastTenseMessage(CopilotToolName.Insert, displayName, parameters, success, resultText, resolvePath);
				case 'edit':
				case 'str_replace':
				default:
					return getPastTenseMessage(CopilotToolName.Edit, displayName, parameters, success, resultText, resolvePath);
			}
		}
		case CopilotToolName.Grep: {
			const args = parameters as ICopilotGrepToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolComplete.grepPattern', "Searched for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolComplete.grep', "Searched files");
		}
		case CopilotToolName.Rg: {
			const args = parameters as ICopilotRgToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolComplete.grepPattern', "Searched for {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolComplete.grep', "Searched files");
		}
		case CopilotToolName.Glob: {
			const args = parameters as ICopilotGlobToolArgs | undefined;
			if (args?.pattern) {
				return md(localize('toolComplete.globPattern', "Found files matching {0}", appendEscapedMarkdownInlineCode(truncate(args.pattern, 80))));
			}
			return localize('toolComplete.glob', "Found files");
		}
		case CopilotToolName.ApplyPatch:
		case CopilotToolName.GitApplyPatch: {
			const files = getEditFilePaths(parameters).map(resolvePath);
			if (files.length === 1) {
				return md(localize('toolComplete.patchFile', "Edited {0}", formatPathAsMarkdownLink(files[0])));
			}
			if (files.length > 1) {
				return md(localize('toolComplete.patchFiles', "Edited {0}", files.map(formatPathAsMarkdownLink).join(', ')));
			}
			return localize('toolComplete.patch', "Edited files");
		}
		case CopilotToolName.Sql: {
			const args = parameters as ICopilotSqlToolArgs | undefined;
			return args?.description || localize('toolComplete.sql', "Executed SQL query");
		}
		case CopilotToolName.WebFetch: {
			const args = parameters as ICopilotWebFetchToolArgs | undefined;
			if (args?.url) {
				return md(localize('toolComplete.webFetch', "已提取 {0}", formatUrlAsMarkdownLink(args.url)));
			}
			return localize('toolComplete.webFetchGeneric', "已提取 URL");
		}
		case CopilotToolName.ExitPlanMode:
			return localize('toolComplete.exitPlanMode', "Exited plan mode");
		case CopilotToolName.Task:
			return localize('toolComplete.task', "委派任务");
		case CopilotToolName.ListAgents:
			return localize('toolComplete.listAgents', "Listed agents");
		case CopilotToolName.ReadAgent: {
			const agentId = getAgentId(parameters);
			if (agentId) {
				return md(localize('toolComplete.readAgent', "Read agent {0}", appendEscapedMarkdownInlineCode(agentId)));
			}
			return localize('toolComplete.readAgentGeneric', "Read agent");
		}
		case CopilotToolName.WriteAgent: {
			const agentId = getAgentId(parameters);
			if (agentId) {
				return md(localize('toolComplete.writeAgent', "Wrote to agent {0}", appendEscapedMarkdownInlineCode(agentId)));
			}
			return localize('toolComplete.writeAgentGeneric', "Wrote to agent");
		}
		default:
			return displayName;
	}
}

// =============================================================================
// Skill event synthesis
//
// The Copilot SDK emits a `skill` tool call (which we hide) and, separately, a
// `skill.invoked` lifecycle event with the resolved skill file path. We turn
// the latter into a synthesized tool-start/complete pair so clients can render
// a clickable file link to the SKILL.md the agent loaded -- matching the
// existing `view`-tool display style. Live and replay paths share this helper
// so they stay in lock-step (see also the mirrored-pair gotcha for tool-call
// display in this file).
// =============================================================================

/** Subset of the SDK's `skill.invoked` payload that the synth helper needs. */
export interface ICopilotSkillInvokedData {
	readonly name: string;
	readonly path?: string;
	readonly description?: string;
}

/**
 * Builds a stable synthetic tool call id for a `skill.invoked` event so
 * reconnect/replay produces the same id as the original live emit. The id
 * is used unencoded as a path segment (e.g. by `ChatResponseResource.createUri`),
 * so it must not contain characters like `/` -- we hash any fallback values
 * that could carry filesystem paths or arbitrary text.
 */
export function getSkillSyntheticToolCallId(eventId: string | undefined, data: ICopilotSkillInvokedData): string {
	if (eventId) {
		return `synth-skill-${eventId}`;
	}
	const seed = data.path ?? data.name;
	return `synth-skill-${hash(seed).toString(16)}`;
}

/**
 * Synthesized data for a `skill.invoked` tool call. Used by both the live
 * session handler and the history-replay mapper so the two paths render
 * identically. Callers wrap this into protocol actions or {@link Turn}
 * data; this helper avoids any agent-protocol coupling.
 */
export interface ISynthesizedSkillToolCall {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly displayName: string;
	readonly invocationMessage: StringOrMarkdown;
	readonly pastTenseMessage: StringOrMarkdown;
}

/**
 * Synthesizes the data for a `skill.invoked` tool call (a tool-start /
 * tool-complete pair). Returns the constituent fields without coupling to
 * any specific event or action shape — callers compose them into protocol
 * actions or {@link Turn} entries as needed.
 */
export function synthesizeSkillToolCall(
	data: ICopilotSkillInvokedData,
	eventId: string | undefined,
): ISynthesizedSkillToolCall {
	const toolCallId = getSkillSyntheticToolCallId(eventId, data);
	const displayName = localize('toolName.skill', "读取技能");
	// Use the skill name as the link text rather than the basename: every skill
	// file is named SKILL.md, so `Reading skill [plan]` reads better than the
	// always-identical `Reading skill [SKILL.md]`. The client may further upgrade
	// this link to a rich pill based on the `SKILL.md` basename. Skill names and
	// paths come from the SDK / agent host and are escaped to prevent markdown
	// injection from a malicious skill author.
	// Escape only the characters that would break out of markdown link text
	// syntax (`\` and `]`); a full markdown escape would leave visible
	// backslashes in renderers (like the skill pill) that extract link text
	// without re-parsing markdown.
	const escapedName = escapeMarkdownLinkLabel(data.name);
	const skillLink = data.path ? `[${escapedName}](${URI.file(data.path)})` : undefined;
	const invocationMessage: StringOrMarkdown = skillLink
		? md(localize('toolInvoke.skill', "Read skill {0}", skillLink))
		: localize('toolInvoke.skillName', "Reading skill {0}", data.name);
	const pastTenseMessage: StringOrMarkdown = skillLink
		? md(localize('toolComplete.skill', "Read skill {0}", skillLink))
		: localize('toolComplete.skillName', "Read skill {0}", data.name);
	return {
		toolCallId,
		toolName: CopilotToolName.Skill,
		displayName,
		invocationMessage,
		pastTenseMessage,
	};
}

export function getToolInputString(toolName: string, parameters: Record<string, unknown> | undefined, rawArguments: string | undefined): string | undefined {
	if (!parameters && !rawArguments) {
		return undefined;
	}

	if (SHELL_TOOL_NAMES.has(toolName) || WRITE_SHELL_TOOL_NAMES.has(toolName)) {
		const args = parameters as ICopilotShellToolArgs | undefined;
		// Custom tool overrides may wrap the args: { kind: 'custom-tool', args: { command: '...' } }
		const command = args?.command ?? (args as Record<string, unknown> | undefined)?.args;
		if (typeof command === 'string') {
			return command;
		}
		if (typeof command === 'object' && command !== null && hasKey(command, { command: true })) {
			return (command as ICopilotShellToolArgs).command;
		}
		return rawArguments;
	}

	switch (toolName) {
		case CopilotToolName.Grep: {
			const args = parameters as ICopilotGrepToolArgs | undefined;
			return args?.pattern ?? rawArguments;
		}
		case CopilotToolName.Rg: {
			const args = parameters as ICopilotRgToolArgs | undefined;
			return args?.pattern ?? rawArguments;
		}
		case CopilotToolName.WebFetch: {
			const args = parameters as ICopilotWebFetchToolArgs | undefined;
			return args?.url ?? rawArguments;
		}
		default:
			// For other tools, show the formatted JSON arguments
			if (parameters) {
				try {
					return JSON.stringify(parameters, null, 2);
				} catch {
					return rawArguments;
				}
			}
			return rawArguments;
	}
}

/**
 * Returns a rendering hint for the given tool. Currently 'terminal', 'subagent',
 * and 'search' are supported, which tell the renderer to display the tool with
 * a terminal command block, a subagent widget, or a search icon respectively.
 */
export function getToolKind(toolName: string): 'terminal' | 'subagent' | 'search' | undefined {
	if (SHELL_TOOL_NAMES.has(toolName)) {
		return 'terminal';
	}
	if (SUBAGENT_TOOL_NAMES.has(toolName)) {
		return 'subagent';
	}
	if (SEARCH_TOOL_NAMES.has(toolName)) {
		return 'search';
	}
	return undefined;
}

/**
 * Extracts subagent metadata (agent name, description) from the parsed
 * arguments of a Copilot SDK subagent tool call. The Copilot `task` tool
 * uses `agent_type` (snake_case), which this normalizes into the generic
 * `subagentAgentName` / `subagentDescription` shape used by the rest of the
 * agent host code.
 *
 * Only call this for tools where {@link getToolKind} returned `'subagent'`.
 */
export function getSubagentMetadata(parameters: Record<string, unknown> | undefined): { agentName?: string; description?: string } {
	if (!parameters) {
		return {};
	}
	const agentName = typeof parameters.agent_type === 'string' && parameters.agent_type.length > 0
		? parameters.agent_type
		: undefined;
	const description = typeof parameters.description === 'string' && parameters.description.length > 0
		? parameters.description
		: undefined;
	return { agentName, description };
}

/**
 * Returns the shell language identifier for syntax highlighting.
 * Used when creating terminal tool-specific data for the renderer.
 */
export function getShellLanguage(toolName: string): string {
	switch (toolName) {
		case CopilotToolName.PowerShell:
		case CopilotToolName.WritePowerShell:
		case CopilotToolName.ReadPowerShell: return 'powershell';
		default: return 'shellscript';
	}
}

// =============================================================================
// Permission display
//
// Derives display fields from SDK permission requests for the tool
// confirmation UI. Colocated with the tool-start display helpers above so
// that formatting utilities (formatPathAsMarkdownLink, md, etc.) are shared.
// =============================================================================

export function tryStringify(value: unknown): string | undefined {
	try {
		return JSON.stringify(value);
	} catch {
		return undefined;
	}
}

/**
 * Loose, optional-field projection of the SDK's {@link PermissionRequest}
 * discriminated union. Lets the rest of the agent host read the well-known
 * fields without `switch (request.kind)` narrowing at every access site.
 *
 * The SDK's `PermissionRequest` (a union with required per-variant fields) is
 * structurally assignable to this interface — every variant carries `kind`
 * and `toolCallId?`, and the variant-specific fields are listed here as
 * optional. Use this type at the agent-host boundary so call sites and tests
 * can rely on a single shape.
 */
export interface ITypedPermissionRequest {
	/** Permission kind discriminator from the SDK. */
	kind: PermissionRequest['kind'];
	/** Whether managed policy requires a human response and forbids host auto-approval. */
	managedApprovalRequired?: boolean;
	/** Tool call ID that triggered this permission request, when available. */
	toolCallId?: string;
	/** File path — set for `read` permission requests. */
	path?: string;
	/** File path — set for `write` permission requests. */
	fileName?: string;
	/** Full shell command text — set for `shell` permission requests. */
	fullCommandText?: string;
	/**
	 * True when the model requested this `shell` command run outside the
	 * sandbox (via `requestSandboxBypass`) and the host opted in via
	 * `sandbox.allowBypass`.
	 */
	requestSandboxBypass?: boolean;
	/** Human-readable intention describing the operation. */
	intention?: string;
	/** MCP server name — set for `mcp` permission requests. */
	serverName?: string;
	/** Tool name — set for `mcp` and `custom-tool` permission requests. */
	toolName?: string;
	/** Tool arguments — set for `custom-tool` permission requests. */
	args?: Record<string, unknown>;
	/** URL — set for `url` permission requests. */
	url?: string;
	/** Unified diff of the proposed change — set for `write` permission requests. */
	diff?: string;
	/** New file contents that will be written — set for `write` permission requests. */
	newFileContents?: string;
}

/** Safely extract a string value from an SDK field that may be `unknown` at runtime. */
function str(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/**
 * Derives display fields from a permission request for the tool confirmation UI.
 */
export function getPermissionDisplay(request: ITypedPermissionRequest, workingDirectory?: URI, isNewFile?: boolean): {
	confirmationTitle: string;
	invocationMessage: StringOrMarkdown;
	toolInput?: string;
	/** Normalized permission kind for auto-approval routing. */
	permissionKind: IAgentToolPendingConfirmationSignal['permissionKind'];
	/** File path extracted from the request. */
	permissionPath?: string;
} {
	const path = str(request.path) ?? str(request.fileName);
	const fullCommandText = str(request.fullCommandText);
	const intention = str(request.intention);
	const serverName = str(request.serverName);
	const toolName = str(request.toolName);

	const shellConfirmationTitle = request.requestSandboxBypass
		? localize('copilot.permission.shell.bypass.title', "在沙盒外的终端中运行?")
		: localize('copilot.permission.shell.title', "是否在终端中运行?");

	switch (request.kind) {
		case 'shell': {
			// Strip a redundant `cd <workingDirectory> && …` prefix so the
			// confirmation dialog shows the simplified command.
			const shellParams: Record<string, unknown> | undefined = fullCommandText ? { command: fullCommandText } : undefined;
			stripRedundantCdPrefix(CopilotToolName.Bash, shellParams, workingDirectory);
			const cleanedCommand = typeof shellParams?.command === 'string' ? shellParams.command : fullCommandText;
			return {
				confirmationTitle: shellConfirmationTitle,
				invocationMessage: intention ?? getInvocationMessage(CopilotToolName.Bash, getToolDisplayName(CopilotToolName.Bash), cleanedCommand ? { command: cleanedCommand } : undefined),
				toolInput: cleanedCommand,
				permissionKind: 'shell',
				permissionPath: path,
			};
		}
		case 'custom-tool': {
			// Custom tool overrides (e.g. our shell tool). Extract the actual
			// tool args from the SDK's wrapper envelope.
			const args = typeof request.args === 'object' && request.args !== null ? request.args as Record<string, unknown> : undefined;
			const sdkToolName = str(request.toolName);
			if (args && sdkToolName && isShellTool(sdkToolName) && typeof args.command === 'string') {
				stripRedundantCdPrefix(sdkToolName, args, workingDirectory);
				const command = args.command as string;
				return {
					confirmationTitle: shellConfirmationTitle,
					invocationMessage: getInvocationMessage(sdkToolName, getToolDisplayName(sdkToolName), { command }),
					toolInput: command,
					permissionKind: 'shell',
					permissionPath: path,
				};
			}
			return {
				confirmationTitle: localize('copilot.permission.default.title', "是否允许工具调用?"),
				invocationMessage: md(localize('copilot.permission.default.message', "是否允许模型调用 {0}?", appendEscapedMarkdownInlineCode(toolName ?? request.kind))),
				toolInput: args ? tryStringify(args) : tryStringify(request),
				permissionKind: request.kind,
				permissionPath: path,
			};
		}
		case 'write': {
			const toolName = isNewFile ? CopilotToolName.Create : CopilotToolName.Edit;
			return {
				confirmationTitle: isNewFile
					? localize('copilot.permission.create.title', "是否创建文件?")
					: localize('copilot.permission.write.title', "是否写入文件?"),
				invocationMessage: getInvocationMessage(toolName, getToolDisplayName(toolName), path ? { path } : undefined),
				toolInput: tryStringify(path ? { path } : request) ?? undefined,
				permissionKind: 'write',
				permissionPath: path,
			};
		}
		case 'mcp': {
			const title = toolName ?? localize('copilot.permission.mcp.defaultTool', "MCP 工具");
			return {
				confirmationTitle: serverName
					? localize('copilot.permission.mcp.title', "是否允许来自 {0} 的工具?", serverName)
					: localize('copilot.permission.default.title', "是否允许工具调用?"),
				invocationMessage: serverName ? `${serverName}: ${title}` : title,
				toolInput: tryStringify({ serverName, toolName }) ?? undefined,
				permissionKind: 'mcp',
				permissionPath: path,
			};
		}
		case 'read':
			return {
				confirmationTitle: localize('copilot.permission.read.title', "是否允许在工作区外部读取文件?"),
				invocationMessage: getInvocationMessage(CopilotToolName.View, getToolDisplayName(CopilotToolName.View), path ? { path } : undefined),
				permissionKind: 'read',
				permissionPath: path,
			};
		case 'url': {
			const url = str(request.url);
			// Parse through URL for punycode escaping, but preserve the raw value if parsing fails.
			const normalizedUrl = url ? (URL.canParse(url) ? new URL(url).href : url) : undefined;
			return {
				confirmationTitle: localize('copilot.permission.url.title', "是否提取 URL?"),
				invocationMessage: md(localize('copilot.permission.url.message', "是否允许提取 Web 内容?")),
				toolInput: normalizedUrl ? JSON.stringify({ url: normalizedUrl }) : undefined,
				permissionKind: 'url',
			};
		}
		default:
			return {
				confirmationTitle: localize('copilot.permission.default.title', "是否允许工具调用?"),
				invocationMessage: md(localize('copilot.permission.default.message', "是否允许模型调用 {0}?", appendEscapedMarkdownInlineCode(toolName ?? request.kind))),
				toolInput: tryStringify(request) ?? undefined,
				permissionKind: request.kind,
				permissionPath: path,
			};
	}
}
