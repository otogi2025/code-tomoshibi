/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../nls.js';
import { AgentNetworkDomainSettingId } from '../../networkFilter/common/settings.js';
import { AgentSandboxEnabledValue, AgentSandboxSettingId } from '../../sandbox/common/settings.js';
import { createSchema, schemaProperty } from './agentHostSchema.js';

/**
 * Top-level keys the agent host's root config bag exposes for sandboxing.
 * All sandbox-related values live nested under {@link AgentHostSandboxConfigKey.Sandbox}
 * — the persisted JSON has a single `"sandbox": { ... }` object rather than a
 * dozen flat keys.
 */
export const enum AgentHostSandboxConfigKey {
	Sandbox = 'sandbox',
}

/**
 * Well-known sub-keys inside the agent host's `sandbox` object. These are
 * intentionally a flat, prefix-free namespace owned by the agent host —
 * distinct from the workbench's `chat.agent.sandbox.*` setting IDs. Hosts
 * (today: the workbench client) translate from their setting IDs to these
 * keys when forwarding values via a `RootConfigChanged` action.
 */
export const enum AgentHostSandboxKey {
	Enabled = 'enabled',
	WindowsEnabled = 'enabled.windows',
	AllowNetwork = 'allowNetwork',
	AllowUnsandboxedCommands = 'allowUnsandboxedCommands',
	LinuxFileSystem = 'fileSystem.linux',
	MacFileSystem = 'fileSystem.mac',
	WindowsFileSystem = 'fileSystem.windows',
	AdvancedRuntime = 'advanced.runtime',
	AllowedNetworkDomains = 'allowedNetworkDomains',
	DeniedNetworkDomains = 'deniedNetworkDomains',
}

/** Shape of the persisted/forwarded `sandbox` object. */
export type ISandboxConfigValue = Partial<{
	[AgentHostSandboxKey.Enabled]: AgentSandboxEnabledValue;
	[AgentHostSandboxKey.WindowsEnabled]: AgentSandboxEnabledValue;
	[AgentHostSandboxKey.AllowNetwork]: boolean;
	[AgentHostSandboxKey.AllowUnsandboxedCommands]: boolean;
	[AgentHostSandboxKey.LinuxFileSystem]: Record<string, unknown>;
	[AgentHostSandboxKey.MacFileSystem]: Record<string, unknown>;
	[AgentHostSandboxKey.WindowsFileSystem]: Record<string, unknown>;
	[AgentHostSandboxKey.AdvancedRuntime]: Record<string, unknown>;
	[AgentHostSandboxKey.AllowedNetworkDomains]: string[];
	[AgentHostSandboxKey.DeniedNetworkDomains]: string[];
}>;

/**
 * Schema for the subset of workbench sandbox settings that hosts (today: the
 * workbench client) may forward into the agent host's root config bag.
 *
 * The agent host's terminal sandbox engine reads these values through
 * {@link IAgentConfigurationService.getRootValue}. Only the modern,
 * normalized form of each setting is declared here — the workbench is
 * expected to:
 *
 *  - map legacy boolean sandbox enabled values to the `'on' | 'off' | 'allowNetwork'`
 *    agent-host enum, and
 *  - migrate values from any deprecated setting IDs to their modern key
 *
 * before pushing a `RootConfigChanged` action. That keeps the agent-host
 * schema (and validation) free of backward-compat baggage.
 */
