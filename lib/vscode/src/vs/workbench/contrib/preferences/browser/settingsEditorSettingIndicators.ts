/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as DOM from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { HoverStyle, type IHoverOptions } from '../../../../base/browser/ui/hover/hover.js';
import { HoverPosition } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { SimpleIconLabel } from '../../../../base/browser/ui/iconLabel/simpleIconLabel.js';
import { Emitter } from '../../../../base/common/event.js';
import { IMarkdownString, MarkdownString, createMarkdownLink } from '../../../../base/common/htmlContent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IWorkbenchConfigurationService } from '../../../services/configuration/common/configuration.js';
import { ADVANCED_INDICATOR_DESCRIPTION, EXPERIMENTAL_INDICATOR_DESCRIPTION, POLICY_SETTING_TAG, PREVIEW_INDICATOR_DESCRIPTION } from '../common/preferences.js';
import { SettingsTreeSettingElement } from './settingsTreeModels.js';

const $ = DOM.$;

type ScopeString = 'workspace' | 'user' | 'remote' | 'default';

export interface ISettingOverrideClickEvent {
	scope: ScopeString;
	language: string;
	settingKey: string;
}

interface SettingIndicator {
	element: HTMLElement;
	/**
	 * The element to focus on when navigating with keyboard.
	 * When undefined, use {@link element} instead.
	 */
	focusElement?: HTMLElement;
	label: SimpleIconLabel;
	disposables: DisposableStore;
}

/**
 * Renders the indicators next to a setting, such as "Also Modified In".
 */
export class SettingsTreeIndicatorsLabel implements IDisposable {
	private readonly indicatorsContainerElement: HTMLElement;

	private readonly previewIndicator: SettingIndicator;
	private readonly advancedIndicator: SettingIndicator;
	private readonly workspaceTrustIndicator: SettingIndicator;
	private readonly scopeOverridesIndicator: SettingIndicator;
	private readonly defaultOverrideIndicator: SettingIndicator;

	/** Indicators that each have their own square container at the top-right of the setting */
	private readonly isolatedIndicators: SettingIndicator[] = [];
	/** Indicators that end up wrapped in a parenthesis at the top-right of the setting */
	private readonly parenthesizedIndicators: SettingIndicator[];

	private readonly keybindingListeners: DisposableStore = new DisposableStore();
	private focusedIndex = 0;

	constructor(
		container: HTMLElement,
		@IWorkbenchConfigurationService private readonly configurationService: IWorkbenchConfigurationService,
		@IHoverService private readonly hoverService: IHoverService,
		@ILanguageService private readonly languageService: ILanguageService,
		@ICommandService private readonly commandService: ICommandService) {
		this.indicatorsContainerElement = DOM.append(container, $('.setting-indicators-container'));
		this.indicatorsContainerElement.style.display = 'inline';

		this.previewIndicator = this.createPreviewIndicator();
		this.advancedIndicator = this.createAdvancedIndicator();
		this.isolatedIndicators = [this.previewIndicator, this.advancedIndicator];

		this.workspaceTrustIndicator = this.createWorkspaceTrustIndicator();
		this.scopeOverridesIndicator = this.createScopeOverridesIndicator();
		this.defaultOverrideIndicator = this.createDefaultOverrideIndicator();
		this.parenthesizedIndicators = [this.workspaceTrustIndicator, this.scopeOverridesIndicator, this.defaultOverrideIndicator];
	}

	private defaultHoverOptions: Partial<IHoverOptions> = {
		trapFocus: true,
		style: HoverStyle.Pointer,
		position: {
			hoverPosition: HoverPosition.BELOW,
		},
	};


	private createWorkspaceTrustIndicator(): SettingIndicator {
		const disposables = new DisposableStore();
		const workspaceTrustElement = $('span.setting-indicator.setting-item-workspace-trust');
		const workspaceTrustLabel = disposables.add(new SimpleIconLabel(workspaceTrustElement));
		workspaceTrustLabel.text = '$(shield) ' + localize('workspaceUntrustedLabel', "需要工作区信任");

		const content = localize('trustLabel', "此设置值仅可应用于受信任的工作区。");
		disposables.add(this.hoverService.setupDelayedHover(workspaceTrustElement, () => ({
			...this.defaultHoverOptions,
			content,
			actions: [{
				label: localize('manageWorkspaceTrust', "管理工作区信任"),
				commandId: 'workbench.trust.manage',
				run: (target: HTMLElement) => {
					this.commandService.executeCommand('workbench.trust.manage');
				}
			}],
		}), { setupKeyboardEvents: true }));
		return {
			element: workspaceTrustElement,
			label: workspaceTrustLabel,
			disposables
		};
	}

