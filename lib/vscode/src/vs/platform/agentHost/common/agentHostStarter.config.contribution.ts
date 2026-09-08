/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../nls.js';
import { IPolicyData } from '../../../base/common/defaultAccount.js';
import { PolicyCategory } from '../../../base/common/policy.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { COPILOT_OTEL_CAPTURE_CONTENT_KEY, COPILOT_OTEL_ENABLED_KEY, COPILOT_OTEL_ENDPOINT_KEY, COPILOT_OTEL_HEADERS_KEY, COPILOT_OTEL_LOCK_CAPTURE_CONTENT_KEY, COPILOT_OTEL_PROTOCOL_KEY, COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY, COPILOT_OTEL_SERVICE_NAME_KEY, managedSettingValue } from '../../policy/common/copilotManagedSettings.js';
import product from '../../product/common/product.js';
import { Registry } from '../../registry/common/platform.js';
import {
	AgentHostByokModelsEnabledSettingId,
	AgentHostClaudeAgentEnabledSettingId,
	AgentHostClaudeMultiRootEnabledSettingId,
	AgentHostCodexAgentBinaryArgsSettingId,
	AgentHostCodexAgentEnabledSettingId,
	AgentHostCodexMultiRootEnabledSettingId,
	AgentHostCodexAgentSdkRootSettingId,
	AgentHostCodexAgentCodexHomeSettingId,
	AgentHostCopilotMultiRootEnabledSettingId,
	AgentHostOTelCaptureContentSettingId,
	AgentHostOTelDbSpanExporterEnabledSettingId,
	AgentHostOTelEnabledSettingId,
	AgentHostOTelExporterTypeSettingId,
	AgentHostOTelOtlpEndpointSettingId,
	AgentHostOTelOtlpProtocolSettingId,
	AgentHostOTelOutfileSettingId,
	AgentHostOTelResourceAttributesSettingId,
	AgentHostOTelServiceNameSettingId,
	AgentHostSystemProxyEnabledSettingId,
} from './agentService.js';

// Settings consumed by the agent host starter (`electronAgentHostStarter.ts`
// and `nodeAgentHostStarter.ts`) to populate the spawned agent host process's
// environment. The starter exists in both the desktop main process and the
// remote server process, so this registration has to be visible to both —
// each starter file side-effect-imports this contribution, which causes the
// registration to run as soon as the starter module is loaded. The renderer
// also imports this so the same defaults show up in the settings UI.
//
// Side-effect imports of this file:
//   - `src/vs/platform/agentHost/electron-main/electronAgentHostStarter.ts`
//     (main process, loaded transitively from `app.ts`).
//   - `src/vs/platform/agentHost/node/nodeAgentHostStarter.ts`
//     (remote server, loaded transitively from `serverServices.ts`).
//   - `src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts`
//     (renderer registration for the settings UI).

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

// Custom managed-settings resolvers for the enterprise OTel policies. The simple pass-through
// keys use `managedSettingValue(KEY)`; these three combine or transform the managed value:
//   - protocol: the schema's OTLP protocol string maps onto the agent-host exporter type.
//   - captureContent: explicit boolean wins; otherwise `lockCaptureContent` forces it off.
//   - outfile: when the enterprise mandates an OTLP endpoint/protocol, local file export is
//     suppressed so spans can't be diverted to disk.
function managedOTelProtocolValue(policyData: IPolicyData): string | undefined {
	const protocol = policyData.managedSettings?.[COPILOT_OTEL_PROTOCOL_KEY];
	if (protocol === 'grpc') {
		return 'otlp-grpc';
	}
	if (protocol === 'http/protobuf' || protocol === 'http/json') {
		return 'otlp-http';
	}
	return undefined;
}

function managedOTelCaptureContentValue(policyData: IPolicyData): boolean | undefined {
	const captureContent = policyData.managedSettings?.[COPILOT_OTEL_CAPTURE_CONTENT_KEY];
	if (typeof captureContent === 'boolean') {
		return captureContent;
	}
	return policyData.managedSettings?.[COPILOT_OTEL_LOCK_CAPTURE_CONTENT_KEY] === true ? false : undefined;
}

function managedOTelOutfileValue(policyData: IPolicyData): string | undefined {
	const managedSettings = policyData.managedSettings;
	if (managedSettings?.[COPILOT_OTEL_ENDPOINT_KEY] !== undefined || managedSettings?.[COPILOT_OTEL_PROTOCOL_KEY] !== undefined) {
		return '';
	}
	return undefined;
}

