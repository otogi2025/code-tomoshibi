/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { streamToBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { getErrorMessage } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IHeaders, IRequestContext, IRequestOptions } from '../../../base/parts/request/common/request.js';
import { localize } from '../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
import { Registry } from '../../registry/common/platform.js';

export const IRequestService = createDecorator<IRequestService>('requestService');

/**
 * Use as the {@link IRequestOptions.callSite} value to prevent
 * request telemetry from being emitted. This is needed for
 * callers such as the telemetry sender to avoid cyclical calls.
 */
export const NO_FETCH_TELEMETRY = 'NO_FETCH_TELEMETRY';

export interface IRequestCompleteEvent {
	readonly callSite: string;
	readonly latency: number;
	readonly statusCode: number | undefined;
}

export interface AuthInfo {
	isProxy: boolean;
	scheme: string;
	host: string;
	port: number;
	realm: string;
	attempt: number;
}

export interface Credentials {
	username: string;
	password: string;
}

export interface IRequestService {
	readonly _serviceBrand: undefined;

	/**
	 * Fires when a request completes (successfully or with an error response).
	 */
	readonly onDidCompleteRequest: Event<IRequestCompleteEvent>;

	request(options: IRequestOptions, token: CancellationToken): Promise<IRequestContext>;

	resolveProxy(url: string): Promise<string | undefined>;
	lookupAuthorization(authInfo: AuthInfo): Promise<Credentials | undefined>;
	lookupKerberosAuthorization(url: string): Promise<string | undefined>;
	loadCertificates(): Promise<string[]>;
}

class LoggableHeaders {

	private headers: IHeaders | undefined;

	constructor(private readonly original: IHeaders) { }

	toJSON(): any {
		if (!this.headers) {
			const headers = Object.create(null);
			for (const key in this.original) {
				if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'proxy-authorization') {
					headers[key] = '*****';
				} else {
					headers[key] = this.original[key];
				}
			}
			this.headers = headers;
		}
		return this.headers;
	}

}

export abstract class AbstractRequestService extends Disposable implements IRequestService {

	declare readonly _serviceBrand: undefined;

	private counter = 0;

	private readonly _onDidCompleteRequest = this._register(new Emitter<IRequestCompleteEvent>());
	readonly onDidCompleteRequest = this._onDidCompleteRequest.event;

	constructor(protected readonly logService: ILogService) {
		super();
	}

	protected async logAndRequest(options: IRequestOptions, request: () => Promise<IRequestContext>): Promise<IRequestContext> {
		const prefix = `#${++this.counter}: ${options.url}`;
		this.logService.trace(`${prefix} - begin`, options.type, new LoggableHeaders(options.headers ?? {}));
		const startTime = Date.now();
		try {
			const result = await request();
			this.logService.trace(`${prefix} - end`, options.type, result.res.statusCode, result.res.headers);
			this._onDidCompleteRequest.fire({
				callSite: options.callSite,
				latency: Date.now() - startTime,
				statusCode: result.res.statusCode,
			});
			return result;
		} catch (error) {
			this.logService.error(`${prefix} - error`, options.type, getErrorMessage(error));
			throw error;
		}
	}

	abstract request(options: IRequestOptions, token: CancellationToken): Promise<IRequestContext>;
	abstract resolveProxy(url: string): Promise<string | undefined>;
	abstract lookupAuthorization(authInfo: AuthInfo): Promise<Credentials | undefined>;
	abstract lookupKerberosAuthorization(url: string): Promise<string | undefined>;
	abstract loadCertificates(): Promise<string[]>;
}

export function isSuccess(context: IRequestContext): boolean {
	return (context.res.statusCode && context.res.statusCode >= 200 && context.res.statusCode < 300) || context.res.statusCode === 1223;
}

export function isClientError(context: IRequestContext): boolean {
	return !!context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500;
}

export function isServerError(context: IRequestContext): boolean {
	return !!context.res.statusCode && context.res.statusCode >= 500 && context.res.statusCode < 600;
}

/**
 * Reads a header value from an {@link IHeaders} map, tolerating array-shaped
 * values and case-insensitive lookups.
 */
