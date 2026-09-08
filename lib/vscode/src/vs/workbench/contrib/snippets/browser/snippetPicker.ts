/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { ISnippetsService } from './snippets.js';
import { Snippet, SnippetSource } from './snippetsFile.js';
import { IQuickPickItem, IQuickInputService, QuickPickInput } from '../../../../platform/quickinput/common/quickInput.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Event } from '../../../../base/common/event.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';

export async function pickSnippet(accessor: ServicesAccessor, languageIdOrSnippets: string | Snippet[], resourceUri?: URI): Promise<Snippet | undefined> {

	const snippetService = accessor.get(ISnippetsService);
	const quickInputService = accessor.get(IQuickInputService);

	interface ISnippetPick extends IQuickPickItem {
		snippet: Snippet;
	}

	let snippets: Snippet[];
	if (Array.isArray(languageIdOrSnippets)) {
		snippets = languageIdOrSnippets;
	} else {
		snippets = (await snippetService.getSnippets(languageIdOrSnippets, resourceUri, { includeDisabledSnippets: true, includeNoPrefixSnippets: true }));
	}

	snippets.sort((a, b) => a.snippetSource - b.snippetSource);

	const makeSnippetPicks = () => {
		const result: QuickPickInput<ISnippetPick>[] = [];
		let prevSnippet: Snippet | undefined;
		for (const snippet of snippets) {
			const pick: ISnippetPick = {
				label: snippet.prefix || snippet.name,
				detail: snippet.description || snippet.body,
				snippet
			};
			if (!prevSnippet || prevSnippet.snippetSource !== snippet.snippetSource || prevSnippet.source !== snippet.source) {
				let label = '';
				switch (snippet.snippetSource) {
					case SnippetSource.User:
						label = nls.localize('sep.userSnippet', "用户代码片段");
						break;
					case SnippetSource.Extension:
						label = snippet.source;
						break;
					case SnippetSource.Workspace:
						label = nls.localize('sep.workspaceSnippet', "工作区代码片段");
						break;
				}
				result.push({ type: 'separator', label });
			}

			if (snippet.snippetSource === SnippetSource.Extension) {
				const isEnabled = snippetService.isEnabled(snippet);
				if (isEnabled) {
					pick.buttons = [{
						iconClass: ThemeIcon.asClassName(Codicon.eyeClosed),
						tooltip: nls.localize('disableSnippet', '从 IntelliSense 中隐藏')
					}];
				} else {
					pick.description = nls.localize('isDisabled', "(从 IntelliSense 中隐藏)");
					pick.buttons = [{
						iconClass: ThemeIcon.asClassName(Codicon.eye),
						tooltip: nls.localize('enable.snippet', '在 IntelliSense 中显示')
					}];
				}
			}

			result.push(pick);
			prevSnippet = snippet;
		}
		return result;
	};

	const disposables = new DisposableStore();
	const picker = disposables.add(quickInputService.createQuickPick<ISnippetPick>({ useSeparators: true }));
	picker.placeholder = nls.localize('pick.placeholder', "选择代码段");
	picker.matchOnDetail = true;
	picker.ignoreFocusOut = false;
	picker.keepScrollPosition = true;
	disposables.add(picker.onDidTriggerItemButton(ctx => {
		const isEnabled = snippetService.isEnabled(ctx.item.snippet);
		snippetService.updateEnablement(ctx.item.snippet, !isEnabled);
		picker.items = makeSnippetPicks();
	}));
	picker.items = makeSnippetPicks();
	if (!picker.items.length) {
		picker.validationMessage = nls.localize('pick.noSnippetAvailable', "没有可用的代码片段");
	}
	picker.show();

	// wait for an item to be picked or the picker to become hidden
	await Promise.race([Event.toPromise(picker.onDidAccept), Event.toPromise(picker.onDidHide)]);
	const result = picker.selectedItems[0]?.snippet;
	disposables.dispose();
	return result;
}
