/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Copies the KaTeX stylesheet and fonts into `preview-out/` so that they can be
 * contributed to the Markdown preview through `markdown.previewStyles`.
 */
import fse from 'fs-extra';
import path from 'path';

const outDirName = 'preview-out';

function resolveOutDir(args: string[]): string {
	const outputRootIndex = args.indexOf('--outputRoot');
	if (outputRootIndex >= 0) {
		return path.join(args[outputRootIndex + 1], outDirName);
	}
	return path.join(import.meta.dirname, outDirName);
}

const outDir = resolveOutDir(process.argv);
const katexDir = path.join(import.meta.dirname, 'node_modules', 'katex', 'dist');

fse.mkdirSync(outDir, { recursive: true });

fse.copySync(
	path.join(katexDir, 'katex.min.css'),
	path.join(outDir, 'katex.min.css'));

const fontsDir = path.join(katexDir, 'fonts');
const fontsOutDir = path.join(outDir, 'fonts/');

fse.mkdirSync(fontsOutDir, { recursive: true });

for (const file of fse.readdirSync(fontsDir)) {
	if (file.endsWith('.woff2')) {
		fse.copyFileSync(path.join(fontsDir, file), path.join(fontsOutDir, file));
	}
}