export function readHeader(headers: IHeaders | undefined, name: string): string | undefined {
	if (!headers) {
		return undefined;
	}
	const value = headers[name] ?? headers[name.toLowerCase()];
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

/**
 * Parses the `Retry-After` header as a number of seconds. Returns `undefined`
 * if absent or not a finite positive number. The HTTP-date form is not parsed.
 */
export function retryAfterFromHeaders(headers: IHeaders | undefined): number | undefined {
	const value = readHeader(headers, 'retry-after');
	if (!value) {
		return undefined;
	}
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function hasNoContent(context: IRequestContext): boolean {
	return context.res.statusCode === 204;
}

export async function asText(context: IRequestContext): Promise<string | null> {
	if (hasNoContent(context)) {
		return null;
	}
	const buffer = await streamToBuffer(context.stream);
	return buffer.toString();
}

export async function asTextOrError(context: IRequestContext): Promise<string | null> {
	if (!isSuccess(context)) {
		throw new Error('Server returned ' + context.res.statusCode);
	}
	return asText(context);
}

export async function asJson<T = {}>(context: IRequestContext): Promise<T | null> {
	if (!isSuccess(context)) {
		throw new Error('Server returned ' + context.res.statusCode);
	}
	if (hasNoContent(context)) {
		return null;
	}
	const buffer = await streamToBuffer(context.stream);
	const str = buffer.toString();
	try {
		return JSON.parse(str);
	} catch (err) {
		err.message += ':\n' + str;
		throw err;
	}
}

export function updateProxyConfigurationsScope(useHostProxy: boolean, useHostProxyDefault: boolean): void {
	registerProxyConfigurations(useHostProxy, useHostProxyDefault);
}

export const USER_LOCAL_AND_REMOTE_SETTINGS = [
	'http.proxy',
	'http.proxyStrictSSL',
	'http.proxyKerberosServicePrincipal',
	'http.noProxy',
	'http.proxyAuthorization',
	'http.proxySupport',
	'http.systemCertificates',
	'http.systemCertificatesNode',
	'http.experimental.systemCertificatesV2',
	'http.fetchAdditionalSupport',
	'http.experimental.networkInterfaceCheckInterval',
];

export const systemCertificatesNodeDefault = false;

let proxyConfiguration: IConfigurationNode[] = [];
let previousUseHostProxy: boolean | undefined = undefined;
let previousUseHostProxyDefault: boolean | undefined = undefined;
function registerProxyConfigurations(useHostProxy = true, useHostProxyDefault = true): void {
	if (previousUseHostProxy === useHostProxy && previousUseHostProxyDefault === useHostProxyDefault) {
		return;
	}

	previousUseHostProxy = useHostProxy;
	previousUseHostProxyDefault = useHostProxyDefault;

	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	const oldProxyConfiguration = proxyConfiguration;
	proxyConfiguration = [
		{
			id: 'http',
			order: 15,
			title: localize('httpConfigurationTitle', "HTTP"),
			type: 'object',
			scope: ConfigurationScope.MACHINE,
			properties: {
				'http.useLocalProxyConfiguration': {
					type: 'boolean',
					default: useHostProxyDefault,
					markdownDescription: localize('useLocalProxy', "控制是否在远程扩展主机中使用本地代理配置。此设置仅在 [remote development](https://aka.ms/vscode-remote). 期间用作远程设置"),
					restricted: true
				},
			}
		},
		{
			id: 'http',
			order: 15,
			title: localize('httpConfigurationTitle', "HTTP"),
			type: 'object',
			scope: ConfigurationScope.APPLICATION,
			properties: {
				'http.electronFetch': {
					type: 'boolean',
					default: false,
					description: localize('electronFetch', "控制是否应启用对 Electron 而不是 Node.js 的 fetch 实现的使用。所有本地扩展都将获得用于全局提取 API 的 Electron 提取实现。"),
					restricted: true
				},
			}
		},
		{
			id: 'http',
			order: 15,
			title: localize('httpConfigurationTitle', "HTTP"),
			type: 'object',
			scope: useHostProxy ? ConfigurationScope.APPLICATION : ConfigurationScope.MACHINE,
			properties: {
				'http.proxy': {
					type: 'string',
					pattern: '^(https?|socks|socks4a?|socks5h?)://([^:]*(:[^@]*)?@)?([^:]+|\\[[:0-9a-fA-F]+\\])(:\\d+)?/?$|^$',
					markdownDescription: localize('proxy', "要使用的代理设置。如果未设置，则将从“http_proxy”和“https_proxy”环境变量继承。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.proxyStrictSSL': {
					type: 'boolean',
					default: true,
					markdownDescription: localize('strictSSL', "控制是否应根据提供的 CA 列表验证代理服务器证书。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.proxyKerberosServicePrincipal': {
					type: 'string',
					markdownDescription: localize('proxyKerberosServicePrincipal', "使用 HTTP 代理替代 Kerberos 身份验证的主体服务名称。未设置此项时，将使用基于代理主机名的默认值。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.noProxy': {
					type: 'array',
					items: { type: 'string' },
					markdownDescription: localize('noProxy', "指定应为其忽略 HTTP/HTTPS 请求的代理设置的域名。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.proxyAuthorization': {
					type: ['null', 'string'],
					default: null,
					markdownDescription: localize('proxyAuthorization', "要作为每个网络请求的 “Proxy-Authorization” 标头发送的值。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.proxySupport': {
					type: 'string',
					enum: ['off', 'on', 'fallback', 'override'],
					enumDescriptions: [
						localize('proxySupportOff', "禁用对扩展的代理支持。"),
						localize('proxySupportOn', "为扩展启用代理支持。"),
						localize('proxySupportFallback', "在未找到代理的情况下，启用扩展的代理支持，回退到请求选项。"),
						localize('proxySupportOverride', "为扩展启用代理支持，覆盖请求选项。"),
					],
					default: 'override',
					markdownDescription: localize('proxySupport', "对扩展使用代理支持。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.systemCertificates': {
					type: 'boolean',
					default: true,
					markdownDescription: localize('systemCertificates', "控制是否应从 OS 加载 CA 证书。在 Windows 和 macOS 上，关闭此功能后需要重新加载窗口。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.systemCertificatesNode': {
					type: 'boolean',
					tags: ['experimental'],
					default: systemCertificatesNodeDefault,
					markdownDescription: localize('systemCertificatesNode', "控制是否应使用 Node.js 内置支持加载系统证书。更改此设置后请重新加载窗口。在[远程开发](https://aka.ms/vscode-remote)期间禁用 {0} 设置时，可在本地设置和远程设置中分别配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true,
					experiment: {
						mode: 'auto'
					}
				},
				'http.experimental.systemCertificatesV2': {
					type: 'boolean',
					tags: ['experimental'],
					default: false,
					markdownDescription: localize('systemCertificatesV2', "控制是否应启用从 OS 实验性加载 CA 证书。这使用的方法比默认实现更常见。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true
				},
				'http.fetchAdditionalSupport': {
					type: 'boolean',
					default: true,
					markdownDescription: localize('fetchAdditionalSupport', "控制是否应扩展 Node.js 提取实现并提供额外支持。启用相应的设置时，当前将添加代理支持 ({1}) 和系统证书 ({2})。在 [remote development](https://aka.ms/vscode-remote) 禁用 {0} 设置时，可在本地设置和远程设置中单独配置此设置。", '`#http.useLocalProxyConfiguration#`', '`#http.proxySupport#`', '`#http.systemCertificates#`'),
					restricted: true
				},
				'http.webSocketAdditionalSupport': {
					type: 'boolean',
					default: true,
					markdownDescription: localize('webSocketAdditionalSupport', "控制是否应通过其他支持扩展内置的 WebSocket 实现。当前，当启用相应设置时，会添加代理支持({1})和系统证书({2})。在[远程开发](https://aka.ms/vscode-remote)期间禁用 {0} 设置时，可在本地设置和远程设置中分别配置此设置。", '`#http.useLocalProxyConfiguration#`', '`#http.proxySupport#`', '`#http.systemCertificates#`'),
					restricted: true
				},
				'http.experimental.networkInterfaceCheckInterval': {
					type: 'number',
					default: 300,
					minimum: -1,
					tags: ['experimental'],
					markdownDescription: localize('networkInterfaceCheckInterval', "控制检查网络接口更改以使代理缓存失效的时间间隔(秒)。设置为 -1 可禁用。在[远程开发](https://aka.ms/vscode-remote)期间禁用 {0} 设置时，可在本地设置和远程设置中分别配置此设置。", '`#http.useLocalProxyConfiguration#`'),
					restricted: true,
					experiment: {
						mode: 'auto'
					}
				}
			}
		}
	];
	configurationRegistry.updateConfigurations({ add: proxyConfiguration, remove: oldProxyConfiguration });
}

registerProxyConfigurations();
