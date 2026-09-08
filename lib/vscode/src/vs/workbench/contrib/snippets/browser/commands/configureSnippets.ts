/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isValidBasename } from '../../../../../base/common/extpath.js';
import { extname } from '../../../../../base/common/path.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { getIconClassesForLanguageId } from '../../../../../editor/common/services/getIconClasses.js';
import * as nls from '../../../../../nls.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from '../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { SnippetsAction } from './abstractSnippetsActions.js';
import { ISnippetsService } from '../snippets.js';
import { SnippetSource } from '../snippetsFile.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';

namespace ISnippetPick {
	export function is(thing: object | undefined): thing is ISnippetPick {
		return !!thing && URI.isUri((<ISnippetPick>thing).filepath);
	}
}

interface ISnippetPick extends IQuickPickItem {
	filepath: URI;
	hint?: true;
}

async function computePicks(snippetService: ISnippetsService, userDataProfileService: IUserDataProfileService, languageService: ILanguageService, labelService: ILabelService) {

	const existing: ISnippetPick[] = [];
	const future: ISnippetPick[] = [];

	const seen = new Set<string>();
	const added = new Map<string, { snippet: ISnippetPick; detail: string }>();

	for (const file of await snippetService.getSnippetFiles()) {

		if (file.source === SnippetSource.Extension) {
			// skip extension snippets
			continue;
		}

		if (file.isGlobalSnippets) {

			await file.load();

			// list scopes for global snippets
			const names = new Set<string>();
			let source: string | undefined;

			outer: for (const snippet of file.data) {
				if (!source) {
					source = snippet.source;
				}

				for (const scope of snippet.scopes) {
					const name = languageService.getLanguageName(scope);
					if (name) {
						if (names.size >= 4) {
							names.add(`${name}...`);
							break outer;
						} else {
							names.add(name);
						}
					}
				}
			}

			const snippet: ISnippetPick = {
				label: basename(file.location),
				filepath: file.location,
				description: names.size === 0
					? nls.localize('global.scope', "(全局)")
					: nls.localize('global.1', "({0})", [...names].join(', '))
			};
			existing.push(snippet);

			if (!source) {
				continue;
			}

			const detail = nls.localize('detail.label', "({0}) {1}", source, labelService.getUriLabel(file.location, { relative: true }));
			const lastItem = added.get(basename(file.location));
			if (lastItem) {
				snippet.detail = detail;
				lastItem.snippet.detail = lastItem.detail;
			}
			added.set(basename(file.location), { snippet, detail });

		} else {
			// language snippet
			const mode = basename(file.location).replace(/\.json$/, '');
			existing.push({
				label: basename(file.location),
				description: `(${languageService.getLanguageName(mode) ?? mode})`,
				filepath: file.location
			});
			seen.add(mode);
		}
	}

	const dir = userDataProfileService.currentProfile.snippetsHome;
	for (const languageId of languageService.getRegisteredLanguageIds()) {
		const label = languageService.getLanguageName(languageId);
		if (label && !seen.has(languageId)) {
			future.push({
				label: languageId,
				description: `(${label})`,
				filepath: joinPath(dir, `${languageId}.json`),
				hint: true,
				iconClasses: getIconClassesForLanguageId(languageId)
			});
		}
	}

	existing.sort((a, b) => {
		const a_ext = extname(a.filepath.path);
		const b_ext = extname(b.filepath.path);
		if (a_ext === b_ext) {
			return a.label.localeCompare(b.label);
		} else if (a_ext === '.code-snippets') {
			return -1;
		} else {
			return 1;
		}
	});

	future.sort((a, b) => {
		return a.label.localeCompare(b.label);
	});

	return { existing, future };
}

async function createSnippetFile(scope: string, defaultPath: URI, quickInputService: IQuickInputService, fileService: IFileService, textFileService: ITextFileService, opener: IOpenerService) {

	function createSnippetUri(input: string) {
		const filename = extname(input) !== '.code-snippets'
			? `${input}.code-snippets`
			: input;
		return joinPath(defaultPath, filename);
	}

	await fileService.createFolder(defaultPath);

	const input = await quickInputService.input({
		placeHolder: nls.localize('name', "键入代码段文件名"),
		async validateInput(input) {
			if (!input) {
				return nls.localize('bad_name1', "无效的文件名");
			}
			if (!isValidBasename(input)) {
				return nls.localize('bad_name2', "“{0}”不是有效的文件名", input);
			}
			if (await fileService.exists(createSnippetUri(input))) {
				return nls.localize('bad_name3', "“{0}”已存在", input);
			}
			return undefined;
		}
	});

	if (!input) {
		return undefined;
	}

	const resource = createSnippetUri(input);

	await textFileService.write(resource, [
		'{',
		'\t// Place your ' + scope + ' snippets here. Each snippet is defined under a snippet name and has a scope, prefix, body and ',
		'\t// description. Add comma separated ids of the languages where the snippet is applicable in the scope field. If scope ',
		'\t// is left empty or omitted, the snippet gets applied to all languages. The prefix is what is ',
		'\t// used to trigger the snippet and the body will be expanded and inserted. Possible variables are: ',
		'\t// $1, $2 for tab stops, $0 for the final cursor position, and ${1:label}, ${2:another} for placeholders. ',
		'\t// Placeholders with the same ids are connected.',
		'\t// Example:',
		'\t// "Print to console": {',
		'\t// \t"scope": "javascript,typescript",',
		'\t// \t"prefix": "log",',
		'\t// \t"body": [',
		'\t// \t\t"console.log(\'$1\');",',
		'\t// \t\t"$2"',
		'\t// \t],',
		'\t// \t"description": "Log output to console"',
		'\t// }',
		'\t//',
		'\t// You can also restrict snippets to specific files using include/exclude patterns:',
		'\t// "Test snippet": {',
		'\t// \t"scope": "javascript,typescript",',
		'\t// \t"prefix": "test",',
		'\t// \t"body": "test(\'$1\', () => {\\n\\t$0\\n});",',
		'\t// \t"include": ["**/*.test.ts", "*.spec.ts"],',
		'\t// \t"exclude": ["**/temp/*.ts"],',
		'\t// \t"description": "Insert test block"',
		'\t// }',
		'}'
	].join('\n'));

	await opener.open(resource);
	return undefined;
}

