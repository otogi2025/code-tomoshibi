/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { localize } from '../../../../nls.js';
import { IWalkthrough } from '../../../../platform/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';

const titleTranslated = localize('title', "标题");

export const walkthroughsExtensionPoint = ExtensionsRegistry.registerExtensionPoint<IWalkthrough[]>({
	extensionPoint: 'walkthroughs',
	jsonSchema: {
		description: localize('walkthroughs', "提供演练以帮助用户入门扩展。"),
		type: 'array',
		items: {
			type: 'object',
			required: ['id', 'title', 'description', 'steps'],
			defaultSnippets: [{ body: { 'id': '$1', 'title': '$2', 'description': '$3', 'steps': [] } }],
			properties: {
				id: {
					type: 'string',
					description: localize('walkthroughs.id', "此演练的唯一标识符。"),
				},
				title: {
					type: 'string',
					description: localize('walkthroughs.title', "演练的标题。")
				},
				icon: {
					type: 'string',
					description: localize('walkthroughs.icon', "演练图标的相对路径。路径相对于扩展位置。如果未指定，则图标在可用时将默认为扩展图标。"),
				},
				description: {
					type: 'string',
					description: localize('walkthroughs.description', "演练的说明。")
				},
				featuredFor: {
					type: 'array',
					description: localize('walkthroughs.featuredFor', "与这些 glob 模式之一匹配的演练在具有指定文件的工作区中显示为“特色”。例如，针对 TypeScript 项目的演练可能在此处指定“tsconfig.json”。"),
					items: {
						type: 'string'
					},
				},
				when: {
					type: 'string',
					description: localize('walkthroughs.when', "用于控制此演练的可见性的上下文键表达式。")
				},
				steps: {
					type: 'array',
					description: localize('walkthroughs.steps', "要在此演练期间完成的步骤。"),
					items: {
						type: 'object',
						required: ['id', 'title', 'media'],
						defaultSnippets: [{
							body: {
								'id': '$1', 'title': '$2', 'description': '$3',
								'completionEvents': ['$5'],
								'media': {},
							}
						}],
						properties: {
							id: {
								type: 'string',
								description: localize('walkthroughs.steps.id', "此步骤的唯一标识符。用于跟踪已完成的步骤。"),
							},
							title: {
								type: 'string',
								description: localize('walkthroughs.steps.title', "步骤标题。")
							},
							description: {
								type: 'string',
								description: localize('walkthroughs.steps.description.interpolated', "步骤说明。支持 “preformatted”、__italic__和 **bold** 文本。对命令或外部链接使用 markdown 样式链接: {0}、{1} 或 {2}。在其自身行上的链接将呈现为按钮。", `[${titleTranslated}](command:myext.command)`, `[${titleTranslated}](command:toSide:myext.command)`, `[${titleTranslated}](https://aka.ms)`)
							},
							button: {
								deprecationMessage: localize('walkthroughs.steps.button.deprecated.interpolated', "已弃用。请改用说明中的 markdown 链接，例如 {0}、{1}、或 {2}", `[${titleTranslated}](command:myext.command)`, `[${titleTranslated}](command:toSide:myext.command)`, `[${titleTranslated}](https://aka.ms)`),
							},
							media: {
								type: 'object',
								description: localize('walkthroughs.steps.media', "要与此步骤一起显示的媒体(图像或 Markdown 内容)。"),
								oneOf: [
									{
										required: ['image', 'altText'],
										additionalProperties: false,
										properties: {
											path: {
												deprecationMessage: localize('pathDeprecated', "已弃用。请改用“图像”或“Markdown”")
											},
											image: {
												description: localize('walkthroughs.steps.media.image.path.string', "一个图像或对象的路径，由指向光源、暗和 hc 图像的路径(相对于扩展目录)组成。根据上下文，图像将显示从 400px 到800px 宽，具有相似的高度边界。为了支持 HIDPI 显示，图像将以 1.5 倍缩放比例呈现。例如，900 物理像素宽图像将显示为 600 逻辑像素宽。"),
												oneOf: [
													{
														type: 'string',
													},
													{
														type: 'object',
														required: ['dark', 'light', 'hc', 'hcLight'],
														properties: {
															dark: {
																description: localize('walkthroughs.steps.media.image.path.dark.string', "深色主题相对于扩展目录的图像的路径。"),
																type: 'string',
															},
															light: {
																description: localize('walkthroughs.steps.media.image.path.light.string', "浅色主题相对于扩展目录的图像的路径。"),
																type: 'string',
															},
															hc: {
																description: localize('walkthroughs.steps.media.image.path.hc.string', "hc 主题相对于扩展目录的图像的路径。"),
																type: 'string',
															},
															hcLight: {
																description: localize('walkthroughs.steps.media.image.path.hcLight.string', "hc 浅色主题相对于扩展目录的图像的路径。"),
																type: 'string',
															}
														}
													}
												]
											},
											altText: {
												type: 'string',
												description: localize('walkthroughs.steps.media.altText', "无法加载图像时或在屏幕读取器中显示的替换文字。")
											}
										}
									},
									{
										required: ['svg', 'altText'],
										additionalProperties: false,
										properties: {
											svg: {
												description: localize('walkthroughs.steps.media.image.path.svg', "变量中支持颜色标记、svg 路径以支持与工作台匹配的主题设置。"),
												type: 'string',
											},
											altText: {
												type: 'string',
												description: localize('walkthroughs.steps.media.altText', "无法加载图像时或在屏幕读取器中显示的替换文字。")
											},
										}
									},
									{
										required: ['markdown'],
										additionalProperties: false,
										properties: {
											path: {
												deprecationMessage: localize('pathDeprecated', "已弃用。请改用“图像”或“Markdown”")
											},
											markdown: {
												description: localize('walkthroughs.steps.media.markdown.path', "Markdown 文档的路径(相对于扩展目录)。"),
												type: 'string',
											}
										}
									}
								]
							},
							completionEvents: {
								description: localize('walkthroughs.steps.completionEvents', "应触发此步骤变为已勾选的事件。如果为空或未定义，则在单击任何步骤的按钮或链接时，步骤将撤销复选; 如果该步骤没有按钮或链接，则选中它时会选中。"),
								type: 'array',
								items: {
									type: 'string',
									defaultSnippets: [
										{
											label: 'onCommand',
											description: localize('walkthroughs.steps.completionEvents.onCommand', '在 VS Code 中的任何位置执行给定命令时，勾选步骤。'),
											body: 'onCommand:${1:commandId}'
										},
										{
											label: 'onLink',
											description: localize('walkthroughs.steps.completionEvents.onLink', '通过演练步骤打开给定链接时的签出步骤。'),
											body: 'onLink:${2:linkId}'
										},
										{
											label: 'onView',
											description: localize('walkthroughs.steps.completionEvents.onView', '打开给定视图时选中步骤'),
											body: 'onView:${2:viewId}'
										},
										{
											label: 'onSettingChanged',
											description: localize('walkthroughs.steps.completionEvents.onSettingChanged', '在给定设置发生更改时勾选步骤'),
											body: 'onSettingChanged:${2:settingName}'
										},
										{
											label: 'onContext',
											description: localize('walkthroughs.steps.completionEvents.onContext', '当上下文键表达式为 true 时，勾选步骤。'),
											body: 'onContext:${2:key}'
										},
										{
											label: 'onExtensionInstalled',
											description: localize('walkthroughs.steps.completionEvents.extensionInstalled', '安装具有给定 id 的扩展时，请关闭步骤。如果已安装扩展，则步骤将以勾选状态开始。'),
											body: 'onExtensionInstalled:${3:extensionId}'
										},
										{
											label: 'onStepSelected',
											description: localize('walkthroughs.steps.completionEvents.stepSelected', '选中后立即勾选步骤。'),
											body: 'onStepSelected'
										},
									]
								}
							},
							doneOn: {
								description: localize('walkthroughs.steps.doneOn', "指示将步骤标记为已完成的信号。"),
								deprecationMessage: localize('walkthroughs.steps.doneOn.deprecation', "doneOn 已弃用。默认情况下，单击用户按钮时将勾选步骤，以进一步配置使用 completionEvents"),
								type: 'object',
								required: ['command'],
								defaultSnippets: [{ 'body': { command: '$1' } }],
								properties: {
									'command': {
										description: localize('walkthroughs.steps.oneOn.command', "执行指定命令时将步骤标记为已完成。"),
										type: 'string'
									}
								},
							},
							when: {
								type: 'string',
								description: localize('walkthroughs.steps.when', "用于控制此步骤可见性的上下文键表达式。")
							}
						}
					}
				}
			}
		}
	},
	activationEventsGenerator: function* (walkthroughContributions) {
		for (const walkthroughContribution of walkthroughContributions) {
			if (walkthroughContribution.id) {
				yield `onWalkthrough:${walkthroughContribution.id}`;
			}
		}
	}
});
