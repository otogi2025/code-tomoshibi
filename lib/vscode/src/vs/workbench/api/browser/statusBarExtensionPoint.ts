/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { IJSONSchema, TypeFromJsonSchema } from '../../../base/common/jsonSchema.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../services/extensions/common/extensionsRegistry.js';
import { IStatusbarService, StatusbarAlignment as MainThreadStatusBarAlignment, IStatusbarEntryAccessor, IStatusbarEntry, StatusbarAlignment, IStatusbarEntryPriority, StatusbarEntryKind } from '../../services/statusbar/browser/statusbar.js';
import { ThemeColor } from '../../../base/common/themables.js';
import { Command } from '../../../editor/common/languages.js';
import { IAccessibilityInformation, isAccessibilityInformation } from '../../../platform/accessibility/common/accessibility.js';
import { IMarkdownString, isMarkdownString } from '../../../base/common/htmlContent.js';
import { getCodiconAriaLabel } from '../../../base/common/iconLabels.js';
import { hash } from '../../../base/common/hash.js';
import { Event, Emitter } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { Iterable } from '../../../base/common/iterator.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { asStatusBarItemIdentifier } from '../common/extHostTypes.js';
import { STATUS_BAR_ERROR_ITEM_BACKGROUND, STATUS_BAR_WARNING_ITEM_BACKGROUND } from '../../common/theme.js';
import { IManagedHoverTooltipMarkdownString } from '../../../base/browser/ui/hover/hover.js';


// --- service

export const IExtensionStatusBarItemService = createDecorator<IExtensionStatusBarItemService>('IExtensionStatusBarItemService');

export interface IExtensionStatusBarItemChangeEvent {
	readonly added?: ExtensionStatusBarEntry;
	readonly removed?: string;
}

export type ExtensionStatusBarEntry = [string, {
	entry: IStatusbarEntry;
	alignment: MainThreadStatusBarAlignment;
	priority: number;
}];

export const enum StatusBarUpdateKind {
	DidDefine,
	DidUpdate
}

export interface IExtensionStatusBarItemService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<IExtensionStatusBarItemChangeEvent>;

	setOrUpdateEntry(id: string, statusId: string, extensionId: string | undefined, name: string, text: string, tooltip: IMarkdownString | string | undefined | IManagedHoverTooltipMarkdownString, command: Command | undefined, color: string | ThemeColor | undefined, backgroundColor: ThemeColor | undefined, alignLeft: boolean, priority: number | undefined, accessibilityInformation: IAccessibilityInformation | undefined): StatusBarUpdateKind;

	unsetEntry(id: string): void;

	getEntries(): Iterable<ExtensionStatusBarEntry>;
}


class ExtensionStatusBarItemService implements IExtensionStatusBarItemService {

	declare readonly _serviceBrand: undefined;

	private readonly _entries: Map<string, { accessor: IStatusbarEntryAccessor; entry: IStatusbarEntry; alignment: MainThreadStatusBarAlignment; priority: number; disposable: IDisposable }> = new Map();

	private readonly _onDidChange = new Emitter<IExtensionStatusBarItemChangeEvent>();
	readonly onDidChange: Event<IExtensionStatusBarItemChangeEvent> = this._onDidChange.event;

	constructor(@IStatusbarService private readonly _statusbarService: IStatusbarService) { }

	dispose(): void {
		this._entries.forEach(entry => entry.accessor.dispose());
		this._entries.clear();
		this._onDidChange.dispose();
	}

