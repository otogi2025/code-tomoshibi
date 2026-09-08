/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../nls.js';
import { createSchema, schemaProperty } from './agentHostSchema.js';
import type { ModelSelection } from './state/protocol/state.js';

/**
 * Root-config keys consumed exclusively by the Copilot CLI provider
 * (`CopilotSessionLauncher` / `CopilotAgent`) — kept out of the
 * provider-agnostic `agentHostCustomizationConfigSchema`.
 */
export const enum CopilotCliConfigKey {
	/** Use Agent Host's custom terminal tool instead of the SDK's default. Off by default. */
	EnableCustomTerminalTool = 'enableCustomTerminalTool',
	/** Log level passed to the Copilot SDK client. */
	CopilotSdkLogLevel = 'copilotSdkLogLevel',
	/** Enable the rubber duck critic subagent. */
	RubberDuck = 'rubberDuck',
	/** Apply Opus 4.8-tuned system-prompt overrides on Opus 4.8 models. Off by default. */
	Opus48Prompt = 'opus48Prompt',
	/** Enable runtime tool search (deferred-tool loading) for Copilot SDK sessions. On by default. */
	ToolSearchEnabled = 'toolSearchEnabled',
	/** Minimum tool count before MCP/external tools are deferred behind tool search. 0 = always defer. */
	ToolSearchDeferThreshold = 'toolSearchDeferThreshold',
	/** Override reasoning effort regardless of the picker value; unsupported values are ignored. */
	ReasoningEffortOverride = 'reasoningEffortOverride',
	/** Per-model capability overrides (family aliases) keyed by model id. */
	ModelCapabilityOverrides = 'modelCapabilityOverrides',
}

// VS Code `chat.agentHost.*` setting IDs that feed the root-config keys above,
// kept beside the keys they forward to. Registered in `chat.shared.contribution.ts`
// and forwarded into the host's root config by `AgentHostCopilotCliSettingsContribution`
// (and, for the terminal-tool toggle, `AgentHostTerminalContribution`).

export const AgentHostCustomTerminalToolEnabledSettingId = 'chat.agentHost.customTerminalTool.enabled';

export const AgentHostCopilotSdkLogLevelSettingId = 'chat.agentHost.copilotSdk.logLevel';

export const AgentHostOpus48PromptEnabledSettingId = 'chat.agentHost.opus48Prompt.enabled';

export const AgentHostToolSearchEnabledSettingId = 'chat.agentHost.copilot.toolSearch.enabled';

export const AgentHostToolSearchDeferThresholdSettingId = 'chat.agentHost.copilot.toolSearch.deferThreshold';

export const AgentHostReasoningEffortOverrideSettingId = 'chat.agentHost.reasoningEffortOverride';

export const AgentHostModelCapabilityOverridesSettingId = 'chat.agentHost.modelCapabilityOverrides';

export const copilotSdkLogLevelSettingValues = ['info', 'trace'] as const;
export type CopilotSdkLogLevelSetting = typeof copilotSdkLogLevelSettingValues[number];

/** Floors valid tool-search thresholds and returns the default for invalid values. */
export function normalizeToolSearchDeferThreshold(value: number | undefined): number {
	return value !== undefined && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 1;
}

/** Per-model capability override; the agent-host equivalent of the extension's `IModelCapabilityOverride`. */
interface ICopilotCliModelCapabilityOverride {
	/** Alias the model's family for prompt/capability routing (e.g. `"claude-opus-4-8"`). */
	readonly family?: string;
}

/** Map of model id → capability override. */
export type CopilotCliModelCapabilityOverrides = Record<string, ICopilotCliModelCapabilityOverride>;

