/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { $, addDisposableListener, append, EventType, prepend } from '../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';

export interface ISelectOption {
	readonly value: string;
	readonly label: string;
}

/**
 * One row of the settings page: a label on the left (with an optional grey second line) and a
 * single control on the right. Every section is built out of these, so the rows line up whatever
 * the control happens to be.
 */
export function optRow(label: string, small: string | undefined, control: HTMLElement): HTMLElement {
	const row = $('.tomoshibi-settings-opt');
	const labelElement = append(row, $('.tomoshibi-settings-l'));
	append(labelElement, $('span', undefined, label));
	if (small) {
		append(labelElement, $('small', undefined, small));
	}
	if (control.classList.contains('tomoshibi-sw')) {
		// A switch is small enough to stay beside its label even in the narrow layout.
		row.classList.add('sw');
	}
	append(row, control);
	return row;
}

/**
 * The iPad-sized on/off switch. It is a real `<button>` so the browser gives Enter and Space
 * activation for free, and `aria-checked` keeps VoiceOver in step with the pill.
 */
export function switchControl(store: DisposableStore, get: () => boolean, set: (value: boolean) => void): HTMLElement {
	const button = $<HTMLButtonElement>('button.tomoshibi-sw');
	button.type = 'button';
	button.setAttribute('role', 'switch');
	const apply = (value: boolean) => {
		button.classList.toggle('on', value);
		button.setAttribute('aria-checked', String(value));
	};
	apply(get());
	store.add(addDisposableListener(button, EventType.CLICK, event => {
		event.preventDefault();
		const next = !button.classList.contains('on');
		apply(next);
		set(next);
	}));
	return button;
}

export function selectControl(store: DisposableStore, options: readonly ISelectOption[], get: () => string, set: (value: string) => void): HTMLElement {
	const select = $<HTMLSelectElement>('select.tomoshibi-settings-select');
	const current = get();
	let matched = false;
	for (const option of options) {
		const element = append(select, $<HTMLOptionElement>('option'));
		element.value = option.value;
		element.textContent = option.label;
		if (option.value === current) {
			element.selected = true;
			matched = true;
		}
	}
	if (!matched && current) {
		// 存的值不在候选里时一个 option 都不 selected，浏览器按规范显示第一项 —— 这一行就谎报了
		// 真实配置（主题设成 Monokai 时显示「Dark 2026」），而且再点一次那一项不触发 change，
		// 用它自己也改不回来。插一个禁用的占位项顶在最前面并选中，至少让人看见现在生效的是什么。
		const placeholder = prepend(select, $<HTMLOptionElement>('option'));
		placeholder.value = current;
		placeholder.textContent = localize('tomoshibi.settings.selectCurrent', "当前：{0}", current);
		placeholder.disabled = true;
		placeholder.selected = true;
	}
	store.add(addDisposableListener(select, EventType.CHANGE, () => set(select.value)));
	return select;
}

/**
 * A number box that only writes back a value inside the range. An out-of-range or unparsable
 * entry snaps back to the stored value rather than writing nonsense into settings.json.
 */
export function numberControl(store: DisposableStore, min: number, max: number, get: () => number, set: (value: number) => void): HTMLElement {
	const input = $<HTMLInputElement>('input.tomoshibi-settings-number');
	input.type = 'number';
	input.min = String(min);
	input.max = String(max);
	input.value = String(get());
	const commit = () => {
		const parsed = Number.parseInt(input.value, 10);
		if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
			input.value = String(get());
			return;
		}
		if (parsed === get()) {
			// change 和 blur 各来一次，值没变的那次不该写配置：光是点进「字号」框再点出去（iPad 上
			// 很常见的误触）就会白跑一整遍写配置管线，而字号那一行一次 set 写两个键，这两个键第一
			// 次落进 settings.json 时还会连着重建两遍分区。越界回填之后的那次 blur 也走这里。
			return;
		}
		set(parsed);
	};
	store.add(addDisposableListener(input, EventType.CHANGE, commit));
	store.add(addDisposableListener(input, EventType.BLUR, commit));
	return input;
}

/** A value the server owns; shown in the same box shape as an editable field so rows align. */
export function readonlyTextControl(value: string): HTMLElement {
	const input = $<HTMLInputElement>('input.tomoshibi-settings-text');
	input.type = 'text';
	input.value = value;
	input.readOnly = true;
	return input;
}

export function buttonControl(store: DisposableStore, label: string, className: string, run: () => void): HTMLElement {
	const button = $<HTMLButtonElement>(`button.tomoshibi-btn${className}`);
	button.type = 'button';
	button.textContent = label;
	store.add(addDisposableListener(button, EventType.CLICK, event => {
		event.preventDefault();
		run();
	}));
	return button;
}

export function monospaceValue(value: string): HTMLElement {
	return $('span.tomoshibi-settings-mono', undefined, value);
}
