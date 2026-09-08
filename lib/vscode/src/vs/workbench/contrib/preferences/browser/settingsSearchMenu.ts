/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { IActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { DropdownMenuActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { IAction, IActionRunner, Separator } from '../../../../base/common/actions.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { localize } from '../../../../nls.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { SuggestEnabledInput } from '../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js';
import { ADVANCED_SETTING_TAG, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, GENERAL_TAG_SETTING_TAG, ID_SETTING_TAG, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG } from '../common/preferences.js';

export class SettingsSearchFilterDropdownMenuActionViewItem extends DropdownMenuActionViewItem {
	private readonly suggestController: SuggestController | null;

	constructor(
		action: IAction,
		options: IActionViewItemOptions,
		actionRunner: IActionRunner | undefined,
		private readonly searchWidget: SuggestEnabledInput,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		super(action,
			{ getActions: () => this.getActions() },
			contextMenuService,
			{
				...options,
				actionRunner,
				classNames: action.class,
				anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
				menuAsChild: true
			}
		);

		this.suggestController = SuggestController.get(this.searchWidget.inputWidget);
	}

	override render(container: HTMLElement): void {
		super.render(container);
	}

	private doSearchWidgetAction(queryToAppend: string, triggerSuggest: boolean) {
		this.searchWidget.setValue(this.searchWidget.getValue().trimEnd() + ' ' + queryToAppend);
		this.searchWidget.focus();
		if (triggerSuggest && this.suggestController) {
			this.suggestController.triggerSuggest();
		}
	}

	/**
	 * The created action appends a query to the search widget search string. It optionally triggers suggestions.
	 */
	private createAction(id: string, label: string, tooltip: string, queryToAppend: string, triggerSuggest: boolean): IAction {
		return {
			id,
			label,
			tooltip,
			class: undefined,
			enabled: true,
			run: () => { this.doSearchWidgetAction(queryToAppend, triggerSuggest); }
		};
	}

	/**
	 * The created action appends a query to the search widget search string, if the query does not exist.
	 * Otherwise, it removes the query from the search widget search string.
	 * The action does not trigger suggestions after adding or removing the query.
	 */
	private createToggleAction(id: string, label: string, tooltip: string, queryToAppend: string): IAction {
		const splitCurrentQuery = this.searchWidget.getValue().split(' ');
		const queryContainsQueryToAppend = splitCurrentQuery.includes(queryToAppend);
		return {
			id,
			label,
			tooltip,
			class: undefined,
			enabled: true,
			checked: queryContainsQueryToAppend,
			run: () => {
				if (!queryContainsQueryToAppend) {
					const trimmedCurrentQuery = this.searchWidget.getValue().trimEnd();
					const newQuery = trimmedCurrentQuery ? trimmedCurrentQuery + ' ' + queryToAppend : queryToAppend;
					this.searchWidget.setValue(newQuery);
				} else {
					const queryWithRemovedTags = this.searchWidget.getValue().split(' ')
						.filter(word => word !== queryToAppend).join(' ');
					this.searchWidget.setValue(queryWithRemovedTags);
				}
				this.searchWidget.focus();
			}
		};
	}

	private createMutuallyExclusiveToggleAction(id: string, label: string, tooltip: string, filter: string, excludeFilters: string[]): IAction {
		const isFilterEnabled = this.searchWidget.getValue().split(' ').includes(filter);
		return {
			id,
			label,
			tooltip,
			class: undefined,
			enabled: true,
			checked: isFilterEnabled,
			run: () => {
				if (isFilterEnabled) {
					const queryWithRemovedTags = this.searchWidget.getValue().split(' ')
						.filter(word => word !== filter).join(' ');
					this.searchWidget.setValue(queryWithRemovedTags);
				} else {
					let newQuery = this.searchWidget.getValue().split(' ')
						.filter(word => !excludeFilters.includes(word) && word !== filter)
						.join(' ')
						.trimEnd();
					newQuery = newQuery ? newQuery + ' ' + filter : filter;
					this.searchWidget.setValue(newQuery);
				}
				this.searchWidget.focus();
			}
		};
	}

	getActions(): IAction[] {
		return [
			this.createToggleAction(
				'modifiedSettingsSearch',
				localize('modifiedSettingsSearch', "已更改"),
				localize('modifiedSettingsSearchTooltip', "添加或删除已修改的设置筛选器"),
				`@${MODIFIED_SETTING_TAG}`
			),
			new Separator(),
			this.createAction(
				'extSettingsSearch',
				localize('extSettingsSearch', "扩展 ID..."),
				localize('extSettingsSearchTooltip', "添加扩展 ID 筛选器"),
				`@${EXTENSION_SETTING_TAG}`,
				true
			),
			this.createAction(
				'featuresSettingsSearch',
				localize('featureSettingsSearch', "功能..."),
				localize('featureSettingsSearchTooltip', "添加功能筛选器"),
				`@${FEATURE_SETTING_TAG}`,
				true
			),
			this.createAction(
				'tagSettingsSearch',
				localize('tagSettingsSearch', "标记..."),
				localize('tagSettingsSearchTooltip', "添加标记筛选器"),
				`@${GENERAL_TAG_SETTING_TAG}`,
				true
			),
			this.createAction(
				'langSettingsSearch',
				localize('langSettingsSearch', "语言..."),
				localize('langSettingsSearchTooltip', "添加语言 ID 筛选器"),
				`@${LANGUAGE_SETTING_TAG}`,
				true
			),
			this.createAction(
				'idSettingsSearch',
				localize('idSettingsSearch', "设置 ID..."),
				localize('idSettingsSearchTooltip', "添加设置 ID 筛选器"),
				`@${ID_SETTING_TAG}`,
				false
			),
			new Separator(),
			this.createToggleAction(
				'onlineSettingsSearch',
				localize('onlineSettingsSearch', "联机服务"),
				localize('onlineSettingsSearchTooltip', "显示联机服务设置"),
				'@tag:usesOnlineServices'
			),
			this.createToggleAction(
				'policySettingsSearch',
				localize('policySettingsSearch', "组织策略"),
				localize('policySettingsSearchTooltip', "显示组织策略设置"),
				`@${POLICY_SETTING_TAG}`
			),
			new Separator(),
			this.createMutuallyExclusiveToggleAction(
				'stableSettingsSearch',
				localize('stableSettings', "稳定"),
				localize('stableSettingsSearchTooltip', "显示稳定版设置"),
				`@stable`,
				['@tag:preview', '@tag:experimental']
			),
			this.createMutuallyExclusiveToggleAction(
				'previewSettingsSearch',
				localize('previewSettings', "预览"),
				localize('previewSettingsSearchTooltip', "显示预览设置"),
				`@tag:preview`,
				['@stable', '@tag:experimental']
			),
			this.createMutuallyExclusiveToggleAction(
				'experimentalSettingsSearch',
				localize('experimental', "实验性"),
				localize('experimentalSettingsSearchTooltip', "显示实验版设置"),
				`@tag:experimental`,
				['@stable', '@tag:preview']
			),
			new Separator(),
			this.createToggleAction(
				'advancedSettingsSearch',
				localize('advancedSettingsSearch', "高级"),
				localize('advancedSettingsSearchTooltip', "显示高级设置"),
				`@tag:${ADVANCED_SETTING_TAG}`,
			),
		];
	}
}