async function createLanguageSnippetFile(pick: ISnippetPick, fileService: IFileService, textFileService: ITextFileService) {
	if (await fileService.exists(pick.filepath)) {
		return;
	}
	const contents = [
		'{',
		'\t// Place your snippets for ' + pick.label + ' here. Each snippet is defined under a snippet name and has a prefix, body and ',
		'\t// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:',
		'\t// $1, $2 for tab stops, $0 for the final cursor position, and ${1:label}, ${2:another} for placeholders. Placeholders with the ',
		'\t// same ids are connected.',
		'\t// Example:',
		'\t// "Print to console": {',
		'\t// \t"prefix": "log",',
		'\t// \t"body": [',
		'\t// \t\t"console.log(\'$1\');",',
		'\t// \t\t"$2"',
		'\t// \t],',
		'\t// \t"description": "Log output to console"',
		'\t// }',
		'\t//',
		'\t// You can also restrict snippets to specific files using include/exclude patterns:',
		'\t// "Test snippet": {',
		'\t// \t"prefix": "test",',
		'\t// \t"body": "test(\'$1\', () => {\\n\\t$0\\n});",',
		'\t// \t"include": ["**/*.test.ts", "*.spec.ts"],',
		'\t// \t"exclude": ["**/temp/*.ts"],',
		'\t// \t"description": "Insert test block"',
		'\t// }',
		'}'
	].join('\n');
	await textFileService.write(pick.filepath, contents);
}

export class ConfigureSnippetsAction extends SnippetsAction {
	constructor() {
		super({
			id: 'workbench.action.openSnippets',
			title: nls.localize2('openSnippet.label', "配置代码片段"),
			shortTitle: {
				...nls.localize2('userSnippets', "代码片段"),
				mnemonicTitle: nls.localize({ key: 'miOpenSnippets', comment: ['&& denotes a mnemonic'] }, "代码片段(&&S)"),
			},
			f1: true,
			menu: [
				{ id: MenuId.MenubarPreferencesMenu, group: '2_configuration', order: 5 },
				{ id: MenuId.GlobalActivity, group: '2_configuration', order: 5 },
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<any> {

		const snippetService = accessor.get(ISnippetsService);
		const quickInputService = accessor.get(IQuickInputService);
		const opener = accessor.get(IOpenerService);
		const languageService = accessor.get(ILanguageService);
		const userDataProfileService = accessor.get(IUserDataProfileService);
		const workspaceService = accessor.get(IWorkspaceContextService);
		const fileService = accessor.get(IFileService);
		const textFileService = accessor.get(ITextFileService);
		const labelService = accessor.get(ILabelService);

		const picks = await computePicks(snippetService, userDataProfileService, languageService, labelService);
		const existing: QuickPickInput[] = picks.existing;

		type SnippetPick = IQuickPickItem & { uri: URI } & { scope: string };
		const globalSnippetPicks: SnippetPick[] = [{
			scope: nls.localize('new.global_scope', '全局'),
			label: nls.localize('new.global', "新建全局代码片段文件..."),
			uri: userDataProfileService.currentProfile.snippetsHome
		}];

		const workspaceSnippetPicks: SnippetPick[] = [];
		for (const folder of workspaceService.getWorkspace().folders) {
			workspaceSnippetPicks.push({
				scope: nls.localize('new.workspace_scope', "{0} 工作区", folder.name),
				label: nls.localize('new.folder', "新建“{0}”文件夹的代码片段文件...", folder.name),
				uri: folder.toResource('.vscode')
			});
		}

		if (existing.length > 0) {
			existing.unshift({ type: 'separator', label: nls.localize('group.global', "现有代码片段") });
			existing.push({ type: 'separator', label: nls.localize('new.global.sep', "新代码片段") });
		} else {
			existing.push({ type: 'separator', label: nls.localize('new.global.sep', "新代码片段") });
		}

		const pick = await quickInputService.pick(([] as QuickPickInput[]).concat(existing, globalSnippetPicks, workspaceSnippetPicks, picks.future), {
			placeHolder: nls.localize('openSnippet.pickLanguage', "选择代码片段文件或创建代码片段"),
			matchOnDescription: true
		});

		if (globalSnippetPicks.indexOf(pick as SnippetPick) >= 0) {
			return createSnippetFile((pick as SnippetPick).scope, (pick as SnippetPick).uri, quickInputService, fileService, textFileService, opener);
		} else if (workspaceSnippetPicks.indexOf(pick as SnippetPick) >= 0) {
			return createSnippetFile((pick as SnippetPick).scope, (pick as SnippetPick).uri, quickInputService, fileService, textFileService, opener);
		} else if (ISnippetPick.is(pick)) {
			if (pick.hint) {
				await createLanguageSnippetFile(pick, fileService, textFileService);
			}
			return opener.open(pick.filepath);
		}

	}
}
