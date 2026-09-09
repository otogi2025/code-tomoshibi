/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationPropertySchema, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { workbenchConfigurationNodeBase, Extensions as WorkbenchExtensions, IConfigurationMigrationRegistry, ConfigurationKeyValuePairs, ConfigurationMigration } from '../../../common/configuration.js';
import { AccessibilitySignal } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { AccessibilityVoiceSettingId, ISpeechService, SPEECH_LANGUAGES } from '../../speech/common/speechService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Event } from '../../../../base/common/event.js';
import { isDefined } from '../../../../base/common/types.js';

export const accessibilityHelpIsShown = new RawContextKey<boolean>('accessibilityHelpIsShown', false, true);
export const accessibleViewIsShown = new RawContextKey<boolean>('accessibleViewIsShown', false, true);
export const accessibleViewSupportsNavigation = new RawContextKey<boolean>('accessibleViewSupportsNavigation', false, true);
export const accessibleViewVerbosityEnabled = new RawContextKey<boolean>('accessibleViewVerbosityEnabled', false, true);
export const accessibleViewGoToSymbolSupported = new RawContextKey<boolean>('accessibleViewGoToSymbolSupported', false, true);
export const accessibleViewOnLastLine = new RawContextKey<boolean>('accessibleViewOnLastLine', false, true);
export const accessibleViewCurrentProviderId = new RawContextKey<string>('accessibleViewCurrentProviderId', undefined, undefined);
export const accessibleViewInCodeBlock = new RawContextKey<boolean>('accessibleViewInCodeBlock', undefined, undefined);
export const accessibleViewContainsCodeBlocks = new RawContextKey<boolean>('accessibleViewContainsCodeBlocks', undefined, undefined);
export const accessibleViewHasUnassignedKeybindings = new RawContextKey<boolean>('accessibleViewHasUnassignedKeybindings', undefined, undefined);
export const accessibleViewHasAssignedKeybindings = new RawContextKey<boolean>('accessibleViewHasAssignedKeybindings', undefined, undefined);

/**
 * Miscellaneous settings tagged with accessibility and implemented in the accessibility contrib but
 * were better to live under workbench for discoverability.
 */
export const enum AccessibilityWorkbenchSettingId {
	DimUnfocusedEnabled = 'accessibility.dimUnfocused.enabled',
	DimUnfocusedOpacity = 'accessibility.dimUnfocused.opacity',
	HideAccessibleView = 'accessibility.hideAccessibleView',
	AccessibleViewCloseOnKeyPress = 'accessibility.accessibleView.closeOnKeyPress',
	VerboseChatProgressUpdates = 'accessibility.verboseChatProgressUpdates',
	ShowChatCheckmarks = 'accessibility.chat.showCheckmarks'
}

export const enum ViewDimUnfocusedOpacityProperties {
	Default = 0.75,
	Minimum = 0.2,
	Maximum = 1
}

export const enum AccessibilityVerbositySettingId {
	Terminal = 'accessibility.verbosity.terminal',
	DiffEditor = 'accessibility.verbosity.diffEditor',
	MergeEditor = 'accessibility.verbosity.mergeEditor',
	TerminalInlineChat = 'accessibility.verbosity.terminalChat',
	InlineCompletions = 'accessibility.verbosity.inlineCompletions',
	KeybindingsEditor = 'accessibility.verbosity.keybindingsEditor',
	Editor = 'accessibility.verbosity.editor',
	Hover = 'accessibility.verbosity.hover',
	Notification = 'accessibility.verbosity.notification',
	EmptyEditorHint = 'accessibility.verbosity.emptyEditorHint',
	Comments = 'accessibility.verbosity.comments',
	DiffEditorActive = 'accessibility.verbosity.diffEditorActive',
	Find = 'accessibility.verbosity.find'
}

const baseVerbosityProperty: IConfigurationPropertySchema = {
	type: 'boolean',
	default: true,
	tags: ['accessibility']
};

export const accessibilityConfigurationNodeBase = Object.freeze<IConfigurationNode>({
	id: 'accessibility',
	title: localize('accessibilityConfigurationTitle', "辅助功能"),
	type: 'object'
});

