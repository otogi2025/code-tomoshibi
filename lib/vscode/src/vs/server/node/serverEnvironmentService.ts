/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../nls.js';

import { NativeEnvironmentService } from '../../platform/environment/node/environmentService.js';
import { OPTIONS, OptionDescriptions } from '../../platform/environment/node/argv.js';
import { refineServiceDecorator } from '../../platform/instantiation/common/instantiation.js';
import { IEnvironmentService, INativeEnvironmentService } from '../../platform/environment/common/environment.js';
import { memoize } from '../../base/common/decorators.js';
import { URI } from '../../base/common/uri.js';
import { joinPath } from '../../base/common/resources.js';
import { join } from '../../base/common/path.js';
import { ProtocolConstants } from '../../base/parts/ipc/common/ipc.net.js';

export const serverOptions: OptionDescriptions<Required<ServerParsedArgs>> = {
	/* ----- code-server ----- */
	'disable-update-check': { type: 'boolean' },
	'auth': { type: 'string' },
	'disable-file-downloads': { type: 'boolean' },
	'disable-file-uploads': { type: 'boolean' },
	'disable-getting-started-override': { type: 'boolean' },
	'locale': { type: 'string' },
	'link-protection-trusted-domains': { type: 'string[]' },
	'app-name': { type: 'string' },

	/* ----- server setup ----- */

	'host': { type: 'string', cat: 'o', args: 'ip-address', description: nls.localize('host', "服务器应侦听的主机名或 IP 地址。如果未设置，则默认为 “localhost”。") },
	'port': { type: 'string', cat: 'o', args: 'port | port range', description: nls.localize('port', "服务器应侦听的端口。如果传递了 0，则会选取一个随机的空闲端口。如果传递了采用 num-num 格式的范围，则将从范围中选择(包含结束)空闲端口。") },
	'socket-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('socket-path', "服务器要侦听的套接字文件的路径。") },
	'server-base-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('server-base-path', "提供 Web UI 和代码服务器的路径。默认为 “/”。`") },
	'connection-token': { type: 'string', cat: 'o', args: 'token', deprecates: ['connectionToken'], description: nls.localize('connection-token', "必须包含在所有请求中的机密。") },
	'connection-token-file': { type: 'string', cat: 'o', args: 'path', deprecates: ['connection-secret', 'connectionTokenFile'], description: nls.localize('connection-token-file', "包含连接令牌的文件的路径。") },
	'without-connection-token': { type: 'boolean', cat: 'o', description: nls.localize('without-connection-token', "在没有连接令牌的情况下运行。仅当通过其他方式保护连接时才使用此项。") },
	'disable-websocket-compression': { type: 'boolean' },
	'print-startup-performance': { type: 'boolean' },
	'print-ip-address': { type: 'boolean' },
	'accept-server-license-terms': { type: 'boolean', cat: 'o', description: nls.localize('acceptLicenseTerms', "如果已设置，则用户接受服务器许可条款，并将在没有用户提示的情况下启用服务器。") },
	'server-data-dir': { type: 'string', cat: 'o', description: nls.localize('serverDataDir', "指定保存服务器数据的目录。") },
	'telemetry-level': { type: 'string', cat: 'o', args: 'level', description: nls.localize('telemetry-level', "设置初始遥测级别。有效级别为: “off”、 crash”、“error” 和 “all”。如果未指定，服务器将在客户端连接之前发送遥测数据，然后将使用客户端遥测设置。将此项设置为 “off” 等效于 --disable-telemetry") },

	/* ----- vs code options ---	-- */

	'user-data-dir': OPTIONS['user-data-dir'],
	'enable-smoke-test-driver': OPTIONS['enable-smoke-test-driver'],
	'disable-telemetry': OPTIONS['disable-telemetry'],
	'disable-experiments': OPTIONS['disable-experiments'],
	'disable-workspace-trust': OPTIONS['disable-workspace-trust'],
	'file-watcher-polling': { type: 'string', deprecates: ['fileWatcherPolling'] },
	'log': OPTIONS['log'],
	'logsPath': OPTIONS['logsPath'],
	'force-disable-user-env': OPTIONS['force-disable-user-env'],
	'enable-proposed-api': OPTIONS['enable-proposed-api'],

	/* ----- vs code web options ----- */

	'folder': { type: 'string', deprecationMessage: 'No longer supported. Folder needs to be provided in the browser URL or with `default-folder`.' },
	'workspace': { type: 'string', deprecationMessage: 'No longer supported. Workspace needs to be provided in the browser URL or with `default-workspace`.' },

	'default-folder': { type: 'string', description: nls.localize('default-folder', '未在浏览器 URL 中指定输入时要打开的工作区文件夹。已针对当前工作目录解析相对或绝对路径。') },
	'default-workspace': { type: 'string', description: nls.localize('default-workspace', '未在浏览器 URL 中指定输入时要打开的工作区。已针对当前工作目录解析相对或绝对路径。') },

	'enable-sync': { type: 'boolean' },
	'github-auth': { type: 'string' },
	'use-test-resolver': { type: 'boolean' },

	/* ----- extension management ----- */

	'extensions-dir': OPTIONS['extensions-dir'],
	'extensions-download-dir': OPTIONS['extensions-download-dir'],
	'builtin-extensions-dir': OPTIONS['builtin-extensions-dir'],
	'install-extension': OPTIONS['install-extension'],
	'install-builtin-extension': OPTIONS['install-builtin-extension'],
	'update-extensions': OPTIONS['update-extensions'],
	'uninstall-extension': OPTIONS['uninstall-extension'],
	'list-extensions': OPTIONS['list-extensions'],
	'locate-extension': OPTIONS['locate-extension'],

	'show-versions': OPTIONS['show-versions'],
	'category': OPTIONS['category'],
	'force': OPTIONS['force'],
	'do-not-sync': OPTIONS['do-not-sync'],
	'do-not-include-pack-dependencies': OPTIONS['do-not-include-pack-dependencies'],
	'pre-release': OPTIONS['pre-release'],
	'start-server': { type: 'boolean', cat: 'e', description: nls.localize('start-server', "安装或卸载扩展时启动服务器。将与 “install-extension”、“install-builtin-extension” 和 “uninstall-extension” 结合使用。") },


	/* ----- remote development options ----- */

	'enable-remote-auto-shutdown': { type: 'boolean' },
	'remote-auto-shutdown-without-delay': { type: 'boolean' },
	'inspect-ptyhost': { type: 'string', allowEmptyValue: true },

	'agent-host-port': { type: 'string', cat: 'o', args: 'port', description: nls.localize('agent-host-port', "The port the agent host WebSocket server should listen on.") },
	'agent-host-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('agent-host-path', "The path to a socket file for the agent host WebSocket server to listen on.") },
	'agent-host-bridge-port': { type: 'string', cat: 'o', args: 'port', description: nls.localize('agent-host-bridge-port', "Bridge renderer agent-host traffic to an already-running agent host listening on this port. Does not spawn an agent host.") },
	'agent-host-bridge-path': { type: 'string', cat: 'o', args: 'path', description: nls.localize('agent-host-bridge-path', "Bridge renderer agent-host traffic to an already-running agent host listening on this socket path. Does not spawn an agent host.") },
	'agent-host-bridge-host': { type: 'string', cat: 'o', args: 'host', description: nls.localize('agent-host-bridge-host', "Host the externally-running agent host is reachable at when used with --agent-host-bridge-port. Defaults to localhost.") },
	'agent-host-bridge-connection-token': { type: 'string', cat: 'o', args: 'token', description: nls.localize('agent-host-bridge-connection-token', "Connection token required by the externally-running agent host when used with --agent-host-bridge-port.") },

	'use-host-proxy': { type: 'boolean' },
	'without-browser-env-var': { type: 'boolean' },
	'reconnection-grace-time': { type: 'string', cat: 'o', args: 'seconds', description: nls.localize('reconnection-grace-time', "替代重新连接宽限期窗口(秒)。默认值为 10800 秒(3 小时)。") },

	/* ----- server cli ----- */

	'help': OPTIONS['help'],
	'version': OPTIONS['version'],
	'locate-shell-integration-path': OPTIONS['locate-shell-integration-path'],

	'compatibility': { type: 'string' },

	_: OPTIONS['_']
};

