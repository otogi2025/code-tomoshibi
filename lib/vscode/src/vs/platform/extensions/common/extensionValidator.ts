/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isEqualOrParent, joinPath } from '../../../base/common/resources.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import * as nls from '../../../nls.js';
import * as semver from '../../../base/common/semver/semver.js';
import { IExtensionManifest } from './extensions.js';

export interface IParsedVersion {
	hasCaret: boolean;
	hasGreaterEquals: boolean;
	majorBase: number;
	majorMustEqual: boolean;
	minorBase: number;
	minorMustEqual: boolean;
	patchBase: number;
	patchMustEqual: boolean;
	preRelease: string | null;
}

export interface INormalizedVersion {
	majorBase: number;
	majorMustEqual: boolean;
	minorBase: number;
	minorMustEqual: boolean;
	patchBase: number;
	patchMustEqual: boolean;
	notBefore: number; /* milliseconds timestamp, or 0 */
	isMinimum: boolean;
}

const VERSION_REGEXP = /^(\^|>=)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/;
const NOT_BEFORE_REGEXP = /^-(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?$/;

export function isValidVersionStr(version: string): boolean {
	version = version.trim();
	return (version === '*' || VERSION_REGEXP.test(version));
}

export function parseVersion(version: string): IParsedVersion | null {
	if (!isValidVersionStr(version)) {
		return null;
	}

	version = version.trim();

	if (version === '*') {
		return {
			hasCaret: false,
			hasGreaterEquals: false,
			majorBase: 0,
			majorMustEqual: false,
			minorBase: 0,
			minorMustEqual: false,
			patchBase: 0,
			patchMustEqual: false,
			preRelease: null
		};
	}

	const m = version.match(VERSION_REGEXP);
	if (!m) {
		return null;
	}
	return {
		hasCaret: m[1] === '^',
		hasGreaterEquals: m[1] === '>=',
		majorBase: m[2] === 'x' ? 0 : parseInt(m[2], 10),
		majorMustEqual: (m[2] === 'x' ? false : true),
		minorBase: m[4] === 'x' ? 0 : parseInt(m[4], 10),
		minorMustEqual: (m[4] === 'x' ? false : true),
		patchBase: m[6] === 'x' ? 0 : parseInt(m[6], 10),
		patchMustEqual: (m[6] === 'x' ? false : true),
		preRelease: m[8] || null
	};
}

export function normalizeVersion(version: IParsedVersion | null): INormalizedVersion | null {
	if (!version) {
		return null;
	}

	const majorBase = version.majorBase;
	const majorMustEqual = version.majorMustEqual;
	const minorBase = version.minorBase;
	let minorMustEqual = version.minorMustEqual;
	const patchBase = version.patchBase;
	let patchMustEqual = version.patchMustEqual;

	if (version.hasCaret) {
		if (majorBase === 0) {
			patchMustEqual = false;
		} else {
			minorMustEqual = false;
			patchMustEqual = false;
		}
	}

	let notBefore = 0;
	if (version.preRelease) {
		const match = NOT_BEFORE_REGEXP.exec(version.preRelease);
		if (match) {
			const [, year, month, day, hours, minutes] = match;
			notBefore = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours) || 0, Number(minutes) || 0);
		}
	}

	return {
		majorBase: majorBase,
		majorMustEqual: majorMustEqual,
		minorBase: minorBase,
		minorMustEqual: minorMustEqual,
		patchBase: patchBase,
		patchMustEqual: patchMustEqual,
		isMinimum: version.hasGreaterEquals,
		notBefore,
	};
}

