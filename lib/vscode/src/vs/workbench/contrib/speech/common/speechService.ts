/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { language } from '../../../../base/common/platform.js';

export const ISpeechService = createDecorator<ISpeechService>('speechService');

export const HasSpeechProvider = new RawContextKey<boolean>('hasSpeechProvider', false, { type: 'boolean', description: localize('hasSpeechProvider', "语音提供程序已注册到语音服务。") });
export const SpeechToTextInProgress = new RawContextKey<boolean>('speechToTextInProgress', false, { type: 'boolean', description: localize('speechToTextInProgress', "正在进行语音转文本会话。") });
export const TextToSpeechInProgress = new RawContextKey<boolean>('textToSpeechInProgress', false, { type: 'boolean', description: localize('textToSpeechInProgress', "正在进行文本转语音会话。") });

export interface ISpeechProviderMetadata {
	readonly extension: ExtensionIdentifier;
	readonly displayName: string;
}

export enum SpeechToTextStatus {
	Started = 1,
	Recognizing = 2,
	Recognized = 3,
	Stopped = 4,
	Error = 5
}

export interface ISpeechToTextEvent {
	readonly status: SpeechToTextStatus;
	readonly text?: string;
}

export interface ISpeechToTextSession {
	readonly onDidChange: Event<ISpeechToTextEvent>;
}

export enum TextToSpeechStatus {
	Started = 1,
	Stopped = 2,
	Error = 3
}

export interface ITextToSpeechEvent {
	readonly status: TextToSpeechStatus;
	readonly text?: string;
}

export interface ITextToSpeechSession {
	readonly onDidChange: Event<ITextToSpeechEvent>;

	synthesize(text: string): Promise<void>;
}

export enum KeywordRecognitionStatus {
	Recognized = 1,
	Stopped = 2,
	Canceled = 3
}

export interface IKeywordRecognitionEvent {
	readonly status: KeywordRecognitionStatus;
	readonly text?: string;
}

export interface IKeywordRecognitionSession {
	readonly onDidChange: Event<IKeywordRecognitionEvent>;
}

export interface ISpeechToTextSessionOptions {
	readonly language?: string;
}

export interface ITextToSpeechSessionOptions {
	readonly language?: string;
}

export interface ISpeechProvider {
	readonly metadata: ISpeechProviderMetadata;

	createSpeechToTextSession(token: CancellationToken, options?: ISpeechToTextSessionOptions): ISpeechToTextSession;
	createTextToSpeechSession(token: CancellationToken, options?: ITextToSpeechSessionOptions): ITextToSpeechSession;
	createKeywordRecognitionSession(token: CancellationToken): IKeywordRecognitionSession;
}

export interface ISpeechService {

	readonly _serviceBrand: undefined;

	readonly onDidChangeHasSpeechProvider: Event<void>;

	readonly hasSpeechProvider: boolean;

	registerSpeechProvider(identifier: string, provider: ISpeechProvider): IDisposable;

	readonly onDidStartSpeechToTextSession: Event<void>;
	readonly onDidEndSpeechToTextSession: Event<void>;

	readonly hasActiveSpeechToTextSession: boolean;

	/**
	 * Starts to transcribe speech from the default microphone. The returned
	 * session object provides an event to subscribe for transcribed text.
	 */
	createSpeechToTextSession(token: CancellationToken, context?: string): Promise<ISpeechToTextSession>;

	readonly onDidStartTextToSpeechSession: Event<void>;
	readonly onDidEndTextToSpeechSession: Event<void>;

	readonly hasActiveTextToSpeechSession: boolean;

	/**
	 * Creates a synthesizer to synthesize speech from text. The returned
	 * session object provides a method to synthesize text and listen for
	 * events.
	 */
	createTextToSpeechSession(token: CancellationToken, context?: string): Promise<ITextToSpeechSession>;

	readonly onDidStartKeywordRecognition: Event<void>;
	readonly onDidEndKeywordRecognition: Event<void>;

	readonly hasActiveKeywordRecognition: boolean;

	/**
	 * Starts to recognize a keyword from the default microphone. The returned
	 * status indicates if the keyword was recognized or if the session was
	 * stopped.
	 */
	recognizeKeyword(token: CancellationToken): Promise<KeywordRecognitionStatus>;
}