export interface ServerParsedArgs {
	/* ----- code-server ----- */
	'disable-update-check'?: boolean;
	'auth'?: string;
	'disable-file-downloads'?: boolean;
	'disable-file-uploads'?: boolean;
	'disable-getting-started-override'?: boolean;
	'locale'?: string;
	'link-protection-trusted-domains'?: string[];
	'app-name'?: string;

	/* ----- server setup ----- */

	host?: string;
	/**
	 * A port or a port range
	 */
	port?: string;
	'socket-path'?: string;

	/**
	 * The path under which the web UI and the code server is provided.
	 * By defaults it is '/'.`
	 */
	'server-base-path'?: string;

	/**
	 * A secret token that must be provided by the web client with all requests.
	 * Use only `[0-9A-Za-z\-]`.
	 *
	 * By default, a UUID will be generated every time the server starts up.
	 *
	 * If the server is running on a multi-user system, then consider
	 * using `--connection-token-file` which has the advantage that the token cannot
	 * be seen by other users using `ps` or similar commands.
	 */
	'connection-token'?: string;
	/**
	 * A path to a filename which will be read on startup.
	 * Consider placing this file in a folder readable only by the same user (a `chmod 0700` directory).
	 *
	 * The contents of the file will be used as the connection token. Use only `[0-9A-Z\-]` as contents in the file.
	 * The file can optionally end in a `\n` which will be ignored.
	 *
	 * This secret must be communicated to any vscode instance via the resolver or embedder API.
	 */
	'connection-token-file'?: string;