export const soundFeatureBase: IConfigurationPropertySchema = {
	'type': 'string',
	'enum': ['auto', 'on', 'off'],
	'default': 'auto',
	'enumDescriptions': [
		localize('sound.enabled.auto', "附加屏幕阅读器时，启用声音。"),
		localize('sound.enabled.on', "启用声音。"),
		localize('sound.enabled.off', "禁用声音。")
	],
	tags: ['accessibility'],
};

const signalFeatureBase: IConfigurationPropertySchema = {
	'type': 'object',
	'tags': ['accessibility'],
	additionalProperties: false,
	default: {
		sound: 'auto',
		announcement: 'auto'
	}
};

export const announcementFeatureBase: IConfigurationPropertySchema = {
	'type': 'string',
	'enum': ['auto', 'off'],
	'default': 'auto',
	'enumDescriptions': [
		localize('announcement.enabled.auto', "启用公告，仅在屏幕阅读器优化模式下播放。"),
		localize('announcement.enabled.off', "禁用公告。")
	],
	tags: ['accessibility'],
};

const defaultNoAnnouncement: IConfigurationPropertySchema = {
	'type': 'object',
	'tags': ['accessibility'],
	additionalProperties: false,
	'default': {
		'sound': 'auto',
	}
};

const configuration: IConfigurationNode = {
	...accessibilityConfigurationNodeBase,
	scope: ConfigurationScope.RESOURCE,
	properties: {
		[AccessibilityVerbositySettingId.Terminal]: {
			description: localize('verbosity.terminal.description', '提供有关如何在聚焦终端时访问终端辅助功能帮助菜单的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.DiffEditor]: {
			description: localize('verbosity.diffEditor.description', '提供有关如何在聚焦差异编辑器时在其中导航更改的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.InlineCompletions]: {
			description: localize('verbosity.inlineCompletions.description', '提供有关如何访问内联完成悬停和辅助视图的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.KeybindingsEditor]: {
			description: localize('verbosity.keybindingsEditor.description', '提供有关在行聚焦时如何在键盘绑定编辑器中更改键盘绑定以及如何导航到结果表的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Hover]: {
			description: localize('verbosity.hover', '提供有关如何在辅助视图中打开悬停的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Notification]: {
			description: localize('verbosity.notification', '提供有关如何在辅助视图中打开通知的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.EmptyEditorHint]: {
			description: localize('verbosity.emptyEditorHint', '在空文本编辑器中提供有关相关操作的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.Comments]: {
			description: localize('verbosity.comments', '提供有关可在注释小组件或包含注释的文件中执行的操作的信息。'),
			...baseVerbosityProperty
		},
		[AccessibilityVerbositySettingId.DiffEditorActive]: {
			description: localize('verbosity.diffEditorActive', '指示差异编辑器何时成为活动编辑器。'),
			...baseVerbosityProperty
		},
		[AccessibilityWorkbenchSettingId.AccessibleViewCloseOnKeyPress]: {
			markdownDescription: localize('terminal.integrated.accessibleView.closeOnKeyPress', "在 keypress 上，关闭辅助视图，将焦点放在调用它的元素上。"),
			type: 'boolean',
			default: true
		},
		[AccessibilityVerbositySettingId.Find]: {
			description: localize('verbosity.find', '提供有关在以查找输入为焦点时如何访问查找辅助功能帮助菜单的信息。'),
			...baseVerbosityProperty
		},
		'accessibility.signalOptions.volume': {
			'description': localize('accessibility.signalOptions.volume', "声音音量百分比(0-100)。"),
			'type': 'number',
			'minimum': 0,
			'maximum': 100,
			'default': 70,
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.debouncePositionChanges': {
			'description': localize('accessibility.signalOptions.debouncePositionChanges', "是否应停用位置更改"),
			'type': 'boolean',
			'default': false,
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.general': {
			'type': 'object',
			'description': 'Delays for all signals besides error and warning at position',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.general.announcement', "播放通知前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.general.sound', "播放声音之前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 400
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.warningAtPosition': {
			'type': 'object',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.warningAtPosition.announcement', "当该位置出现警告时，播放通知之前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.warningAtPosition.sound', "当该位置出现警告时，播放声音之前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 1000
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signalOptions.experimental.delays.errorAtPosition': {
			'type': 'object',
			'additionalProperties': false,
			'properties': {
				'announcement': {
					'description': localize('accessibility.signalOptions.delays.errorAtPosition.announcement', "当该位置出现错误时，播放通知之前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 3000
				},
				'sound': {
					'description': localize('accessibility.signalOptions.delays.errorAtPosition.sound', "当该位置出现错误时，播放声音之前的延迟(以毫秒为单位)。"),
					'type': 'number',
					'minimum': 0,
					'default': 1000
				}
			},
			'tags': ['accessibility']
		},
		'accessibility.signals.lineHasBreakpoint': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasBreakpoint', "播放信号 -声音(音频提示)和/或公告(警报) - 活动行出现断点时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasBreakpoint.sound', "当有效行具有断点时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasBreakpoint.announcement', "活动行出现断点时播报通知。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.lineHasInlineSuggestion': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.lineHasInlineSuggestion', "活动行包含内联建议时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasInlineSuggestion.sound', "当有效行具有内联建议时播放声音。"),
					...soundFeatureBase,
					'default': 'off'
				}
			}
		},
		'accessibility.signals.nextEditSuggestion': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.nextEditSuggestion', "当有下一个编辑建议时，播放信号音/音频提示和/或公告(警报)。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.nextEditSuggestion.sound', "有下一个编辑建议时播放声音。"),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.nextEditSuggestion.announcement', "有下一个编辑建议时播放声音。"),
					...announcementFeatureBase,
				},
			}
		},
		'accessibility.signals.lineHasError': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasError', "播放信号 -声音(音频提示)和/或公告(警报) - 活动行出现错误时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasError.sound', "当有效行出现错误时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasError.announcement', "活动行出现错误时播报通知。"),
					...announcementFeatureBase,
					default: 'off'
				},
			},
		},
		'accessibility.signals.lineHasFoldedArea': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasFoldedArea', "播放信号 - 声音(音频提示)和/或公告(警报) - 活动行包含可展开的折叠区域时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasFoldedArea.sound', "当有效行具有可展开的折叠区域时播放声音。"),
					...soundFeatureBase,
					default: 'off'
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasFoldedArea.announcement', "活动行出现可展开的折叠区域时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.lineHasWarning': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.lineHasWarning', "播放信号 -声音(音频提示)和/或公告(警报) - 活动行出现警告时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.lineHasWarning.sound', "当有效行出现警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.lineHasWarning.announcement', "活动行出现警告时播报通知。"),
					...announcementFeatureBase,
					default: 'off'
				},
			},
		},
		'accessibility.signals.positionHasError': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.positionHasError', "播放信号 -声音(音频提示)和/或公告(警报) - 活动行出现警告时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.positionHasError.sound', "当有效行出现警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.positionHasError.announcement', "活动行出现警告时播报通知。"),
					...announcementFeatureBase,
					default: 'on'
				},
			},
		},
		'accessibility.signals.positionHasWarning': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.positionHasWarning', "播放信号 -声音(音频提示)和/或公告(警报) - 活动行出现警告时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.positionHasWarning.sound', "当有效行出现警告时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.positionHasWarning.announcement', "活动行出现警告时播报通知。"),
					...announcementFeatureBase,
					default: 'on'
				},
			},
		},
		'accessibility.signals.onDebugBreak': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.onDebugBreak', "播放信号 -声音(音频提示)和/或公告(警报) - 调试程序在断点处停止时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.onDebugBreak.sound', "当调试程序在断点上停止时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.onDebugBreak.announcement', "调试程序在断点上停止时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.noInlayHints': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.noInlayHints', "播放信号 -声音(音频提示)和/或公告(警报) - 尝试读取带有包含无内嵌提示的内嵌提示的行时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.noInlayHints.sound', "尝试读取包含无内嵌提示的内嵌提示的行时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.noInlayHints.announcement', "尝试读取带有包含无内嵌提示的内嵌提示的行时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.taskCompleted': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.taskCompleted', "播放信号 - 声音(音频提示)和/或公告(警报) - 完成任务时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.taskCompleted.sound', "任务完成时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.taskCompleted.announcement', "任务完成时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.taskFailed': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.taskFailed', "播放信号 -声音(音频提示)和/或公告(警报) - 任务失败(非零退出代码)时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.taskFailed.sound', "任务失败时播放声音(非零退出代码)。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.taskFailed.announcement', "任务失败(非零退出代码)时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalCommandFailed': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalCommandFailed', "播放信号 - 终端命令失败(非零退出代码)或在可访问视图中导航到具有此类退出代码的命令时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalCommandFailed.sound', "当终端命令失败(非零退出代码)或在可访问视图中导航到具有此类退出代码的命令时，播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalCommandFailed.announcement', "终端命令失败(非零退出代码)或在可访问视图中导航到具有此类退出代码的命令时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalCommandSucceeded': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalCommandSucceeded', "当终端命令成功(零退出代码)或在可访问视图中导航到具有此类退出代码的命令时，播放信号 - 声音(音频提示)和/或公告(警报)。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalCommandSucceeded.sound', "当终端命令成功(零退出代码)或在可访问视图中导航到具有此类退出代码的命令时，播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalCommandSucceeded.announcement', "终端命令成功(零退出代码)或在可访问视图中导航到具有此类退出代码的命令时，播放公告。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalQuickFix': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalQuickFix', "播放信号 -声音(音频提示)和/或公告(警报) - 终端快速修复可用时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalQuickFix.sound', "当终端快速修复可用时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalQuickFix.announcement', "终端快速修复可用时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.terminalBell': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.terminalBell', "播放信号 -声音(音频提示)和/或公告(警报) - 终端铃声响铃时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.terminalBell.sound', "当终端钟响铃时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.terminalBell.announcement', "终端钟响铃时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.diffLineInserted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineInserted', "当焦点在可访问差异查看器模式下移动到插入行或下一个/上一个更改时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.sound', "当焦点移到可访问差异查看器下的已插入行或下一/上一个更改时播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.diffLineModified': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineModified', "当焦点在可访问差异查看器模式下移动到修改行或下一个/上一个更改时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.diffLineModified.sound', "当焦点移到可访问差异查看器下的已修改行或下一/上一个更改时播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.diffLineDeleted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.diffLineDeleted', "当焦点在可访问差异查看器模式下移动到删除行或下一个/上一个更改时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.diffLineDeleted.sound', "当焦点移到可访问差异查看器下的已删除行或下一/上一个更改时播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.chatEditModifiedFile': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.chatEditModifiedFile', "在显示包含聊天编辑更改的文件时播放声音/音频提示"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatEditModifiedFile.sound', "在显示包含聊天编辑更改的文件时播放声音"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.progress': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.progress', "播放信号 -声音(音频提示)和/或公告(警报) - 进度过程中发生循环时。"),
			'default': {
				'sound': 'auto',
				'announcement': 'off'
			},
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.progress.sound', "在进行进度时循环播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.progress.announcement', "在进度进行时循环发出警报。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.chatRequestSent': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.chatRequestSent', "播放信号 - 声音(音频提示)和/或公告(警报) - 发出聊天请求时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatRequestSent.sound', "发出聊天请求时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.chatRequestSent.announcement', "发出聊天请求时播报通知。"),
					...announcementFeatureBase
				},
			}
		},
		'accessibility.signals.chatResponseReceived': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.chatResponseReceived', "收到响应时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatResponseReceived.sound', "收到响应时播放声音。"),
					...soundFeatureBase
				},
			}
		},
		'accessibility.signals.codeActionTriggered': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.codeActionTriggered', "播放声音/音频提示 - 触发代码操作时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.codeActionTriggered.sound', "触发代码操作时播放声音。"),
					...soundFeatureBase
				}
			}
		},
		'accessibility.signals.codeActionApplied': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.codeActionApplied', "应用代码操作后播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.codeActionApplied.sound', "应用代码操作后播放声音。"),
					...soundFeatureBase
				},
			}
		},
		'accessibility.signals.voiceRecordingStarted': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.voiceRecordingStarted', "语音录制开始时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceRecordingStarted.sound', "语音录制开始时播放声音。"),
					...soundFeatureBase,
				},
			},
			'default': {
				'sound': 'on'
			}
		},
		'accessibility.signals.voiceModeStarted': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.voiceModeStarted', "Plays a signal - sound (audio cue) and/or announcement (alert) - when voice mode has started."),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceModeStarted.sound', "Plays a sound when voice mode has started."),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.voiceModeStarted.announcement', "Announces when voice mode has started."),
					...announcementFeatureBase,
				}
			},
			'default': {
				'sound': 'on',
				'announcement': 'auto'
			}
		},
		'accessibility.signals.voiceRecordingStopped': {
			...defaultNoAnnouncement,
			'description': localize('accessibility.signals.voiceRecordingStopped', "语音录制停止时播放声音/音频提示。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceRecordingStopped.sound', "语音录制停止时播放声音。"),
					...soundFeatureBase,
				},
			},
			'default': {
				'sound': 'on'
			}
		},
		'accessibility.signals.voiceModeStopped': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.voiceModeStopped', "Plays a signal - sound (audio cue) and/or announcement (alert) - when voice mode has stopped."),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.voiceModeStopped.sound', "Plays a sound when voice mode has stopped."),
					...soundFeatureBase,
				},
				'announcement': {
					'description': localize('accessibility.signals.voiceModeStopped.announcement', "Announces when voice mode has stopped."),
					...announcementFeatureBase,
				}
			},
			'default': {
				'sound': 'on',
				'announcement': 'auto'
			}
		},
		'accessibility.signals.clear': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.clear', "播放信号 - 声音(音频提示)和/或公告(警报) - 清除功能(例如，终端、调试控制台或输出通道)时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.clear.sound', "清除功能时播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.clear.announcement', "清除功能时播报通知。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.editsUndone': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.editsUndone', "撤消编辑后播放信号 - 声音(音频提示)和/或通知(警报)。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.editsUndone.sound', "撤消编辑后播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.editsUndone.announcement', "撤消编辑后发出通知。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.editsKept': {
			...signalFeatureBase,
			'description': localize('accessibility.signals.editsKept', "保存编辑后播放信号 - 声音(音频提示)和/或通知(警报)。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.editsKept.sound', "保留编辑后播放声音。"),
					...soundFeatureBase
				},
				'announcement': {
					'description': localize('accessibility.signals.editsKept.announcement', "保留编辑后发出通知。"),
					...announcementFeatureBase
				},
			},
		},
		'accessibility.signals.save': {
			'type': 'object',
			'tags': ['accessibility'],
			additionalProperties: false,
			'markdownDescription': localize('accessibility.signals.save', "播放信号 - 声音(音频提示)和/或公告(警报) - 保存文件时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.save.sound', "保存文件时播放声音。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.save.sound.userGesture', "当用户显式保存文件时播放声音。"),
						localize('accessibility.signals.save.sound.always', "每次保存文件(包括自动保存)时播放声音。"),
						localize('accessibility.signals.save.sound.never', "从不播放声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.save.announcement', "保存文件时播报通知。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.save.announcement.userGesture', "当用户显式保存文件时，将报出。"),
						localize('accessibility.signals.save.announcement.always', "每当保存文件(包括自动保存)时，都会报出。"),
						localize('accessibility.signals.save.announcement.never', "从不播放公告。")
					],
				},
			},
			default: {
				'sound': 'never',
				'announcement': 'never'
			}
		},
		'accessibility.signals.format': {
			'type': 'object',
			'tags': ['accessibility'],
			additionalProperties: false,
			'markdownDescription': localize('accessibility.signals.format', "播放信号 -声音(音频提示)和/或公告(警报) - 设置文件或笔记本的格式时。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.format.sound', "在格式化文件或笔记本时播放声音。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.format.userGesture', "在用户显式保存文件时播放声音。"),
						localize('accessibility.signals.format.always', "每次格式化文件(包括将其设置为在保存、键入、粘贴或运行单元格时格式化)时播放声音。"),
						localize('accessibility.signals.format.never', "从不播放声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.format.announcement', "格式化文件或笔记本时播报通知。"),
					'type': 'string',
					'enum': ['userGesture', 'always', 'never'],
					'default': 'never',
					'enumDescriptions': [
						localize('accessibility.signals.format.announcement.userGesture', "用户显式格式化文件时播报通知。"),
						localize('accessibility.signals.format.announcement.always', "每次文件格式化时(包括在将文件设置为在保存、键入、粘贴或运行单元格时格式化)，发出公告。"),
						localize('accessibility.signals.format.announcement.never', "从不报出。")
					],
				},
			},
			default: {
				'sound': 'never',
				'announcement': 'never'
			}
		},
		'accessibility.signals.chatUserActionRequired': {
			...signalFeatureBase,
			'markdownDescription': localize('accessibility.signals.chatUserActionRequired', "当聊天中需要用户操作时，播放信号 - 声音(音频提示)和/或通知(警报)。"),
			'properties': {
				'sound': {
					'description': localize('accessibility.signals.chatUserActionRequired.sound', "在聊天中需要用户操作时播放声音。"),
					'type': 'string',
					'enum': ['auto', 'on', 'off'],
					'enumDescriptions': [
						localize('sound.enabled.autoWindow', "附加屏幕阅读器时，启用声音。"),
						localize('sound.enabled.on', "启用声音。"),
						localize('sound.enabled.off', "禁用声音。")
					],
				},
				'announcement': {
					'description': localize('accessibility.signals.chatUserActionRequired.announcement', "在聊天中需要用户操作时发出通知 - 包括有关操作与如何执行操作的信息。"),
					...announcementFeatureBase
				},
			},
			default: {
				'sound': 'auto',
				'announcement': 'auto'
			},
			tags: ['accessibility']
		},
		'accessibility.underlineLinks': {
			'type': 'boolean',
			'description': localize('accessibility.underlineLinks', "控制是否应在工作台中向链接添加下划线。"),
			'default': false,
		},
		'accessibility.debugWatchVariableAnnouncements': {
			'type': 'boolean',
			'description': localize('accessibility.debugWatchVariableAnnouncements', "控制是否应在调试监视视图中公布变量更改。"),
			'default': true,
		},
		'accessibility.replEditor.readLastExecutionOutput': {
			'type': 'boolean',
			'description': localize('accessibility.replEditor.readLastExecutedOutput', "控制是否将宣布来自本机 REPL 中执行的输出。"),
			'default': true,
		},
		'accessibility.replEditor.autoFocusReplExecution': {
			type: 'string',
			enum: ['none', 'input', 'lastExecution'],
			default: 'input',
			description: localize('replEditor.autoFocusAppendedCell', "控制执行代码时是否应自动将焦点发送到 REPL。"),
		},
		'accessibility.windowTitleOptimized': {
			'type': 'boolean',
			'default': true,
			'markdownDescription': localize('accessibility.windowTitleOptimized', "控制在屏幕阅读器模式下是否应针对屏幕阅读器优化 {0}。启用后，窗口标题会将 {1} 追加到末尾。", '`#window.title#`', '`activeEditorState`')
		},
		'accessibility.openChatEditedFiles': {
			'type': 'boolean',
			'default': false,
			'markdownDescription': localize('accessibility.openChatEditedFiles', "控制在聊天代理对文件应用编辑后是否应打开文件。")
		},
		'accessibility.verboseChatProgressUpdates': {
			'type': 'boolean',
			'default': true,
			'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "控制是否应在聊天请求进行过程中发出详细的进度公告，包括 <search term> 的搜索文本(具有 X 个结果)、创建的文件 <file_name> 或读取文件 <file path> 等信息。")
		}
	}
};

