/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { CustomizationType } from '../../../common/state/protocol/channels-session/state.js';
import { CustomizationLoadStatus, customizationId, type DirectoryCustomization, type SkillCustomization } from '../../../common/state/sessionState.js';

/**
 * URI scheme for synthetic "built-in" customizations that have no editable
 * file on disk. These entries appear in the customization list purely for
 * discovery (their name and description); they carry no openable content.
 */
const AGENT_BUILTIN_SCHEME = 'agent-builtin';

/**
 * A Claude built-in slash command backed by the Skill tool, used to seed the
 * **pre-materialize** built-in list. These ship compiled into the Claude
 * CLI/SDK — they have no editable file on disk and, before a live session
 * exists, the SDK can't tell us its real command set, so we show a curated
 * best-guess list for discoverability.
 *
 * Once a session materializes, {@link buildSdkBuiltinSkillsContainer} replaces
 * this list with the runtime's actual built-ins (the SDK commands we don't
 * discover on disk), so this list only matters pre-session and may safely
 * drift from the CLI over time.
 *
 * This list covers the Skill-tool built-ins only. The CLI-level built-ins
 * typed directly in the terminal (`/help`, `/clear`, `/compact`, `/config`,
 * `/fast`, `/model`, `/tasks`, `/workflows`) are intentionally excluded —
 * they are not skills and would be mislabeled in a Skills container.
 */
interface IClaudeBuiltinCommand {
	readonly name: string;
	/**
	 * User-facing description, resolved lazily so `localize()` runs at call
	 * time rather than module-init (which would freeze the bundle locale).
	 */
	readonly description: () => string;
}

const CLAUDE_BUILTIN_COMMANDS: readonly IClaudeBuiltinCommand[] = [
	{ name: 'init', description: () => localize('claude.builtin.init', "(内置)扫描代码库，并生成一个包含项目结构、约定和未来会话说明的 `CLAUDE.md` 文件。") },
	{ name: 'review', description: () => localize('claude.builtin.review', "(内置)评审拉取请求或一组更改。") },
	{ name: 'security-review', description: () => localize('claude.builtin.securityReview', "(内置)完成对当前分支上待处理更改的安全评审。") },
	{ name: 'code-review', description: () => localize('claude.builtin.codeReview', "(内置)以选定的工作量级别(低→最大)评审当前差异，查找正确性 bug 以及重用/简化/效率方面的清理。传递 `--comment` 可将结果作为内联 PR 注释发布，或传递 `--fix` 来将其应用到工作树。") },
	{ name: 'simplify', description: () => localize('claude.builtin.simplify', "(内置)评审已更改的代码以进行重用、简化、效率和高度清理，然后应用修复。仅限质量 - 它会不搜寻 bug (使用 `/code-review` 执行此操作)。") },
	{ name: 'verify', description: () => localize('claude.builtin.verify', "(内置)运行应用并观察行为，以确认代码更改确实按预期工作。用于验证 PR、确认修复或在推送前验证本地更改。") },
	{ name: 'run', description: () => localize('claude.builtin.run', "(内置)启动并驱动项目的应用以查看更改是否生效 - 运行、启动或截取应用屏幕截图，或确认更改在实际应用中有效(不仅仅是测试)。") },
	{ name: 'loop', description: () => localize('claude.builtin.loop', "(内置)按定期间隔运行提示或 / 命令(例如 `/loop 5m /foo`, 默认为 10m)。适用于定期任务或轮询状态 - 非一次性工作。") },
	{ name: 'claude-api', description: () => localize('claude.builtin.claudeApi', "(内置) Claude API / Anthropic SDK 参考: 模型 ID、定价、参数、流式传输、工具使用、MCP、智能体、缓存、令牌计数、迁移。") },
	{ name: 'fewer-permission-prompts', description: () => localize('claude.builtin.fewerPermissionPrompts', "(内置)扫描转录内容以查找常见的只读 Bash/MCP 调用，并将优先级允许列表添加到项目 `.claude/settings.json` 以减少权限提示。") },
	{ name: 'update-config', description: () => localize('claude.builtin.updateConfig', "(内置)通过 `settings.json` 配置 Claude Code 工具: 用于自动化行为、权限、环境变量和挂钩故障排除的挂钩。") },
	{ name: 'keybindings-help', description: () => localize('claude.builtin.keybindingsHelp', "(内置)自定义键盘快捷键、重新绑定按键、添加组合绑定，或修改 `~/.claude/keybindings.json`。") },
	{ name: 'write-a-skill', description: () => localize('claude.builtin.writeASkill', "(内置)创作新技能。") },
];

/**
 * A Claude built-in subagent, used to seed the **pre-materialize** agent list.
 * These ship compiled into the Claude CLI/SDK (no editable file on disk), so
 * before a live session exists we surface a curated best-guess set for
 * discovery and selection. Once a session materializes, the live
 * `supportedAgents()` set supersedes this (see the SDK fallback in
 * `buildDiscoveredCustomizations`), so the list may safely drift over time.
 *
 * Includes the SDK default (`general-purpose`) for completeness; the discovery
 * layer hides it (selecting it is equivalent to "no selection"). The model
 * each agent runs on is folded into the description since the customization
 * surface has no model field.
 */
