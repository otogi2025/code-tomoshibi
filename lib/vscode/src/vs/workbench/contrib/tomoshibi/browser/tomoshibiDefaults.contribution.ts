/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { TerminalSettingId } from '../../../../platform/terminal/common/terminal.js';
import { LayoutSettings } from '../../../services/layout/browser/layoutService.js';
import { ThemeSettings, ThemeSettingDefaults } from '../../../services/themes/common/workbenchThemeService.js';

/**
 * Product defaults for Code-Tomoshibi.
 *
 * These settings are not personal preferences: they are what makes the product
 * behave like itself on a fresh install (an iPad opening straight into a terminal
 * that keeps running while the tab is away). They used to live in a hand written
 * `settings.json` on each deployment, which meant a new instance silently behaved
 * like stock VS Code Web.
 *
 * They are registered through the same channel an extension uses for
 * `configurationDefaults`, so a user `settings.json` still overrides every one of
 * them. Registration happens at module evaluation time (this file is imported from
 * `workbench.web.main.ts`), before any service reads configuration; the registry
 * also applies overrides to properties registered later, so import order does not
 * matter.
 *
 * `terminal.integrated.persistentSessionScrollback` / `terminal.integrated.cursorStyle`
 * are not registered here: their schema defaults already are the values this product
 * wants. The first one also has a second, independent reader — the pty host is started
 * with the replay buffer read in `server/node/serverServices.ts`, in the server process,
 * where nothing on this list applies — so changing that number means going there.
 */
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations([{
	overrides: {

		// iPad Safari corrupts the WebGL glyph atlas after the file picker returns or
		// the viewport changes, which makes large runs of characters disappear.
		[TerminalSettingId.GpuAcceleration]: 'off',

		// "Claude on the left, text on the right".
		'workbench.panel.defaultLocation': 'left',

		// Drop the title bar search box, the AI icon and the layout toggles: one less
		// row on a small screen.
		[LayoutSettings.COMMAND_CENTER]: false,
		[LayoutSettings.LAYOUT_ACTIONS]: false,

		// Closing an iPad tab counts as a window close, so the session has to survive it.
		[TerminalSettingId.PersistentSessionReviveProcess]: 'onExitAndWindowClose',

		// An agent can print a lot in one go.
		[TerminalSettingId.Scrollback]: 10000,

		// Touch selection copies, and there is no right mouse button to open a menu with.
		[TerminalSettingId.CopyOnSelection]: true,
		[TerminalSettingId.RightClickBehavior]: 'paste',

		// Every animation Safari does not have to paint is battery and latency saved.
		'workbench.reduceMotion': 'on',

		// The web schema defaults to `Light 2026` (`themeConfiguration.ts`), while this
		// product ships a dark UI and only offers these two themes in its settings.
		[ThemeSettings.COLOR_THEME]: ThemeSettingDefaults.COLOR_THEME_DARK,

		// Workspace Trust is switched off with `--disable-workspace-trust`, so every workspace
		// counts as trusted and upstream stops asking before following a link out of a file.
		// Ask anyway: the confirmation is the only thing left between a link in someone else's
		// repository and the browser.
		'workbench.trustedDomains.promptInTrustedWorkspace': true,
	}
}]);
