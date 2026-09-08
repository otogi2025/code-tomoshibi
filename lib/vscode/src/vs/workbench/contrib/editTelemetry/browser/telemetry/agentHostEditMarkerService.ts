/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditTelemetryTrigger } from '../../../../../platform/telemetry/common/editTelemetry.js';

export interface IAgentHostEditAttributionCoverageGap {
	readonly editCount: number;
	readonly insertedCount: number;
}

export interface IPreparedAgentHostEditAttributionFlush {
	readonly flushToken: string;
	readonly agentModifiedCount: number;
	commit(totalModifiedCount: number): Promise<void>;
}

export class AgentHostEditAttributionUnknownOutcomeError extends Error {
	constructor(cause: unknown) {
		super('The Agent Host edit attribution outcome is unknown', { cause });
	}
}

export class AgentHostEditAttributionDeferredError extends Error {
	constructor(cause: unknown) {
		super('The Agent Host edit attribution was deferred', { cause });
	}
}

export interface IAgentHostEditMarkerService {
	createCorrelation(resource: URI): IExternalEditCorrelation;
	takeCoverageGap?(resource: URI): IAgentHostEditAttributionCoverageGap | undefined;
	prepareFlush(resource: URI, trigger: EditTelemetryTrigger, statsUuid: string, isDirty: boolean, languageId?: string): Promise<IPreparedAgentHostEditAttributionFlush | undefined>;
}

export interface IExternalEditCorrelation {
	readonly onDidSuppress: Event<string>;
	readonly onDidInvalidate: Event<string>;
	register(before: string, after: string): string;
	isSuppressed(id: string): boolean;
	release(id: string): void;
}
