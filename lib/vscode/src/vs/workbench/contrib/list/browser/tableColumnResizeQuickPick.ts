/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { Table } from '../../../../base/browser/ui/table/tableWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { localize } from '../../../../nls.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';

interface IColumnResizeQuickPickItem extends IQuickPickItem {
	index: number;
}

export class TableColumnResizeQuickPick extends Disposable {
	constructor(
		private readonly _table: Table<unknown>,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
	) {
		super();
	}

	async show(): Promise<void> {
		const items: IColumnResizeQuickPickItem[] = [];
		this._table.getColumnLabels().forEach((label, index) => {
			if (label) {
				items.push({ label, index });
			}
		});
		const column = await this._quickInputService.pick<IColumnResizeQuickPickItem>(items, { placeHolder: localize('table.column.selection', "选择要调整大小的列，键入以进行筛选。") });
		if (!column) {
			return;
		}
		const value = await this._quickInputService.input({
			placeHolder: localize('table.column.resizeValue.placeHolder', "即 20、60、100..."),
			prompt: localize('table.column.resizeValue.prompt', "请输入“{0}”列的宽度(以百分比表示)。", column.label),
			validateInput: (input: string) => this._validateColumnResizeValue(input)
		});
		const percentageValue = value ? Number.parseInt(value) : undefined;
		if (!percentageValue) {
			return;
		}
		this._table.resizeColumn(column.index, percentageValue);
	}

	private async _validateColumnResizeValue(input: string): Promise<string | { content: string; severity: Severity } | null | undefined> {
		const percentage = Number.parseInt(input);
		if (input && !Number.isInteger(percentage)) {
			return localize('table.column.resizeValue.invalidType', "请输入一个整数。");
		} else if (percentage < 0 || percentage > 100) {
			return localize('table.column.resizeValue.invalidRange', "请输入一个大于 0 且小于等于 100 的数字。");
		}
		return null;
	}
}