export const copilotCliConfigSchema = createSchema({
	[CopilotCliConfigKey.EnableCustomTerminalTool]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.enableCustomTerminalTool.title', "使用智能体主机终端工具"),
		description: localize('agentHost.config.enableCustomTerminalTool.description', "启用后，Copilot SDK 会话使用智能体主机终端工具替代，而非 SDK 的默认终端行为。"),
		default: false,
	}),
	[CopilotCliConfigKey.CopilotSdkLogLevel]: schemaProperty<CopilotSdkLogLevelSetting>({
		type: 'string',
		title: localize('agentHost.config.copilotSdkLogLevel.title', "Copilot SDK Log Level"),
		description: localize('agentHost.config.copilotSdkLogLevel.description', "Controls logging from the Copilot SDK runtime. Agent host trace logging always enables trace output."),
		enum: [...copilotSdkLogLevelSettingValues],
		enumLabels: [
			localize('agentHost.config.copilotSdkLogLevel.info', "Info"),
			localize('agentHost.config.copilotSdkLogLevel.trace', "Trace"),
		],
		default: 'info',
	}),
	[CopilotCliConfigKey.RubberDuck]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.rubberDuck.title', "Rubber Duck 智能体"),
		description: localize('agentHost.config.rubberDuck.description', "启用后，编码智能体会使用 Rubber Duck 批判子智能体，通过补充模型评审代码更改。"),
		default: false,
	}),
	[CopilotCliConfigKey.Opus48Prompt]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.opus48Prompt.title', "Opus 4.8 智能体提示"),
		description: localize('agentHost.config.opus48Prompt.description', "启用此选项后，运行 Claude Opus 4.8 模型的 Copilot SDK 会话会在默认系统消息之上应用针对 Opus 4.8 调优的系统提示部分覆盖。"),
		default: false,
	}),
	[CopilotCliConfigKey.ToolSearchEnabled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.toolSearchEnabled.title', "Agent Host Tool Search"),
		description: localize('agentHost.config.toolSearchEnabled.description', "When enabled, Copilot SDK sessions defer MCP and non-core VS Code tools behind a tool-search tool so the model discovers them on demand instead of loading every tool definition up front."),
		default: true,
	}),
	[CopilotCliConfigKey.ToolSearchDeferThreshold]: schemaProperty<number>({
		type: 'number',
		title: localize('agentHost.config.toolSearchDeferThreshold.title', "Tool Search Defer Threshold"),
		description: localize('agentHost.config.toolSearchDeferThreshold.description', "Minimum number of tools before MCP and external tools are deferred behind tool search. Set to 0 to always defer external tools. Only effective when tool search is enabled."),
		default: 1,
	}),
	[CopilotCliConfigKey.ReasoningEffortOverride]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.reasoningEffortOverride.title', "Reasoning Effort Override"),
		description: localize('agentHost.config.reasoningEffortOverride.description', "Overrides the reasoning effort for Copilot SDK sessions regardless of the per-model picker value. Set it to a level the selected model supports (e.g. `low`, `medium`, `high`, `xhigh`); a value that isn't a recognized effort level is ignored and the session falls back to the picker value. Only affects Copilot SDK sessions; intended for experimentation."),
		default: '',
	}),
	[CopilotCliConfigKey.ModelCapabilityOverrides]: schemaProperty<CopilotCliModelCapabilityOverrides>({
		type: 'object',
		title: localize('agentHost.config.modelCapabilityOverrides.title', "模型功能覆盖"),
		description: localize('agentHost.config.modelCapabilityOverrides.description', "Per-model capability overrides for Copilot SDK sessions, keyed by model id (`*` matches every model; a specific entry wins field-by-field). Aliasing a model id to a known `family` routes it to that family's tuned system prompt and tool profile without changing the model id sent to the runtime; the remaining fields override reasoning effort, tool enablement, and model capability limits per model. Only affects Copilot SDK sessions; intended for experimentation."),
		additionalProperties: {
			type: 'object',
			title: localize('agentHost.config.modelCapabilityOverrides.entry.title', "功能覆盖"),
			description: localize('agentHost.config.modelCapabilityOverrides.entry.description', "单次功能覆盖。属性键为模型 ID。"),
			properties: {
				family: {
					type: 'string',
					title: localize('agentHost.config.modelCapabilityOverrides.family.title', "系列"),
					description: localize('agentHost.config.modelCapabilityOverrides.family.description', "Route the model to another family's tuned system prompt and tool profile (e.g. `claude-opus-4.8`). The model id sent to the runtime is unaffected, so the session still runs on the selected model."),
				},
			},
		},
		default: {},
	}),
});

/** Returns the configured family alias for `modelId`, or `undefined`. Malformed entries are treated as unset. */
function getModelFamilyAlias(overrides: CopilotCliModelCapabilityOverrides | undefined, modelId: string): string | undefined {
	const family = overrides?.[modelId]?.family;
	return typeof family === 'string' && family.length > 0 ? family : undefined;
}

/**
 * Substitutes a configured family alias for the model id so an aliased preview model
 * routes to a known family's prompt contributor. `model.config` picker values are
 * preserved; returns the input unchanged when no alias applies.
 */
export function applyModelFamilyAlias(model: ModelSelection | undefined, overrides: CopilotCliModelCapabilityOverrides | undefined): ModelSelection | undefined {
	if (!model) {
		return undefined;
	}
	const family = getModelFamilyAlias(overrides, model.id);
	return family ? { ...model, id: family } : model;
}
