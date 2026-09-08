/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';

export const enum SurveyQuestionType {
	Segment = 'segment',
	Radio = 'radio',
}

export interface ISurveyOption {
	readonly id: string;
	readonly label: string;
}

interface ISurveyQuestionBase {
	readonly id: string;
	readonly label: string;
	readonly options: readonly ISurveyOption[];
	/** When true, the question must be answered before submission. */
	readonly required?: boolean;
	/**
	 * The telemetry field name this answer maps to in the `survey/submit` event.
	 * When set, the selected option ID (or numeric index if {@link asMeasurement} is true) is emitted under this key.
	 */
	readonly telemetryKey?: string;
	/** When true, the answer is logged as a numeric index into the options array (0-based) with `isMeasurement`. */
	readonly asMeasurement?: boolean;
}

export interface ISurveySegmentQuestion extends ISurveyQuestionBase {
	readonly type: SurveyQuestionType.Segment;
}

export interface ISurveyRadioQuestion extends ISurveyQuestionBase {
	readonly type: SurveyQuestionType.Radio;
	readonly columns?: number;
}

export type ISurveyQuestion = ISurveySegmentQuestion | ISurveyRadioQuestion;

export interface ISurveyDefinition {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly questions: readonly ISurveyQuestion[];
}

/**
 * Product-Market Fit survey for GitHub Copilot.
 * Based on the Sean Ellis "very disappointed" test.
 */
export const CopilotPMFSurvey: ISurveyDefinition = {
	id: 'copilot-pmf',
	title: localize('survey.copilotPmf.title', "帮助我们改进 GitHub Copilot"),
	description: localize('survey.copilotPmf.description', "这份简短的调查有助于我们了解 Copilot 与你的工作流的契合程度。"),
	questions: [
		{
			type: SurveyQuestionType.Segment,
			id: 'disappointment',
			required: true,
			telemetryKey: 'score',
			asMeasurement: true,
			label: localize('survey.copilotPmf.q1', "如果不能再使用 Copilot，你会有多失望?"),
			options: [
				{ id: 'not-at-all', label: localize('survey.copilotPmf.q1.notAtAll', "一点也不") },
				{ id: 'slightly', label: localize('survey.copilotPmf.q1.slightly', "稍微有用") },
				{ id: 'somewhat', label: localize('survey.copilotPmf.q1.somewhat', "有点") },
				{ id: 'very', label: localize('survey.copilotPmf.q1.very', "非常") },
				{ id: 'extremely', label: localize('survey.copilotPmf.q1.extremely', "极其") },
			],
		},
		{
			type: SurveyQuestionType.Radio,
			id: 'primary-benefit',
			telemetryKey: 'primaryBenefit',
			label: localize('survey.copilotPmf.q2', "Copilot 最近在哪些方面帮助了你?"),
			columns: 2,
			options: [
				{ id: 'shipping-faster', label: localize('survey.copilotPmf.q2.shippingFaster', "更快地交付更改") },
				{ id: 'getting-unstuck', label: localize('survey.copilotPmf.q2.gettingUnstuck', "摆脱 bug 困扰") },
				{ id: 'multi-file', label: localize('survey.copilotPmf.q2.multiFile', "进行多文件更改") },
				{ id: 'automating', label: localize('survey.copilotPmf.q2.automating', "自动执行重复性工作") },
				{ id: 'understanding', label: localize('survey.copilotPmf.q2.understanding', "了解代码库") },
				{ id: 'planning', label: localize('survey.copilotPmf.q2.planning', "规划方法") },
				{ id: 'reviewing', label: localize('survey.copilotPmf.q2.reviewing', "改进或审阅代码") },
				{ id: 'no-clear-value', label: localize('survey.copilotPmf.q2.noClearValue', "我尚未获得明确的价值") },
				{ id: 'other', label: localize('survey.copilotPmf.q2.other', "以上都不是") },
			],
		},
		{
			type: SurveyQuestionType.Radio,
			id: 'primary-friction',
			telemetryKey: 'primaryFriction',
			label: localize('survey.copilotPmf.q3', "什么最妨碍你?"),
			columns: 2,
			options: [
				{ id: 'trust', label: localize('survey.copilotPmf.q3.trust', "输出难以信任") },
				{ id: 'context', label: localize('survey.copilotPmf.q3.context', "缺少存储库或项目上下文") },
				{ id: 'bigger-tasks', label: localize('survey.copilotPmf.q3.biggerTasks', "难以应对更大的任务") },
				{ id: 'reviewing-time', label: localize('survey.copilotPmf.q3.reviewingTime', "审阅时间过长") },
				{ id: 'steering', label: localize('survey.copilotPmf.q3.steering', "需要太多指导") },
				{ id: 'slow', label: localize('survey.copilotPmf.q3.slow', "太慢/中断流程") },
				{ id: 'setup', label: localize('survey.copilotPmf.q3.setup', "设置或集成很难") },
				{ id: 'security', label: localize('survey.copilotPmf.q3.security', "安全或权限问题") },
				{ id: 'cost', label: localize('survey.copilotPmf.q3.cost', "限制、成本或计费") },
				{ id: 'other', label: localize('survey.copilotPmf.q3.other', "以上都不是") },
			],
		},
		{
			type: SurveyQuestionType.Segment,
			id: 'programming-experience',
			telemetryKey: 'programmingExperience',
			asMeasurement: true,
			label: localize('survey.copilotPmf.q4', "你做编程多久了?"),
			options: [
				{ id: 'less-than-3', label: localize('survey.copilotPmf.q4.lessThan3', "<3 年") },
				{ id: '3-to-5', label: localize('survey.copilotPmf.q4.3to5', "3-5 年") },
				{ id: '6-to-9', label: localize('survey.copilotPmf.q4.6to9', "6-9 年") },
				{ id: '10-to-19', label: localize('survey.copilotPmf.q4.10to19', "10-19 年") },
				{ id: '20-plus', label: localize('survey.copilotPmf.q4.20plus', "20+ 年") },
			],
		},
	],
};