	private createScopeOverridesIndicator(): SettingIndicator {
		const disposables = new DisposableStore();
		// Don't add .setting-indicator class here, because it gets conditionally added later.
		const otherOverridesElement = $('span.setting-item-overrides');
		const otherOverridesLabel = disposables.add(new SimpleIconLabel(otherOverridesElement));
		return {
			element: otherOverridesElement,
			label: otherOverridesLabel,
			disposables
		};
	}

	private createDefaultOverrideIndicator(): SettingIndicator {
		const disposables = new DisposableStore();
		const defaultOverrideIndicator = $('span.setting-indicator.setting-item-default-overridden');
		const defaultOverrideLabel = disposables.add(new SimpleIconLabel(defaultOverrideIndicator));
		defaultOverrideLabel.text = localize('defaultOverriddenLabel', "默认值已更改");

		return {
			element: defaultOverrideIndicator,
			label: defaultOverrideLabel,
			disposables
		};
	}

	private createPreviewIndicator(): SettingIndicator {
		const disposables = new DisposableStore();
		const previewIndicator = $('span.setting-indicator.setting-item-preview');
		const previewLabel = disposables.add(new SimpleIconLabel(previewIndicator));

		return {
			element: previewIndicator,
			label: previewLabel,
			disposables
		};
	}

	private createAdvancedIndicator(): SettingIndicator {
		const disposables = new DisposableStore();
		const advancedIndicator = $('span.setting-indicator.setting-item-preview');
		const advancedLabel = disposables.add(new SimpleIconLabel(advancedIndicator));
		advancedLabel.text = localize('advancedLabel', "高级");

		disposables.add(this.hoverService.setupDelayedHover(advancedIndicator, {
			...this.defaultHoverOptions,
			content: ADVANCED_INDICATOR_DESCRIPTION,
		}, { setupKeyboardEvents: true }));

		return {
			element: advancedIndicator,
			label: advancedLabel,
			disposables
		};
	}

	private render() {
		this.indicatorsContainerElement.innerText = '';
		this.indicatorsContainerElement.style.display = 'none';

		const isolatedIndicatorsToShow = this.isolatedIndicators.filter(indicator => {
			return indicator.element.style.display !== 'none';
		});
		if (isolatedIndicatorsToShow.length) {
			this.indicatorsContainerElement.style.display = 'inline';
			for (let i = 0; i < isolatedIndicatorsToShow.length; i++) {
				DOM.append(this.indicatorsContainerElement, isolatedIndicatorsToShow[i].element);
			}
		}

		const parenthesizedIndicatorsToShow = this.parenthesizedIndicators.filter(indicator => {
			return indicator.element.style.display !== 'none';
		});
		if (parenthesizedIndicatorsToShow.length) {
			this.indicatorsContainerElement.style.display = 'inline';
			DOM.append(this.indicatorsContainerElement, $('span', undefined, '('));
			for (let i = 0; i < parenthesizedIndicatorsToShow.length - 1; i++) {
				DOM.append(this.indicatorsContainerElement, parenthesizedIndicatorsToShow[i].element);
				DOM.append(this.indicatorsContainerElement, $('span.comma', undefined, ' • '));
			}
			DOM.append(this.indicatorsContainerElement, parenthesizedIndicatorsToShow[parenthesizedIndicatorsToShow.length - 1].element);
			DOM.append(this.indicatorsContainerElement, $('span', undefined, ')'));
		}
		this.resetIndicatorNavigationKeyBindings([...isolatedIndicatorsToShow, ...parenthesizedIndicatorsToShow]);
	}

