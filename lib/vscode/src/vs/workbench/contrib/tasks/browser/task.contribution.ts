/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as nls from '../../../../nls.js';

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { MenuRegistry, MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';

import { ProblemMatcherRegistry } from '../common/problemMatcher.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';

import * as jsonContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { IJSONSchema } from '../../../../base/common/jsonSchema.js';

import { StatusbarAlignment, IStatusbarService, IStatusbarEntryAccessor, IStatusbarEntry } from '../../../services/statusbar/browser/statusbar.js';

import { IOutputChannelRegistry, Extensions as OutputExt } from '../../../services/output/common/output.js';

import { ITaskEvent, TaskGroup, TaskSettingId, TASKS_CATEGORY, TASK_RUNNING_STATE, TASK_TERMINAL_ACTIVE, TaskEventKind, rerunTaskIcon, RerunForActiveTerminalCommandId, RerunAllRunningTasksCommandId } from '../common/tasks.js';
import { ITaskService, TaskCommandsRegistered, TaskExecutionSupportedContext } from '../common/taskService.js';

import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry, IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { RunAutomaticTasks, ManageAutomaticTaskRunning } from './runAutomaticTasks.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { KeyMod, KeyCode } from '../../../../base/common/keyCodes.js';
import schemaVersion1 from '../common/jsonSchema_v1.js';
import schemaVersion2, { updateProblemMatchers, updateTaskDefinitions } from '../common/jsonSchema_v2.js';
import { AbstractTaskService, ConfigureTaskAction } from './abstractTaskService.js';
import { tasksSchemaId } from '../../../services/configuration/common/configuration.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { WorkbenchStateContext } from '../../../common/contextkeys.js';
import { IQuickAccessRegistry, Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { TasksQuickAccessProvider } from './tasksQuickAccess.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { TaskDefinitionRegistry } from '../common/taskDefinitionRegistry.js';
import { TerminalMenuBarGroup } from '../../terminal/browser/terminalMenus.js';
import { isString } from '../../../../base/common/types.js';
import { promiseWithResolvers } from '../../../../base/common/async.js';

import { TerminalContextKeys } from '../../terminal/common/terminalContextKey.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { ITerminalInstance, ITerminalService } from '../../terminal/browser/terminal.js';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RunAutomaticTasks, LifecyclePhase.Eventually);

registerAction2(ManageAutomaticTaskRunning);
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: ManageAutomaticTaskRunning.ID,
		title: ManageAutomaticTaskRunning.LABEL,
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});

export class TaskStatusBarContributions extends Disposable implements IWorkbenchContribution {
	private _runningTasksStatusItem: IStatusbarEntryAccessor | undefined;
	private _activeTasksCount: number = 0;

	constructor(
		@ITaskService private readonly _taskService: ITaskService,
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@IProgressService private readonly _progressService: IProgressService
	) {
		super();
		this._registerListeners();
	}

	private _registerListeners(): void {
		let promise: Promise<void> | undefined = undefined;
		let resolve: (value?: void | Thenable<void>) => void;
		this._register(this._taskService.onDidStateChange(event => {
			if (event.kind === TaskEventKind.Changed) {
				this._updateRunningTasksStatus();
			}

			if (!this._ignoreEventForUpdateRunningTasksCount(event)) {
				switch (event.kind) {
					case TaskEventKind.Active:
						this._activeTasksCount++;
						if (this._activeTasksCount === 1) {
							if (!promise) {
								({ promise, resolve } = promiseWithResolvers<void>());
							}
						}
						break;
					case TaskEventKind.Inactive:
						// Since the exiting of the sub process is communicated async we can't order inactive and terminate events.
						// So try to treat them accordingly.
						if (this._activeTasksCount > 0) {
							this._activeTasksCount--;
							if (this._activeTasksCount === 0) {
								if (promise && resolve) {
									resolve!();
								}
							}
						}
						break;
					case TaskEventKind.Terminated:
						if (this._activeTasksCount !== 0) {
							this._activeTasksCount = 0;
							if (promise && resolve) {
								resolve!();
							}
						}
						break;
				}
			}

			if (promise && (event.kind === TaskEventKind.Active) && (this._activeTasksCount === 1)) {
				this._progressService.withProgress({ location: ProgressLocation.Window, command: 'workbench.action.tasks.showTasks' }, progress => {
					progress.report({ message: nls.localize('building', '正在生成...') });
					return promise!;
				}).then(() => {
					promise = undefined;
				});
			}
		}));
	}

