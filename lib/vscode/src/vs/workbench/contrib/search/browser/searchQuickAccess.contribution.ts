/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';
import { AbstractGotoLineQuickAccessProvider } from '../../../../editor/contrib/quickAccess/browser/gotoLineQuickAccess.js';
import { Extensions as QuickAccessExtensions, IQuickAccessRegistry } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { defaultQuickAccessContextKeyValue } from '../../../browser/quickaccess.js';
import { GotoSymbolQuickAccessProvider } from '../../codeEditor/browser/quickaccess/gotoSymbolQuickAccess.js';
import { AnythingQuickAccessProvider } from './anythingQuickAccess.js';
import { SymbolsQuickAccessProvider } from './symbolsQuickAccess.js';
import './searchActionsSymbol.js';

const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);

quickAccessRegistry.registerQuickAccessProvider({
	ctor: AnythingQuickAccessProvider,
	prefix: AnythingQuickAccessProvider.PREFIX,
	placeholder: nls.localize('anythingQuickAccessPlaceholder', "按名称搜索文件(追加 {0} 转到行，追加 {1} 转到符号)", AbstractGotoLineQuickAccessProvider.GO_TO_LINE_PREFIX, GotoSymbolQuickAccessProvider.PREFIX),
	contextKey: defaultQuickAccessContextKeyValue,
	helpEntries: [{
		description: nls.localize('anythingQuickAccess', "转到文件"),
		commandId: 'workbench.action.quickOpen',
		commandCenterOrder: 10
	}]
});

quickAccessRegistry.registerQuickAccessProvider({
	ctor: SymbolsQuickAccessProvider,
	prefix: SymbolsQuickAccessProvider.PREFIX,
	placeholder: nls.localize('symbolsQuickAccessPlaceholder', "键入要打开的符号的名称。"),
	contextKey: 'inWorkspaceSymbolsPicker',
	helpEntries: [{ description: nls.localize('symbolsQuickAccess', "转到工作区中的符号"), commandId: 'workbench.action.showAllSymbols' }]
});