export function isValidVersion(_inputVersion: string | INormalizedVersion, _inputDate: ProductDate, _desiredVersion: string | INormalizedVersion): boolean {
	let version: INormalizedVersion | null;
	if (typeof _inputVersion === 'string') {
		version = normalizeVersion(parseVersion(_inputVersion));
	} else {
		version = _inputVersion;
	}

	let productTs: number | undefined;
	if (_inputDate instanceof Date) {
		productTs = _inputDate.getTime();
	} else if (typeof _inputDate === 'string') {
		productTs = new Date(_inputDate).getTime();
	}

	let desiredVersion: INormalizedVersion | null;
	if (typeof _desiredVersion === 'string') {
		desiredVersion = normalizeVersion(parseVersion(_desiredVersion));
	} else {
		desiredVersion = _desiredVersion;
	}

	if (!version || !desiredVersion) {
		return false;
	}

	const majorBase = version.majorBase;
	const minorBase = version.minorBase;
	const patchBase = version.patchBase;

	let desiredMajorBase = desiredVersion.majorBase;
	let desiredMinorBase = desiredVersion.minorBase;
	let desiredPatchBase = desiredVersion.patchBase;
	const desiredNotBefore = desiredVersion.notBefore;

	let majorMustEqual = desiredVersion.majorMustEqual;
	let minorMustEqual = desiredVersion.minorMustEqual;
	let patchMustEqual = desiredVersion.patchMustEqual;

	if (desiredVersion.isMinimum) {
		if (majorBase > desiredMajorBase) {
			return true;
		}

		if (majorBase < desiredMajorBase) {
			return false;
		}

		if (minorBase > desiredMinorBase) {
			return true;
		}

		if (minorBase < desiredMinorBase) {
			return false;
		}

		if (productTs && productTs < desiredNotBefore) {
			return false;
		}

		return patchBase >= desiredPatchBase;
	}

	// Anything < 1.0.0 is compatible with >= 1.0.0, except exact matches
	if (majorBase === 1 && desiredMajorBase === 0 && (!majorMustEqual || !minorMustEqual || !patchMustEqual)) {
		desiredMajorBase = 1;
		desiredMinorBase = 0;
		desiredPatchBase = 0;
		majorMustEqual = true;
		minorMustEqual = false;
		patchMustEqual = false;
	}

	if (majorBase < desiredMajorBase) {
		// smaller major version
		return false;
	}

	if (majorBase > desiredMajorBase) {
		// higher major version
		return (!majorMustEqual);
	}

	// at this point, majorBase are equal

	if (minorBase < desiredMinorBase) {
		// smaller minor version
		return false;
	}

	if (minorBase > desiredMinorBase) {
		// higher minor version
		return (!minorMustEqual);
	}

	// at this point, minorBase are equal

	if (patchBase < desiredPatchBase) {
		// smaller patch version
		return false;
	}

	if (patchBase > desiredPatchBase) {
		// higher patch version
		return (!patchMustEqual);
	}

	// at this point, patchBase are equal

	if (productTs && productTs < desiredNotBefore) {
		return false;
	}

	return true;
}

type ProductDate = string | Date | undefined;

export function validateExtensionManifest(productVersion: string, productDate: ProductDate, extensionLocation: URI, extensionManifest: IExtensionManifest, extensionIsBuiltin: boolean): readonly [Severity, string][] {
	const validations: [Severity, string][] = [];
	if (typeof extensionManifest.publisher !== 'undefined' && typeof extensionManifest.publisher !== 'string') {
		validations.push([Severity.Error, nls.localize('extensionDescription.publisher', "属性 publisher 的类型必须是 `string`。")]);
		return validations;
	}
	if (typeof extensionManifest.name !== 'string') {
		validations.push([Severity.Error, nls.localize('extensionDescription.name', "属性“{0}”是必需的，其类型必须是 `string`", 'name')]);
		return validations;
	}
	if (typeof extensionManifest.version !== 'string') {
		validations.push([Severity.Error, nls.localize('extensionDescription.version', "属性“{0}”是必需的，其类型必须是 `string`", 'version')]);
		return validations;
	}
	if (!extensionManifest.engines) {
		validations.push([Severity.Error, nls.localize('extensionDescription.engines', "属性“{0}”是必要属性，其类型必须是 `object`", 'engines')]);
		return validations;
	}
	if (typeof extensionManifest.engines.vscode !== 'string') {
		validations.push([Severity.Error, nls.localize('extensionDescription.engines.vscode', "属性“{0}”是必需的，其类型必须是 `string`", 'engines.vscode')]);
		return validations;
	}
	if (typeof extensionManifest.extensionDependencies !== 'undefined') {
		if (!isStringArray(extensionManifest.extensionDependencies)) {
			validations.push([Severity.Error, nls.localize('extensionDescription.extensionDependencies', "属性“{0}”可以省略，否则其类型必须是 `string[]`", 'extensionDependencies')]);
			return validations;
		}
	}
	if (typeof extensionManifest.extensionAffinity !== 'undefined') {
		if (!isStringArray(extensionManifest.extensionAffinity)) {
			validations.push([Severity.Error, nls.localize('extensionDescription.extensionAffinity', "属性“{0}”可以省略，否则其类型必须是 `string[]`", 'extensionAffinity')]);
			return validations;
		}
	}
	if (typeof extensionManifest.activationEvents !== 'undefined') {
		if (!isStringArray(extensionManifest.activationEvents)) {
			validations.push([Severity.Error, nls.localize('extensionDescription.activationEvents1', "属性“{0}”可以省略，否则其类型必须是 `string[]`", 'activationEvents')]);
			return validations;
		}
		if (typeof extensionManifest.main === 'undefined' && typeof extensionManifest.browser === 'undefined') {
			validations.push([Severity.Error, nls.localize('extensionDescription.activationEvents2', "如果扩展没有“{1}”或“{2}”属性，则应省略属性“{0}”。", 'activationEvents', 'main', 'browser')]);
			return validations;
		}
	}
	if (typeof extensionManifest.extensionKind !== 'undefined') {
		if (typeof extensionManifest.main === 'undefined') {
			validations.push([Severity.Warning, nls.localize('extensionDescription.extensionKind', "仅当同时定义了属性“main”时，才能定义属性“{0}”。", 'extensionKind')]);
			// not a failure case
		}
	}
	if (typeof extensionManifest.main !== 'undefined') {
		if (typeof extensionManifest.main !== 'string') {
			validations.push([Severity.Error, nls.localize('extensionDescription.main1', "属性 `{0}` 可以省略，否则其类型必须是 `string`", 'main')]);
			return validations;
		} else {
			const mainLocation = joinPath(extensionLocation, extensionManifest.main);
			if (!isEqualOrParent(mainLocation, extensionLocation)) {
				validations.push([Severity.Warning, nls.localize('extensionDescription.main2', "应在扩展文件夹({1})中包含 `main` ({0})。这可能会使扩展不可移植。", mainLocation.path, extensionLocation.path)]);
				// not a failure case
			}
		}
	}
	if (typeof extensionManifest.browser !== 'undefined') {
		if (typeof extensionManifest.browser !== 'string') {
			validations.push([Severity.Error, nls.localize('extensionDescription.browser1', "属性“{0}”可以省略，否则其类型必须是 `string`", 'browser')]);
			return validations;
		} else {
			const browserLocation = joinPath(extensionLocation, extensionManifest.browser);
			if (!isEqualOrParent(browserLocation, extensionLocation)) {
				validations.push([Severity.Warning, nls.localize('extensionDescription.browser2', "应在扩展文件夹({1})中包含 `browser` ({0})。这可能会使扩展不可移植。", browserLocation.path, extensionLocation.path)]);
				// not a failure case
			}
		}
	}

	if (!semver.valid(extensionManifest.version)) {
		validations.push([Severity.Error, nls.localize('notSemver', "扩展版本与 semver 不兼容。")]);
		return validations;
	}

	const notices: string[] = [];
	const validExtensionVersion = isValidExtensionVersion(productVersion, productDate, extensionManifest, extensionIsBuiltin, notices);
	if (!validExtensionVersion) {
		for (const notice of notices) {
			validations.push([Severity.Error, notice]);
		}
	}

	return validations;
}

