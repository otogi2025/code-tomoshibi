/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, WorkbenchPhase, Extensions as WorkbenchExtensions, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { ILabelService, ResourceLabelFormatting } from '../../../../platform/label/common/label.js';
import { OperatingSystem, isWeb, OS } from '../../../../base/common/platform.js';
import { Schemas } from '../../../../base/common/network.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { ILoggerService } from '../../../../platform/log/common/log.js';
import { localize, localize2 } from '../../../../nls.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { PersistentConnection } from '../../../../platform/remote/common/remoteAgentConnection.js';
import { IDownloadService } from '../../../../platform/download/common/download.js';
import { DownloadServiceChannel } from '../../../../platform/download/common/downloadIpc.js';
import { RemoteLoggerChannelClient } from '../../../../platform/log/common/logIpc.js';
import { REMOTE_DEFAULT_IF_LOCAL_EXTENSIONS } from '../../../../platform/remote/common/remote.js';
import product from '../../../../platform/product/common/product.js';


const EXTENSION_IDENTIFIER_PATTERN = '([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$';

export class LabelContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.remoteLabel';

	constructor(
		@ILabelService private readonly labelService: ILabelService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService) {
		this.registerFormatters();
	}

	private registerFormatters(): void {
		this.remoteAgentService.getEnvironment().then(remoteEnvironment => {
			const os = remoteEnvironment?.os || OS;
			const formatting: ResourceLabelFormatting = {
				label: '${path}',
				separator: os === OperatingSystem.Windows ? '\\' : '/',
				tildify: os !== OperatingSystem.Windows,
				normalizeDriveLetter: os === OperatingSystem.Windows,
				workspaceSuffix: isWeb ? undefined : Schemas.vscodeRemote
			};
			this.labelService.registerFormatter({
				scheme: Schemas.vscodeRemote,
				formatting
			});

			if (remoteEnvironment) {
				this.labelService.registerFormatter({
					scheme: Schemas.vscodeUserData,
					formatting
				});
			}
		});
	}
}

class RemoteChannelsContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IDownloadService downloadService: IDownloadService,
		@ILoggerService loggerService: ILoggerService,
	) {
		super();
		const connection = remoteAgentService.getConnection();
		if (connection) {
			connection.registerChannel('download', new DownloadServiceChannel(downloadService));
			connection.withChannel('logger', async channel => this._register(new RemoteLoggerChannelClient(loggerService, channel)));
		}
	}
}

class RemoteInvalidWorkspaceDetector extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.remoteInvalidWorkspaceDetector';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IDialogService private readonly dialogService: IDialogService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService
	) {
		super();

		// When connected to a remote workspace, we currently cannot
		// validate that the workspace exists before actually opening
		// it. As such, we need to check on that after startup and guide
		// the user to a valid workspace.
		// (see https://github.com/microsoft/vscode/issues/133872)
		if (this.environmentService.remoteAuthority) {
			remoteAgentService.getEnvironment().then(remoteEnv => {
				if (remoteEnv) {
					// we use the presence of `remoteEnv` to figure out
					// if we got a healthy remote connection
					// (see https://github.com/microsoft/vscode/issues/135331)
					this.validateRemoteWorkspace();
				}
			});
		}
	}

	private async validateRemoteWorkspace(): Promise<void> {
		const workspace = this.contextService.getWorkspace();
		const workspaceUriToStat = workspace.configuration ?? workspace.folders.at(0)?.uri;
		if (!workspaceUriToStat) {
			return; // only when in workspace
		}

		const exists = await this.fileService.exists(workspaceUriToStat);
		if (exists) {
			return; // all good!
		}

		const res = await this.dialogService.confirm({
			type: 'warning',
			message: localize('invalidWorkspaceMessage', "工作区不存在"),
			detail: localize('invalidWorkspaceDetail', "请选择另一个工作区以打开。"),
			primaryButton: localize({ key: 'invalidWorkspacePrimary', comment: ['&& denotes a mnemonic'] }, "打开工作区(&&O)...")
		});

		if (res.confirmed) {

			// Pick Workspace
			if (workspace.configuration) {
				return this.fileDialogService.pickWorkspaceAndOpen({});
			}

			// Pick Folder
			return this.fileDialogService.pickFolderAndOpen({});
		}
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
registerWorkbenchContribution2(LabelContribution.ID, LabelContribution, WorkbenchPhase.BlockStartup);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteChannelsContribution, LifecyclePhase.Restored);
registerWorkbenchContribution2(RemoteInvalidWorkspaceDetector.ID, RemoteInvalidWorkspaceDetector, WorkbenchPhase.BlockStartup);

