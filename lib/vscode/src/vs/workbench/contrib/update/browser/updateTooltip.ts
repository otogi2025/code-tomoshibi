/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as dom from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IMeteredConnectionService } from '../../../../platform/meteredConnection/common/meteredConnection.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { AvailableForDownload, Disabled, DisablementReason, Downloaded, Downloading, Idle, IUpdate, Overwriting, Ready, Restarting, State, StateType, Updating } from '../../../../platform/update/common/update.js';
import { ShowCurrentReleaseNotesActionId } from '../common/update.js';
import { computeDownloadSpeed, computeDownloadTimeRemaining, computeProgressPercent, formatBytes, formatDate, formatTimeRemaining, tryParseDate } from '../common/updateUtils.js';
import './media/updateTooltip.css';

/**
 * A stateful tooltip control for the update status.
 */
export class UpdateTooltip extends Disposable {
	public readonly domNode: HTMLElement;

	// Header section
	private readonly titleNode: HTMLElement;

	// Product info section
	private readonly productInfoNode: HTMLElement;
	private readonly productNameNode: HTMLElement;
	private readonly currentVersionNode: HTMLElement;
	private readonly currentVersionCopyValue: { value: string };
	private readonly latestVersionNode: HTMLElement;
	private readonly latestVersionCopyValue: { value: string };
	private readonly releaseDateNode: HTMLElement;

	// Progress section
	private readonly progressContainer: HTMLElement;
	private readonly progressFill: HTMLElement;
	private readonly progressPercentNode: HTMLElement;
	private readonly progressSizeNode: HTMLElement;

	// Extra download info
	private readonly downloadStatsContainer: HTMLElement;
	private readonly timeRemainingNode: HTMLElement;
	private readonly speedInfoNode: HTMLElement;

	// State-specific message
	private readonly messageNode: HTMLElement;

	// Button bar
	private readonly buttonBar: HTMLElement;
	private readonly releaseNotesButton: HTMLButtonElement;
	private readonly actionButton: HTMLButtonElement;

	private releaseNotesVersion: string | undefined;

	constructor(
		@IClipboardService private readonly clipboardService: IClipboardService,
		@ICommandService private readonly commandService: ICommandService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IHoverService private readonly hoverService: IHoverService,
		@IMeteredConnectionService private readonly meteredConnectionService: IMeteredConnectionService,
		@IProductService private readonly productService: IProductService,
	) {
		super();

		this.domNode = dom.$('.update-tooltip');

		// Header section
		const header = dom.append(this.domNode, dom.$('.header'));
		this.titleNode = dom.append(header, dom.$('.title'));

		// Product info section
		this.productInfoNode = dom.append(this.domNode, dom.$('.product-info'));

		const logoContainer = dom.append(this.productInfoNode, dom.$('.product-logo'));
		logoContainer.setAttribute('role', 'img');
		logoContainer.setAttribute('aria-label', this.productService.nameLong);

		const details = dom.append(this.productInfoNode, dom.$('.product-details'));

		this.productNameNode = dom.append(details, dom.$('.product-name'));
		this.productNameNode.textContent = this.productService.nameLong;

		const currentVersionRow = this.createVersionRow(details);
		this.currentVersionNode = currentVersionRow.label;
		this.currentVersionCopyValue = currentVersionRow.copyValue;

		const latestVersionRow = this.createVersionRow(details);
		this.latestVersionNode = latestVersionRow.label;
		this.latestVersionCopyValue = latestVersionRow.copyValue;

		this.releaseDateNode = dom.append(details, dom.$('.product-release-date'));

		// Progress section
		this.progressContainer = dom.append(this.domNode, dom.$('.progress-container'));
		const progressBar = dom.append(this.progressContainer, dom.$('.progress-bar'));
		this.progressFill = dom.append(progressBar, dom.$('.progress-fill'));

		const progressText = dom.append(this.progressContainer, dom.$('.progress-text'));
		this.progressPercentNode = dom.append(progressText, dom.$('span'));
		this.progressSizeNode = dom.append(progressText, dom.$('span'));

		// Extra download stats
		this.downloadStatsContainer = dom.append(this.progressContainer, dom.$('.download-stats'));
		this.timeRemainingNode = dom.append(this.downloadStatsContainer, dom.$('.time-remaining'));
		this.speedInfoNode = dom.append(this.downloadStatsContainer, dom.$('.speed-info'));

		// State-specific message
		this.messageNode = dom.append(this.domNode, dom.$('.state-message'));

		// Button bar
		this.buttonBar = dom.append(this.domNode, dom.$('.button-bar'));

		this.releaseNotesButton = dom.append(this.buttonBar, dom.$('button.release-notes-button')) as HTMLButtonElement;
		this.releaseNotesButton.textContent = localize('updateTooltip.viewReleaseNotes', "发行说明");
		this._register(dom.addDisposableListener(this.releaseNotesButton, 'click', () => {
			if (this.releaseNotesVersion) {
				this.runCommandAndClose(ShowCurrentReleaseNotesActionId, this.releaseNotesVersion);
			}
		}));

		this.actionButton = dom.append(this.buttonBar, dom.$('button.action-button')) as HTMLButtonElement;
		this._register(dom.addDisposableListener(this.actionButton, 'click', () => {
			const commandId = this.actionButton.dataset.commandId;
			if (commandId) {
				this.runCommandAndClose(commandId);
			}
		}));

		// Populate static product info
		this.updateCurrentVersion();
	}