export function isValidExtensionVersion(productVersion: string, productDate: ProductDate, extensionManifest: IExtensionManifest, extensionIsBuiltin: boolean, notices: string[]): boolean {

	if (extensionIsBuiltin || (typeof extensionManifest.main === 'undefined' && typeof extensionManifest.browser === 'undefined')) {
		// No version check for builtin or declarative extensions
		return true;
	}

	return isVersionValid(productVersion, productDate, extensionManifest.engines.vscode, notices);
}

export function isEngineValid(engine: string, version: string, date: ProductDate): boolean {
	// TODO@joao: discuss with alex '*' doesn't seem to be a valid engine version
	return engine === '*' || isVersionValid(version, date, engine);
}

function isVersionValid(currentVersion: string, date: ProductDate, requestedVersion: string, notices: string[] = []): boolean {

	const desiredVersion = normalizeVersion(parseVersion(requestedVersion));
	if (!desiredVersion) {
		notices.push(nls.localize('versionSyntax', "无法解析 \"engines.vscode\" 的值 {0}。请改为如 ^1.22.0, ^1.22.x 等。", requestedVersion));
		return false;
	}

	// enforce that a breaking API version is specified.
	// for 0.X.Y, that means up to 0.X must be specified
	// otherwise for Z.X.Y, that means Z must be specified
	if (desiredVersion.majorBase === 0) {
		// force that major and minor must be specific
		if (!desiredVersion.majorMustEqual || !desiredVersion.minorMustEqual) {
			notices.push(nls.localize('versionSpecificity1', "\"engines.vscode\" ({0}) 中指定的版本不够具体。对于 1.0.0 之前的 vscode 版本，请至少定义主要和次要想要的版本。例如: ^0.10.0、0.10.x、0.11.0 等。", requestedVersion));
			return false;
		}
	} else {
		// force that major must be specific
		if (!desiredVersion.majorMustEqual) {
			notices.push(nls.localize('versionSpecificity2', "\"engines.vscode\" ({0}) 中指定的版本不够具体。对于 1.0.0 之后的 vscode 版本，请至少定义主要想要的版本。例如: ^1.10.0、1.10.x、1.x.x、2.x.x 等。", requestedVersion));
			return false;
		}
	}

	if (!isValidVersion(currentVersion, date, desiredVersion)) {
		notices.push(nls.localize('versionMismatch', "扩展与 Code {0} 不兼容。扩展需要: {1}。", currentVersion, requestedVersion));
		return false;
	}

	return true;
}

function isStringArray(arr: readonly string[]): boolean {
	if (!Array.isArray(arr)) {
		return false;
	}
	for (let i = 0, len = arr.length; i < len; i++) {
		if (typeof arr[i] !== 'string') {
			return false;
		}
	}
	return true;
}