	private resetIndicatorNavigationKeyBindings(indicators: SettingIndicator[]) {
		this.keybindingListeners.clear();
		this.indicatorsContainerElement.role = indicators.length >= 1 ? 'toolbar' : 'button';
		if (!indicators.length) {
			return;
		}
		const firstElement = indicators[0].focusElement ?? indicators[0].element;
		firstElement.tabIndex = 0;
		this.keybindingListeners.add(DOM.addDisposableListener(this.indicatorsContainerElement, 'keydown', (e) => {
			const ev = new StandardKeyboardEvent(e);
			let handled = true;
			if (ev.equals(KeyCode.Home)) {
				this.focusIndicatorAt(indicators, 0);
			} else if (ev.equals(KeyCode.End)) {
				this.focusIndicatorAt(indicators, indicators.length - 1);
			} else if (ev.equals(KeyCode.RightArrow)) {
				const indexToFocus = (this.focusedIndex + 1) % indicators.length;
				this.focusIndicatorAt(indicators, indexToFocus);
			} else if (ev.equals(KeyCode.LeftArrow)) {
				const indexToFocus = this.focusedIndex ? this.focusedIndex - 1 : indicators.length - 1;
				this.focusIndicatorAt(indicators, indexToFocus);
			} else {
				handled = false;
			}

			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		}));
	}

	private focusIndicatorAt(indicators: SettingIndicator[], index: number) {
		if (index === this.focusedIndex) {
			return;
		}
		const indicator = indicators[index];
		const elementToFocus = indicator.focusElement ?? indicator.element;
		elementToFocus.tabIndex = 0;
		elementToFocus.focus();

		const currentlyFocusedIndicator = indicators[this.focusedIndex];
		const previousFocusedElement = currentlyFocusedIndicator.focusElement ?? currentlyFocusedIndicator.element;
		previousFocusedElement.tabIndex = -1;

		this.focusedIndex = index;
	}

	updateWorkspaceTrust(element: SettingsTreeSettingElement) {
		this.workspaceTrustIndicator.element.style.display = element.isUntrusted ? 'inline' : 'none';
		this.render();
	}

	updatePreviewIndicator(element: SettingsTreeSettingElement) {
		const isPreviewSetting = element.tags?.has('preview');
		const isExperimentalSetting = element.tags?.has('experimental');
		this.previewIndicator.element.style.display = (isPreviewSetting || isExperimentalSetting) ? 'inline' : 'none';
		this.previewIndicator.label.text = isPreviewSetting ?
			localize('previewLabel', "预览") :
			localize('experimentalLabel', "实验性");

		const content = isPreviewSetting ? PREVIEW_INDICATOR_DESCRIPTION : EXPERIMENTAL_INDICATOR_DESCRIPTION;
		this.previewIndicator.disposables.add(this.hoverService.setupDelayedHover(this.previewIndicator.element, {
			...this.defaultHoverOptions,
			content,
		}, { setupKeyboardEvents: true }));

		this.render();
	}

	updateAdvancedIndicator(element: SettingsTreeSettingElement) {
		const isAdvancedSetting = element.tags?.has('advanced');
		this.advancedIndicator.element.style.display = isAdvancedSetting ? 'inline' : 'none';
		this.render();
	}

	private getInlineScopeDisplayText(completeScope: string): string {
		const [scope, language] = completeScope.split(':');
		const localizedScope = scope === 'user' ?
			localize('user', "用户") : scope === 'workspace' ?
				localize('workspace', "工作区") : localize('remote', "远程");
		if (language) {
			return `${this.languageService.getLanguageName(language)} > ${localizedScope}`;
		}
		return localizedScope;
	}

	dispose() {
		this.keybindingListeners.dispose();
		for (const indicator of this.isolatedIndicators) {
			indicator.disposables.dispose();
		}
		for (const indicator of this.parenthesizedIndicators) {
			indicator.disposables.dispose();
		}
	}

