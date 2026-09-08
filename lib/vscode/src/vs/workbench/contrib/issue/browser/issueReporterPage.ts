/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { escape } from '../../../../base/common/strings.js';
import { localize } from '../../../../nls.js';

const sendSystemInfoLabel = escape(localize('sendSystemInfo', "包含系统信息"));
const sendProcessInfoLabel = escape(localize('sendProcessInfo', "包含当前运行中的进程"));
const sendWorkspaceInfoLabel = escape(localize('sendWorkspaceInfo', "包含工作区元数据"));
const sendExtensionsLabel = escape(localize('sendExtensions', "包含已启用的扩展"));
const sendExperimentsLabel = escape(localize('sendExperiments', "包括 A/B 试验信息"));
const sendExtensionData = escape(localize('sendExtensionData', "包括其他扩展信息"));
const acknowledgementsLabel = escape(localize('acknowledgements', "我确认我的 VS Code 版本未更新，并且此问题可能会关闭。"));
const reviewGuidanceLabel = localize( // intentionally not escaped because of its embedded tags
	{
		key: 'reviewGuidanceLabel',
		comment: [
			'{Locked="<a href=\"https://github.com/microsoft/vscode/wiki/Submitting-Bugs-and-Suggestions\" target=\"_blank\">"}',
			'{Locked="</a>"}'
		]
	},
	'在此处报告问题之前，请<a href="https://github.com/microsoft/vscode/wiki/Submitting-Bugs-and-Suggestions" target="_blank">查看我们提供的指导</a>。请使用英文填写该表单。'
);