export interface IClaudeBuiltinAgent {
	readonly name: string;
	/** User-facing description, resolved lazily (see {@link IClaudeBuiltinCommand.description}). */
	readonly description: () => string;
}

export const CLAUDE_BUILTIN_AGENTS: readonly IClaudeBuiltinAgent[] = [
	{ name: 'claude', description: () => localize('claude.builtinAgent.claude', "(内置)适用于任何不适合更具体智能体的任务的通用智能体 - 未输入智能体名称时的默认选项。") },
	{ name: 'claude-code-guide', description: () => localize('claude.builtinAgent.claudeCodeGuide', "(内置)回答有关 Claude Agent SDK 以及 Claude/Anthropic API 的问题 - 功能、挂钩、/ 命令、MCP 服务器、设置、IDE 集成、SDK 智能体构建和 API 使用。模型: Haiku。") },
	{ name: 'Explore', description: () => localize('claude.builtinAgent.explore', "(内置)只读搜索智能体，用于在你仅需要结论时跨多个文件进行广泛的扇出搜索；它定位代码而非评审代码。模型: Haiku。") },
	{ name: 'general-purpose', description: () => localize('claude.builtinAgent.generalPurpose', "(内置)用于研究复杂问题、搜索代码和执行多步骤任务的通用智能体。") },
	{ name: 'Plan', description: () => localize('claude.builtinAgent.plan', "(内置)用于设计实施计划的软件架构师智能体 - 分步计划、关键文件和架构权衡。") },
];

/**
 * A resolved built-in skill entry ready to become a read-only customization.
 * Structurally matches the SDK's `SlashCommand` (`{ name, description }`), so
 * the live command set can be passed straight through.
 */
interface IBuiltinSkillEntry {
	readonly name: string;
	readonly description: string;
}

/**
 * Builds the read-only "Built-in" skills container from resolved
 * `{ name, description }` entries. Each child is a {@link CustomizationType.Skill}
 * on the {@link AGENT_BUILTIN_SCHEME}; the name and description shown in the
 * list are the discovery information it carries (the entries have no openable
 * content). Returns `undefined` when there are no entries.
 */
function buildBuiltinSkillsContainer(entries: readonly IBuiltinSkillEntry[]): DirectoryCustomization | undefined {
	if (entries.length === 0) {
		return undefined;
	}

	const children: SkillCustomization[] = entries.map(entry => {
		const uri = URI.from({ scheme: AGENT_BUILTIN_SCHEME, path: `/skill/${encodeURIComponent(entry.name)}` }).toString();
		return {
			type: CustomizationType.Skill,
			id: customizationId(uri),
			uri,
			name: entry.name,
			description: entry.description,
		};
	});

	const containerUri = URI.from({ scheme: AGENT_BUILTIN_SCHEME, path: '/skills' }).toString();
	return {
		type: CustomizationType.Directory,
		id: customizationId(containerUri),
		uri: containerUri,
		name: 'builtin',
		enabled: true,
		contents: CustomizationType.Skill,
		writable: false,
		load: { kind: CustomizationLoadStatus.Loaded },
		children,
	};
}

/**
 * The curated, hardcoded built-in container. Used ONLY pre-materialize —
 * before a live SDK snapshot exists, this is our best guess at the runtime's
 * built-in slash commands so the user can still discover them. Once a session
 * materializes, {@link buildSdkBuiltinSkillsContainer} supersedes it with the
 * runtime's real command set.
 *
 * Curated commands that collide with a discovered disk skill are excluded so
 * a user's editable `/<name>` is never duplicated by a read-only built-in
 * (mirrors {@link buildSdkBuiltinSkillsContainer} and the built-in-agent path).
 * Returns `undefined` when nothing remains.
 *
 * @param diskSkillNames Names of skills discovered on disk, to exclude.
 */
export function buildClaudeBuiltinSkillsContainer(diskSkillNames: ReadonlySet<string>): DirectoryCustomization | undefined {
	return buildBuiltinSkillsContainer(
		CLAUDE_BUILTIN_COMMANDS
			.filter(cmd => !diskSkillNames.has(cmd.name))
			.map(cmd => ({ name: cmd.name, description: cmd.description() }))
	);
}

/**
 * The post-materialize built-in container, derived from the live SDK command
 * set. A command the SDK reports but that we do NOT discover on disk as an
 * editable skill is a genuine runtime built-in (it has no editable file), so
 * it is surfaced read-only via {@link AGENT_BUILTIN_SCHEME} using the SDK's
 * own description. Commands backed by a discovered disk skill are excluded —
 * they are already shown as their editable selves. This auto-includes runtime
 * built-ins we never hardcoded and self-heals as the CLI evolves.
 *
 * @param commands The live SDK command set (`supportedCommands()`).
 * @param diskSkillNames Names of skills discovered on disk, to exclude.
 */
export function buildSdkBuiltinSkillsContainer(
	commands: readonly IBuiltinSkillEntry[],
	diskSkillNames: ReadonlySet<string>,
): DirectoryCustomization | undefined {
	const seen = new Set<string>();
	const entries: IBuiltinSkillEntry[] = [];
	for (const command of commands) {
		if (diskSkillNames.has(command.name) || seen.has(command.name)) {
			continue;
		}
		seen.add(command.name);
		entries.push({ name: command.name, description: command.description });
	}
	return buildBuiltinSkillsContainer(entries);
}