	private updateCurrentVersion() {
		const productVersion = this.productService.version;
		if (productVersion) {
			const currentCommitId = this.productService.commit?.substring(0, 7);
			this.currentVersionNode.textContent = currentCommitId
				? localize('updateTooltip.currentVersionLabelWithCommit', "当前版本: {0} ({1})", productVersion, currentCommitId)
				: localize('updateTooltip.currentVersionLabel', "当前版本: {0}", productVersion);
			this.currentVersionCopyValue.value = currentCommitId ? `${productVersion} (${this.productService.commit})` : productVersion;
			this.currentVersionNode.parentElement!.style.display = '';
		} else {
			this.currentVersionNode.parentElement!.style.display = 'none';
		}
	}

	private hideAll() {
		this.productInfoNode.style.display = '';
		this.progressContainer.style.display = 'none';
		this.speedInfoNode.textContent = '';
		this.timeRemainingNode.textContent = '';
		this.messageNode.style.display = 'none';
		this.actionButton.style.display = 'none';
		this.actionButton.dataset.commandId = '';
		this.releaseNotesButton.style.marginRight = '';
	}

	public renderState(state: State) {
		this.hideAll();
		switch (state.type) {
			case StateType.Uninitialized:
				this.renderUninitialized();
				break;
			case StateType.Disabled:
				this.renderDisabled(state);
				break;
			case StateType.Idle:
				this.renderIdle(state);
				break;
			case StateType.CheckingForUpdates:
				this.renderCheckingForUpdates();
				break;
			case StateType.AvailableForDownload:
				this.renderAvailableForDownload(state);
				break;
			case StateType.Downloading:
				this.renderDownloading(state);
				break;
			case StateType.Downloaded:
				this.renderDownloaded(state);
				break;
			case StateType.Updating:
				this.renderUpdating(state);
				break;
			case StateType.Ready:
				this.renderReady(state);
				break;
			case StateType.Overwriting:
				this.renderOverwriting(state);
				break;
			case StateType.Cancelling:
				this.renderCancelling();
				break;
			case StateType.Restarting:
				this.renderRestarting(state);
				break;
		}
	}

	private renderUninitialized() {
		this.renderTitleAndInfo(localize('updateTooltip.initializingTitle', "正在初始化"));
		this.renderMessage(localize('updateTooltip.initializingMessage', "正在初始化更新服务..."));
	}

	private renderDisabled({ reason }: Disabled) {
		this.renderTitleAndInfo(localize('updateTooltip.updatesDisabledTitle', "已禁用更新"));
		switch (reason) {
			case DisablementReason.NotBuilt:
				this.renderMessage(
					localize('updateTooltip.disabledNotBuilt', "更新不适用于此版本。"),
					Codicon.info);
				break;
			case DisablementReason.DisabledByEnvironment:
				this.renderMessage(
					localize('updateTooltip.disabledByEnvironment', "更新被 --disable-updates 命令行参数禁用。"),
					Codicon.warning);
				break;
			case DisablementReason.ManuallyDisabled:
				this.renderMessage(
					localize('updateTooltip.disabledManually', "更新被手动禁用。将 \"update.mode\" 设置更改为启用。"),
					Codicon.warning);
				break;
			case DisablementReason.Policy:
				this.renderMessage(
					localize('updateTooltip.disabledByPolicy', "更新已被组织策略禁用。"),
					Codicon.info);
				break;
			case DisablementReason.MissingConfiguration:
				this.renderMessage(
					localize('updateTooltip.disabledMissingConfig', "已禁用更新，因为未配置更新 URL。"),
					Codicon.info);
				break;
			case DisablementReason.InvalidConfiguration:
				this.renderMessage(
					localize('updateTooltip.disabledInvalidConfig', "更新被禁用，因为更新 URL 无效。"),
					Codicon.error);
				break;
			case DisablementReason.RunningAsAdmin:
				this.renderMessage(
					localize(
						'updateTooltip.disabledRunningAsAdmin',
						"以管理员身份运行的 {0} 用户安装时，更新不可用。",
						this.productService.nameShort),
					Codicon.warning);
				break;
			default:
				this.renderMessage(localize('updateTooltip.disabledGeneric', "已禁用更新。"), Codicon.warning);
				break;
		}
	}