export function registerAccessibilityConfiguration() {
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	registry.registerConfiguration(configuration);

	registry.registerConfiguration({
		...workbenchConfigurationNodeBase,
		properties: {
			[AccessibilityWorkbenchSettingId.DimUnfocusedEnabled]: {
				description: localize('dimUnfocusedEnabled', '是否将未聚焦的编辑器和终端变暗，这可以更清楚地说明键入的输入将转到何处。这适用于大多数编辑器，但使用 iframe(如笔记本和扩展 Web 视图编辑器)的编辑器除外。'),
				type: 'boolean',
				default: false,
				tags: ['accessibility'],
				scope: ConfigurationScope.APPLICATION,
			},
			[AccessibilityWorkbenchSettingId.DimUnfocusedOpacity]: {
				markdownDescription: localize('dimUnfocusedOpacity', '不透明度分数 (0.2 到 1.0) 用于未聚焦的编辑器和终端。这仅在启用 {0} 时生效。', `\`#${AccessibilityWorkbenchSettingId.DimUnfocusedEnabled}#\``),
				type: 'number',
				minimum: ViewDimUnfocusedOpacityProperties.Minimum,
				maximum: ViewDimUnfocusedOpacityProperties.Maximum,
				default: ViewDimUnfocusedOpacityProperties.Default,
				tags: ['accessibility'],
				scope: ConfigurationScope.APPLICATION,
			},
			[AccessibilityWorkbenchSettingId.HideAccessibleView]: {
				description: localize('accessibility.hideAccessibleView', "控制是否隐藏辅助视图。"),
				type: 'boolean',
				default: false,
				tags: ['accessibility']
			},
			[AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates]: {
				'type': 'boolean',
				'default': true,
				'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "控制是否应在聊天请求进行过程中发出详细的进度公告，包括 <search term> 的搜索文本(具有 X 个结果)、创建的文件 <file_name> 或读取文件 <file path> 等信息。")
			},
			[AccessibilityWorkbenchSettingId.ShowChatCheckmarks]: {
				'type': 'boolean',
				'default': false,
				'tags': ['accessibility'],
				'markdownDescription': localize('accessibility.chat.showCheckmarks', "控制是否在已完成的工具调用和聊天响应中的其他可折叠项上显示勾选图标。")
			}
		}
	});
}