	setOrUpdateEntry(entryId: string,
		id: string, extensionId: string | undefined, name: string, text: string,
		tooltip: IMarkdownString | string | undefined | IManagedHoverTooltipMarkdownString,
		command: Command | undefined, color: string | ThemeColor | undefined, backgroundColor: ThemeColor | undefined,
		alignLeft: boolean, priority: number | undefined, accessibilityInformation: IAccessibilityInformation | undefined
	): StatusBarUpdateKind {
		// if there are icons in the text use the tooltip for the aria label
		let ariaLabel: string;
		let role: string | undefined = undefined;
		if (accessibilityInformation) {
			ariaLabel = accessibilityInformation.label;
			role = accessibilityInformation.role;
		} else {
			ariaLabel = getCodiconAriaLabel(text);
			if (typeof tooltip === 'string' || isMarkdownString(tooltip)) {
				const tooltipString = typeof tooltip === 'string' ? tooltip : tooltip.value;
				ariaLabel += `, ${tooltipString}`;
			}
		}
		let kind: StatusbarEntryKind | undefined = undefined;
		switch (backgroundColor?.id) {
			case STATUS_BAR_ERROR_ITEM_BACKGROUND:
			case STATUS_BAR_WARNING_ITEM_BACKGROUND:
				// override well known colors that map to status entry kinds to support associated themable hover colors
				kind = backgroundColor.id === STATUS_BAR_ERROR_ITEM_BACKGROUND ? 'error' : 'warning';
				color = undefined;
				backgroundColor = undefined;
		}
		const entry: IStatusbarEntry = { name, text, tooltip, command, color, backgroundColor, ariaLabel, role, kind, extensionId };

		if (typeof priority === 'undefined') {
			priority = 0;
		}

		let alignment = alignLeft ? StatusbarAlignment.LEFT : StatusbarAlignment.RIGHT;

		// alignment and priority can only be set once (at creation time)
		const existingEntry = this._entries.get(entryId);
		if (existingEntry) {
			alignment = existingEntry.alignment;
			priority = existingEntry.priority;
		}

		// Create new entry if not existing
		if (!existingEntry) {
			let entryPriority: number | IStatusbarEntryPriority;
			if (typeof extensionId === 'string') {
				// We cannot enforce unique priorities across all extensions, so we
				// use the extension identifier as a secondary sort key to reduce
				// the likelyhood of collisions.
				// See https://github.com/microsoft/vscode/issues/177835
				// See https://github.com/microsoft/vscode/issues/123827
				entryPriority = { primary: priority, secondary: hash(extensionId) };
			} else {
				entryPriority = priority;
			}

			const accessor = this._statusbarService.addEntry(entry, id, alignment, entryPriority);
			this._entries.set(entryId, {
				accessor,
				entry,
				alignment,
				priority,
				disposable: toDisposable(() => {
					accessor.dispose();
					this._entries.delete(entryId);
					this._onDidChange.fire({ removed: entryId });
				})
			});

			this._onDidChange.fire({ added: [entryId, { entry, alignment, priority }] });
			return StatusBarUpdateKind.DidDefine;

		} else {
			// Otherwise update
			existingEntry.accessor.update(entry);
			existingEntry.entry = entry;
			return StatusBarUpdateKind.DidUpdate;
		}
	}

	unsetEntry(entryId: string): void {
		this._entries.get(entryId)?.disposable.dispose();
		this._entries.delete(entryId);
	}

	getEntries(): Iterable<[string, { entry: IStatusbarEntry; alignment: MainThreadStatusBarAlignment; priority: number }]> {
		return this._entries.entries();
	}
}

registerSingleton(IExtensionStatusBarItemService, ExtensionStatusBarItemService, InstantiationType.Delayed);

// --- extension point and reading of it

type IUserFriendlyStatusItemEntry = TypeFromJsonSchema<typeof statusBarItemSchema>;

function isUserFriendlyStatusItemEntry(candidate: unknown): candidate is IUserFriendlyStatusItemEntry {
	const obj = candidate as IUserFriendlyStatusItemEntry;
	return (typeof obj.id === 'string' && obj.id.length > 0)
		&& typeof obj.name === 'string'
		&& typeof obj.text === 'string'
		&& (obj.alignment === 'left' || obj.alignment === 'right')
		&& (obj.command === undefined || typeof obj.command === 'string')
		&& (obj.tooltip === undefined || typeof obj.tooltip === 'string')
		&& (obj.priority === undefined || typeof obj.priority === 'number')
		&& (obj.accessibilityInformation === undefined || isAccessibilityInformation(obj.accessibilityInformation))
		;
}

