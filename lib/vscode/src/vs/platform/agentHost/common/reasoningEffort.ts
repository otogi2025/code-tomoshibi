/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../nls.js';

/**
 * Union of every reasoning-effort / thinking-level value surfaced by any
 * agent-host provider. Individual providers expose a subset:
 * - Codex: `'minimal' | 'low' | 'medium' | 'high'`
 * - Copilot / Claude: `'low' | 'medium' | 'high' | 'xhigh' | 'max'`
 *
 * The label/description helpers below are the single source of truth for
 * the localized picker strings so every provider renders the same value
 * consistently.
 */
export type ReasoningEffortLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Localized, title-cased picker label for a reasoning-effort value.
 * Falls back to capitalizing an unrecognized value so a newly-introduced
 * effort tier never surfaces raw (e.g. lowercase `'max'`).
 */
export function getReasoningEffortLabel(level: string): string {
	switch (level) {
		case 'none': return localize('reasoningEffort.none', "无");
		case 'minimal': return localize('reasoningEffort.minimal', "最少");
		case 'low': return localize('reasoningEffort.low', "低");
		case 'medium': return localize('reasoningEffort.medium', "中等");
		case 'high': return localize('reasoningEffort.high', "高");
		case 'xhigh': return localize('reasoningEffort.xhigh', "极高");
		case 'max': return localize('reasoningEffort.max', "最大值");
		default: return level.charAt(0).toUpperCase() + level.slice(1);
	}
}

/**
 * Localized description for a reasoning-effort value, shown beneath the
 * label in the picker. Returns `undefined` for an unrecognized value so
 * callers can omit the description rather than show an empty string.
 *
 * Wording mirrors the canonical extension helper `getReasoningEffortDescription`
 * in `extensions/copilot/src/extension/conversation/common/languageModelAccess.ts`
 * so every provider surfaces the same descriptions.
 */
export function getReasoningEffortDescription(level: string): string | undefined {
	switch (level) {
		case 'none': return localize('reasoningEffort.noneDescription', "未应用推理");
		case 'minimal': return localize('reasoningEffort.minimalDescription', "推理最少，响应最快");
		case 'low': return localize('reasoningEffort.lowDescription', "响应速度更快，推理更少");
		case 'medium': return localize('reasoningEffort.mediumDescription', "平衡推理和速度");
		case 'high': return localize('reasoningEffort.highDescription', "较大推理深度，但速度较慢");
		case 'xhigh': return localize('reasoningEffort.xhighDescription', "推理深度最高，但速度最慢");
		case 'max': return localize('reasoningEffort.maxDescription', "无约束的绝对最大能力");
		default: return undefined;
	}
}

/**
 * Resolve the default reasoning effort for a model so the picker never renders an
 * `undefined` selection. Prefers the declared default, then `'high'` for Claude/Kimi K3
 * and `'medium'` otherwise, then the first supported level.
 */
export function resolveDefaultReasoningEffort(supportedEfforts: readonly string[] | undefined, declaredDefault?: string, modelId?: string): string | undefined {
	if (!supportedEfforts?.length) {
		return undefined;
	}
	if (declaredDefault && supportedEfforts.includes(declaredDefault)) {
		return declaredDefault;
	}
	const lowerId = modelId?.toLowerCase() ?? '';
	const preferred = lowerId.startsWith('claude') || lowerId.includes('kimi-k3') ? 'high' : 'medium';
	return supportedEfforts.includes(preferred) ? preferred : supportedEfforts[0];
}