	updateScopeOverrides(element: SettingsTreeSettingElement, onDidClickOverrideElement: Emitter<ISettingOverrideClickEvent>, onApplyFilter: Emitter<string>) {
		this.scopeOverridesIndicator.disposables.clear();
		this.scopeOverridesIndicator.element.innerText = '';
		this.scopeOverridesIndicator.element.style.display = 'none';
		this.scopeOverridesIndicator.focusElement = this.scopeOverridesIndicator.element;
		if (element.hasPolicyValue) {
			// If the setting falls under a policy, then no matter what the user sets, the policy value takes effect.
			this.scopeOverridesIndicator.element.style.display = 'inline';
			this.scopeOverridesIndicator.element.classList.add('setting-indicator');

			this.scopeOverridesIndicator.label.text = '$(briefcase) ' + localize('policyLabelText', "由组织管理");
			const content = localize('policyDescription', "此设置由你所在组织管理，并且无法更改其实际值。");
			this.scopeOverridesIndicator.disposables.add(this.hoverService.setupDelayedHover(this.scopeOverridesIndicator.element, () => ({
				...this.defaultHoverOptions,
				content,
				actions: [{
					label: localize('policyFilterLink', "查看策略设置"),
					commandId: '_settings.action.viewPolicySettings',
					run: (_) => {
						onApplyFilter.fire(`@${POLICY_SETTING_TAG}`);
					}
				}],
			}), { setupKeyboardEvents: true }));
		} else if (element.isAgentsWindowReadOnly) {
			this.scopeOverridesIndicator.element.style.display = 'inline';
			this.scopeOverridesIndicator.element.classList.add('setting-indicator');

			this.scopeOverridesIndicator.label.text = '$(lock) ' + localize('agentsWindowReadOnlyLabelText', "无法在智能体窗口中更改");
			const content = localize('agentsWindowReadOnlyDescription', "无法在智能体窗口中更改此设置。");
			this.scopeOverridesIndicator.disposables.add(this.hoverService.setupDelayedHover(this.scopeOverridesIndicator.element, {
				...this.defaultHoverOptions,
				content,
			}, { setupKeyboardEvents: true }));
		} else if (element.settingsTarget === ConfigurationTarget.USER_LOCAL && this.configurationService.isSettingAppliedForAllProfiles(element.setting.key)) {
			this.scopeOverridesIndicator.element.style.display = 'inline';
			this.scopeOverridesIndicator.element.classList.add('setting-indicator');

			this.scopeOverridesIndicator.label.text = localize('applicationSetting', "适用所有配置文件");

			const content = localize('applicationSettingDescription', "该设置不特定于当前配置文件，并将在切换配置文件时保留其值。");
			this.scopeOverridesIndicator.disposables.add(this.hoverService.setupDelayedHover(this.scopeOverridesIndicator.element, {
				...this.defaultHoverOptions,
				content,
			}, { setupKeyboardEvents: true }));
		} else if (element.overriddenScopeList.length || element.overriddenDefaultsLanguageList.length) {
			if (element.overriddenScopeList.length === 1 && !element.overriddenDefaultsLanguageList.length) {
				// We can inline the override and show all the text in the label
				// so that users don't have to wait for the hover to load
				// just to click into the one override there is.
				this.scopeOverridesIndicator.element.style.display = 'inline';
				this.scopeOverridesIndicator.element.classList.remove('setting-indicator');

				const prefaceText = element.isConfigured ?
					localize('alsoConfiguredIn', "同时修改于") :
					localize('configuredIn', "修改于");
				this.scopeOverridesIndicator.label.text = `${prefaceText} `;

				const overriddenScope = element.overriddenScopeList[0];
				const view = DOM.append(this.scopeOverridesIndicator.element, $('a.modified-scope', undefined, this.getInlineScopeDisplayText(overriddenScope)));
				view.tabIndex = -1;
				this.scopeOverridesIndicator.focusElement = view;
				const onClickOrKeydown = (e: UIEvent) => {
					const [scope, language] = overriddenScope.split(':');
					onDidClickOverrideElement.fire({
						settingKey: element.setting.key,
						scope: scope as ScopeString,
						language
					});
					e.preventDefault();
					e.stopPropagation();
				};
				this.scopeOverridesIndicator.disposables.add(DOM.addDisposableListener(view, DOM.EventType.CLICK, (e) => {
					onClickOrKeydown(e);
				}));
				this.scopeOverridesIndicator.disposables.add(DOM.addDisposableListener(view, DOM.EventType.KEY_DOWN, (e) => {
					const ev = new StandardKeyboardEvent(e);
					if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
						onClickOrKeydown(e);
					}
				}));
			} else {
				this.scopeOverridesIndicator.element.style.display = 'inline';
				this.scopeOverridesIndicator.element.classList.add('setting-indicator');
				const scopeOverridesLabelText = element.isConfigured ?
					localize('alsoConfiguredElsewhere', "也已在其他位置修改") :
					localize('configuredElsewhere', "已在其他位置修改");
				this.scopeOverridesIndicator.label.text = scopeOverridesLabelText;

				let contentMarkdownString = '';
				if (element.overriddenScopeList.length) {
					const prefaceText = element.isConfigured ?
						localize('alsoModifiedInScopes', "在以下范围中也修改了该设置:") :
						localize('modifiedInScopes', "已在以下作用域中修改该设置:");
					contentMarkdownString = prefaceText;
					for (const scope of element.overriddenScopeList) {
						const scopeDisplayText = this.getInlineScopeDisplayText(scope);
						contentMarkdownString += '\n- ' + createMarkdownLink(scopeDisplayText, SettingScopeLink.create(scope).toString(), getAccessibleScopeDisplayText(scope, this.languageService));
					}
				}
				if (element.overriddenDefaultsLanguageList.length) {
					if (contentMarkdownString) {
						contentMarkdownString += `\n\n`;
					}
					const prefaceText = localize('hasDefaultOverridesForLanguages', "以下语言具有默认替代:");
					contentMarkdownString += prefaceText;
					for (const language of element.overriddenDefaultsLanguageList) {
						const scopeDisplayText = this.languageService.getLanguageName(language);
						contentMarkdownString += '\n- ' + createMarkdownLink(scopeDisplayText ?? language, SettingScopeLink.create(`default:${language}`).toString());
					}
				}
				const content: IMarkdownString = {
					value: contentMarkdownString,
					isTrusted: false,
					supportHtml: false
				};
				this.scopeOverridesIndicator.disposables.add(this.hoverService.setupDelayedHover(this.scopeOverridesIndicator.element, () => ({
					...this.defaultHoverOptions,
					content,
					linkHandler: (url: string) => {
						const [scope, language] = SettingScopeLink.parse(url).split(':');
						onDidClickOverrideElement.fire({
							settingKey: element.setting.key,
							scope: scope as ScopeString,
							language
						});
					}
				}), { setupKeyboardEvents: true }));
			}
		}
		this.render();
	}

	updateDefaultOverrideIndicator(element: SettingsTreeSettingElement) {
		this.defaultOverrideIndicator.element.style.display = 'none';
		let sourceToDisplay = getDefaultValueSourceToDisplay(element);
		if (sourceToDisplay !== undefined) {
			this.defaultOverrideIndicator.element.style.display = 'inline';
			this.defaultOverrideIndicator.disposables.clear();

			// Show source of default value when hovered
			if (Array.isArray(sourceToDisplay) && sourceToDisplay.length === 1) {
				sourceToDisplay = sourceToDisplay[0];
			}

			let defaultOverrideHoverContent;
			if (!Array.isArray(sourceToDisplay)) {
				defaultOverrideHoverContent = localize('defaultOverriddenDetails', "默认设置值被“{0}”替代", sourceToDisplay);
			} else {
				sourceToDisplay = sourceToDisplay.map(source => `\`${source}\``);
				defaultOverrideHoverContent = localize('multipledefaultOverriddenDetails', "“{0}”已设置了默认值", sourceToDisplay.slice(0, -1).join(', ') + ' & ' + sourceToDisplay.slice(-1));
			}

			this.defaultOverrideIndicator.disposables.add(this.hoverService.setupDelayedHover(this.defaultOverrideIndicator.element, () => ({
				content: new MarkdownString().appendMarkdown(defaultOverrideHoverContent),
				style: HoverStyle.Pointer,
				position: {
					hoverPosition: HoverPosition.BELOW,
				},
			}), { setupKeyboardEvents: true }));
		}
		this.render();
	}
}