const enableDiagnostics = true;

if (enableDiagnostics) {
	class TriggerReconnectAction extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.triggerReconnect',
				title: localize2('triggerReconnect', '连接: 触发器重新连接'),
				category: Categories.Developer,
				f1: true,
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			PersistentConnection.debugTriggerReconnection();
		}
	}

	class PauseSocketWriting extends Action2 {
		constructor() {
			super({
				id: 'workbench.action.pauseSocketWriting',
				title: localize2('pauseSocketWriting', '连接: 暂停套接字写入'),
				category: Categories.Developer,
				f1: true,
			});
		}

		async run(accessor: ServicesAccessor): Promise<void> {
			PersistentConnection.debugPauseSocketWriting();
		}
	}

	registerAction2(TriggerReconnectAction);
	registerAction2(PauseSocketWriting);
}

const extensionKindSchema: IJSONSchema = {
	type: 'string',
	enum: [
		'ui',
		'workspace'
	],
	enumDescriptions: [
		localize('ui', "UI 扩展类型。在远程窗口中，只有在本地计算机上可用时，才会启用此类扩展。"),
		localize('workspace', "工作区扩展类型。在远程窗口中，仅在远程上可用时启用此类扩展。")
	],
};

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerConfiguration({
		id: 'remote',
		title: localize('remote', "远程"),
		type: 'object',
		properties: {
			'remote.extensionKind': {
				type: 'object',
				markdownDescription: localize('remote.extensionKind', "覆盖扩展的类型。\"ui\" 扩展在本地计算机上安装和运行，而 \"workspace\" 扩展则在远程计算机上运行。通过使用此设置重写扩展的默认类型，可指定是否应在本地或远程安装和启用该扩展。"),
				patternProperties: {
					[EXTENSION_IDENTIFIER_PATTERN]: {
						oneOf: [{ type: 'array', items: extensionKindSchema }, extensionKindSchema],
						default: ['ui'],
					},
				},
				default: {
					'pub.name': ['ui']
				}
			},
			'remote.restoreForwardedPorts': {
				type: 'boolean',
				markdownDescription: localize('remote.restoreForwardedPorts', "还原您在工作区中转发的端口。"),
				default: true
			},
			'remote.autoForwardPorts': {
				type: 'boolean',
				markdownDescription: localize('remote.autoForwardPorts', "启用后，将检测到新的正在运行的进程，并自动转发其侦听的端口。禁用此设置将不会阻止转发所有端口。即使禁用，扩展将仍然能够导致端口被转发，并且打开某些 URL 仍将导致端口被转发。另请参阅 {0}。", '`#remote.autoForwardPortsSource#`'),
				default: true
			},
			'remote.autoForwardPortsSource': {
				type: 'string',
				markdownDescription: localize('remote.autoForwardPortsSource', "设置当 {0} 为 true 时自动从其转发端口的源。当 {0} 为 false 时，{1} 将用于查找有关已转发的端口的信息。在 Windows 和 Mac 远程设备上，“process”和“hybrid”选项不起作用，系统将使用“output”。", '`#remote.autoForwardPorts#`', '`#remote.autoForwardPortsSource#`'),
				enum: ['process', 'output', 'hybrid'],
				enumDescriptions: [
					localize('remote.autoForwardPortsSource.process', "通过监视包含端口的已启动进程发现端口时，将自动转发该端口。"),
					localize('remote.autoForwardPortsSource.output', "通过读取终端和调试输出发现端口时，将自动转发该端口。并非所有使用端口的进程都将打印到集成终端或调试控制台，因此某些端口将丢失。根据输出转发的端口将不会被“取消转发”，除非重载或用户在“端口”视图中关闭该端口。"),
					localize('remote.autoForwardPortsSource.hybrid', "通过读取终端和调试输出发现端口时，端口将自动转发。并非所有使用端口的进程都将打印到集成终端或调试控制台，因此某些端口将丢失。通过监视侦听该端口的进程以终止，端口将为“未转发”。")
				],
				default: 'process'
			},
			'remote.autoForwardPortsFallback': {
				type: 'number',
				default: 20,
				markdownDescription: localize('remote.autoForwardPortFallback', "自动转发端口且 `remote.autoForwardPortsSource` 默认设置为 `process` 时将触发从 `process` 切换到 `hybrid` 的自动转发端口数。设置为 `0` 可禁用回退。如果尚未配置 `remote.autoForwardPortsFallback`，但配置了 `remote.autoForwardPortsSource`，`remote.autoForwardPortsFallback` 将被视为如同设置为 `0`。")
			},
			'remote.forwardOnOpen': {
				type: 'boolean',
				description: localize('remote.forwardOnClick', "控制从终端和调试控制台打开具有端口的本地 URL 时是否转发它。"),
				default: true
			},
			// Consider making changes to extensions\configuration-editing\schemas\devContainer.schema.src.json
			// and extensions\configuration-editing\schemas\attachContainer.schema.json
			// to keep in sync with devcontainer.json schema.
			'remote.portsAttributes': {
				type: 'object',
				patternProperties: {
					'(^\\d+(-\\d+)?$)|(.+)': {
						type: 'object',
						description: localize('remote.portsAttributes.port', "端口、端口范围(例如 \"40000-55000\")、主机和端口(例如 \"db:1234\")或正则表达式(例如 \".+\\\\/server.js\")。对于端口号或端口范围，属性将应用于该端口号或端口号范围。使用正则表达式的属性将应用于其关联流程命令行与表达式匹配的端口。"),
						properties: {
							'onAutoForward': {
								type: 'string',
								enum: ['notify', 'openBrowser', 'openBrowserOnce', 'openPreview', 'silent', 'ignore'],
								enumDescriptions: [
									localize('remote.portsAttributes.notify', "在自动转发端口时显示通知。"),
									localize('remote.portsAttributes.openBrowser', "在自动转发端口时打开浏览器。根据你的设置，可能会打开嵌入式浏览器。"),
									localize('remote.portsAttributes.openBrowserOnce', "自动转发端口时打开浏览器，但仅在会话期间第一次转发端口时打开。这可能会打开嵌入式浏览器，具体取决于你的设置。"),
									localize('remote.portsAttributes.openPreview', "自动转发端口时，在同一窗口中打开预览。"),
									localize('remote.portsAttributes.silent', "在自动转发此端口时，不显示任何通知，也不执行任何操作。"),
									localize('remote.portsAttributes.ignore', "此端口不会自动转发。")
								],
								description: localize('remote.portsAttributes.onForward', "定义在为自动转发发现端口时发生的操作"),
								default: 'notify'
							},
							'elevateIfNeeded': {
								type: 'boolean',
								description: localize('remote.portsAttributes.elevateIfNeeded', "在转发此端口时，自动提示提升(如果需要)。如果本地端口是特权端口，则需要提升。"),
								default: false
							},
							'label': {
								type: 'string',
								description: localize('remote.portsAttributes.label', "将在此端口的 UI 中显示的标签。"),
								default: localize('remote.portsAttributes.labelDefault', "应用程序")
							},
							'requireLocalPort': {
								type: 'boolean',
								markdownDescription: localize('remote.portsAttributes.requireLocalPort', "如果为 true，则将显示一个模式对话框，指示所选的本地端口是否不用于转发。"),
								default: false
							},
							'protocol': {
								type: 'string',
								enum: ['http', 'https'],
								description: localize('remote.portsAttributes.protocol', "转发此端口时要使用的协议。")
							}
						},
						default: {
							'label': localize('remote.portsAttributes.labelDefault', "应用程序"),
							'onAutoForward': 'notify'
						}
					}
				},
				markdownDescription: localize('remote.portsAttributes', "设置在转发特定端口号时应用的属性。例如:\r\n\r\n```\r\n\"3000\": {\r\n  \"label\": \"Application\"\r\n},\r\n\"40000-55000\": {\r\n  \"onAutoForward\": \"ignore\"\r\n},\r\n\".+\\\\/server.js\": {\r\n \"onAutoForward\": \"openPreview\"\r\n}\r\n```"),
				defaultSnippets: [{ body: { '${1:3000}': { label: '${2:Application}', onAutoForward: 'openPreview' } } }],
				errorMessage: localize('remote.portsAttributes.patternError', "必须是一个端口号、端口号范围或正则表达式。"),
				additionalProperties: false,
				default: {
					'443': {
						'protocol': 'https'
					},
					'8443': {
						'protocol': 'https'
					}
				}
			},
			'remote.otherPortsAttributes': {
				type: 'object',
				properties: {
					'onAutoForward': {
						type: 'string',
						enum: ['notify', 'openBrowser', 'openPreview', 'silent', 'ignore'],
						enumDescriptions: [
							localize('remote.portsAttributes.notify', "在自动转发端口时显示通知。"),
							localize('remote.portsAttributes.openBrowser', "在自动转发端口时打开浏览器。根据你的设置，可能会打开嵌入式浏览器。"),
							localize('remote.portsAttributes.openPreview', "自动转发端口时，在同一窗口中打开预览。"),
							localize('remote.portsAttributes.silent', "在自动转发此端口时，不显示任何通知，也不执行任何操作。"),
							localize('remote.portsAttributes.ignore', "此端口不会自动转发。")
						],
						description: localize('remote.portsAttributes.onForward', "定义在为自动转发发现端口时发生的操作"),
						default: 'notify'
					},
					'elevateIfNeeded': {
						type: 'boolean',
						description: localize('remote.portsAttributes.elevateIfNeeded', "在转发此端口时，自动提示提升(如果需要)。如果本地端口是特权端口，则需要提升。"),
						default: false
					},
					'label': {
						type: 'string',
						description: localize('remote.portsAttributes.label', "将在此端口的 UI 中显示的标签。"),
						default: localize('remote.portsAttributes.labelDefault', "应用程序")
					},
					'requireLocalPort': {
						type: 'boolean',
						markdownDescription: localize('remote.portsAttributes.requireLocalPort', "如果为 true，则将显示一个模式对话框，指示所选的本地端口是否不用于转发。"),
						default: false
					},
					'protocol': {
						type: 'string',
						enum: ['http', 'https'],
						description: localize('remote.portsAttributes.protocol', "转发此端口时要使用的协议。")
					}
				},
				defaultSnippets: [{ body: { onAutoForward: 'ignore' } }],
				markdownDescription: localize('remote.portsAttributes.defaults', "对于未从设置 {0} 中获得属性的所有端口，设置其上应用的默认属性。例如: \r\n\r\n```\r\n{\r\n  \"onAutoForward\": \"ignore\"\r\n}\r\n```", '`#remote.portsAttributes#`'),
				additionalProperties: false
			},
			'remote.localPortHost': {
				type: 'string',
				enum: ['localhost', 'allInterfaces'],
				default: 'localhost',
				description: localize('remote.localPortHost', "指定将用于端口转发的本地主机名。")
			},
			[REMOTE_DEFAULT_IF_LOCAL_EXTENSIONS]: {
				type: 'array',
				markdownDescription: localize('remote.defaultExtensionsIfInstalledLocally.markdownDescription', '连接到远程时要安装的扩展列表(已在本地安装)。'),
				default: product?.remoteDefaultExtensionsIfInstalledLocally || [],
				items: {
					type: 'string',
					pattern: EXTENSION_IDENTIFIER_PATTERN,
					patternErrorMessage: localize('remote.defaultExtensionsIfInstalledLocally.invalidFormat', '扩展标识符的格式必须为 “publisher.name”。')
				},
			}
		}
	});
