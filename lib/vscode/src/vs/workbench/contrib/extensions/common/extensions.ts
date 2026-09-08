/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { IPager } from '../../../../base/common/paging.js';
import { IQueryOptions, ILocalExtension, IGalleryExtension, IExtensionIdentifier, IExtensionInfo, IExtensionQueryOptions, IDeprecationInfo, InstallExtensionResult, InstallOptions } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { EnablementState, IExtensionManagementServer, IResourceExtension } from '../../../services/extensionManagement/common/extensionManagement.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExtensionManifest, ExtensionType } from '../../../../platform/extensions/common/extensions.js';
import { URI } from '../../../../base/common/uri.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IExtensionsStatus as IExtensionRuntimeStatus } from '../../../services/extensions/common/extensions.js';
import { IExtensionEditorOptions } from './extensionsInput.js';
import { ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { Severity } from '../../../../platform/notification/common/notification.js';
import { IMarkdownString } from '../../../../base/common/htmlContent.js';

export const enum ExtensionState {
	Installing,
	Installed,
	Uninstalling,
	Uninstalled
}

export const enum ExtensionRuntimeActionType {
	ReloadWindow = 'reloadWindow',
	RestartExtensions = 'restartExtensions',
	DownloadUpdate = 'downloadUpdate',
	ApplyUpdate = 'applyUpdate',
	QuitAndInstall = 'quitAndInstall',
}

export type ExtensionRuntimeState = { action: ExtensionRuntimeActionType; reason: string };

export interface IExtension {
	readonly type: ExtensionType;
	readonly isBuiltin: boolean;
	readonly isWorkspaceScoped: boolean;
	readonly state: ExtensionState;
	readonly name: string;
	readonly displayName: string;
	readonly identifier: IExtensionIdentifier;
	readonly publisher: string;
	readonly publisherDisplayName: string;
	readonly publisherUrl?: URI;
	readonly publisherDomain?: { link: string; verified: boolean };
	readonly publisherSponsorLink?: URI;
	readonly pinned: boolean;
	readonly version: string;
	readonly private: boolean;
	readonly latestVersion: string;
	readonly preRelease: boolean;
	readonly isPreReleaseVersion: boolean;
	readonly hasPreReleaseVersion: boolean;
	readonly hasReleaseVersion: boolean;
	readonly description: string;
	readonly url?: string;
	readonly repository?: string;
	readonly supportUrl?: string;
	readonly licenseUrl?: string;
	readonly installCount?: number;
	readonly rating?: number;
	readonly ratingCount?: number;
	readonly ratingUrl?: string;
	readonly outdated: boolean;
	readonly outdatedTargetPlatform: boolean;
	readonly runtimeState: ExtensionRuntimeState | undefined;
	readonly enablementState: EnablementState;
	readonly tags: readonly string[];
	readonly categories: readonly string[];
	readonly dependencies: string[];
	readonly extensionPack: string[];
	readonly telemetryData: any;
	readonly preview: boolean;
	getManifest(token: CancellationToken): Promise<IExtensionManifest | null>;
	hasReadme(): boolean;
	getReadme(token: CancellationToken): Promise<string>;
	hasChangelog(): boolean;
	getChangelog(token: CancellationToken): Promise<string>;
	readonly server?: IExtensionManagementServer;
	readonly local?: ILocalExtension;
	gallery?: IGalleryExtension;
	readonly resourceExtension?: IResourceExtension;
	readonly isMalicious: boolean | undefined;
	readonly maliciousInfoLink: string | undefined;
	readonly deprecationInfo?: IDeprecationInfo;
	readonly missingFromGallery?: boolean;
}

export const IExtensionsWorkbenchService = createDecorator<IExtensionsWorkbenchService>('extensionsWorkbenchService');

export interface InstallExtensionOptions extends InstallOptions {
	version?: string;
	justification?: string | { reason: string; action: string };
	enable?: boolean;
	installEverywhere?: boolean;
}

export interface IExtensionsNotification {
	readonly message: string | IMarkdownString;
	readonly severity: Severity;
	readonly extensions: IExtension[];
	readonly query?: string;
	readonly action?: { readonly label: string; run(): void };
	dismiss?(): void;
}

export interface IExtensionsWorkbenchService {
	readonly _serviceBrand: undefined;
	readonly onChange: Event<IExtension | undefined>;
	readonly onReset: Event<void>;
	readonly local: IExtension[];
	readonly installed: IExtension[];
	readonly outdated: IExtension[];
	readonly whenInitialized: Promise<void>;
	queryLocal(server?: IExtensionManagementServer): Promise<IExtension[]>;
	queryGallery(token: CancellationToken): Promise<IPager<IExtension>>;
	queryGallery(options: IQueryOptions, token: CancellationToken): Promise<IPager<IExtension>>;
	getExtensions(extensionInfos: IExtensionInfo[], token: CancellationToken): Promise<IExtension[]>;
	getExtensions(extensionInfos: IExtensionInfo[], options: IExtensionQueryOptions, token: CancellationToken): Promise<IExtension[]>;
	getResourceExtensions(locations: URI[], isWorkspaceScoped: boolean): Promise<IExtension[]>;
	canInstall(extension: IExtension): Promise<true | IMarkdownString>;
	install(id: string, installOptions?: InstallExtensionOptions, progressLocation?: ProgressLocation | string): Promise<IExtension>;
	install(vsix: URI, installOptions?: InstallExtensionOptions, progressLocation?: ProgressLocation | string): Promise<IExtension>;
	install(extension: IExtension, installOptions?: InstallExtensionOptions, progressLocation?: ProgressLocation | string): Promise<IExtension>;
	installInServer(extension: IExtension, server: IExtensionManagementServer, installOptions?: InstallOptions): Promise<void>;
	downloadVSIX(extension: string, versionKind: 'prerelease' | 'release' | 'any'): Promise<void>;
	uninstall(extension: IExtension): Promise<void>;
	togglePreRelease(extension: IExtension): Promise<void>;
	canSetLanguage(extension: IExtension): boolean;
	setLanguage(extension: IExtension): Promise<void>;
	setEnablement(extensions: IExtension | IExtension[], enablementState: EnablementState): Promise<void>;
	isAutoUpdateEnabledFor(extensionOrPublisher: IExtension | string): boolean;
	updateAutoUpdateEnablementFor(extensionOrPublisher: IExtension | string, enable: boolean): Promise<void>;
	shouldRequireConsentToUpdate(extension: IExtension): Promise<string | undefined>;
	updateAutoUpdateForAllExtensions(value: boolean): Promise<void>;
	open(extension: IExtension | string, options?: IExtensionEditorOptions): Promise<void>;
	openSearch(searchValue: string, focus?: boolean): Promise<void>;
	getAutoUpdateValue(): AutoUpdateConfigurationValue;
	isAutoUpdateDelayed(extension: IExtension): boolean;
	getAutoUpdateDelayRemaining(extension: IExtension): number;
	getAutoUpdateDelay(): number;
	checkForUpdates(): Promise<void>;
	getExtensionRuntimeStatus(extension: IExtension): IExtensionRuntimeStatus | undefined;
	updateAll(): Promise<InstallExtensionResult[]>;
	updateRunningExtensions(message?: string): Promise<void>;

	readonly onDidChangeExtensionsNotification: Event<IExtensionsNotification | undefined>;
	getExtensionsNotification(): IExtensionsNotification | undefined;

	// Sync APIs
	isExtensionIgnoredToSync(extension: IExtension): boolean;
	toggleExtensionIgnoredToSync(extension: IExtension): Promise<void>;
	toggleApplyExtensionToAllProfiles(extension: IExtension): Promise<void>;
}

export const enum ExtensionEditorTab {
	Readme = 'readme',
	Features = 'features',
	Changelog = 'changelog',
	Dependencies = 'dependencies',
	ExtensionPack = 'extensionPack',
}

export const AutoUpdateConfigurationKey = 'extensions.autoUpdate';
export const AutoUpdateDelayConfigurationKey = 'extensions.autoUpdateDelay';
export const AutoCheckUpdatesConfigurationKey = 'extensions.autoCheckUpdates';
export const AutoRestartConfigurationKey = 'extensions.autoRestart';

export type AutoUpdateConfigurationValue = 'on' | 'off';

export const LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID = 'workbench.extensions.action.listWorkspaceUnsupportedExtensions';

// Context Keys
export const HasOutdatedExtensionsContext = new RawContextKey<boolean>('hasOutdatedExtensions', false);
