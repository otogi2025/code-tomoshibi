/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { IConfigBasedExtensionTip as IRawConfigBasedExtensionTip } from '../../../base/common/product.js';
import { joinPath } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { IConfigBasedExtensionTip, IExecutableBasedExtensionTip, IExtensionTipsService } from './extensionManagement.js';
import { IFileService } from '../../files/common/files.js';
import { IProductService } from '../../product/common/productService.js';

//#region Base Extension Tips Service

export class ExtensionTipsService extends Disposable implements IExtensionTipsService {

	_serviceBrand: undefined;

	private readonly allConfigBasedTips: Map<string, IRawConfigBasedExtensionTip> = new Map<string, IRawConfigBasedExtensionTip>();

	constructor(
		@IFileService protected readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
	) {
		super();
		if (this.productService.configBasedExtensionTips) {
			Object.entries(this.productService.configBasedExtensionTips).forEach(([, value]) => this.allConfigBasedTips.set(value.configPath, value));
		}
	}

	getConfigBasedTips(folder: URI): Promise<IConfigBasedExtensionTip[]> {
		return this.getValidConfigBasedTips(folder);
	}

	async getImportantExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> {
		return [];
	}

	async getOtherExecutableBasedTips(): Promise<IExecutableBasedExtensionTip[]> {
		return [];
	}

	private async getValidConfigBasedTips(folder: URI): Promise<IConfigBasedExtensionTip[]> {
		const result: IConfigBasedExtensionTip[] = [];
		for (const [configPath, tip] of this.allConfigBasedTips) {
			if (tip.configScheme && tip.configScheme !== folder.scheme) {
				continue;
			}
			try {
				const content = (await this.fileService.readFile(joinPath(folder, configPath))).value.toString();
				for (const [key, value] of Object.entries(tip.recommendations)) {
					if (!value.contentPattern || new RegExp(value.contentPattern, 'mig').test(content)) {
						result.push({
							extensionId: key,
							extensionName: value.name,
							configName: tip.configName,
							important: !!value.important,
							isExtensionPack: !!value.isExtensionPack,
							whenNotInstalled: value.whenNotInstalled
						});
					}
				}
			} catch (error) { /* Ignore */ }
		}
		return result;
	}
}

//#endregion