	private async _updateRunningTasksStatus(): Promise<void> {
		const tasks = await this._taskService.getActiveTasks();
		if (tasks.length === 0) {
			if (this._runningTasksStatusItem) {
				this._runningTasksStatusItem.dispose();
				this._runningTasksStatusItem = undefined;
			}
		} else {
			const itemProps: IStatusbarEntry = {
				name: nls.localize('status.runningTasks', "运行任务"),
				text: `$(tools) ${tasks.length}`,
				ariaLabel: nls.localize('numberOfRunningTasks', "{0} 个正在运行的任务", tasks.length),
				tooltip: nls.localize('runningTasks', "显示运行中的任务"),
				command: 'workbench.action.tasks.showTasks',
			};

			if (!this._runningTasksStatusItem) {
				this._runningTasksStatusItem = this._statusbarService.addEntry(itemProps, 'status.runningTasks', StatusbarAlignment.LEFT, { location: { id: 'status.problems', priority: 50 }, alignment: StatusbarAlignment.RIGHT });
			} else {
				this._runningTasksStatusItem.update(itemProps);
			}
		}
	}

	private _ignoreEventForUpdateRunningTasksCount(event: ITaskEvent): boolean {
		if (!this._taskService.inTerminal() || event.kind === TaskEventKind.Changed) {
			return false;
		}

		if ((isString(event.group) ? event.group : event.group?._id) !== TaskGroup.Build._id) {
			return true;
		}

		return event.__task.configurationProperties.problemMatchers === undefined || event.__task.configurationProperties.problemMatchers.length === 0;
	}
}

workbenchRegistry.registerWorkbenchContribution(TaskStatusBarContributions, LifecyclePhase.Restored);

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Run,
	command: {
		id: 'workbench.action.tasks.runTask',
		title: nls.localize({ key: 'miRunTask', comment: ['&& denotes a mnemonic'] }, "运行任务(&&R)…")
	},
	order: 1,
	when: TaskExecutionSupportedContext
});

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Run,
	command: {
		id: 'workbench.action.tasks.build',
		title: nls.localize({ key: 'miBuildTask', comment: ['&& denotes a mnemonic'] }, "运行生成任务(&&B)…")
	},
	order: 2,
	when: TaskExecutionSupportedContext
});

// Manage Tasks
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Manage,
	command: {
		precondition: TASK_RUNNING_STATE,
		id: 'workbench.action.tasks.showTasks',
		title: nls.localize({ key: 'miRunningTask', comment: ['&& denotes a mnemonic'] }, "显示正在运行的任务(&&G)…")
	},
	order: 1,
	when: TaskExecutionSupportedContext
});

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Manage,
	command: {
		precondition: TASK_RUNNING_STATE,
		id: 'workbench.action.tasks.restartTask',
		title: nls.localize({ key: 'miRestartTask', comment: ['&& denotes a mnemonic'] }, "重启正在运行的任务(&&E)…")
	},
	order: 2,
	when: TaskExecutionSupportedContext
});

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Manage,
	command: {
		precondition: TASK_RUNNING_STATE,
		id: 'workbench.action.tasks.terminate',
		title: nls.localize({ key: 'miTerminateTask', comment: ['&& denotes a mnemonic'] }, "终止任务(&&T)…")
	},
	order: 3,
	when: TaskExecutionSupportedContext
});

