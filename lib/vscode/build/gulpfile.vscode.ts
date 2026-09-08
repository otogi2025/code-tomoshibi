/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { gulp } from './lib/gulp/facade.ts';
import * as path from 'path';
import es from 'event-stream';
import vfs from 'vinyl-fs';
import { getVersion } from './lib/getVersion.ts';
import { writeISODate } from './lib/date.ts';
import * as task from './lib/gulp/task.ts';
import * as i18n from './lib/i18n.ts';
import minimist from 'minimist';
import { compileNonNativeExtensionsBuildTask, compileAllExtensionsBuildTask, compileExtensionMediaBuildTask } from './gulpfile.extensions.ts';
import { copyCodiconsTask } from './lib/compilation.ts';
import { spawnTsgo } from './lib/tsgo.ts';
import { runEsbuildTranspile, runEsbuildBundle } from './lib/esbuild.ts';

const root = path.dirname(import.meta.dirname);
const commit = getVersion(root);
const sourceMappingURLBase = `https://main.vscode-cdn.net/sourcemaps/${commit}`;

// tomoshibi: the desktop packaging pipeline is gone. Everything that used to live between the
// imports and `core-ci` -- the per-platform BUILD_TARGETS loop, packageTask, the win32
// authenticode helpers, the asar/electron packaging and the `bundle-vscode` / `minify-vscode` /
// `core-ci-old` tasks -- existed only to ship an Electron desktop app. Codet ships a server and a
// web bundle, built through `core-ci` below (ci/build/build-vscode.sh:169), which is the only task
// in this file anything outside it still calls. Their entry points also pointed at
// vs/code/electron-browser/*, whose sources were deleted earlier, so they were already dead.

task.task(task.define('core-ci', task.series(
	copyCodiconsTask,
	compileNonNativeExtensionsBuildTask,
	compileExtensionMediaBuildTask,
	writeISODate('out-build'),
	// Type-check with tsgo (no emit)
	task.define('tsgo-typecheck', () => spawnTsgo(path.join(root, 'src', 'tsconfig.json'), { taskName: 'tsgo-typecheck', noEmit: true })),
	// Transpile individual files to out-build first (for unit tests)
	task.define('esbuild-out-build', () => runEsbuildTranspile('out-build', false)),
	// Then bundle for shipping (bundles also write NLS files to out-build)
	task.parallel(
		// tomoshibi: desktop bundle removed — electron-* sources are deleted, codet only ships server/server-web
		task.define('esbuild-vscode-reh-min', () => runEsbuildBundle('out-vscode-reh-min', true, true, 'server', `${sourceMappingURLBase}/core`)),
		task.define('esbuild-vscode-reh-web-min', () => runEsbuildBundle('out-vscode-reh-web-min', true, true, 'server-web', `${sourceMappingURLBase}/core`)),
	)
)));

// #region nls

task.task(task.define(
	'vscode-translations-export',
	task.series(
		task.task('core-ci') as task.Task,
		compileAllExtensionsBuildTask,
		function () {
			const pathToMetadata = './out-build/nls.metadata.json';
			const pathToExtensions = '.build/extensions/*';
			const pathToSetup = 'build/win32/i18n/messages.en.isl';

			return es.merge(
				gulp.src(pathToMetadata).pipe(i18n.createXlfFilesForCoreBundle()),
				gulp.src(pathToSetup).pipe(i18n.createXlfFilesForIsl()),
				gulp.src(pathToExtensions).pipe(i18n.createXlfFilesForExtensions())
			).pipe(vfs.dest('../vscode-translations-export'));
		}
	)
));

task.task('vscode-translations-import', function () {
	const options = minimist(process.argv.slice(2), {
		string: 'location',
		default: {
			location: '../vscode-translations-import'
		}
	});
	return es.merge([...i18n.defaultLanguages, ...i18n.extraLanguages].map(language => {
		const id = language.id;
		return gulp.src(`${options.location}/${id}/vscode-setup/messages.xlf`)
			.pipe(i18n.prepareIslFiles(language))
			.pipe(vfs.dest(`./build/win32/i18n`));
	}));
});

// #endregion