function getDefaultValueSourceToDisplay(element: SettingsTreeSettingElement): string | undefined | string[] {
	let sourceToDisplay: string | undefined | string[];
	const defaultValueSource = element.defaultValueSource;
	if (defaultValueSource) {
		if (defaultValueSource instanceof Map) {
			sourceToDisplay = [];
			for (const [, value] of defaultValueSource) {
				const newValue = typeof value !== 'string' ? value.displayName ?? value.id : value;
				if (!sourceToDisplay.includes(newValue)) {
					sourceToDisplay.push(newValue);
				}
			}
		} else if (typeof defaultValueSource === 'string') {
			sourceToDisplay = defaultValueSource;
		} else {
			sourceToDisplay = defaultValueSource.displayName ?? defaultValueSource.id;
		}
	}
	return sourceToDisplay;
}

function getAccessibleScopeDisplayText(completeScope: string, languageService: ILanguageService): string {
	const [scope, language] = completeScope.split(':');
	const localizedScope = scope === 'user' ?
		localize('user', "用户") : scope === 'workspace' ?
			localize('workspace', "工作区") : localize('remote', "远程");
	if (language) {
		return localize('modifiedInScopeForLanguage', "{1} 的 {0} 范围", localizedScope, languageService.getLanguageName(language));
	}
	return localizedScope;
}