export { AccessibilityVoiceSettingId };

export const SpeechTimeoutDefault = 0;

export class DynamicSpeechAccessibilityConfiguration extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.dynamicSpeechAccessibilityConfiguration';

	constructor(
		@ISpeechService private readonly speechService: ISpeechService
	) {
		super();

		this._register(Event.runAndSubscribe(speechService.onDidChangeHasSpeechProvider, () => this.updateConfiguration()));
	}

	private updateConfiguration(): void {
		if (!this.speechService.hasSpeechProvider) {
			return; // these settings require a speech provider
		}

		const languages = this.getLanguages();
		const languagesSorted = Object.keys(languages).sort((langA, langB) => {
			return languages[langA].name.localeCompare(languages[langB].name);
		});

		const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		registry.registerConfiguration({
			...accessibilityConfigurationNodeBase,
			properties: {
				[AccessibilityVoiceSettingId.SpeechTimeout]: {
					'markdownDescription': localize('voice.speechTimeout', "停止说话后语音识别保持活动状态的持续时间（以毫秒为单位）。例如，在聊天会话中，超时后自动提交听录文本。设置为“0”以禁用此功能。"),
					'type': 'number',
					'default': SpeechTimeoutDefault,
					'minimum': 0,
					'tags': ['accessibility']
				},
				[AccessibilityVoiceSettingId.IgnoreCodeBlocks]: {
					'markdownDescription': localize('voice.ignoreCodeBlocks', "是否忽略文本到语音转换合成中的代码片段。"),
					'type': 'boolean',
					'default': false,
					'tags': ['accessibility']
				},
				[AccessibilityVoiceSettingId.SpeechLanguage]: {
					'markdownDescription': localize('voice.speechLanguage', "文本转语音和语音转文本应使用的语言。如果可能，请选择 `auto` 以使用所配置的显示语言。请注意，语音识别与合成器并不支持所有显示语言。"),
					'type': 'string',
					'enum': languagesSorted,
					'default': 'auto',
					'tags': ['accessibility'],
					'enumDescriptions': languagesSorted.map(key => languages[key].name),
					'enumItemLabels': languagesSorted.map(key => languages[key].name)
				},
				[AccessibilityVoiceSettingId.AutoSynthesize]: {
					'type': 'string',
					'enum': ['on', 'off'],
					'enumDescriptions': [
						localize('accessibility.voice.autoSynthesize.on', "启用该功能。启用屏幕阅读器后，请注意，这将禁用 aria 更新。"),
						localize('accessibility.voice.autoSynthesize.off', "禁用该功能。"),
					],
					'markdownDescription': localize('autoSynthesize', "在将语音用作输入时，是否应自动大声朗读文本响应。例如在聊天会话中，当语音用作聊天请求时，将会自动合成响应。"),
					'default': 'off',
					'tags': ['accessibility']
				}
			}
		});
	}

	private getLanguages(): { [locale: string]: { name: string } } {
		return {
			['auto']: {
				name: localize('speechLanguage.auto', "自动(使用显示语言)")
			},
			...SPEECH_LANGUAGES
		};
	}
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'audioCues.volume',
		migrateFn: (value, accessor) => {
			return [
				['accessibility.signalOptions.volume', { value }],
				['audioCues.volume', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'audioCues.debouncePositionChanges',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.debouncePositionChanges', { value }],
				['audioCues.debouncePositionChanges', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signalOptions',
		migrateFn: (value, accessor) => {
			const delayGeneral = getDelaysFromConfig(accessor, 'general');
			const delayError = getDelaysFromConfig(accessor, 'errorAtPosition');
			const delayWarning = getDelaysFromConfig(accessor, 'warningAtPosition');
			const volume = getVolumeFromConfig(accessor);
			const debouncePositionChanges = getDebouncePositionChangesFromConfig(accessor);
			const result: [key: string, { value: any }][] = [];
			if (!!volume) {
				result.push(['accessibility.signalOptions.volume', { value: volume }]);
			}
			if (!!delayGeneral) {
				result.push(['accessibility.signalOptions.experimental.delays.general', { value: delayGeneral }]);
			}
			if (!!delayError) {
				result.push(['accessibility.signalOptions.experimental.delays.errorAtPosition', { value: delayError }]);
			}
			if (!!delayWarning) {
				result.push(['accessibility.signalOptions.experimental.delays.warningAtPosition', { value: delayWarning }]);
			}
			if (!!debouncePositionChanges) {
				result.push(['accessibility.signalOptions.debouncePositionChanges', { value: debouncePositionChanges }]);
			}
			result.push(['accessibility.signalOptions', { value: undefined }]);
			return result;
		}
	}]);


Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.sounds.volume',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.volume', { value }],
				['accessibility.signals.sounds.volume', { value: undefined }]
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.debouncePositionChanges',
		migrateFn: (value) => {
			return [
				['accessibility.signalOptions.debouncePositionChanges', { value }],
				['accessibility.signals.debouncePositionChanges', { value: undefined }]
			];
		}
	}]);