configurationRegistry.registerConfiguration({
	id: 'chatAgentHostStarter',
	title: nls.localize('chatAgentHostStarterConfigurationTitle', "聊天智能体主机启动程序"),
	type: 'object',
	properties: {
		[AgentHostSystemProxyEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.systemProxy.enabled', "When enabled, Copilot sessions automatically discover and use the operating system's proxy configuration when no proxy environment variable is set."),
			default: true,
			tags: ['experimental', 'advanced'],
			experiment: { mode: 'startup' },
		},
		[AgentHostCopilotMultiRootEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.copilotAgent.multiRootEnabled', "When enabled, Copilot agent-host sessions advertise support for multiple working directories, so a session created in a multi-root workspace can span every workspace folder. Experimental; newly created sessions pick up a change without restarting the agent host."),
			default: false,
			// Hidden from the Settings UI while the feature is dogfooded internally.
			// Still settable via `settings.json`; flip `default` (e.g. to
			// `product.quality !== 'stable'`) to enable it for a build channel.
			included: false,
		},
		[AgentHostClaudeMultiRootEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.claudeAgent.multiRootEnabled', "When enabled, Claude agent-host sessions advertise support for multiple working directories, so a session created in a multi-root workspace can span every workspace folder. Experimental; newly created sessions pick up a change without restarting the agent host."),
			default: false,
			// Hidden from the Settings UI while the feature is dogfooded internally.
			// Still settable via `settings.json`; flip `default` (e.g. to
			// `product.quality !== 'stable'`) to enable it for a build channel.
			included: false,
		},
		[AgentHostCodexMultiRootEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.codexAgent.multiRootEnabled', "When enabled, Codex agent-host sessions advertise support for multiple working directories, so a session created in a multi-root workspace can span every workspace folder. Experimental; newly created sessions pick up a change without restarting the agent host."),
			default: false,
			included: false,
		},
		[AgentHostClaudeAgentEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.claudeAgent.enabled', "When enabled, the agent host registers the Claude provider, subject to the Claude SDK being reachable. The agent host process must be restarted for changes to take effect."),
			default: true,
			tags: ['experimental', 'advanced'],
			// Owns the `Claude3PIntegration` policy; gating here disables Claude across all surfaces.
			// The user-facing copilot-chat setting `github.copilot.chat.claudeAgent.enabled` attaches
			// to this policy via a `policyReference` declared in the distro `product.json`. Ownership
			// lives here (not in `product.json`) so the policy can carry a `value` callback that honors
			// the account-side editor preview-features flag.
			policy: {
				name: 'Claude3PIntegration',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.113',
				value: (policyData) => policyData.chat_preview_features_enabled === false ? false : undefined,
				localization: {
					description: {
						key: 'chat.agentHost.claudeAgent.enabled.policy',
						value: nls.localize('chat.agentHost.claudeAgent.enabled.policy', "在 VS Code 中启用 Claude Agent 会话。直接在编辑器中启动和恢复由 Anthropic Claude Agent SDK 提供支持的智能体编码会话。使用你现有的 Copilot 订阅。"),
					}
				}
			},
		},
		[AgentHostByokModelsEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.byokModels.enabled', "When enabled, extension-provided BYOK ('bring your own key') models can run in agent-host sessions. Changes are synchronized to the running agent host and do not require a restart."),
			default: false,
			tags: ['experimental', 'advanced'],
			experiment: { mode: 'startup' },
		},
		[AgentHostCodexAgentEnabledSettingId]: {
			type: 'boolean',
			description: nls.localize('chat.agentHost.codexAgent.enabled', "When enabled, the agent host registers the Codex provider (subject to the Codex SDK being reachable). Enabling takes effect without restarting the agent host."),
			default: false,
			tags: ['experimental', 'advanced'],
			// Allow the default to be overridden by an experiment. Uses `startup`
			// (matching the sibling agent-host settings) since the agent host
			// process must be restarted for a change to take effect anyway.
			experiment: { mode: 'startup' },
			// Owns the `Codex3PIntegration` policy; gating here disables Codex across all agent-host surfaces.
			policy: {
				name: 'Codex3PIntegration',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.126',
				value: (policyData) => policyData.chat_preview_features_enabled === false ? false : undefined,
				localization: {
					description: {
						key: 'chat.agentHost.codexAgent.enabled.policy',
						value: nls.localize('chat.agentHost.codexAgent.enabled.policy', "Enable Codex Agent sessions in VS Code. Start and resume agentic coding sessions powered by OpenAI Codex. Usage can be routed through GitHub Copilot or authenticated directly with an OpenAI account."),
					}
				}
			},
		},
		[AgentHostCodexAgentSdkRootSettingId]: {
			type: 'string',
			description: nls.localize('chat.agentHost.codexAgent.sdkRoot', "Experimental, for local SDK development only. Absolute path to a directory containing `node_modules/@openai/codex`. When set, the agent host spawns the Codex binary from this tree instead of downloading the SDK. Empty (the default) falls through to the SDK distribution shipped with this build. The agent host process must be restarted for changes to take effect."),
			default: '',
			tags: ['experimental', 'advanced'],
			included: product.quality !== 'stable',
		},
		[AgentHostCodexAgentCodexHomeSettingId]: {
			type: 'string',
			description: nls.localize('chat.agentHost.codexAgent.codexHome', "`$CODEX_HOME` 的可选替代。控制 codex 二进制文件读取配置和写入回滚的位置。为空时，codex 使用默认值(`~/.codex`)。"),
			default: '',
			tags: ['experimental', 'advanced'],
			included: product.quality !== 'stable',
		},
		[AgentHostCodexAgentBinaryArgsSettingId]: {
			type: 'array',
			items: { type: 'string' },
			description: nls.localize('chat.agentHost.codexAgent.binaryArgs', "传递给 `codex app-server` 的其他命令行参数。主要用于调试(例如，`--log-level=debug`)。"),
			default: [],
			tags: ['experimental', 'advanced'],
			included: product.quality !== 'stable',
		},
		[AgentHostOTelEnabledSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.otel.enabled', "When enabled, the agent host emits OpenTelemetry traces from the Copilot SDK. Configurable in user settings only. Either configure `#chat.agentHost.otel.otlpEndpoint#` to ship traces to an external collector or enable `#chat.agentHost.otel.dbSpanExporter.enabled#` to capture them locally."),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelEnabled`; the copilot-chat setting `github.copilot.chat.otel.enabled`
			// attaches to it via a `policyReference` in the extension's package.json.
			policy: {
				name: 'CopilotOtelEnabled',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_ENABLED_KEY),
				managedSettings: {
					[COPILOT_OTEL_ENABLED_KEY]: { type: 'boolean' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.enabled.policy',
						value: nls.localize('chat.agentHost.otel.enabled.policy', "控制是否启用 Copilot OpenTelemetry 导出。托管后，用户无法替代企业值。"),
					}
				},
			},
		},
		[AgentHostOTelExporterTypeSettingId]: {
			type: 'string',
			enum: ['otlp-http', 'otlp-grpc', 'console', 'file'],
			markdownDescription: nls.localize('chat.agentHost.otel.exporterType', "开启 `#chat.agentHost.otel.enabled#` 时，Copilot SDK 使用的导出程序后端。仅可在用户设置中配置。`otlp-grpc` 会在 CLI 运行时以透明方式降级为 `otlp-http`。"),
			default: 'otlp-http',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelProtocol`; the managed `telemetry.protocol` string is mapped onto
			// the exporter type (`grpc` -> `otlp-grpc`, `http/*` -> `otlp-http`).
			policy: {
				name: 'CopilotOtelProtocol',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedOTelProtocolValue,
				managedSettings: {
					[COPILOT_OTEL_PROTOCOL_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.protocol.policy',
						value: nls.localize('chat.agentHost.otel.protocol.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 协议。"),
					},
					enumDescriptions: [
						{ key: 'chat.agentHost.otel.protocol.policy.otlpHttp', value: nls.localize('chat.agentHost.otel.protocol.policy.otlpHttp', "使用 OTLP over HTTP。"), },
						{ key: 'chat.agentHost.otel.protocol.policy.otlpGrpc', value: nls.localize('chat.agentHost.otel.protocol.policy.otlpGrpc', "使用 OTLP over gRPC。"), },
						{ key: 'chat.agentHost.otel.protocol.policy.console', value: nls.localize('chat.agentHost.otel.protocol.policy.console', "企业管理的设置未选择控制台导出程序。"), },
						{ key: 'chat.agentHost.otel.protocol.policy.file', value: nls.localize('chat.agentHost.otel.protocol.policy.file', "企业管理的设置未选择文件导出程序。"), },
					],
				},
			},
		},
		[AgentHostOTelOtlpProtocolSettingId]: {
			type: 'string',
			markdownDescription: nls.localize('chat.agentHost.otel.otlpProtocol', "用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 有线协议(`http/json`、`http/protobuf` 或 `grpc`)。仅策略: 没有面向用户的设置；它会传递托管 `telemetry.protocol`，因此智能体主机的 `OTEL_EXPORTER_OTLP_PROTOCOL` 可以区分 protobuf 和 json。"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			// Policy-only delivery slot — no user-writable surface (mirrors `chat.plugins.extraMarketplaces`).
			included: false,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelOtlpProtocol`; passes the raw managed `telemetry.protocol` through so the
			// starters can set `OTEL_EXPORTER_OTLP_PROTOCOL` (the `exporterType` policy only carries transport).
			policy: {
				name: 'CopilotOtelOtlpProtocol',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_PROTOCOL_KEY),
				managedSettings: {
					[COPILOT_OTEL_PROTOCOL_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.otlpProtocol.policy',
						value: nls.localize('chat.agentHost.otel.otlpProtocol.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 有线协议(protobuf 与 JSON)。"),
					}
				},
			},
		},
		[AgentHostOTelOtlpEndpointSettingId]: {
			type: 'string',
			markdownDescription: nls.localize('chat.agentHost.otel.otlpEndpoint', "导出程序类型为 `otlp-http` 或 `otlp-grpc` 时的 OTLP 终结点 URL。仅可在用户设置中配置。在智能体主机进程内设置 `OTEL_EXPORTER_OTLP_ENDPOINT`。"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelEndpoint`.
			policy: {
				name: 'CopilotOtelEndpoint',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_ENDPOINT_KEY),
				managedSettings: {
					[COPILOT_OTEL_ENDPOINT_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.otlpEndpoint.policy',
						value: nls.localize('chat.agentHost.otel.otlpEndpoint.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 收集器终结点。"),
					}
				},
			},
		},
		[AgentHostOTelCaptureContentSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.otel.captureContent', "启用后，将提示和响应内容包含在 OTel 跨度属性中。仅可在用户设置中配置。设置 `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`。隐私敏感: 请勿在将跨度发送到共享接收器的环境中启用。"),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelCaptureContent`; explicit managed value wins, otherwise
			// `telemetry.lockCaptureContent` forces capture off.
			policy: {
				name: 'CopilotOtelCaptureContent',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedOTelCaptureContentValue,
				managedSettings: {
					[COPILOT_OTEL_CAPTURE_CONTENT_KEY]: { type: 'boolean' },
					[COPILOT_OTEL_LOCK_CAPTURE_CONTENT_KEY]: { type: 'boolean' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.captureContent.policy',
						value: nls.localize('chat.agentHost.otel.captureContent.policy', "控制 Copilot OpenTelemetry 导出是否捕获提示、响应和工具内容。"),
					}
				},
			},
		},
		[AgentHostOTelOutfileSettingId]: {
			type: 'string',
			markdownDescription: nls.localize('chat.agentHost.otel.outfile', "导出程序类型为 `file` 时跨度 JSON 行的输出路径。仅可在用户设置中配置。设置 `COPILOT_OTEL_FILE_EXPORTER_PATH`。"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelOutfile`; suppresses local file export when the enterprise mandates an OTLP sink.
			policy: {
				name: 'CopilotOtelOutfile',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedOTelOutfileValue,
				managedSettings: {
					[COPILOT_OTEL_ENDPOINT_KEY]: { type: 'string' },
					[COPILOT_OTEL_PROTOCOL_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.outfile.policy',
						value: nls.localize('chat.agentHost.otel.outfile.policy', "配置企业管理的 Copilot OpenTelemetry 导出时，阻止本地文件导出。"),
					}
				},
			},
		},
		[AgentHostOTelDbSpanExporterEnabledSettingId]: {
			type: 'boolean',
			markdownDescription: nls.localize('chat.agentHost.otel.dbSpanExporter.enabled', "启用后，智能体主机将每个发出的 OTel 跨度持久化到本地 SQLite 数据库。仅可在用户设置中配置。可通过 `Export Agent Host Traces Database` 命令查看跨度。与外部导出器兼容: 跨度写入 SQLite *并*转发到用户配置的接收器。"),
			default: false,
			scope: ConfigurationScope.APPLICATION,
			tags: ['experimental', 'advanced'],
		},
		[AgentHostOTelServiceNameSettingId]: {
			type: 'string',
			markdownDescription: nls.localize('chat.agentHost.otel.serviceName', "用于 Copilot OpenTelemetry 导出的企业管理的 OTel `service.name` 资源属性。仅策略: 没有面向用户的设置；它会传递托管 `telemetry.serviceName`，因此智能体主机的 `OTEL_SERVICE_NAME` 可识别来自此部署的跨度。"),
			default: '',
			scope: ConfigurationScope.APPLICATION,
			// Policy-only delivery slot — no user-writable surface (mirrors `chat.agentHost.otel.otlpProtocol`).
			included: false,
			tags: ['experimental', 'advanced'],
			// Owns `CopilotOtelServiceName`; passes the raw managed `telemetry.serviceName` through so the
			// starters can set `OTEL_SERVICE_NAME` on the agent host process.
			policy: {
				name: 'CopilotOtelServiceName',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_SERVICE_NAME_KEY),
				managedSettings: {
					[COPILOT_OTEL_SERVICE_NAME_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.serviceName.policy',
						value: nls.localize('chat.agentHost.otel.serviceName.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTel `service.name` 资源属性。"),
					}
				},
			},
		},
		[AgentHostOTelResourceAttributesSettingId]: {
			// Policy-only delivery slot — no user-writable surface (mirrors `chat.plugins.extraMarketplaces`).
			// Carried as a `{ [key]: string }` object; the starters serialize it into `OTEL_RESOURCE_ATTRIBUTES`.
			type: 'object',
			additionalProperties: { type: ['string'] as ['string'] },
			default: {},
			scope: ConfigurationScope.APPLICATION,
			included: false,
			tags: ['experimental', 'advanced'],
			markdownDescription: nls.localize('chat.agentHost.otel.resourceAttributes', "用于 Copilot OpenTelemetry 导出的企业管理的 OTel 资源属性。仅策略: 没有面向用户的设置；它会传递托管 `telemetry.resourceAttributes` 映射，因此智能体主机的 `OTEL_RESOURCE_ATTRIBUTES` 包含部署的属性。"),
			policy: {
				name: 'CopilotOtelResourceAttributes',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY),
				managedSettings: {
					[COPILOT_OTEL_RESOURCE_ATTRIBUTES_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.resourceAttributes.policy',
						value: nls.localize('chat.agentHost.otel.resourceAttributes.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTel 资源属性。"),
					}
				},
			},
		},
		// Extension-only policy delivery slot for managed OTLP exporter headers (e.g. auth tokens).
		// Deliberately NOT delivered to the agent host: headers would have to travel via env vars,
		// which the agent host leaks into the tool subprocesses it spawns, exposing the secret. The
		// Copilot Chat extension applies these headers directly to its OTLP exporter instead.
		['chat.agentHost.otel.headers']: {
			type: 'object',
			additionalProperties: { type: ['string'] as ['string'] },
			default: {},
			scope: ConfigurationScope.APPLICATION,
			included: false,
			tags: ['experimental', 'advanced'],
			markdownDescription: nls.localize('chat.agentHost.otel.headers', "用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 导出程序标头(例如身份验证令牌)。仅策略且仅扩展: 直接应用于 Copilot 对话助手扩展的 OTLP 导出程序，从不传递到智能体主机进程。"),
			policy: {
				name: 'CopilotOtelHeaders',
				category: PolicyCategory.InteractiveSession,
				minimumVersion: '1.127',
				value: managedSettingValue(COPILOT_OTEL_HEADERS_KEY),
				managedSettings: {
					[COPILOT_OTEL_HEADERS_KEY]: { type: 'string' },
				},
				localization: {
					description: {
						key: 'chat.agentHost.otel.headers.policy',
						value: nls.localize('chat.agentHost.otel.headers.policy', "控制用于 Copilot OpenTelemetry 导出的企业管理的 OTLP 导出程序标头。"),
					}
				},
			},
		},
	}
});
