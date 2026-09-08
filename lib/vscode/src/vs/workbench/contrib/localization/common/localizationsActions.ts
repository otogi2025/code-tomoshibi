/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize, localize2 } from '../../../../nls.js';
import { IQuickInputService, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILanguagePackItem, ILanguagePackService } from '../../../../platform/languagePacks/common/languagePacks.js';
import { ILocaleService } from '../../../services/localization/common/locale.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';

export class ConfigureDisplayLanguageAction extends Action2 {
	public static readonly ID = 'workbench.action.configureLocale';

	constructor() {
		super({
			id: ConfigureDisplayLanguageAction.ID,
			title: localize2('configureLocale', "配置显示语言"),
			menu: {
				id: MenuId.CommandPalette
			},
			metadata: {
				description: localize2('configureLocaleDescription', "根据已安装的语言包更改 VS Code 的区域设置。常用语言包括法语、中文、西班牙语、日语、德语、朝鲜语等。")
			}
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const languagePackService: ILanguagePackService = accessor.get(ILanguagePackService);
		const quickInputService: IQuickInputService = accessor.get(IQuickInputService);
		const localeService: ILocaleService = accessor.get(ILocaleService);
		const extensionWorkbenchService: IExtensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);

		const installedLanguages = await languagePackService.getInstalledLanguages();

		const disposables = new DisposableStore();
		const qp = disposables.add(quickInputService.createQuickPick<ILanguagePackItem>({ useSeparators: true }));
		qp.matchOnDescription = true;
		qp.placeholder = localize('chooseLocale', "选择显示语言");

		if (installedLanguages?.length) {
			const items: Array<ILanguagePackItem | IQuickPickSeparator> = [{ type: 'separator', label: localize('installed', "已安装") }];
			qp.items = items.concat(this.withMoreInfoButton(installedLanguages));
		}

		disposables.add(qp.onDidHide(() => {
			disposables.dispose();
		}));

		const installedSet = new Set<string>(installedLanguages?.map(language => language.id!) ?? []);
		languagePackService.getAvailableLanguages().then(availableLanguages => {
			const newLanguages = availableLanguages.filter(l => l.id && !installedSet.has(l.id));
			if (newLanguages.length) {
				qp.items = [
					...qp.items,
					{ type: 'separator', label: localize('available', "可用") },
					...this.withMoreInfoButton(newLanguages)
				];
			}
			qp.busy = false;
		});

		disposables.add(qp.onDidAccept(async () => {
			const selectedLanguage = qp.activeItems[0] as ILanguagePackItem | undefined;
			if (selectedLanguage) {
				qp.hide();
				await localeService.setLocale(selectedLanguage);
			}
		}));

		disposables.add(qp.onDidTriggerItemButton(async e => {
			qp.hide();
			if (e.item.extensionId) {
				await extensionWorkbenchService.open(e.item.extensionId);
			}
		}));

		qp.show();
		qp.busy = true;
	}

	private withMoreInfoButton(items: ILanguagePackItem[]): ILanguagePackItem[] {
		for (const item of items) {
			if (item.extensionId) {
				item.buttons = [{
					tooltip: localize('moreInfo', "详细信息"),
					iconClass: 'codicon-info'
				}];
			}
		}
		return items;
	}
}

export class ClearDisplayLanguageAction extends Action2 {
	public static readonly ID = 'workbench.action.clearLocalePreference';
	public static readonly LABEL = localize2('clearDisplayLanguage', "清除显示语言首选项");

	constructor() {
		super({
			id: ClearDisplayLanguageAction.ID,
			title: ClearDisplayLanguageAction.LABEL,
			menu: {
				id: MenuId.CommandPalette
			}
		});
	}

	public async run(accessor: ServicesAccessor): Promise<void> {
		const localeService: ILocaleService = accessor.get(ILocaleService);
		await localeService.clearLocalePreference();
	}
}