export const enum AccessibilityVoiceSettingId {
	SpeechTimeout = 'accessibility.voice.speechTimeout',
	AutoSynthesize = 'accessibility.voice.autoSynthesize',
	SpeechLanguage = 'accessibility.voice.speechLanguage',
	IgnoreCodeBlocks = 'accessibility.voice.ignoreCodeBlocks'
}

export const SPEECH_LANGUAGE_CONFIG = AccessibilityVoiceSettingId.SpeechLanguage;

export const SPEECH_LANGUAGES = {
	['da-DK']: {
		name: localize('speechLanguage.da-DK', "丹麦语(丹麦)")
	},
	['de-DE']: {
		name: localize('speechLanguage.de-DE', "德语(德国)")
	},
	['en-AU']: {
		name: localize('speechLanguage.en-AU', "英语(澳大利亚)")
	},
	['en-CA']: {
		name: localize('speechLanguage.en-CA', "英语(加拿大)")
	},
	['en-GB']: {
		name: localize('speechLanguage.en-GB', "英语(英国)")
	},
	['en-IE']: {
		name: localize('speechLanguage.en-IE', "英语(爱尔兰)")
	},
	['en-IN']: {
		name: localize('speechLanguage.en-IN', "英语(印度)")
	},
	['en-NZ']: {
		name: localize('speechLanguage.en-NZ', "英语(新西兰)")
	},
	['en-US']: {
		name: localize('speechLanguage.en-US', "英语(美国)")
	},
	['es-ES']: {
		name: localize('speechLanguage.es-ES', "西班牙语(西班牙)")
	},
	['es-MX']: {
		name: localize('speechLanguage.es-MX', "西班牙语(墨西哥)")
	},
	['fr-CA']: {
		name: localize('speechLanguage.fr-CA', "法语(加拿大)")
	},
	['fr-FR']: {
		name: localize('speechLanguage.fr-FR', "法语(法国)")
	},
	['hi-IN']: {
		name: localize('speechLanguage.hi-IN', "印地语(印度)")
	},
	['it-IT']: {
		name: localize('speechLanguage.it-IT', "意大利语(意大利)")
	},
	['ja-JP']: {
		name: localize('speechLanguage.ja-JP', "日语(日本)")
	},
	['ko-KR']: {
		name: localize('speechLanguage.ko-KR', "韩语(韩国)")
	},
	['nl-NL']: {
		name: localize('speechLanguage.nl-NL', "荷兰语(荷兰)")
	},
	['pt-PT']: {
		name: localize('speechLanguage.pt-PT', "葡萄牙语(葡萄牙)")
	},
	['pt-BR']: {
		name: localize('speechLanguage.pt-BR', "葡萄牙语(巴西)")
	},
	['ru-RU']: {
		name: localize('speechLanguage.ru-RU', "俄语(俄罗斯)")
	},
	['sv-SE']: {
		name: localize('speechLanguage.sv-SE', "瑞典语(瑞典)")
	},
	['tr-TR']: {
		// allow-any-unicode-next-line
		name: localize('speechLanguage.tr-TR', "土耳其语(土耳其)")
	},
	['zh-CN']: {
		name: localize('speechLanguage.zh-CN', "中文(简体，中国)")
	},
	['zh-HK']: {
		name: localize('speechLanguage.zh-HK', "中文(繁体，香港特别行政区)")
	},
	['zh-TW']: {
		name: localize('speechLanguage.zh-TW', "中文(繁体，台湾)")
	}
};

export function speechLanguageConfigToLanguage(config: unknown, lang = language): string {
	if (typeof config === 'string') {
		if (config === 'auto') {
			if (lang !== 'en') {
				const langParts = lang.split('-');

				return speechLanguageConfigToLanguage(`${langParts[0]}-${(langParts[1] ?? langParts[0]).toUpperCase()}`);
			}
		} else {
			if (SPEECH_LANGUAGES[config as keyof typeof SPEECH_LANGUAGES]) {
				return config;
			}
		}
	}

	return 'en-US';
}