	private renderIdle({ error, notAvailable }: Idle) {
		if (error) {
			this.renderTitleAndInfo(localize('updateTooltip.updateErrorTitle', "更新错误"));
			this.renderMessage(error, Codicon.error);
			return;
		}

		if (notAvailable) {
			this.renderTitleAndInfo(localize('updateTooltip.noUpdateAvailableTitle', "无可用更新"));
			this.renderMessage(localize('updateTooltip.noUpdateAvailableMessage', "当前没有可用的更新。"), Codicon.info);
			return;
		}

		this.renderTitleAndInfo(localize('updateTooltip.upToDateTitle', "最新"));
		switch (this.configurationService.getValue<string>('update.mode')) {
			case 'none':
				this.renderMessage(localize('updateTooltip.autoUpdateNone', "已禁用自动更新。"), Codicon.warning);
				break;
			case 'manual':
				this.renderMessage(localize('updateTooltip.autoUpdateManual', "将检查自动更新，但不会自动安装。"));
				break;
			case 'start':
				this.renderMessage(localize('updateTooltip.autoUpdateStart', "更新将在重启时应用。"));
				break;
			case 'default':
				if (this.meteredConnectionService.isConnectionMetered) {
					this.renderMessage(
						localize('updateTooltip.meteredConnectionMessage', "Automatic updates are paused because the network connection is metered."),
						Codicon.radioTower);
				} else {
					this.renderMessage(
						localize('updateTooltip.autoUpdateDefault', "已启用自动更新。祝你编码愉快!"),
						Codicon.smiley);
				}
				break;
		}
	}

	private renderCheckingForUpdates() {
		this.renderTitleAndInfo(localize('updateTooltip.checkingForUpdatesTitle', "正在检查更新"));
		this.renderMessage(localize('updateTooltip.checkingPleaseWait', "正在检查更新，请稍候..."));
	}

	private renderAvailableForDownload({ update }: AvailableForDownload) {
		this.renderTitleAndInfo(localize('updateTooltip.updateAvailableTitle', "更新可用"), update);
		this.renderActionButton(localize('updateTooltip.downloadButton', "下载"), 'update.downloadNow');
	}