export const sandboxConfigSchema = createSchema({
	[AgentHostSandboxConfigKey.Sandbox]: schemaProperty<ISandboxConfigValue>({
		type: 'object',
		title: localize('agentHost.config.sandbox.title', "智能体沙盒"),
		properties: {
			[AgentHostSandboxKey.Enabled]: {
				type: 'string',
				title: localize('agentHost.config.sandbox.enabled.title', "已启用沙盒"),
				enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On, AgentSandboxEnabledValue.AllowNetwork],
			},
			[AgentHostSandboxKey.WindowsEnabled]: {
				type: 'string',
				title: localize('agentHost.config.sandbox.windowsEnabled.title', "已启用沙盒(Windows)"),
				enum: [AgentSandboxEnabledValue.Off, AgentSandboxEnabledValue.On, AgentSandboxEnabledValue.AllowNetwork],
			},
			[AgentHostSandboxKey.AllowNetwork]: {
				type: 'boolean',
				title: localize('agentHost.config.sandbox.allowNetwork.title', "允许网络"),
			},
			[AgentHostSandboxKey.AllowUnsandboxedCommands]: {
				type: 'boolean',
				title: localize('agentHost.config.sandbox.allowUnsandboxedCommands.title', "允许未沙盒化的命令"),
			},
			[AgentHostSandboxKey.LinuxFileSystem]: {
				type: 'object',
				title: localize('agentHost.config.sandbox.linuxFileSystem.title', "Linux 沙盒文件系统"),
			},
			[AgentHostSandboxKey.MacFileSystem]: {
				type: 'object',
				title: localize('agentHost.config.sandbox.macFileSystem.title', "macOS 沙盒文件系统"),
			},
			[AgentHostSandboxKey.WindowsFileSystem]: {
				type: 'object',
				title: localize('agentHost.config.sandbox.windowsFileSystem.title', "Windows 沙盒文件系统"),
			},
			[AgentHostSandboxKey.AdvancedRuntime]: {
				type: 'object',
				title: localize('agentHost.config.sandbox.advancedRuntime.title', "高级沙盒运行时"),
			},
			[AgentHostSandboxKey.AllowedNetworkDomains]: {
				type: 'array',
				title: localize('agentHost.config.sandbox.allowedDomains.title', "允许的网络域"),
				items: { type: 'string', title: localize('agentHost.config.sandbox.allowedDomains.item.title', "域") },
			},
			[AgentHostSandboxKey.DeniedNetworkDomains]: {
				type: 'array',
				title: localize('agentHost.config.sandbox.deniedDomains.title', "已拒绝网络域"),
				items: { type: 'string', title: localize('agentHost.config.sandbox.deniedDomains.item.title', "域") },
			},
		},
	}),
});

/**
 * Maps modern workbench sandbox setting IDs (the ones the engine asks about)
 * to the sub-keys inside the agent host's `sandbox` config object.
 *
 * Deprecated setting IDs are intentionally absent: hosts forwarding values
 * into the agent host are expected to migrate deprecated → modern IDs
 * before dispatching `RootConfigChanged`.
 */
export const sandboxSettingIdToAgentHostKey: Readonly<Record<string, AgentHostSandboxKey>> = {
	[AgentSandboxSettingId.AgentSandboxEnabled]: AgentHostSandboxKey.Enabled,
	[AgentSandboxSettingId.AgentSandboxWindowsEnabled]: AgentHostSandboxKey.WindowsEnabled,
	[AgentSandboxSettingId.AgentSandboxAllowNetwork]: AgentHostSandboxKey.AllowNetwork,
	[AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands]: AgentHostSandboxKey.AllowUnsandboxedCommands,
	[AgentSandboxSettingId.AgentSandboxLinuxFileSystem]: AgentHostSandboxKey.LinuxFileSystem,
	[AgentSandboxSettingId.AgentSandboxMacFileSystem]: AgentHostSandboxKey.MacFileSystem,
	[AgentSandboxSettingId.AgentSandboxWindowsFileSystem]: AgentHostSandboxKey.WindowsFileSystem,
	[AgentSandboxSettingId.AgentSandboxAdvancedRuntime]: AgentHostSandboxKey.AdvancedRuntime,
	[AgentNetworkDomainSettingId.AllowedNetworkDomains]: AgentHostSandboxKey.AllowedNetworkDomains,
	[AgentNetworkDomainSettingId.DeniedNetworkDomains]: AgentHostSandboxKey.DeniedNetworkDomains,
};