// Configure Tasks
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Configure,
	command: {
		id: 'workbench.action.tasks.configureTaskRunner',
		title: nls.localize({ key: 'miConfigureTask', comment: ['&& denotes a mnemonic'] }, "配置任务(&&C)…")
	},
	order: 1,
	when: TaskExecutionSupportedContext
});

MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
	group: TerminalMenuBarGroup.Configure,
	command: {
		id: 'workbench.action.tasks.configureDefaultBuildTask',
		title: nls.localize({ key: 'miConfigureBuildTask', comment: ['&& denotes a mnemonic'] }, "配置默认生成任务(&&F)…")
	},
	order: 2,
	when: TaskExecutionSupportedContext
});


MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.openWorkspaceFileTasks',
		title: nls.localize2('workbench.action.tasks.openWorkspaceFileTasks', "打开工作区任务"),
		category: TASKS_CATEGORY
	},
	when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo('workspace'), TaskExecutionSupportedContext)
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: ConfigureTaskAction.ID,
		title: ConfigureTaskAction.TEXT,
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.showLog',
		title: nls.localize2('ShowLogAction.label', "显示任务日志"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.runTask',
		title: nls.localize2('RunTaskAction.label', "运行任务"),
		category: TASKS_CATEGORY
	}
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.reRunTask',
		title: nls.localize2('ReRunTaskAction.label', "重新运行上一个任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.restartTask',
		title: nls.localize2('RestartTaskAction.label', "重启正在运行的任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: RerunAllRunningTasksCommandId,
		title: nls.localize2('RerunAllRunningTasksAction.label', "重新运行所有正在运行的任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.showTasks',
		title: nls.localize2('ShowTasksAction.label', "显示运行中的任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.terminate',
		title: nls.localize2('TerminateAction.label', "终止任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.build',
		title: nls.localize2('BuildAction.label', "运行生成任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.test',
		title: nls.localize2('TestAction.label', "运行测试任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.configureDefaultBuildTask',
		title: nls.localize2('ConfigureDefaultBuildTask.label', "配置默认生成任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.configureDefaultTestTask',
		title: nls.localize2('ConfigureDefaultTestTask.label', "配置默认测试任务"),
		category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: 'workbench.action.tasks.openUserTasks',
		title: nls.localize2('workbench.action.tasks.openUserTasks', "打开用户任务"), category: TASKS_CATEGORY
	},
	when: TaskExecutionSupportedContext
});

class UserTasksGlobalActionContribution extends Disposable implements IWorkbenchContribution {

	constructor() {
		super();
		this.registerActions();
	}

	private registerActions() {
		const id = 'workbench.action.tasks.openUserTasks';
		const title = nls.localize('tasks', "任务");
		this._register(MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
			command: {
				id,
				title
			},
			when: TaskExecutionSupportedContext,
			group: '2_configuration',
			order: 6
		}));
		this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
			command: {
				id,
				title
			},
			when: TaskExecutionSupportedContext,
			group: '2_configuration',
			order: 6
		}));
	}
}
workbenchRegistry.registerWorkbenchContribution(UserTasksGlobalActionContribution, LifecyclePhase.Restored);

// MenuRegistry.addCommand( { id: 'workbench.action.tasks.rebuild', title: nls.localize('RebuildAction.label', 'Run Rebuild Task'), category: tasksCategory });
// MenuRegistry.addCommand( { id: 'workbench.action.tasks.clean', title: nls.localize('CleanAction.label', 'Run Clean Task'), category: tasksCategory });

KeybindingsRegistry.registerKeybindingRule({
	id: 'workbench.action.tasks.build',
	weight: KeybindingWeight.WorkbenchContrib,
	when: TaskCommandsRegistered,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB
});

// Tasks Output channel. Register it before using it in Task Service.
const outputChannelRegistry = Registry.as<IOutputChannelRegistry>(OutputExt.OutputChannels);
outputChannelRegistry.registerChannel({ id: AbstractTaskService.OutputChannelId, label: AbstractTaskService.OutputChannelLabel, log: false });


// Register Quick Access
const quickAccessRegistry = (Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess));
const tasksPickerContextKey = 'inTasksPicker';

