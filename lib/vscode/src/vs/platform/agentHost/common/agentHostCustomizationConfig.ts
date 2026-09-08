/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../nls.js';
import { createSchema, schemaProperty } from './agentHostSchema.js';
import { CustomizationType, type Customization, type PluginCustomization } from './state/protocol/state.js';
import { customizationId } from './state/sessionState.js';

export const codexUsageSources = ['copilot', 'openai'] as const;
export type CodexUsageSource = typeof codexUsageSources[number];

/**
 * Well-known root-config keys used by the platform to configure agent-host
 * customizations.
 */
export const enum AgentHostConfigKey {
	/** Host-owned Open Plugins available to remote sessions. */
	Customizations = 'customizations',
	/**
	 * Absolute path to the shell executable for host-managed terminals.
	 * TODO: revisit magic key in config; refine into a dedicated typed channel. https://github.com/microsoft/vscode/issues/313812
	 */
	DefaultShell = 'defaultShell',
	/**
	 * When true (the default), the Claude provider routes all Anthropic
	 * `messages` traffic through the local Copilot-CAPI proxy (Copilot-routed
	 * Claude). When false, the Claude Agent SDK talks to Anthropic directly on
	 * the user's own credentials (BYO Anthropic — Phase 19).
	 */
	ClaudeUseCopilotProxy = 'claudeUseCopilotProxy',
	CodexUsageSource = 'codexUsageSource',
	/** Controls whether session-scoped file customizations come from local scan or SDK discovery. */
	SessionCustomizationDiscoveryMode = 'sessionCustomizationDiscoveryMode',
	/**
	 * Optional GitHub Enterprise base URI (e.g. `https://ghe.example.com` for a
	 * GitHub Enterprise Server, or `https://tenant.ghe.com` for GitHub Enterprise
	 * Cloud). When set, the agent host computes its GitHub protected resources and
	 * REST/GraphQL endpoints from this base instead of github.com. Normally pushed
	 * by the local VS Code client from the workbench `github-enterprise.uri`
	 * setting; remote operators set it directly in the remote
	 * `agent-host-config.json`.
	 */
	GithubEnterpriseUri = 'githubEnterpriseUri',
}

export const SESSION_CUSTOMIZATION_DISCOVERY_MODES = ['scan', 'discover'] as const;
export type SessionCustomizationDiscoveryMode = typeof SESSION_CUSTOMIZATION_DISCOVERY_MODES[number];
export const DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE: SessionCustomizationDiscoveryMode = 'scan';

/**
 * Persisted on-disk shape for a host-configured plugin. Kept stable across
 * the customization protocol refactor so existing `agent-host-config.json`
 * files keep working; entries are mapped to the new
 * {@link Customization} shape at read time by
 * {@link getAgentHostConfiguredCustomizations}.
 */
interface IPersistedCustomizationConfigEntry {
	uri: string;
	displayName: string;
	description?: string;
}