	private renderDownloading(state: Downloading) {
		this.renderTitleAndInfo(localize('updateTooltip.downloadingUpdateTitle', "正在下载更新"), state.update);

		const { downloadedBytes, totalBytes } = state;
		if (downloadedBytes !== undefined && totalBytes !== undefined && totalBytes > 0) {
			const percentage = computeProgressPercent(downloadedBytes, totalBytes) ?? 0;
			this.progressFill.style.width = `${percentage}%`;
			this.progressPercentNode.textContent = `${percentage}%`;
			this.progressSizeNode.textContent = `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
			this.progressContainer.style.display = '';

			const speed = computeDownloadSpeed(state);
			if (speed !== undefined && speed > 0) {
				this.speedInfoNode.textContent = localize('updateTooltip.downloadSpeed', '{0}/秒', formatBytes(speed));
			}

			const timeRemaining = computeDownloadTimeRemaining(state);
			if (timeRemaining !== undefined && timeRemaining > 0) {
				this.timeRemainingNode.textContent = `~${formatTimeRemaining(timeRemaining)} ${localize('updateTooltip.timeRemaining', "剩余")}`;
			}

			this.downloadStatsContainer.style.display = '';
		} else {
			this.renderMessage(localize('updateTooltip.downloadingPleaseWait', "正在下载更新，请稍候..."));
		}
	}

	private renderDownloaded({ update }: Downloaded) {
		this.renderTitleAndInfo(localize('updateTooltip.updateReadyTitle', "更新已准备好安装"), update);
		this.renderActionButton(localize('updateTooltip.installButton', "安装"), 'update.install');
	}

	private renderUpdating({ update, currentProgress, maxProgress }: Updating) {
		this.renderTitleAndInfo(localize('updateTooltip.installingUpdateTitle', "正在安装更新"), update);

		const percentage = computeProgressPercent(currentProgress, maxProgress);
		if (percentage !== undefined) {
			this.progressFill.style.width = `${percentage}%`;
			this.progressPercentNode.textContent = `${percentage}%`;
			this.progressSizeNode.textContent = '';
			this.progressContainer.style.display = '';
		} else {
			this.renderMessage(localize('updateTooltip.installingPleaseWait', "正在安装更新，请稍候..."));
		}
	}

	private renderReady({ update }: Ready) {
		if (this.configurationService.getValue<string>('update.mode') === 'manual') {
			this.renderTitleAndInfo(localize('updateTooltip.updateInstalledTitle', "已安装更新"), update);
			this.renderActionButton(localize('updateTooltip.restartButton', "重启"), 'update.restart');
		} else {
			this.renderTitleAndInfo(localize('updateTooltip.restartToUpdateTitle', "重启以更新"), update);
		}
	}

	private renderOverwriting({ update }: Overwriting) {
		this.renderTitleAndInfo(localize('updateTooltip.downloadingNewerUpdateTitle', "正在下载较新的更新"), update);
		this.renderMessage(localize('updateTooltip.downloadingNewerPleaseWait', "已发布较新的更新。正在下载，请稍候..."));
	}

	private renderRestarting({ update }: Restarting) {
		this.renderTitleAndInfo(localize('updateTooltip.restartingTitle', "正在重启 {0}", this.productService.nameShort), update);
		this.renderMessage(localize('updateTooltip.restartingPleaseWait', "正在重启以更新，请稍候..."));
	}

	private renderCancelling() {
		this.renderTitleAndInfo(localize('updateTooltip.cancellingTitle', "正在取消更新"));
		this.renderMessage(localize('updateTooltip.cancellingPleaseWait', "正在取消更新，请稍候..."));
	}

	private renderTitleAndInfo(title: string, update?: IUpdate) {
		this.titleNode.textContent = title;

		// Latest version
		const version = update?.productVersion;
		if (version) {
			const updateCommitId = update.version?.substring(0, 7);
			this.latestVersionNode.textContent = updateCommitId
				? localize('updateTooltip.latestVersionLabelWithCommit', "最新版本: {0} ({1})", version, updateCommitId)
				: localize('updateTooltip.latestVersionLabel', "最新版本: {0}", version);
			this.latestVersionCopyValue.value = updateCommitId ? `${version} (${update.version})` : version;
			this.latestVersionNode.parentElement!.style.display = '';
		} else {
			this.latestVersionNode.parentElement!.style.display = 'none';
		}

		// Release date
		const releaseDate = update?.timestamp ?? tryParseDate(this.productService.date);
		if (typeof releaseDate === 'number' && releaseDate > 0) {
			this.releaseDateNode.textContent = localize('updateTooltip.releasedLabel', "发布者 {0}", formatDate(releaseDate));
			this.releaseDateNode.style.display = '';
		} else {
			this.releaseDateNode.style.display = 'none';
		}

		// Release notes button
		this.releaseNotesVersion = version ?? this.productService.version;
		this.releaseNotesButton.style.display = this.releaseNotesVersion ? '' : 'none';
		this.releaseNotesButton.style.marginRight = this.releaseNotesVersion ? 'auto' : '';
		this.buttonBar.style.display = this.releaseNotesVersion ? '' : 'none';
	}

	private renderActionButton(label: string, commandId: string) {
		this.actionButton.textContent = label;
		this.actionButton.dataset.commandId = commandId;
		this.actionButton.style.display = '';
	}

	private renderMessage(message: string, icon?: ThemeIcon) {
		dom.clearNode(this.messageNode);
		if (icon) {
			const iconNode = dom.append(this.messageNode, dom.$('.state-message-icon'));
			iconNode.classList.add(...ThemeIcon.asClassNameArray(icon));
		}
		dom.append(this.messageNode, document.createTextNode(message));
		this.messageNode.style.display = '';
	}

	private createVersionRow(parent: HTMLElement): { label: HTMLElement; copyValue: { value: string } } {
		const row = dom.append(parent, dom.$('.product-version'));
		const label = dom.append(row, dom.$('span'));
		const copyValue = { value: '' };

		const copyButton = dom.append(row, dom.$('a.copy-version-button'));
		copyButton.setAttribute('role', 'button');
		copyButton.setAttribute('tabindex', '0');
		const title = localize('updateTooltip.copyVersion', "复制");
		copyButton.title = title;
		copyButton.setAttribute('aria-label', title);

		const copyIcon = dom.append(copyButton, dom.$('.copy-icon'));
		copyIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.copy));
		this._register(dom.addDisposableListener(copyButton, 'click', e => {
			e.preventDefault();
			e.stopPropagation();
			if (copyValue.value) {
				this.clipboardService.writeText(copyValue.value);
			}
		}));

		return { label, copyValue };
	}

	private runCommandAndClose(command: string, ...args: unknown[]) {
		this.commandService.executeCommand(command, ...args);
		this.hoverService.hideHover(true);
	}
}
