/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../nls.js';
import { Lazy } from './lazy.js';
import { LANGUAGE_DEFAULT } from './platform.js';

const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const month = day * 30;
const year = day * 365;

/**
 * Create a localized difference of the time between now and the specified date.
 * @param date The date to generate the difference from.
 * @param appendAgoLabel Whether to append the " ago" to the end.
 * @param useFullTimeWords Whether to use full words (eg. seconds) instead of
 * shortened (eg. secs).
 * @param disallowNow Whether to disallow the string "now" when the difference
 * is less than 30 seconds.
 */
export function fromNow(date: number | Date, appendAgoLabel?: boolean, useFullTimeWords?: boolean, disallowNow?: boolean): string {
	if (typeof date === 'undefined') {
		return localize('date.fromNow.unknown', '未知');
	}

	if (typeof date !== 'number') {
		date = date.getTime();
	}

	const seconds = Math.round((new Date().getTime() - date) / 1000);
	if (seconds < -30) {
		return localize('date.fromNow.in', '{0} 后', fromNow(new Date().getTime() + seconds * 1000, false));
	}

	if (!disallowNow && seconds < 30) {
		return localize('date.fromNow.now', '现在');
	}

	let value: number;
	if (seconds < minute) {
		value = seconds;

		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.seconds.singular.ago.fullWord', '{0} 秒前', value)
					: localize('date.fromNow.seconds.singular.ago', '{0} 秒前', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.seconds.plural.ago.fullWord', '{0} 秒前', value)
					: localize('date.fromNow.seconds.plural.ago', '{0} 秒前', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.seconds.singular.fullWord', '{0} 秒', value)
					: localize('date.fromNow.seconds.singular', '{0} 秒', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.seconds.plural.fullWord', '{0} 秒', value)
					: localize('date.fromNow.seconds.plural', '{0} 秒', value);
			}
		}
	}

	if (seconds < hour) {
		value = Math.round(seconds / minute);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.minutes.singular.ago.fullWord', '{0} 分钟前', value)
					: localize('date.fromNow.minutes.singular.ago', '{0} 分钟前', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.minutes.plural.ago.fullWord', '{0} 分钟前', value)
					: localize('date.fromNow.minutes.plural.ago', '{0} 分钟前', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.minutes.singular.fullWord', '{0} 分钟', value)
					: localize('date.fromNow.minutes.singular', '{0} 分钟', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.minutes.plural.fullWord', '{0} 分钟', value)
					: localize('date.fromNow.minutes.plural', '{0} 分钟', value);
			}
		}
	}

	if (seconds < day) {
		value = Math.round(seconds / hour);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.hours.singular.ago.fullWord', '{0} 小时前', value)
					: localize('date.fromNow.hours.singular.ago', '{0} 小时前', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.hours.plural.ago.fullWord', '{0} 小时前', value)
					: localize('date.fromNow.hours.plural.ago', '{0} 小时前', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.hours.singular.fullWord', '{0} 小时', value)
					: localize('date.fromNow.hours.singular', '{0} 小时', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.hours.plural.fullWord', '{0} 小时', value)
					: localize('date.fromNow.hours.plural', '{0} 小时', value);
			}
		}
	}

	if (seconds < week) {
		value = Math.round(seconds / day);
		if (appendAgoLabel) {
			return value === 1
				? localize('date.fromNow.days.singular.ago', '{0} 天前', value)
				: localize('date.fromNow.days.plural.ago', '{0} 天前', value);
		} else {
			return value === 1
				? localize('date.fromNow.days.singular', '{0} 天', value)
				: localize('date.fromNow.days.plural', '{0} 天', value);
		}
	}

	if (seconds < month) {
		value = Math.round(seconds / week);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.weeks.singular.ago.fullWord', '{0} 周前', value)
					: localize('date.fromNow.weeks.singular.ago', '{0} 周前', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.weeks.plural.ago.fullWord', '{0} 周前', value)
					: localize('date.fromNow.weeks.plural.ago', '{0} 周前', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.weeks.singular.fullWord', '{0} 周', value)
					: localize('date.fromNow.weeks.singular', '{0} 周', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.weeks.plural.fullWord', '{0} 周', value)
					: localize('date.fromNow.weeks.plural', '{0} 周', value);
			}
		}
	}

	if (seconds < year) {
		value = Math.round(seconds / month);
		if (appendAgoLabel) {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.months.singular.ago.fullWord', '{0} 个月前', value)
					: localize('date.fromNow.months.singular.ago', '{0} 个月前', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.months.plural.ago.fullWord', '{0} 个月前', value)
					: localize('date.fromNow.months.plural.ago', '{0} 个月前', value);
			}
		} else {
			if (value === 1) {
				return useFullTimeWords
					? localize('date.fromNow.months.singular.fullWord', '{0} 月', value)
					: localize('date.fromNow.months.singular', '{0} 个月', value);
			} else {
				return useFullTimeWords
					? localize('date.fromNow.months.plural.fullWord', '{0} 个月', value)
					: localize('date.fromNow.months.plural', '{0} 个月', value);
			}
		}
	}

	value = Math.round(seconds / year);
	if (appendAgoLabel) {
		if (value === 1) {
			return useFullTimeWords
				? localize('date.fromNow.years.singular.ago.fullWord', '{0} 年前', value)
				: localize('date.fromNow.years.singular.ago', '{0} 年前', value);
		} else {
			return useFullTimeWords
				? localize('date.fromNow.years.plural.ago.fullWord', '{0} 年前', value)
				: localize('date.fromNow.years.plural.ago', '{0} 年前', value);
		}
	} else {
		if (value === 1) {
			return useFullTimeWords
				? localize('date.fromNow.years.singular.fullWord', '{0} 年', value)
				: localize('date.fromNow.years.singular', '{0} 年', value);
		} else {
			return useFullTimeWords
				? localize('date.fromNow.years.plural.fullWord', '{0} 年', value)
				: localize('date.fromNow.years.plural', '{0} 年', value);
		}
	}
}

export function fromNowByDay(date: number | Date, appendAgoLabel?: boolean, useFullTimeWords?: boolean): string {
	if (typeof date !== 'number') {
		date = date.getTime();
	}

	const todayMidnightTime = new Date();
	todayMidnightTime.setHours(0, 0, 0, 0);
	const yesterdayMidnightTime = new Date(todayMidnightTime.getTime());
	yesterdayMidnightTime.setDate(yesterdayMidnightTime.getDate() - 1);

	if (date > todayMidnightTime.getTime()) {
		return localize('today', '今天');
	}

	if (date > yesterdayMidnightTime.getTime()) {
		return localize('yesterday', '昨天');
	}

	return fromNow(date, appendAgoLabel, useFullTimeWords);
}

/**
 * Gets a readable duration with intelligent/lossy precision. For example "40ms" or "3.040s")
 * @param ms The duration to get in milliseconds.
 * @param useFullTimeWords Whether to use full words (eg. seconds) instead of
 * shortened (eg. secs).
 */
export function getDurationString(ms: number, useFullTimeWords?: boolean) {
	const seconds = Math.abs(ms / 1000);
	if (seconds < 1) {
		return useFullTimeWords
			? localize('duration.ms.full', '{0} 毫秒', ms)
			: localize('duration.ms', '{0} 毫秒', ms);
	}
	if (seconds < minute) {
		return useFullTimeWords
			? localize('duration.s.full', '{0} 秒', Math.round(ms) / 1000)
			: localize('duration.s', '{0} 秒', Math.round(ms) / 1000);
	}
	if (seconds < hour) {
		return useFullTimeWords
			? localize('duration.m.full', '{0} 分钟', Math.round(ms / (1000 * minute)))
			: localize('duration.m', '{0} 分钟', Math.round(ms / (1000 * minute)));
	}
	if (seconds < day) {
		return useFullTimeWords
			? localize('duration.h.full', '{0} 小时', Math.round(ms / (1000 * hour)))
			: localize('duration.h', '{0} 小时', Math.round(ms / (1000 * hour)));
	}
	return localize('duration.d', '{0} 天', Math.round(ms / (1000 * day)));
}

export function toLocalISOString(date: Date): string {
	return date.getFullYear() +
		'-' + String(date.getMonth() + 1).padStart(2, '0') +
		'-' + String(date.getDate()).padStart(2, '0') +
		'T' + String(date.getHours()).padStart(2, '0') +
		':' + String(date.getMinutes()).padStart(2, '0') +
		':' + String(date.getSeconds()).padStart(2, '0') +
		'.' + (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5) +
		'Z';
}

export const safeIntl = {
	DateTimeFormat(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions): Lazy<Intl.DateTimeFormat> {
		return new Lazy(() => {
			try {
				return new Intl.DateTimeFormat(locales, options);
			} catch {
				return new Intl.DateTimeFormat(undefined, options);
			}
		});
	},
	Collator(locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): Lazy<Intl.Collator> {
		return new Lazy(() => {
			try {
				return new Intl.Collator(locales, options);
			} catch {
				return new Intl.Collator(undefined, options);
			}
		});
	},
	Segmenter(locales?: Intl.LocalesArgument, options?: Intl.SegmenterOptions): Lazy<Intl.Segmenter> {
		return new Lazy(() => {
			try {
				return new Intl.Segmenter(locales, options);
			} catch {
				return new Intl.Segmenter(undefined, options);
			}
		});
	},
	Locale(tag: Intl.Locale | string, options?: Intl.LocaleOptions): Lazy<Intl.Locale> {
		return new Lazy(() => {
			try {
				return new Intl.Locale(tag, options);
			} catch {
				return new Intl.Locale(LANGUAGE_DEFAULT, options);
			}
		});
	},
	NumberFormat(locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions): Lazy<Intl.NumberFormat> {
		return new Lazy(() => {
			try {
				return new Intl.NumberFormat(locales, options);
			} catch {
				return new Intl.NumberFormat(undefined, options);
			}
		});
	}
};