	/**
	 * Run the server without a connection token
	 */
	'without-connection-token'?: boolean;

	'disable-websocket-compression'?: boolean;

	'print-startup-performance'?: boolean;
	'print-ip-address'?: boolean;

	'accept-server-license-terms': boolean;

	'server-data-dir'?: string;

	'telemetry-level'?: string;

	'disable-workspace-trust'?: boolean;

	/* ----- vs code options ----- */

	'user-data-dir'?: string;

	'enable-smoke-test-driver'?: boolean;

	'disable-telemetry'?: boolean;
	'disable-experiments'?: boolean;
	'file-watcher-polling'?: string;

	'log'?: string[];
	'logsPath'?: string;

	'force-disable-user-env'?: boolean;
	'enable-proposed-api'?: string[];

	/* ----- vs code web options ----- */

	'default-workspace'?: string;
	'default-folder'?: string;

	/** @deprecated use default-workspace instead */
	workspace: string;
	/** @deprecated use default-folder instead */
	folder: string;


	'enable-sync'?: boolean;
	'github-auth'?: string;
	'use-test-resolver'?: boolean;

	/* ----- extension management ----- */

	'extensions-dir'?: string;
	'extensions-download-dir'?: string;
	'builtin-extensions-dir'?: string;
	'install-extension'?: string[];
	'install-builtin-extension'?: string[];
	'update-extensions'?: boolean;
	'uninstall-extension'?: string[];
	'list-extensions'?: boolean;
	'locate-extension'?: string[];
	'show-versions'?: boolean;
	'category'?: string;
	force?: boolean; // used by install-extension
	'do-not-sync'?: boolean; // used by install-extension
	'pre-release'?: boolean; // used by install-extension
	'do-not-include-pack-dependencies'?: boolean; // used by install-extension


	'start-server'?: boolean;

	/* ----- remote development options ----- */

	'enable-remote-auto-shutdown'?: boolean;
	'remote-auto-shutdown-without-delay'?: boolean;
	'inspect-ptyhost'?: string;

	'agent-host-port'?: string;
	'agent-host-path'?: string;
	'agent-host-bridge-port'?: string;
	'agent-host-bridge-path'?: string;
	'agent-host-bridge-host'?: string;
	'agent-host-bridge-connection-token'?: string;

	'use-host-proxy'?: boolean;
	'without-browser-env-var'?: boolean;
	'reconnection-grace-time'?: string;

	/* ----- server cli ----- */
	help: boolean;
	version: boolean;
	'locate-shell-integration-path'?: string;

	compatibility: string;

	_: string[];
}

export const IServerEnvironmentService = refineServiceDecorator<IEnvironmentService, IServerEnvironmentService>(IEnvironmentService);

export interface IServerEnvironmentService extends INativeEnvironmentService {
	readonly machineSettingsResource: URI;
	readonly mcpResource: URI;
	readonly args: ServerParsedArgs;
	readonly reconnectionGraceTime: number;
}

export class ServerEnvironmentService extends NativeEnvironmentService implements IServerEnvironmentService {
	@memoize
	override get userRoamingDataHome(): URI { return this.appSettingsHome; }
	@memoize
	get machineSettingsResource(): URI { return joinPath(URI.file(join(this.userDataPath, 'Machine')), 'settings.json'); }
	@memoize
	get mcpResource(): URI { return joinPath(URI.file(join(this.userDataPath, 'User')), 'mcp.json'); }
	override get args(): ServerParsedArgs { return super.args as ServerParsedArgs; }
	@memoize
	get reconnectionGraceTime(): number { return parseGraceTime(this.args['reconnection-grace-time'], ProtocolConstants.ReconnectionGraceTime); }
}

function parseGraceTime(rawValue: string | undefined, fallback: number): number {
	if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
		console.log(`[reconnection-grace-time] No CLI argument provided, using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
		return fallback;
	}
	const parsedSeconds = Number(rawValue);
	if (!isFinite(parsedSeconds) || parsedSeconds < 0) {
		console.log(`[reconnection-grace-time] Invalid value '${rawValue}', using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
		return fallback;
	}
	const millis = Math.floor(parsedSeconds * 1000);
	if (!isFinite(millis) || millis > Number.MAX_SAFE_INTEGER) {
		console.log(`[reconnection-grace-time] Value too large '${rawValue}', using default: ${fallback}ms (${Math.floor(fallback / 1000)}s)`);
		return fallback;
	}
	console.log(`[reconnection-grace-time] Parsed CLI argument: ${parsedSeconds}s -> ${millis}ms`);
	return millis;
}
