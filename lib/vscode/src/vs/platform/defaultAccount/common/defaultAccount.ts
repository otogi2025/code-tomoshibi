/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICopilotTokenInfo, IDefaultAccount, IDefaultAccountAuthenticationProvider, IPolicyData } from '../../../base/common/defaultAccount.js';
import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

/**
 * Well-known GitHub URL paths used with {@link IDefaultAccountService.resolveGitHubUrl}.
 */
export const GitHubPaths = {
	copilotSettings: 'settings/copilot/features',
	billingBudgets: 'settings/copilot/features?utm_source=vscode',
	copilotUpgrade: 'github-copilot/upgrade?utm_source=vscode',
} as const;

/**
 * Outcome of the last `/copilot_internal/managed_settings` fetch.
 * - A numeric HTTP status code indicates the server responded with that code.
 * - `'ok'`: response parsed and adapted successfully (including an empty `{}` body).
 * - `'no-url'`: no `managedSettingsUrl` configured in product.json.
 * - `'no-response'`: network error, all sessions rejected, or active rate-limit backoff.
 * - `'parse-error'`: response received but JSON parsing failed.
 * - `null`: never fetched.
 */
export type ManagedSettingsFetchStatus = number | 'ok' | 'no-url' | 'no-response' | 'parse-error' | null;

export interface IDefaultAccountProvider {
	readonly defaultAccount: IDefaultAccount | null;
	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null>;
	readonly policyData: IPolicyData | null;
	readonly onDidChangePolicyData: Event<IPolicyData | null>;
	readonly copilotTokenInfo: ICopilotTokenInfo | null;
	readonly onDidChangeCopilotTokenInfo: Event<ICopilotTokenInfo | null>;
	readonly managedSettingsFetchStatus: ManagedSettingsFetchStatus;
	/** Timestamp (ms) of the last managed-settings fetch, or `null` if never fetched. */
	readonly managedSettingsFetchedAt: number | null;
	/** The raw JSON response from the managed-settings endpoint, for diagnostics. */
	readonly managedSettingsRawResponse: unknown;
	getDefaultAccountAuthenticationProvider(): IDefaultAccountAuthenticationProvider;

	/**
	 * Resolves a GitHub URL path to a full URL, using the GitHub Enterprise
	 * base URL when the user is authenticated via a GHE provider, or
	 * `https://github.com` otherwise.
	 *
	 * @param path The path portion of the URL (e.g. `settings/copilot/features`).
	 */
	resolveGitHubUrl(path: string): string;

	refresh(options?: { forceRefresh?: boolean }): Promise<IDefaultAccount | null>;
	signIn(options?: { additionalScopes?: readonly string[];[key: string]: unknown }): Promise<IDefaultAccount | null>;
	signOut(): Promise<void>;
}

export const IDefaultAccountService = createDecorator<IDefaultAccountService>('defaultAccountService');

export interface IDefaultAccountService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null>;
	readonly onDidChangePolicyData: Event<IPolicyData | null>;
	readonly policyData: IPolicyData | null;
	readonly currentDefaultAccount: IDefaultAccount | null;
	readonly copilotTokenInfo: ICopilotTokenInfo | null;
	readonly onDidChangeCopilotTokenInfo: Event<ICopilotTokenInfo | null>;
	readonly managedSettingsFetchStatus: ManagedSettingsFetchStatus;
	/** Timestamp (ms) of the last managed-settings fetch, or `null` if never fetched. */
	readonly managedSettingsFetchedAt: number | null;
	/** The raw JSON response from the managed-settings endpoint, for diagnostics. */
	readonly managedSettingsRawResponse: unknown;
	getDefaultAccount(): Promise<IDefaultAccount | null>;
	getDefaultAccountAuthenticationProvider(): IDefaultAccountAuthenticationProvider;
	setDefaultAccountProvider(provider: IDefaultAccountProvider): void;
	refresh(options?: { forceRefresh?: boolean }): Promise<IDefaultAccount | null>;
	signIn(options?: { additionalScopes?: readonly string[];[key: string]: unknown }): Promise<IDefaultAccount | null>;
	signOut(): Promise<void>;

	/**
	 * Resolves a GitHub URL path to a full URL, using the GitHub Enterprise
	 * base URL when the user is authenticated via a GHE provider, or
	 * `https://github.com` otherwise.
	 *
	 * @param path The path portion of the URL (e.g. `settings/copilot/features`).
	 */
	resolveGitHubUrl(path: string): string;
}

/**
 * Inert account service for builds that have no product account system.
 *
 * Mirrors `NullPolicyService`: consumers keep injecting the contract and simply
 * get the "signed out" answer. `getDefaultAccount()` resolves immediately — the real
 * implementation awaits a barrier that only opens once a provider registers, so a
 * faithful copy would hang every caller forever.
 */
export class NullDefaultAccountService implements IDefaultAccountService {
	declare readonly _serviceBrand: undefined;

	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null> = Event.None;
	readonly onDidChangePolicyData: Event<IPolicyData | null> = Event.None;
	readonly onDidChangeCopilotTokenInfo: Event<ICopilotTokenInfo | null> = Event.None;
	readonly policyData: IPolicyData | null = null;
	readonly currentDefaultAccount: IDefaultAccount | null = null;
	readonly copilotTokenInfo: ICopilotTokenInfo | null = null;
	readonly managedSettingsFetchStatus: ManagedSettingsFetchStatus = null;
	readonly managedSettingsFetchedAt: number | null = null;
	readonly managedSettingsRawResponse: unknown = null;

	async getDefaultAccount(): Promise<IDefaultAccount | null> {
		return null;
	}

	getDefaultAccountAuthenticationProvider(): IDefaultAccountAuthenticationProvider {
		return { id: 'default', name: 'Default', enterprise: false };
	}

	setDefaultAccountProvider(): void {
		// no-op: nothing can provide an account in this build
	}

	async refresh(): Promise<IDefaultAccount | null> {
		return null;
	}

	async signIn(): Promise<IDefaultAccount | null> {
		return null;
	}

	async signOut(): Promise<void> {
		// no-op
	}

	resolveGitHubUrl(path: string): string {
		return `https://github.com/${path}`;
	}
}