export const agentHostCustomizationConfigSchema = createSchema({
	[AgentHostConfigKey.Customizations]: schemaProperty<IPersistedCustomizationConfigEntry[]>({
		type: 'array',
		title: localize('agentHost.config.customizations.title', "插件"),
		description: localize('agentHost.config.customizations.description', "在此智能体主机上配置并可供远程会话使用的插件。"),
		default: [],
		items: {
			type: 'object',
			title: localize('agentHost.config.customizations.itemTitle', "插件"),
			properties: {
				uri: {
					type: 'string',
					title: localize('agentHost.config.customizations.uri', "插件 URI"),
				},
				displayName: {
					type: 'string',
					title: localize('agentHost.config.customizations.displayName', "名称"),
				},
				description: {
					type: 'string',
					title: localize('agentHost.config.customizations.descriptionField', "描述"),
				},
			},
			required: ['uri', 'displayName'],
		},
	}),
	[AgentHostConfigKey.DefaultShell]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.defaultShell.title', "默认 Shell"),
		description: localize('agentHost.config.defaultShell.description', "主机托管终端使用的 shell 可执行文件的绝对路径。通常由已连接的 VS Code 客户端从 `terminal.integrated.agentHostProfile.<os>` 推送(回退到 `terminal.integrated.defaultProfile.<os>`)；未设置时，智能体主机会回退到系统 shell。仅支持路径；尚不传递工作台配置文件中的 `args` 和 `env`。工作台仅为本地智能体主机推送此设置 - 远程智能体主机操作员应直接在远程机器的 `agent-host-config.json` 中设置。"),
	}),
	[AgentHostConfigKey.ClaudeUseCopilotProxy]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.claudeUseCopilotProxy.title', "Route Claude Through Copilot"),
		description: localize('agentHost.config.claudeUseCopilotProxy.description', "When enabled (the default), the Claude agent routes all requests through GitHub Copilot. When disabled, Claude talks to Anthropic directly using your own credentials (API key or Claude subscription)."),
		default: true,
	}),
	[AgentHostConfigKey.CodexUsageSource]: schemaProperty<CodexUsageSource>({
		type: 'string',
		title: localize('agentHost.config.codexUsageSource.title', "Codex Usage Source"),
		description: localize('agentHost.config.codexUsageSource.description', "Choose whether Codex usage is routed through GitHub Copilot or uses an existing Codex OpenAI login. VS Code does not provide the OpenAI sign-in flow; authenticate Codex separately before selecting OpenAI."),
		default: 'copilot',
		enum: [...codexUsageSources],
	}),
	[AgentHostConfigKey.SessionCustomizationDiscoveryMode]: schemaProperty<SessionCustomizationDiscoveryMode>({
		type: 'string',
		enum: [...SESSION_CUSTOMIZATION_DISCOVERY_MODES],
		title: localize('agentHost.config.sessionCustomizationDiscoveryMode.title', "Session Customization Discovery Mode"),
		description: localize('agentHost.config.sessionCustomizationDiscoveryMode.description', "Controls whether session-scoped customizations are populated from local file scanning or from Copilot SDK discovery."),
		default: DEFAULT_SESSION_CUSTOMIZATION_DISCOVERY_MODE,
	}),
	[AgentHostConfigKey.GithubEnterpriseUri]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.githubEnterpriseUri.title', "GitHub Enterprise URI"),
		description: localize('agentHost.config.githubEnterpriseUri.description', "GitHub Enterprise 实例的可选基 URI (例如，GitHub Enterprise Server 使用 \"https://ghe.example.com\"，GitHub Enterprise Cloud 使用 \"https://tenant.ghe.com\")。设置后，智能体主机将针对此实例(而非 github.com)进行身份验证和 GitHub API 调用。通常由已连接的 VS Code 客户端从 `github-enterprise.uri` 设置推送；远程智能体主机操作员可直接在远程 `agent-host-config.json` 中设置它。"),
	}),
});

export const defaultAgentHostCustomizationConfigValues = {
	[AgentHostConfigKey.Customizations]: [] as IPersistedCustomizationConfigEntry[],
};

/**
 * Reads the persisted (legacy-shaped) plugin entries from the agent-host
 * root config and lifts them into the new {@link Customization} container
 * shape used by the rest of the platform.
 */
export function getAgentHostConfiguredCustomizations(values: Record<string, unknown> | undefined): readonly Customization[] {
	const raw = values?.[AgentHostConfigKey.Customizations];
	const entries = agentHostCustomizationConfigSchema.validate(AgentHostConfigKey.Customizations, raw)
		? raw
		: defaultAgentHostCustomizationConfigValues[AgentHostConfigKey.Customizations];
	return entries.map(toContainerCustomization);
}

/**
 * Lifts a persisted plugin config entry into the new
 * {@link Customization} container shape.
 */
export function toContainerCustomization(entry: IPersistedCustomizationConfigEntry): PluginCustomization {
	return {
		type: CustomizationType.Plugin,
		id: customizationId(entry.uri),
		uri: entry.uri,
		name: entry.displayName,
		enabled: true,
	};
}