export default (): string => `
<div id="update-banner" class="issue-reporter-update-banner hidden">
	<span class="update-banner-text" id="update-banner-text">
		<!-- To be dynamically filled -->
	</span>
</div>
<div class="issue-reporter" id="issue-reporter">
	<div id="english" class="input-group hidden">${escape(localize('completeInEnglish', "请使用英文进行填写。"))}</div>

	<div id="review-guidance-help-text" class="input-group">${reviewGuidanceLabel}</div>

	<div class="section">
		<div class="input-group">
			<label class="inline-label" for="issue-type">${escape(localize('issueTypeLabel', "这是一个"))}</label>
			<select id="issue-type" class="inline-form-control">
				<!-- To be dynamically filled -->
			</select>
		</div>

		<div class="input-group" id="problem-source">
			<label class="inline-label" for="issue-source">${escape(localize('issueSourceLabel', "适用源"))} <span class="required-input">*</span></label>
			<select id="issue-source" class="inline-form-control" required>
				<!-- To be dynamically filled -->
			</select>
			<div id="issue-source-empty-error" class="validation-error hidden" role="alert">${escape(localize('issueSourceEmptyValidation', "问题源是必需的。"))}</div>
			<div id="problem-source-help-text" class="instructions hidden">${escape(localize('disableExtensionsLabelText', "请试着在{0}之后重现问题。如果此问题仅在扩展运行时才能重现，那么这可能是一个扩展的问题。"))
		.replace('{0}', () => `<span tabIndex=0 role="button" id="disableExtensions" class="workbenchCommand">${escape(localize('disableExtensions', "禁用所有扩展并重新加载窗口"))}</span>`)}
			</div>

			<div id="extension-selection">
				<label class="inline-label" for="extension-selector">${escape(localize('chooseExtension', "扩展"))} <span class="required-input">*</span></label>
				<select id="extension-selector" class="inline-form-control">
					<!-- To be dynamically filled -->
				</select>
				<div id="extension-selection-validation-error" class="validation-error hidden" role="alert">${escape(localize('extensionWithNonstandardBugsUrl', "问题报告程序无法为此扩展创建问题。请访问{0}报告问题。"))
		.replace('{0}', () => `<span tabIndex=0 role="button" id="extensionBugsLink" class="workbenchCommand"><!-- To be dynamically filled --></span>`)}</div>
				<div id="extension-selection-validation-error-no-url" class="validation-error hidden" role="alert">
					${escape(localize('extensionWithNoBugsUrl', "问题报告程序无法为此扩展创建问题，因为它没有指定用于报告问题的 URL。请查看此扩展的应用商店页面，以便查看是否有其他说明。"))}
				</div>
			</div>
		</div>

		<div id="issue-title-container" class="input-group">
			<label class="inline-label" for="issue-title">${escape(localize('issueTitleLabel', "标题"))} <span class="required-input">*</span></label>
			<input id="issue-title" type="text" class="inline-form-control" placeholder="${escape(localize('issueTitleRequired', "请输入标题。"))}" required>
			<div id="issue-title-empty-error" class="validation-error hidden" role="alert">${escape(localize('titleEmptyValidation', "标题是必需的。"))}</div>
			<div id="issue-title-length-validation-error" class="validation-error hidden" role="alert">${escape(localize('titleLengthValidation', "标题太长。"))}</div>
			<small id="similar-issues">
				<!-- To be dynamically filled -->
			</small>
		</div>

	</div>

	<div class="input-group description-section">
		<label for="description" id="issue-description-label">
			<!-- To be dynamically filled -->
		</label>
		<div class="instructions" id="issue-description-subtitle">
			<!-- To be dynamically filled -->
		</div>
		<div class="block-info-text">
			<textarea name="description" id="description" placeholder="${escape(localize('details', "请输入详细信息。"))}" required></textarea>
		</div>
		<div id="description-empty-error" class="validation-error hidden" role="alert">${escape(localize('descriptionEmptyValidation', "需要描述。"))}</div>
		<div id="description-short-error" class="validation-error hidden" role="alert">${escape(localize('descriptionTooShortValidation', "请提供更长的说明。"))}</div>
	</div>

	<div class="system-info" id="block-container">
		<div class="block block-extension-data">
			<input class="send-extension-data" aria-label="${sendExtensionData}" type="checkbox" id="includeExtensionData" checked/>
			<label class="extension-caption" id="extension-caption" for="includeExtensionData">
				${sendExtensionData}
				<span id="ext-loading" hidden></span>
				<span class="ext-parens" hidden>(</span><a href="#" class="showInfo" id="extension-id">${escape(localize('show', "显示"))}</a><span class="ext-parens" hidden>)</span>
				<a id="extension-data-download">${escape(localize('downloadExtensionData', "下载扩展数据"))}</a>
			</label>
			<pre class="block-info" id="extension-data" placeholder="${escape(localize('extensionData', "扩展没有要包含的其他数据。"))}" style="white-space: pre-wrap; user-select: text;">
				<!-- To be dynamically filled -->
			</pre>
		</div>

		<div class="block block-system">
			<input class="sendData" aria-label="${sendSystemInfoLabel}" type="checkbox" id="includeSystemInfo" checked/>
			<label class="caption" for="includeSystemInfo">
				${sendSystemInfoLabel}
				(<a href="#" class="showInfo">${escape(localize('show', "显示"))}</a>)
			</label>
			<div class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
		</div>
		</div>
		<div class="block block-process">
			<input class="sendData" aria-label="${sendProcessInfoLabel}" type="checkbox" id="includeProcessInfo" checked/>
			<label class="caption" for="includeProcessInfo">
				${sendProcessInfoLabel}
				(<a href="#" class="showInfo">${escape(localize('show', "显示"))}</a>)
			</label>
			<pre class="block-info hidden" style="user-select: text;">
				<code>
				<!-- To be dynamically filled -->
				</code>
			</pre>
		</div>
		<div class="block block-workspace">
			<input class="sendData" aria-label="${sendWorkspaceInfoLabel}" type="checkbox" id="includeWorkspaceInfo" checked/>
			<label class="caption" for="includeWorkspaceInfo">
				${sendWorkspaceInfoLabel}
				(<a href="#" class="showInfo">${escape(localize('show', "显示"))}</a>)
			</label>
			<pre id="systemInfo" class="block-info hidden" style="user-select: text;">
				<code>
				<!-- To be dynamically filled -->
				</code>
			</pre>
		</div>
		<div class="block block-extensions">
			<input class="sendData" aria-label="${sendExtensionsLabel}" type="checkbox" id="includeExtensions" checked/>
			<label class="caption" for="includeExtensions">
				${sendExtensionsLabel}
				(<a href="#" class="showInfo">${escape(localize('show', "显示"))}</a>)
			</label>
			<div id="systemInfo" class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
			</div>
		</div>
		<div class="block block-experiments">
			<input class="sendData" aria-label="${sendExperimentsLabel}" type="checkbox" id="includeExperiments" checked/>
			<label class="caption" for="includeExperiments">
				${sendExperimentsLabel}
				(<a href="#" class="showInfo">${escape(localize('show', "显示"))}</a>)
			</label>
			<pre class="block-info hidden" style="user-select: text;">
				<!-- To be dynamically filled -->
			</pre>
		</div>
		<div class="block block-acknowledgements hidden" id="version-acknowledgements">
			<input class="sendData" aria-label="${acknowledgementsLabel}" type="checkbox" id="includeAcknowledgement"/>
			<label class="caption" for="includeAcknowledgement">
				${acknowledgementsLabel}
			</label>
		</div>
	</div>

</div>`;