const statusBarItemSchema = {
	type: 'object',
	required: ['id', 'text', 'alignment', 'name'],
	properties: {
		id: {
			type: 'string',
			markdownDescription: localize('id', '状态栏条目的标识符。在扩展中必须具有唯一性。调用 "vscode.window.createStatusBarItem(id, ...)"-API 时必须使用相同的值')
		},
		name: {
			type: 'string',
			description: localize('name', '条目名称，例如“Python 语言指示器”、“Git 状态”等。尽量使名称长度保持较短，但其描述性足以让用户了解状态栏项包含的内容。')
		},
		text: {
			type: 'string',
			description: localize('text', '要为该条目显示的文本。可以使用 `\\$(<name>)`- 语法(例如 \'Hello {0}!\')在文本中嵌入图标', '$(globe)')
		},
		tooltip: {
			type: 'string',
			description: localize('tooltip', '条目的工具提示文本。')
		},
		command: {
			type: 'string',
			description: localize('command', '点击状态栏条目时要执行的命令。')
		},
		alignment: {
			type: 'string',
			enum: ['left', 'right'],
			description: localize('alignment', '状态栏条目的对齐方式。')
		},
		priority: {
			type: 'number',
			description: localize('priority', '状态栏条目的优先级。值越高，意味着应在左侧显示更多项。')
		},
		accessibilityInformation: {
			type: 'object',
			description: localize('accessibilityInformation', '定义在状态栏条目聚焦时要使用的角色和 aria 标签。'),
			required: ['label'],
			properties: {
				role: {
					type: 'string',
					description: localize('accessibilityInformation.role', '定义屏幕阅读器如何与其交互的状态栏条目的角色。有关 aria 角色的详细信息，请参阅此处 https://w3c.github.io/aria/#widget_roles')
				},
				label: {
					type: 'string',
					description: localize('accessibilityInformation.label', '状态栏条目的 aria 标签。默认为条目的文本。')
				}
			}
		}
	}
} as const satisfies IJSONSchema;

const statusBarItemsSchema: IJSONSchema = {
	description: localize('vscode.extension.contributes.statusBarItems', "将项目贡献到状态栏。"),
	oneOf: [
		statusBarItemSchema,
		{
			type: 'array',
			items: statusBarItemSchema
		}
	]
};

const statusBarItemsExtensionPoint = ExtensionsRegistry.registerExtensionPoint<IUserFriendlyStatusItemEntry | IUserFriendlyStatusItemEntry[]>({
	extensionPoint: 'statusBarItems',
	jsonSchema: statusBarItemsSchema,
});

export class StatusBarItemsExtensionPoint {

	constructor(@IExtensionStatusBarItemService statusBarItemsService: IExtensionStatusBarItemService) {

		const contributions = new DisposableStore();

		statusBarItemsExtensionPoint.setHandler((extensions) => {

			contributions.clear();

			for (const entry of extensions) {

				if (!isProposedApiEnabled(entry.description, 'contribStatusBarItems')) {
					entry.collector.error(`The ${statusBarItemsExtensionPoint.name} is proposed API`);
					continue;
				}

				const { value, collector } = entry;

				for (const candidate of Iterable.wrap(value)) {
					if (!isUserFriendlyStatusItemEntry(candidate)) {
						collector.error(localize('invalid', "状态栏项贡献无效。"));
						continue;
					}

					const fullItemId = asStatusBarItemIdentifier(entry.description.identifier, candidate.id);

					const kind = statusBarItemsService.setOrUpdateEntry(
						fullItemId,
						fullItemId,
						ExtensionIdentifier.toKey(entry.description.identifier),
						candidate.name ?? entry.description.displayName ?? entry.description.name,
						candidate.text,
						candidate.tooltip,
						candidate.command ? { id: candidate.command, title: candidate.name } : undefined,
						undefined, undefined,
						candidate.alignment === 'left',
						candidate.priority,
						candidate.accessibilityInformation
					);

					if (kind === StatusBarUpdateKind.DidDefine) {
						contributions.add(toDisposable(() => statusBarItemsService.unsetEntry(fullItemId)));
					}
				}
			}
		});
	}
}