function getAccessibleScopeDisplayMidSentenceText(completeScope: string, languageService: ILanguageService): string {
	const [scope, language] = completeScope.split(':');
	const localizedScope = scope === 'user' ?
		localize('user', "用户") : scope === 'workspace' ?
			localize('workspace', "工作区") : localize('remote', "远程");
	if (language) {
		return localize('modifiedInScopeForLanguageMidSentence', "{1} 的 {0} 范围", localizedScope.toLowerCase(), languageService.getLanguageName(language));
	}
	return localizedScope;
}

export function getIndicatorsLabelAriaLabel(element: SettingsTreeSettingElement, configurationService: IWorkbenchConfigurationService, userDataProfilesService: IUserDataProfilesService, languageService: ILanguageService): string {
	const ariaLabelSections: string[] = [];

	// Add preview or experimental indicator text
	if (element.tags?.has('preview')) {
		ariaLabelSections.push(localize('previewLabel', "预览"));
	} else if (element.tags?.has('experimental')) {
		ariaLabelSections.push(localize('experimentalLabel', "实验性"));
	}

	if (element.tags?.has('advanced')) {
		ariaLabelSections.push(localize('advancedLabel', "高级"));
	}

	// Add workspace trust text
	if (element.isUntrusted) {
		ariaLabelSections.push(localize('workspaceUntrustedAriaLabel', "工作区不受信任；未应用设置值"));
	}

	if (element.hasPolicyValue) {
		ariaLabelSections.push(localize('policyDescriptionAccessible', "由组织策略管理；未应用设置值"));
	} else if (element.isAgentsWindowReadOnly) {
		ariaLabelSections.push(localize('agentsWindowReadOnlyAccessible', "无法在智能体窗口中更改"));
	} else if (element.settingsTarget === ConfigurationTarget.USER_LOCAL && configurationService.isSettingAppliedForAllProfiles(element.setting.key)) {
		ariaLabelSections.push(localize('applicationSettingDescriptionAccessible', "切换配置文件时保留设置值"));
	} else {
		// Add other overrides text
		const otherOverridesStart = element.isConfigured ?
			localize('alsoConfiguredIn', "同时修改于") :
			localize('configuredIn', "修改于");
		const otherOverridesList = element.overriddenScopeList
			.map(scope => getAccessibleScopeDisplayMidSentenceText(scope, languageService)).join(', ');
		if (element.overriddenScopeList.length) {
			ariaLabelSections.push(`${otherOverridesStart} ${otherOverridesList}`);
		}
	}

	// Add default override indicator text
	let sourceToDisplay = getDefaultValueSourceToDisplay(element);
	if (sourceToDisplay !== undefined) {
		if (Array.isArray(sourceToDisplay) && sourceToDisplay.length === 1) {
			sourceToDisplay = sourceToDisplay[0];
		}

		let overriddenDetailsText;
		if (!Array.isArray(sourceToDisplay)) {
			overriddenDetailsText = localize('defaultOverriddenDetailsAriaLabel', "{0} 替代了默认值", sourceToDisplay);
		} else {
			overriddenDetailsText = localize('multipleDefaultOverriddenDetailsAriaLabel', "“{0}”会替代默认值", sourceToDisplay.slice(0, -1).join(', ') + ' & ' + sourceToDisplay.slice(-1));
		}
		ariaLabelSections.push(overriddenDetailsText);
	}

	// Add text about default values being overridden in other languages
	const otherLanguageOverridesList = element.overriddenDefaultsLanguageList
		.map(language => languageService.getLanguageName(language)).join(', ');
	if (element.overriddenDefaultsLanguageList.length) {
		const otherLanguageOverridesText = localize('defaultOverriddenLanguagesList', "存在适用于 {0} 的特定于语言的默认值", otherLanguageOverridesList);
		ariaLabelSections.push(otherLanguageOverridesText);
	}

	const ariaLabel = ariaLabelSections.join('. ');
	return ariaLabel;
}

/**
 * Internal links used to open a specific scope in the settings editor
 */
namespace SettingScopeLink {
	export function create(scope: string): URI {
		return URI.from({
			scheme: Schemas.internal,
			path: '/',
			query: encodeURIComponent(scope)
		});
	}

	export function parse(link: string): string {
		const uri = URI.parse(link);
		return decodeURIComponent(uri.query);
	}
}