function getDelaysFromConfig(accessor: (key: string) => any, type: 'general' | 'errorAtPosition' | 'warningAtPosition'): { announcement: number; sound: number } | undefined {
	return accessor(`accessibility.signalOptions.experimental.delays.${type}`) || accessor('accessibility.signalOptions')?.['experimental.delays']?.[`${type}`] || accessor('accessibility.signalOptions')?.['delays']?.[`${type}`];
}

function getVolumeFromConfig(accessor: (key: string) => any): string | undefined {
	return accessor('accessibility.signalOptions.volume') || accessor('accessibility.signalOptions')?.volume || accessor('accessibility.signals.sounds.volume') || accessor('audioCues.volume');
}

function getDebouncePositionChangesFromConfig(accessor: (key: string) => any): number | undefined {
	return accessor('accessibility.signalOptions.debouncePositionChanges') || accessor('accessibility.signalOptions')?.debouncePositionChanges || accessor('accessibility.signals.debouncePositionChanges') || accessor('audioCues.debouncePositionChanges');
}

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: AccessibilityVoiceSettingId.AutoSynthesize,
		migrateFn: (value: boolean) => {
			let newValue: string | undefined;
			if (value === true) {
				newValue = 'on';
			} else if (value === false) {
				newValue = 'off';
			} else {
				return [];
			}
			return [
				[AccessibilityVoiceSettingId.AutoSynthesize, { value: newValue }],
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: 'accessibility.signals.chatResponsePending',
		migrateFn: (value, accessor) => {
			return [
				['accessibility.signals.progress', { value }],
				['accessibility.signals.chatResponsePending', { value: undefined }],
			];
		}
	}]);

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.map<ConfigurationMigration | undefined>(item => item.legacySoundSettingsKey ? ({
		key: item.legacySoundSettingsKey,
		migrateFn: (sound, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			const legacyAnnouncementSettingsKey = item.legacyAnnouncementSettingsKey;
			let announcement: string | undefined;
			if (legacyAnnouncementSettingsKey) {
				announcement = accessor(legacyAnnouncementSettingsKey) ?? undefined;
				if (announcement !== undefined && typeof announcement !== 'string') {
					announcement = announcement ? 'auto' : 'off';
				}
			}
			configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
			configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
			return configurationKeyValuePairs;
		}
	}) : undefined).filter(isDefined));

Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
	.registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.filter(i => !!i.legacyAnnouncementSettingsKey && !!i.legacySoundSettingsKey).map(item => ({
		key: item.legacyAnnouncementSettingsKey!,
		migrateFn: (announcement, accessor) => {
			const configurationKeyValuePairs: ConfigurationKeyValuePairs = [];
			const sound = accessor(item.settingsKey)?.sound || accessor(item.legacySoundSettingsKey!);
			if (announcement !== undefined && typeof announcement !== 'string') {
				announcement = announcement ? 'auto' : 'off';
			}
			configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
			configurationKeyValuePairs.push([`${item.legacyAnnouncementSettingsKey}`, { value: undefined }]);
			configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
			return configurationKeyValuePairs;
		}
	})));