quickAccessRegistry.registerQuickAccessProvider({
	ctor: TasksQuickAccessProvider,
	prefix: TasksQuickAccessProvider.PREFIX,
	contextKey: tasksPickerContextKey,
	placeholder: nls.localize('tasksQuickAccessPlaceholder', "键入要运行的任务的名称。"),
	helpEntries: [{ description: nls.localize('tasksQuickAccessHelp', "运行任务"), commandCenterOrder: 60 }]
});

// tasks.json validation
const schema: IJSONSchema = {
	id: tasksSchemaId,
	description: 'Task definition file',
	type: 'object',
	allowTrailingCommas: true,
	allowComments: true,
	default: {
		version: '2.0.0',
		tasks: [
			{
				label: 'My Task',
				command: 'echo hello',
				type: 'shell',
				args: [],
				problemMatcher: ['$tsc'],
				presentation: {
					reveal: 'always'
				},
				group: 'build'
			}
		]
	}
};

schema.definitions = {
	...schemaVersion1.definitions,
	...schemaVersion2.definitions,
};
schema.oneOf = [...(schemaVersion2.oneOf || []), ...(schemaVersion1.oneOf || [])];

const jsonRegistry = <jsonContributionRegistry.IJSONContributionRegistry>Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(tasksSchemaId, schema);

export class TaskRegistryContribution extends Disposable implements IWorkbenchContribution {
	static ID = 'taskRegistryContribution';
	constructor() {
		super();

		this._register(ProblemMatcherRegistry.onMatcherChanged(() => {
			updateProblemMatchers();
			jsonRegistry.notifySchemaChanged(tasksSchemaId);
		}));

		this._register(TaskDefinitionRegistry.onDefinitionsChanged(() => {
			updateTaskDefinitions();
			jsonRegistry.notifySchemaChanged(tasksSchemaId);
		}));
	}
}
registerWorkbenchContribution2(TaskRegistryContribution.ID, TaskRegistryContribution, WorkbenchPhase.AfterRestored);


const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'task',
	order: 100,
	title: nls.localize('tasksConfigurationTitle', "任务"),
	type: 'object',
	properties: {
		[TaskSettingId.ProblemMatchersNeverPrompt]: {
			markdownDescription: nls.localize('task.problemMatchers.neverPrompt', "配置在运行任务时是否显示问题匹配器提示。设置为\"true\"从不提示，或使用任务类型的字典仅关闭特定任务类型的提示。"),
			'oneOf': [
				{
					type: 'boolean',
					markdownDescription: nls.localize('task.problemMatchers.neverPrompt.boolean', '为所有任务设置问题匹配器提示行为。')
				},
				{
					type: 'object',
					patternProperties: {
						'.*': {
							type: 'boolean'
						}
					},
					markdownDescription: nls.localize('task.problemMatchers.neverPrompt.array', '包含任务类型布尔对的对象，从不提示有问题的匹配者。'),
					default: {
						'shell': true
					}
				}
			],
			default: false
		},
		[TaskSettingId.AutoDetect]: {
			markdownDescription: nls.localize('task.autoDetect', "控制为所有任务提供程序扩展启用\"提供任务\"。如果\"任务: 运行任务\"命令速度较慢，则禁用任务提供程序的自动检测可能会提供帮助。单个扩展还可以提供禁用自动检测的设置。"),
			type: 'string',
			enum: ['on', 'off'],
			default: 'on'
		},
		[TaskSettingId.SlowProviderWarning]: {
			markdownDescription: nls.localize('task.slowProviderWarning', "配置当提供程序速度较慢时是否显示警告"),
			'oneOf': [
				{
					type: 'boolean',
					markdownDescription: nls.localize('task.slowProviderWarning.boolean', '为所有任务设置慢速提供程序警告。')
				},
				{
					type: 'array',
					items: {
						type: 'string',
						markdownDescription: nls.localize('task.slowProviderWarning.array', '从不显示慢速提供程序警告的任务类型的数组。')
					}
				}
			],
			default: true
		},
		[TaskSettingId.QuickOpenHistory]: {
			markdownDescription: nls.localize('task.quickOpen.history', "控制任务快速打开对话框中跟踪的最近项目数。"),
			type: 'number',
			default: 30, minimum: 0, maximum: 30
		},
		[TaskSettingId.QuickOpenDetail]: {
			markdownDescription: nls.localize('task.quickOpen.detail', "控制是否显示在“运行任务”等任务快速选取中具有详细信息的任务的详细信息。"),
			type: 'boolean',
			default: true
		},
		[TaskSettingId.QuickOpenSkip]: {
			type: 'boolean',
			description: nls.localize('task.quickOpen.skip', "控制当只有一个任务要选取时是否跳过任务快速选取。"),
			default: false
		},
		[TaskSettingId.QuickOpenShowAll]: {
			type: 'boolean',
			description: nls.localize('task.quickOpen.showAll', "使 Tasks: Run Task 命令使用速度较慢的“全部显示”行为，而不是使用任务按提供程序进行分组的速度更快的双层选取器。"),
			default: false
		},
		[TaskSettingId.AllowAutomaticTasks]: {
			type: 'string',
			enum: ['on', 'off'],
			enumDescriptions: [
				nls.localize('task.allowAutomaticTasks.on', "始终"),
				nls.localize('task.allowAutomaticTasks.off', "从不"),
			],
			description: nls.localize('task.allowAutomaticTasks', "启用自动任务 - 请注意，任务将不会在不受信任的工作区中运行。"),
			default: 'off',
			scope: ConfigurationScope.APPLICATION,
			restricted: true
		},
		[TaskSettingId.Reconnection]: {
			type: 'boolean',
			description: nls.localize('task.reconnection', "在窗口重新加载时，重新连接到具有问题匹配器的任务。"),
			default: true
		},
		[TaskSettingId.SaveBeforeRun]: {
			markdownDescription: nls.localize(
				'task.saveBeforeRun',
				'在运行任务前保存所有未保存的编辑器。'
			),
			type: 'string',
			enum: ['always', 'never', 'prompt'],
			enumDescriptions: [
				nls.localize('task.saveBeforeRun.always', '运行前始终保存所有编辑器。'),
				nls.localize('task.saveBeforeRun.never', '运行前绝不保存编辑器。'),
				nls.localize('task.SaveBeforeRun.prompt', '提示在运行前是否保存编辑器。'),
			],
			default: 'always',
		},
		[TaskSettingId.NotifyWindowOnTaskCompletion]: {
			type: 'integer',
			markdownDescription: nls.localize('task.NotifyWindowOnTaskCompletion', '控制在任务已完成且窗口未聚焦的情况下，距离显示 OS 通知的最短任务运行时间(毫秒)。设置为 -1 可禁用通知。设置为 0 则始终显示通知。这包括窗口徽章和通知横幅。'),
			default: 60000,
			minimum: -1,
			agentsWindow: { default: -1 },
		},
		[TaskSettingId.VerboseLogging]: {
			type: 'boolean',
			description: nls.localize('task.verboseLogging', "为任务启用详细日志记录。"),
			default: false
		},
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: RerunForActiveTerminalCommandId,
			icon: rerunTaskIcon,
			title: nls.localize2('workbench.action.tasks.rerunForActiveTerminal', '重新运行任务'),
			precondition: TASK_TERMINAL_ACTIVE,
			menu: [{ id: MenuId.TerminalInstanceContext, when: TASK_TERMINAL_ACTIVE }],
			keybinding: {
				when: TerminalContextKeys.focus,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
				mac: {
					primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyR
				},
				weight: KeybindingWeight.WorkbenchContrib
			}
		});
	}
	async run(accessor: ServicesAccessor, args: unknown): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const taskSystem = accessor.get(ITaskService);
		const instance = args as ITerminalInstance ?? terminalService.activeInstance;
		if (instance) {
			await taskSystem.rerun(instance.instanceId);
		}
	}
});
