/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import * as dom from '../../../../base/browser/dom.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import * as nls from '../../../../nls.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { TerminalExitReason } from '../../../../platform/terminal/common/terminal.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { TOMOSHIBI_RECONNECTION_OWNER } from '../common/terminal.js';
import { ITerminalInstance, ITerminalService } from './terminal.js';

/**
 * A Session group is a first-class entity: it owns an identity, a name and a color, and it
 * survives having no members at all. Sessions only ever reference a group by id.
 */
export interface ITomoshibiSessionGroup {
	readonly id: string;
	name: string;
	color: string;
	collapsed: boolean;
}

export interface ITomoshibiSessionEntry {
	/** Id of the owning {@link ITomoshibiSessionGroup}, if any. */
	group?: string;
	/** User supplied Session name, overriding the process/OSC title. */
	title?: string;
	pinned?: boolean;
	/**
	 * 最后一次确认「这个键属于某个活着的实例」的时刻（epoch ms）。对账时用它判死条目，
	 * 见 {@link SESSION_ENTRY_TTL_MS}。缺省表示这条是老文件里的，第一次对账时补上当前时间。
	 */
	lastSeen?: number;
}

export interface ITomoshibiSessionModel {
	version: 2;
	/**
	 * 最后一次改动的时刻（epoch ms）。用来在「服务端文件」和「设备本地镜像」之间判谁新 —— 没有它
	 * 的话，一次瞬时读失败之后本地改动会在下一次读成功时被旧文件静默盖回去（见 `_load`）。
	 * 老文件没有这个字段，按 0 算，也就是文件继续赢，跟改动前的行为一致。
	 */
	updatedAt?: number;
	/** Ordered; the strip and the tree render groups in this order. */
	groups: ITomoshibiSessionGroup[];
	sessions: { [sessionKey: string]: ITomoshibiSessionEntry };
}

/**
 * `waiting` is produced by the tomoshibiActivity terminal contribution, which watches the
 * screen for an agent question and calls {@link ITomoshibiSessionService.setWaiting}.
 */
export type TomoshibiSessionActivity = 'running' | 'waiting' | 'error' | 'done';

export const ITomoshibiSessionService = createDecorator<ITomoshibiSessionService>('tomoshibiSessionService');

export interface ITomoshibiSessionService {
	readonly _serviceBrand: undefined;

	/** Fires whenever the persisted model changes, from this window or from another one. */
	readonly onDidChange: Event<void>;
	/** Fires with the instance id whose activity state changed. */
	readonly onDidChangeActivity: Event<number>;

	readonly groups: readonly ITomoshibiSessionGroup[];

	/**
	 * The stable key a Session's metadata is filed under. Also performs the pty-reconnect key
	 * migration, so it must be called with a live instance rather than recomputed by callers.
	 *
	 * ⛔ 键是不透明的，调用方只许拿它当字典键用，不许解析、不许自己拼（格式见文件里的
	 * `SESSION_KEY_*` 注释）。
	 */
	sessionKey(instance: ITerminalInstance): string;

	getTitle(instance: ITerminalInstance): string | undefined;
	setTitle(instance: ITerminalInstance, title: string | undefined): void;

	getGroupOf(instance: ITerminalInstance): ITomoshibiSessionGroup | undefined;
	setGroupOf(instance: ITerminalInstance, groupId: string | undefined): void;

	isPinned(instance: ITerminalInstance): boolean;
	setPinned(instance: ITerminalInstance, pinned: boolean): void;

	/** Drops every piece of metadata for a Session that is being closed for good. */
	forget(instance: ITerminalInstance): void;

	getGroupById(groupId: string): ITomoshibiSessionGroup | undefined;
	createGroup(name: string): ITomoshibiSessionGroup;
	renameGroup(groupId: string, name: string): void;
	deleteGroup(groupId: string): void;
	setCollapsed(groupId: string, collapsed: boolean): void;

	getActivity(instanceId: number): TomoshibiSessionActivity | undefined;

	/**
	 * Marks the Session filed under `key` as waiting for the user. Only ever downgrades a
	 * `running` Session to `waiting`; it is dropped again as soon as the Session stops running.
	 */
	setWaiting(key: string, waiting: boolean): void;
}

/** The first two are the shell's subtitle orange and university purple. */
export const TOMOSHIBI_SESSION_GROUP_COLORS: readonly string[] = ['#f2a154', '#b48cff', '#5fd38d', '#4da3ff', '#ff7a7a', '#ffd166'];

const MIRROR_STORAGE_KEY = 'tomoshibi.terminal.sessions.v2';
/**
 * 「已经问过一次要不要开系统通知」。⛔ 只问一次：被拒之后再弹就是骚扰，而且浏览器把 denied 记死了，
 * 再怎么问 `requestPermission()` 也只会立刻返回 denied。
 */
const NOTIFICATION_ASKED_STORAGE_KEY = 'tomoshibi.terminal.notificationPermissionAsked.v1';
const V1_GROUPS_STORAGE_KEY = 'tomoshibi.terminal.sessionGroups.v1';
const V1_TITLES_STORAGE_KEY = 'tomoshibi.terminal.sessionTitles.v1';
const V1_PINNED_STORAGE_KEY = 'tomoshibi.terminal.pinnedSessions.v1';
const SAVE_DEBOUNCE_MS = 300;
const ACTIVITY_IDLE_MS = 12000;
/** Coalesce window for the activity sniffer: a screen-repaint storm runs the regex once per
 * window instead of once per data chunk. This is a throttle, not a debounce — see `_queueActivity`. */
const ACTIVITY_COALESCE_MS = 150;
/**
 * 每个合并窗口最多留这么多原始字节参与嗅探。剥离转义序列的两个全局正则以前是对**整块**数据跑的，
 * 跑完却只用最后 2400 个字符（`state.tail`），`cat` 一个几 MB 的日志时每 150ms 就白扫一遍全部数据，
 * 还顺带制造约 3 份整块 buffer 的临时字符串（iPad Safari 上 GC 压力比 CPU 更扎手）。
 * 16KB 给转义序列留足了膨胀余量：尾巴是跨窗口累积的，被截掉的中间内容本来也进不了那 2400 字符。
 */
const ACTIVITY_RAW_TAIL_LIMIT = 16 * 1024;

/**
 * 元数据键的三个命名空间。⛔ 三者绝不可以互相解析成对方 —— 把 pty id 和 instanceId 塞进同一个命名
 * 空间正是「两个不同 Session 撞到同一条元数据」的成因（两个计数器都从 1 开始、毫不相干）。
 * - `s:<uuid>`  建 Session 时自己发的号，写进 `shellLaunchConfig.reconnectionProperties` 交给 pty
 *   宿主保管。页面刷新（attach）和服务端重启（revive）都会原样带回来，所以它跨刷新、跨重启稳定，
 *   而且永不重号。这是正常终端唯一会用到的键。
 * - `pty:<id>`  拿不到 uuid 时的退路：改动之前就已经跑着的老进程、任务终端、扩展终端。pty 宿主一
 *   重启就从 0 重新发号，所以这类键会被复用，只能靠回收 + 保留期兜住。
 * - `local:<n>` 连 pty id 都还没有时的临时键，只允许往 `pty:` 搬一次。
 */
const SESSION_KEY_UUID_PREFIX = 's:';
const SESSION_KEY_PTY_PREFIX = 'pty:';
const SESSION_KEY_LOCAL_PREFIX = 'local:';

/**
 * 元数据的保留期。超过这么久既不属于任何活实例、又没被改过的条目会在对账时清掉。
 * 定 30 天的理由：`s:` 键是 uuid，永不重号，留着旧条目最多是文件变大，不会串到别人身上，所以宁可
 * 宽一点 —— 一个命过名的 Session 搁置几周再回来，名字还在。真正危险的是会被复用的 `pty:` 键，那个
 * 靠「实例真终止就立刻回收」兜，不靠保留期。
 */
const SESSION_ENTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * `_load()` 之后隔多久做一次对账。要等终端恢复完才能知道哪些键还活着：终端是分批恢复的
 * （terminalService.ts 的分批 revive 中间还插着 350ms 等待），20 秒是留足余量的一刀。
 * 就算真的没等到，被误判成「不属于活实例」的条目也只是不刷新 lastSeen，不会被删（还差 30 天）。
 */
const SESSION_RECONCILE_DELAY_MS = 20000;
/**
 * 读 sessions.json 失败之后的重试退避（ms），最后一档一直重复用，直到读通为止。
 * ⛔ 不许「失败一次就永久停写」：`_fileWritable` 一旦锁死，这整次会话里所有重命名/分组改动都只活在
 * 设备本地镜像里，下一次读成功时被服务端旧文件静默盖回去，用户全程看不到任何提示。
 */
const LOAD_RETRY_DELAYS_MS = [2000, 5000, 15000, 60000];

/**
 * 老版本的键是裸数字（`String(persistentProcessId ?? instanceId)`），既可能是 pty id 也可能是
 * instanceId，无法分辨、也不能信：部署这次改动本身就要重启 code-server，重启后 pty id 从头再发，
 * 留着这些键只会让新 Session 顶上别人的名字。所以读到就丢弃，⛔ 不迁移 —— 代价是一次性丢掉旧的
 * Session 名称/固定/分组归属，分组本身（id 是 uuid）不受影响。
 */
function isNamespacedSessionKey(key: string): boolean {
	return key.startsWith(SESSION_KEY_UUID_PREFIX) || key.startsWith(SESSION_KEY_PTY_PREFIX) || key.startsWith(SESSION_KEY_LOCAL_PREFIX);
}

/**
 * 「agent 这一轮跑完了」的标记。⛔ 缺席不代表在跑，见 `_recordActivity`。
 */
const AGENT_COMPLETE_NEEDLES: readonly string[] = ['ask codex to do anything', 'worked for'];

/**
 * 「agent 正在跑」的标记。只有明确命中这里的东西才算在跑。
 * `working` 必须单独成词、并且排掉 git 的 "working tree clean" / "working directory" / "working copy"
 * —— 跑一次 `git status` 就会误命中，那是把普通 shell 画成「正在运行」的第二个成因。
 */
const AGENT_RUNNING_PATTERNS: readonly RegExp[] = [
	/esc to interrupt/g,
	/\bthinking\b/g,
	/\bworking\b(?!\s+(?:tree|directory|dir|copy|set|on)\b)/g,
];

/** 任意一个模式在 `text` 里最后一次出现的下标；一个都没命中返回 -1。 */
function lastIndexOfAnyPattern(text: string, patterns: readonly RegExp[]): number {
	let last = -1;
	for (const pattern of patterns) {
		pattern.lastIndex = 0;
		for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
			last = Math.max(last, match.index);
			if (pattern.lastIndex === match.index) {
				pattern.lastIndex++;
			}
		}
	}
	return last;
}

function createEmptyModel(): ITomoshibiSessionModel {
	return { version: 2, groups: [], sessions: {} };
}

function reviveModel(raw: string | undefined): ITomoshibiSessionModel | undefined {
	if (!raw) {
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (!parsed || typeof parsed !== 'object') {
		return undefined;
	}
	const candidate = parsed as Partial<ITomoshibiSessionModel>;
	if (candidate.version !== 2) {
		return undefined;
	}
	const model = createEmptyModel();
	if (typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) && candidate.updatedAt > 0) {
		model.updatedAt = candidate.updatedAt;
	}
	const seenIds = new Set<string>();
	for (const group of Array.isArray(candidate.groups) ? candidate.groups : []) {
		if (!group || typeof group.id !== 'string' || !group.id || seenIds.has(group.id)) {
			continue;
		}
		seenIds.add(group.id);
		model.groups.push({
			id: group.id,
			name: typeof group.name === 'string' ? group.name : group.id,
			color: typeof group.color === 'string' && group.color ? group.color : TOMOSHIBI_SESSION_GROUP_COLORS[(model.groups.length) % TOMOSHIBI_SESSION_GROUP_COLORS.length],
			collapsed: group.collapsed === true,
		});
	}
	const sessions = candidate.sessions && typeof candidate.sessions === 'object' ? candidate.sessions : {};
	for (const [key, value] of Object.entries(sessions)) {
		if (!value || typeof value !== 'object' || !isNamespacedSessionKey(key)) {
			continue;
		}
		const entry: ITomoshibiSessionEntry = {};
		const source = value as ITomoshibiSessionEntry;
		if (typeof source.group === 'string' && seenIds.has(source.group)) {
			entry.group = source.group;
		}
		if (typeof source.title === 'string' && source.title.trim()) {
			entry.title = source.title.trim();
		}
		if (source.pinned === true) {
			entry.pinned = true;
		}
		if (typeof source.lastSeen === 'number' && Number.isFinite(source.lastSeen) && source.lastSeen > 0) {
			entry.lastSeen = source.lastSeen;
		}
		// 只有 lastSeen 的条目没有任何内容，跟着一起丢。
		if (entry.group || entry.title || entry.pinned) {
			model.sessions[key] = entry;
		}
	}
	return model;
}

export class TomoshibiSessionService extends Disposable implements ITomoshibiSessionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _onDidChangeActivity = this._register(new Emitter<number>());
	readonly onDidChangeActivity: Event<number> = this._onDidChangeActivity.event;

	private _model: ITomoshibiSessionModel;
	private readonly _resource: URI;
	private readonly _saveScheduler: RunOnceScheduler;
	private readonly _storageListeners = this._register(new DisposableStore());

	/** Raw JSON last pushed into the storage mirror, used to ignore our own change events. */
	private _lastMirrorValue: string | undefined;
	/** Cleared once the server file has been read (or created); blocks writes on a read failure. */
	private _fileWritable = false;
	private _localChangeBeforeLoad = false;
	/** 一次只允许一个 `_load()` 在跑，退避重试和「改动时顺手重试」都要过这道闸。 */
	private _loadInFlight = false;
	private _loadRetryAttempt = 0;
	private _loadRetryTimer: ReturnType<typeof setTimeout> | undefined;
	/** 只在第一次进入「写不了」状态时提示一次；读通之后复位，下一次真出问题还会再提示。 */
	private _notifiedReadOnly = false;
	/** 见 {@link NOTIFICATION_ASKED_STORAGE_KEY}。 */
	private _notificationPermissionAsked = false;

	private readonly _sessionKeysByInstanceId = new Map<number, string>();
	/** 每个实例的 onWillDispose/onDisposed 订阅，实例一走就跟着扔。 */
	private readonly _instanceListeners = this._register(new DisposableMap<number>());
	/** onWillDispose 那一刻的快照：元数据键 + 进程还在不在，见 `_watchInstance`。 */
	private readonly _disposeSnapshots = new Map<number, { key: string; hadLiveProcess: boolean }>();
	private readonly _reconcileScheduler: RunOnceScheduler;
	private readonly _activityStates = new Map<number, { running: boolean; agentIdle: boolean; tail: string }>();
	private readonly _activityTimers = new Map<number, ReturnType<typeof setTimeout>>();
	/** Session keys whose agent is currently asking the user something. */
	private readonly _waitingKeys = new Set<string>();
	/** Raw data chunks accumulated per instance while a coalesce window is open. */
	private readonly _pendingActivityData = new Map<number, string>();
	/** The 150ms coalesce-window timer per instance; see `_queueActivity`. */
	private readonly _activityFlushTimers = new Map<number, ReturnType<typeof setTimeout>>();

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IStorageService private readonly _storageService: IStorageService,
		@IUserDataProfileService userDataProfileService: IUserDataProfileService,
		@ILogService private readonly _logService: ILogService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ITerminalService private readonly _terminalService: ITerminalService,
	) {
		super();

		this._resource = joinPath(userDataProfileService.currentProfile.globalStorageHome, 'tomoshibi', 'sessions.json');
		// The storage mirror is device local (PROFILE lives in the browser's IndexedDB), so it can
		// only be trusted to paint the very first frame. The server file is the source of truth.
		this._lastMirrorValue = this._storageService.get(MIRROR_STORAGE_KEY, StorageScope.PROFILE);
		this._model = reviveModel(this._lastMirrorValue) ?? createEmptyModel();
		this._notificationPermissionAsked = this._storageService.getBoolean(NOTIFICATION_ASKED_STORAGE_KEY, StorageScope.PROFILE, false);

		this._saveScheduler = this._register(new RunOnceScheduler(() => void this._writeFile(), SAVE_DEBOUNCE_MS));
		this._reconcileScheduler = this._register(new RunOnceScheduler(() => this._reconcile(), SESSION_RECONCILE_DELAY_MS));

		this._storageListeners.add(this._storageService.onDidChangeValue(StorageScope.PROFILE, MIRROR_STORAGE_KEY, this._storageListeners)(() => {
			const raw = this._storageService.get(MIRROR_STORAGE_KEY, StorageScope.PROFILE);
			if (raw === this._lastMirrorValue) {
				return;
			}
			this._lastMirrorValue = raw;
			this._model = reviveModel(raw) ?? this._model;
			this._onDidChange.fire();
		}));

		// ⛔ 只在实例刚被 new 出来的这一刻打号，不去补扫 `_terminalService.instances`：进程一旦建好，
		// 再往 shellLaunchConfig 里写东西也送不到 pty 宿主，刷新之后 uuid 就没了，键会从 `s:` 悄悄变回
		// `pty:`，元数据反而被甩掉。补不上号的实例老老实实走 `pty:` 那条退路。
		// 时机成立的依据，两跳都是同步的：`TerminalInstance` 的构造函数一返回，
		// `terminalInstanceService.ts:52` 就 fire `ITerminalInstanceService.onDidCreateInstance`，
		// `terminalService.ts:204-207` 收到后原地转发成我们订阅的这个
		// `ITerminalService.onDidCreateInstance`；而 `_createProcess()` 挂在 `_xtermReadyPromise.then()`
		// 里（terminalInstance.ts:615-641），最快也要等一个微任务，一定排在我们之后。
		// 隐含前提：`ITerminalService` 自己也是 Delayed 单例（terminal.contribution.ts:56），任何要建
		// 终端的代码都得先把它构造出来，那条转发监听因此总是先于第一个实例挂好。
		this._register(this._terminalService.onDidCreateInstance(instance => {
			this._stampSessionId(instance);
			this._watchInstance(instance);
		}));
		// 服务是 Delayed 单例，正常情况下第一个 TerminalInstance 的构造函数（初始化 tomoshibiActivity
		// 贡献时）就把它拉起来了，所以上面那个事件一个都不会漏；这里再补扫一遍纯属保险。
		for (const instance of this._terminalService.instances) {
			this._watchInstance(instance);
		}
		this._register(this._terminalService.onAnyInstanceData(({ instance, data }) => this._queueActivity(instance, data)));
		this._register(this._terminalService.onDidChangeInstances(() => this._pruneDeadInstances()));
		this._register({
			dispose: () => {
				if (this._loadRetryTimer !== undefined) {
					clearTimeout(this._loadRetryTimer);
					this._loadRetryTimer = undefined;
				}
				for (const timer of this._activityTimers.values()) {
					clearTimeout(timer);
				}
				this._activityTimers.clear();
				this._activityStates.clear();
				for (const timer of this._activityFlushTimers.values()) {
					clearTimeout(timer);
				}
				this._activityFlushTimers.clear();
				this._pendingActivityData.clear();
			}
		});

		this._loadAndReconcile();
	}

	//#region persistence

	private _loadAndReconcile(): void {
		if (this._loadInFlight) {
			return;
		}
		this._loadInFlight = true;
		void this._load().finally(() => {
			this._loadInFlight = false;
			// 读不到文件时不对账：那种状态下写回去只会把内存模型当真值盖到磁盘上。
			if (this._fileWritable) {
				this._reconcileScheduler.schedule();
			}
		});
	}

	/**
	 * 读失败后带退避重排一次 `_load()`。⛔ 只要还没读通就一直重排（最后一档 60 秒重复），别再出现
	 * 「失败一次就永久只读」。重排成功那一刻 `_load()` 会看到 `_localChangeBeforeLoad`，把这段只读期
	 * 里攒下的改动推回文件。
	 */
	private _scheduleLoadRetry(): void {
		if (this._loadRetryTimer !== undefined || this._store.isDisposed) {
			return;
		}
		const delay = LOAD_RETRY_DELAYS_MS[Math.min(this._loadRetryAttempt, LOAD_RETRY_DELAYS_MS.length - 1)];
		this._loadRetryAttempt++;
		this._loadRetryTimer = setTimeout(() => {
			this._loadRetryTimer = undefined;
			this._loadAndReconcile();
		}, delay);
	}

	/** 用户刚改了东西但文件还写不了：立刻试一次读，别让他干等退避。 */
	private _retryLoadNow(): void {
		if (this._loadRetryTimer !== undefined) {
			clearTimeout(this._loadRetryTimer);
			this._loadRetryTimer = undefined;
		}
		this._loadAndReconcile();
	}

	private _notifyReadOnly(): void {
		if (this._notifiedReadOnly) {
			return;
		}
		this._notifiedReadOnly = true;
		this._notificationService.warn(nls.localize(
			'tomoshibi.session.readOnly',
			"读不到 Session 记录文件，这次改的名称和分组暂时只存在这台设备的浏览器里，还没写回服务器。正在自动重试。"
		));
	}

	private async _load(): Promise<void> {
		let loaded: ITomoshibiSessionModel | undefined;
		try {
			const content = await this._fileService.readFile(this._resource);
			loaded = reviveModel(content.value.toString());
			this._fileWritable = true;
			this._loadRetryAttempt = 0;
			this._notifiedReadOnly = false;
		} catch (error) {
			if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				// First run on this server: fold the three v1 keys into the v2 model, persist it,
				// and only then retire the v1 keys.
				const migrated = this._localChangeBeforeLoad ? undefined : this._migrateFromV1();
				this._model = migrated ?? this._model;
				this._localChangeBeforeLoad = false;
				this._fileWritable = true;
				this._loadRetryAttempt = 0;
				this._notifiedReadOnly = false;
				this._model.updatedAt = Date.now();
				await this._writeFile();
				for (const key of [V1_GROUPS_STORAGE_KEY, V1_TITLES_STORAGE_KEY, V1_PINNED_STORAGE_KEY]) {
					this._storageService.remove(key, StorageScope.PROFILE);
				}
				this._writeMirror();
				this._onDidChange.fire();
				return;
			}
			// The file exists but could not be read. Keep serving the device-local mirror and
			// never write back over a file we failed to understand.
			this._logService.error('[tomoshibi] failed to read terminal session state, falling back to the storage mirror', error);
			this._fileWritable = false;
			this._notifyReadOnly();
			this._scheduleLoadRetry();
			return;
		}
		if (this._localChangeBeforeLoad) {
			// A change was made before the read came back. The live model wins; push it out.
			this._localChangeBeforeLoad = false;
			this._saveScheduler.schedule();
			return;
		}
		if (!loaded) {
			return;
		}
		// ⛔ 不许无条件用文件盖掉内存模型：读失败重试期间的改动都在镜像里，updatedAt 更新的一方赢。
		// 老文件没有 updatedAt（按 0 算），文件继续赢，跟改动前的行为一致。
		if ((loaded.updatedAt ?? 0) < (this._model.updatedAt ?? 0)) {
			this._logService.warn('[tomoshibi] terminal session file is older than the local mirror, pushing the mirror back out');
			this._saveScheduler.schedule();
			this._onDidChange.fire();
			return;
		}
		this._model = loaded;
		this._writeMirror();
		this._onDidChange.fire();
	}

	/**
	 * 对账：`_load()` 之后（等终端恢复完）走一遍磁盘上的条目，把还活着的盖上时间戳、把过了保留期的
	 * 死条目删掉。没有这一步，sessions.json 只增不减 —— 而 `pty:` 键在 pty 宿主重启后会被重新发出去，
	 * 一条死条目就是一颗将来会被误命中的雷。
	 *
	 * ⛔ 没有 lastSeen 的条目（老文件写的）一律补时间戳而不是删：我们不知道它多老，保留期从升级这一刻
	 * 开始算。
	 */
	private _reconcile(): void {
		const now = Date.now();
		const liveKeys = new Set<string>();
		for (const instance of this._terminalService.instances) {
			// ⛔ 用 `_computeSessionKey` 不用 `sessionKey`：后者带搬键的副作用，对账不该改任何键。
			liveKeys.add(this._computeSessionKey(instance));
		}
		let changed = false;
		for (const [key, entry] of Object.entries(this._model.sessions)) {
			if (liveKeys.has(key)) {
				entry.lastSeen = now;
				changed = true;
				continue;
			}
			if (entry.lastSeen === undefined) {
				entry.lastSeen = now;
				changed = true;
				continue;
			}
			if (now - entry.lastSeen > SESSION_ENTRY_TTL_MS) {
				delete this._model.sessions[key];
				this._waitingKeys.delete(key);
				changed = true;
			}
		}
		if (changed) {
			this._save();
		}
	}

	private _migrateFromV1(): ITomoshibiSessionModel | undefined {
		const groupNames = this._readV1Map(V1_GROUPS_STORAGE_KEY);
		const titles = this._readV1Map(V1_TITLES_STORAGE_KEY);
		const pinned = new Set(this._readV1Array(V1_PINNED_STORAGE_KEY));
		if (!groupNames.size && !titles.size && !pinned.size) {
			return undefined;
		}
		const model = createEmptyModel();
		const groupsByName = new Map<string, ITomoshibiSessionGroup>();
		for (const name of groupNames.values()) {
			if (groupsByName.has(name)) {
				continue;
			}
			const group: ITomoshibiSessionGroup = {
				id: generateUuid(),
				name,
				color: TOMOSHIBI_SESSION_GROUP_COLORS[groupsByName.size % TOMOSHIBI_SESSION_GROUP_COLORS.length],
				collapsed: false,
			};
			groupsByName.set(name, group);
			model.groups.push(group);
		}
		for (const key of new Set([...groupNames.keys(), ...titles.keys(), ...pinned])) {
			// v1 的键也是裸数字，同样不可信（理由见 `isNamespacedSessionKey`）。分组定义留下，
			// 「哪个 Session 属于哪个分组」丢掉。
			if (!isNamespacedSessionKey(key)) {
				continue;
			}
			const entry: ITomoshibiSessionEntry = {};
			const name = groupNames.get(key);
			const group = name ? groupsByName.get(name) : undefined;
			if (group) {
				entry.group = group.id;
			}
			const title = titles.get(key);
			if (title) {
				entry.title = title;
			}
			if (pinned.has(key)) {
				entry.pinned = true;
			}
			if (entry.group || entry.title || entry.pinned) {
				model.sessions[key] = entry;
			}
		}
		return model;
	}

	private _readV1Map(key: string): Map<string, string> {
		try {
			const value = JSON.parse(this._storageService.get(key, StorageScope.PROFILE, '{}')) as Record<string, unknown>;
			return new Map(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1].trim()));
		} catch {
			return new Map();
		}
	}

	private _readV1Array(key: string): string[] {
		try {
			const value = JSON.parse(this._storageService.get(key, StorageScope.PROFILE, '[]')) as unknown;
			return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
		} catch {
			return [];
		}
	}

	private _writeMirror(): void {
		this._lastMirrorValue = JSON.stringify(this._model);
		this._storageService.store(MIRROR_STORAGE_KEY, this._lastMirrorValue, StorageScope.PROFILE, StorageTarget.USER);
	}

	private async _writeFile(): Promise<void> {
		if (!this._fileWritable) {
			return;
		}
		try {
			await this._fileService.writeFile(this._resource, VSBuffer.fromString(JSON.stringify(this._model, undefined, '\t')));
		} catch (error) {
			this._logService.error('[tomoshibi] failed to persist terminal session state', error);
		}
	}

	private _save(): void {
		this._model.updatedAt = Date.now();
		if (!this._fileWritable) {
			this._localChangeBeforeLoad = true;
			// 有改动却写不了文件 —— 立刻再试一次读，别让这次改动一直躺在设备本地镜像里。
			this._retryLoadNow();
		}
		this._writeMirror();
		this._saveScheduler.schedule();
		this._onDidChange.fire();
	}

	//#endregion

	//#region session keys

	sessionKey(instance: ITerminalInstance): string {
		const key = this._computeSessionKey(instance);
		const previousKey = this._sessionKeysByInstanceId.get(instance.instanceId);
		this._sessionKeysByInstanceId.set(instance.instanceId, key);
		if (previousKey && previousKey !== key) {
			this._migrateSessionKey(instance.instanceId, previousKey, key);
		}
		return key;
	}

	private _computeSessionKey(instance: ITerminalInstance): string {
		const sessionId = this._readSessionId(instance);
		if (sessionId) {
			return SESSION_KEY_UUID_PREFIX + sessionId;
		}
		if (instance.persistentProcessId !== undefined) {
			return SESSION_KEY_PTY_PREFIX + instance.persistentProcessId;
		}
		return SESSION_KEY_LOCAL_PREFIX + instance.instanceId;
	}

	/**
	 * 读回我们发的号。`instance.reconnectionProperties`（terminalInstance.ts:351）优先取
	 * `attachPersistentProcess` 上的那份，也就是 pty 宿主经 `_buildProcessDetails`
	 * （ptyService.ts:657）送回来的，所以刷新页面重新 attach、以及服务端重启后 revive
	 * （ptyService.ts:287 把整个 shellLaunchConfig 原样展开重建进程）都能读到同一个 uuid。
	 */
	private _readSessionId(instance: ITerminalInstance): string | undefined {
		const properties = instance.reconnectionProperties;
		if (!properties || properties.ownerId !== TOMOSHIBI_RECONNECTION_OWNER) {
			return undefined;
		}
		const sessionId = (properties.data as { sessionId?: unknown } | undefined)?.sessionId;
		return typeof sessionId === 'string' && sessionId ? sessionId : undefined;
	}

	/**
	 * 给刚建出来的 Session 发一个 uuid 并塞进 shellLaunchConfig，让它跟着进程走到 pty 宿主去。
	 *
	 * ⛔ 只碰「普通的、我们自己的」终端：任务终端和扩展终端已经有自己的 reconnectionProperties
	 * （ownerId 'Task'），feature/transient/自带 pty 的终端根本不进 Session 列表，给它们加
	 * reconnectionProperties 反而会改掉上游算 shouldPersist 的口径
	 * （terminalProcessManager.ts:290/530）。
	 * `TerminalInstance.shouldPersist` 对带 reconnectionProperties 的实例本来会额外要求
	 * `task.reconnection === true`，那条已经改成「ownerId 是我们自己就跳过」，所以这里打号不会
	 * 影响 Session 的持久化，也不怕以后整包删掉 contrib/tasks。
	 */
	private _stampSessionId(instance: ITerminalInstance): void {
		const slc = instance.shellLaunchConfig;
		if (slc.attachPersistentProcess || slc.reconnectionProperties || slc.isFeatureTerminal || slc.isTransient || slc.isExtensionOwnedTerminal || slc.customPtyImplementation) {
			return;
		}
		slc.reconnectionProperties = { ownerId: TOMOSHIBI_RECONNECTION_OWNER, data: { sessionId: generateUuid() } };
	}

	/**
	 * 只为没拿到 uuid 的老进程服务：它们出生时连 pty id 都没有，先落在 `local:<instanceId>` 上，
	 * pty 报到之后要把元数据搬到 `pty:<id>`。
	 *
	 * ⛔ 只许 `local:* → pty:*` 这一个方向。`s:` 键从生到死不变，`pty:` 之间互搬只可能是撞号，
	 * 一律不搬 —— 老代码在这里无条件 `delete` 源键，正是「刷新一次就把别人的名字删掉」的元凶。
	 */
	private _migrateSessionKey(instanceId: number, previousKey: string, key: string): void {
		if (!previousKey.startsWith(SESSION_KEY_LOCAL_PREFIX) || !key.startsWith(SESSION_KEY_PTY_PREFIX)) {
			return;
		}
		const previous = this._model.sessions[previousKey];
		if (!previous) {
			return;
		}
		// 目标键被别的活实例占着就不搬 —— 那条元数据是人家的。
		for (const [otherInstanceId, otherKey] of this._sessionKeysByInstanceId) {
			if (otherInstanceId !== instanceId && otherKey === key) {
				return;
			}
		}
		delete this._model.sessions[previousKey];
		const existing = this._model.sessions[key];
		this._model.sessions[key] = {
			group: existing?.group ?? previous.group,
			title: existing?.title ?? previous.title,
			pinned: existing?.pinned ?? previous.pinned,
		};
		this._save();
	}

	private _entry(instance: ITerminalInstance): ITomoshibiSessionEntry | undefined {
		return this._model.sessions[this.sessionKey(instance)];
	}

	private _updateEntry(instance: ITerminalInstance, update: (entry: ITomoshibiSessionEntry) => void): void {
		const key = this.sessionKey(instance);
		const entry: ITomoshibiSessionEntry = { ...this._model.sessions[key] };
		update(entry);
		if (entry.group === undefined && entry.title === undefined && !entry.pinned) {
			delete this._model.sessions[key];
		} else {
			entry.lastSeen = Date.now();
			this._model.sessions[key] = entry;
		}
		this._save();
	}

	//#endregion

	//#region model

	get groups(): readonly ITomoshibiSessionGroup[] {
		return this._model.groups;
	}

	getGroupById(groupId: string): ITomoshibiSessionGroup | undefined {
		return this._model.groups.find(group => group.id === groupId);
	}

	getTitle(instance: ITerminalInstance): string | undefined {
		return this._entry(instance)?.title;
	}

	setTitle(instance: ITerminalInstance, title: string | undefined): void {
		const next = title?.trim() || undefined;
		if (this.getTitle(instance) === next) {
			return;
		}
		this._updateEntry(instance, entry => { entry.title = next; });
	}

	getGroupOf(instance: ITerminalInstance): ITomoshibiSessionGroup | undefined {
		const groupId = this._entry(instance)?.group;
		return groupId ? this.getGroupById(groupId) : undefined;
	}

	setGroupOf(instance: ITerminalInstance, groupId: string | undefined): void {
		const next = groupId && this.getGroupById(groupId) ? groupId : undefined;
		if (this._entry(instance)?.group === next) {
			return;
		}
		this._updateEntry(instance, entry => { entry.group = next; });
	}

	isPinned(instance: ITerminalInstance): boolean {
		return this._entry(instance)?.pinned === true;
	}

	setPinned(instance: ITerminalInstance, pinned: boolean): void {
		if (this.isPinned(instance) === pinned) {
			return;
		}
		this._updateEntry(instance, entry => { entry.pinned = pinned ? true : undefined; });
	}

	forget(instance: ITerminalInstance): void {
		this._forgetKey(this.sessionKey(instance));
	}

	private _forgetKey(key: string): void {
		this._waitingKeys.delete(key);
		if (!this._model.sessions[key]) {
			return;
		}
		delete this._model.sessions[key];
		this._save();
	}

	createGroup(name: string): ITomoshibiSessionGroup {
		const group: ITomoshibiSessionGroup = {
			id: generateUuid(),
			name,
			color: TOMOSHIBI_SESSION_GROUP_COLORS[this._model.groups.length % TOMOSHIBI_SESSION_GROUP_COLORS.length],
			collapsed: false,
		};
		this._model.groups.push(group);
		this._save();
		return group;
	}

	renameGroup(groupId: string, name: string): void {
		const group = this.getGroupById(groupId);
		if (!group || !name.trim() || group.name === name.trim()) {
			return;
		}
		group.name = name.trim();
		this._save();
	}

	deleteGroup(groupId: string): void {
		const index = this._model.groups.findIndex(group => group.id === groupId);
		if (index === -1) {
			return;
		}
		this._model.groups.splice(index, 1);
		for (const [key, entry] of Object.entries(this._model.sessions)) {
			if (entry.group !== groupId) {
				continue;
			}
			// Members of a deleted group fall back to being ungrouped, they are never closed.
			if (entry.title === undefined && !entry.pinned) {
				delete this._model.sessions[key];
			} else {
				this._model.sessions[key] = { title: entry.title, pinned: entry.pinned, lastSeen: entry.lastSeen };
			}
		}
		this._save();
	}

	setCollapsed(groupId: string, collapsed: boolean): void {
		const group = this.getGroupById(groupId);
		if (!group || group.collapsed === collapsed) {
			return;
		}
		group.collapsed = collapsed;
		this._save();
	}

	//#endregion

	//#region activity

	getActivity(instanceId: number): TomoshibiSessionActivity | undefined {
		const instance = this._terminalService.getInstanceFromId(instanceId);
		if (!instance) {
			return undefined;
		}
		const primaryStatus = instance.statusList.primary;
		// The key is read from the cache rather than through `sessionKey()`, which has the
		// pty-reconnect migration as a side effect and must not run from a render path.
		const key = this._sessionKeysByInstanceId.get(instanceId);
		// A warning-level terminal status is commonly just Shell Integration setup and must not
		// paint every healthy Session yellow. Only a dead process or a real error counts.
		if (instance.exitReason !== undefined || (!!primaryStatus && primaryStatus.severity >= Severity.Error)) {
			if (key) {
				this._waitingKeys.delete(key);
			}
			return 'error';
		}
		// An open question is quiet by nature: the agent paints its prompt and then stops
		// writing, which is exactly what the 12s idle timer files under "done". So the waiting
		// flag outranks the running gate. It is cleared by user input, by the next evaluation
		// that no longer sees a prompt, by exit/error above and by the contribution's dispose
		// (see terminalContrib/tomoshibiActivity).
		if (key && this._waitingKeys.has(key)) {
			return 'waiting';
		}
		return this._activityStates.get(instanceId)?.running ? 'running' : 'done';
	}

	setWaiting(key: string, waiting: boolean): void {
		if (waiting === this._waitingKeys.has(key)) {
			return;
		}
		if (waiting) {
			this._waitingKeys.add(key);
		} else {
			this._waitingKeys.delete(key);
		}
		for (const [instanceId, sessionKey] of this._sessionKeysByInstanceId) {
			if (sessionKey === key) {
				this._onDidChangeActivity.fire(instanceId);
			}
		}
	}

	/**
	 * Throttles the activity sniffer to once per {@link ACTIVITY_COALESCE_MS}: a screen-repaint
	 * storm (e.g. a progress bar) fires `onAnyInstanceData` many times a second, and running the
	 * regex-based sniff on every single chunk is wasted work. Every chunk is appended to a
	 * per-instance buffer, losslessly, in arrival order; only the first chunk of an idle instance
	 * opens a window (`setTimeout`). Chunks that arrive while the window is open just extend the
	 * buffer and do not reschedule it — this is a throttle, not a debounce, so a terminal that
	 * never stops writing still gets sniffed every 150ms rather than being starved indefinitely.
	 * When the window elapses the whole buffered text is handed to the original `_recordActivity`
	 * in one call, which reproduces exactly what running it chunk-by-chunk would have observed
	 * (its ANSI stripping and tail slicing already tolerate arbitrary chunk boundaries).
	 */
	private _queueActivity(instance: ITerminalInstance, data: string): void {
		const instanceId = instance.instanceId;
		const merged = (this._pendingActivityData.get(instanceId) ?? '') + data;
		this._pendingActivityData.set(instanceId, merged.length > ACTIVITY_RAW_TAIL_LIMIT ? merged.slice(-ACTIVITY_RAW_TAIL_LIMIT) : merged);
		if (this._activityFlushTimers.has(instanceId)) {
			return;
		}
		this._activityFlushTimers.set(instanceId, setTimeout(() => {
			this._activityFlushTimers.delete(instanceId);
			const buffered = this._pendingActivityData.get(instanceId);
			this._pendingActivityData.delete(instanceId);
			if (buffered) {
				this._recordActivity(instance, buffered);
			}
		}, ACTIVITY_COALESCE_MS));
	}

	private _recordActivity(instance: ITerminalInstance, data: string): void {
		const instanceId = instance.instanceId;
		const state = this._activityStates.get(instanceId) ?? { running: false, agentIdle: false, tail: '' };
		const wasRunning = state.running;
		// ⛔ 先截断再剥离，不许反过来：剥离是两个全局正则，成本跟输入长度成正比，而下面只用最后
		// 2400 个字符。`_queueActivity` 已经截过一次，这里再兜一次是给直接调进来的路径用的。
		const raw = String(data ?? '');
		const visible = (raw.length > ACTIVITY_RAW_TAIL_LIMIT ? raw.slice(-ACTIVITY_RAW_TAIL_LIMIT) : raw)
			.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
			.replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '');
		if (!visible.trim()) {
			return;
		}
		state.tail = (state.tail + visible).slice(-2400);
		const lower = state.tail.toLowerCase();
		const completeAt = Math.max(
			...AGENT_COMPLETE_NEEDLES.map(needle => lower.lastIndexOf(needle)),
			state.tail.lastIndexOf('\n❯'),
			state.tail.lastIndexOf('\r❯'),
		);
		const runningAt = lastIndexOfAnyPattern(lower, AGENT_RUNNING_PATTERNS);
		// ⛔「没看到完成标记」不等于「正在跑」。老写法 `running = !agentIdle` 是拿完成标记的缺失反推
		// 运行中，于是：默认 bash/zsh 的 `$`/`%` 提示符下敲任何一个键都会被画成「正在运行」并亮 12 秒；
		// Claude Code 的完成标记一条都不长这样（它的行首 ❯ 是选项箭头不是提示符），整个会话常亮不灭。
		// 现在两个标记都没命中就保持原状（初值是「没在跑」），只有明确命中运行标记才置 running。
		if (runningAt >= 0 || completeAt >= 0) {
			state.agentIdle = completeAt > runningAt;
			state.running = runningAt > completeAt;
		}
		this._activityStates.set(instanceId, state);
		// `wasRunning` 现在只可能来自「命中过运行标记」，所以这一条自带手册要求的
		// 「这一轮确实在跑过才通知」，不会再被一条 git 输出骗出「已完成」。
		if (wasRunning && state.agentIdle) {
			this._notifyAgentComplete(instance);
		}
		const oldTimer = this._activityTimers.get(instanceId);
		if (oldTimer) {
			clearTimeout(oldTimer);
		}
		this._activityTimers.set(instanceId, setTimeout(() => {
			this._activityTimers.delete(instanceId);
			const current = this._activityStates.get(instanceId);
			if (current?.running) {
				current.running = false;
				this._onDidChangeActivity.fire(instanceId);
			}
		}, ACTIVITY_IDLE_MS));
		if (wasRunning !== state.running) {
			this._onDidChangeActivity.fire(instanceId);
		}
	}

	private _notifyAgentComplete(instance: ITerminalInstance): void {
		const title = this.getTitle(instance) || instance.title;
		const message = nls.localize('tomoshibi.agent.complete', "{0} 已完成", title);
		this._notificationService.info(message);

		const targetWindow = dom.getActiveWindow();
		const permission = targetWindow.Notification?.permission;
		if (permission === 'granted') {
			if (targetWindow.document.visibilityState === 'hidden') {
				new targetWindow.Notification('Code-Tomoshibi', { body: message, tag: `tomoshibi-terminal-${instance.instanceId}` });
			}
			return;
		}
		if (permission === 'default') {
			this._requestNotificationPermission(targetWindow);
		}
	}

	/**
	 * 申请系统通知权限的唯一入口。⛔ 必须在用户手势里调 `Notification.requestPermission()` —— 所以走
	 * 通知条上的按钮，那个 `run` 是真的 click 处理器。全仓库以前没有任何地方申请过权限，
	 * `_notifyAgentComplete` 里那个 `permission === 'granted'` 分支因此从来没成立过。
	 *
	 * iPad 上还有一层：Safari 普通标签页里 `window.Notification` 根本是 undefined（iOS 只对「添加到
	 * 主屏幕」的 Web App 暴露这个 API），这时 `permission` 是 undefined，连问都问不了，只能靠提示语
	 * 让人先把站点加到主屏幕。
	 */
	private _requestNotificationPermission(targetWindow: Window & typeof globalThis): void {
		const notificationApi = targetWindow.Notification;
		if (!notificationApi || this._notificationPermissionAsked) {
			return;
		}
		this._notificationPermissionAsked = true;
		this._storageService.store(NOTIFICATION_ASKED_STORAGE_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
		this._notificationService.prompt(
			Severity.Info,
			nls.localize('tomoshibi.agent.notify.ask', "要不要在 agent 跑完时推一条系统通知？这样切到别的 App 也能知道。（iPad 上得先把本站「添加到主屏幕」再从那个图标打开，Safari 标签页里收不到。）"),
			[{
				label: nls.localize('tomoshibi.agent.notify.enable', "开启完成提醒"),
				run: () => {
					void notificationApi.requestPermission();
				},
			}, {
				label: nls.localize('tomoshibi.agent.notify.never', "不用了"),
				isSecondary: true,
				run: () => { },
			}],
			{ sticky: true }
		);
	}

	/**
	 * 盯住一个实例的死亡。⛔ 不能只靠「关闭 Session」菜单调 `forget()`：shell 里敲 exit、进程崩掉、
	 * KillAll、KillViewOrEditor 都不经过那条路，元数据就永远留在文件里了。
	 */
	private _watchInstance(instance: ITerminalInstance): void {
		const instanceId = instance.instanceId;
		if (this._instanceListeners.has(instanceId)) {
			return;
		}
		const store = new DisposableStore();
		// onWillDispose 早于 `_processManager.dispose()`（terminalInstance.ts:1515 vs :1547），是唯一
		// 还能分辨「被杀」和「被 detach」的时刻：detach 走的 `detachProcessAndDispose` 会先 await
		// `detachFromProcess()`，那个函数把 `_process` 置 null（terminalProcessManager.ts:238-241），
		// 于是 `persistentProcessId`（同文件 :133 读 `_process?.id`）在这一刻已经是 undefined；
		// 真被杀的实例这时进程还挂着。等到 onDisposed 两边就都是 undefined 了，分不出来。
		// 键也要在这一刻抓：`onDisposed` 时 `_pruneDeadInstances` 可能已经把缓存的键抹了，而
		// 那时 `persistentProcessId` 也没了，重算只会退回 `local:`。
		store.add(instance.onWillDispose(() => this._disposeSnapshots.set(instanceId, {
			key: this._sessionKeysByInstanceId.get(instanceId) ?? this._computeSessionKey(instance),
			hadLiveProcess: instance.persistentProcessId !== undefined,
		})));
		store.add(instance.onDisposed(() => this._onInstanceDisposed(instance)));
		this._instanceListeners.set(instanceId, store);
	}

	private _onInstanceDisposed(instance: ITerminalInstance): void {
		const instanceId = instance.instanceId;
		const snapshot = this._disposeSnapshots.get(instanceId);
		this._disposeSnapshots.delete(instanceId);
		this._instanceListeners.deleteAndDispose(instanceId);
		if (!snapshot) {
			return;
		}
		if (!snapshot.hadLiveProcess) {
			// detach（「从 Session 分离」、关页面时的持久化路径）——进程还在 pty 宿主那边，会回来。
			return;
		}
		// Shutdown = 关页面/重载。持久化开着时走的是上面那条 detach 分支，走到这里说明这台机器上
		// 压根没开持久化，那种情况下留不留元数据都无所谓，交给保留期。Unknown 来源不明，一律保守。
		const reason = instance.exitReason;
		if (reason !== TerminalExitReason.Process && reason !== TerminalExitReason.User && reason !== TerminalExitReason.Extension) {
			return;
		}
		this._forgetKey(snapshot.key);
	}

	private _pruneDeadInstances(): void {
		const live = new Set(this._terminalService.instances.map(instance => instance.instanceId));
		// ⛔ 遍历源必须是「真正存着状态的那几张表的并集」，不能只拿 `_sessionKeysByInstanceId`：
		// 那张表只有 `sessionKey()` 被调用过的实例才有（渲染路径只对每个组的 activeInstance 调），
		// 而四张活动表是按 `onAnyInstanceData` 填的，覆盖所有实例 —— 从编辑器区直接新建的终端、
		// 重载后恢复的分屏里用户从没切过去的窗格，销毁时条目和 12 秒定时器就全留下了。
		const tracked = new Set<number>([
			...this._sessionKeysByInstanceId.keys(),
			...this._activityStates.keys(),
			...this._activityTimers.keys(),
			...this._activityFlushTimers.keys(),
			...this._pendingActivityData.keys(),
		]);
		for (const instanceId of tracked) {
			if (live.has(instanceId)) {
				continue;
			}
			// ⛔ 这里不许动 `_instanceListeners` / `_disposeSnapshots`：本函数挂在
			// `onDidChangeInstances` 上，而实例是先 fire `onDisposed`、由 terminalService 摘掉之后才
			// 触发这个事件的，两个监听器在同一次 fire 里谁先谁后取决于注册顺序。要是这里先跑并把
			// 订阅扔了，`_onInstanceDisposed` 就再也不会被调用，死条目也就回收不掉了。
			// 那两个 map 由 `_onInstanceDisposed` 自己清。
			this._sessionKeysByInstanceId.delete(instanceId);
			const timer = this._activityTimers.get(instanceId);
			if (timer) {
				clearTimeout(timer);
			}
			this._activityTimers.delete(instanceId);
			this._activityStates.delete(instanceId);
			const flushTimer = this._activityFlushTimers.get(instanceId);
			if (flushTimer) {
				clearTimeout(flushTimer);
			}
			this._activityFlushTimers.delete(instanceId);
			this._pendingActivityData.delete(instanceId);
		}
		// `_waitingKeys` 是按元数据键存的，实例走了它不会自己掉。此刻 `_sessionKeysByInstanceId`
		// 里剩下的就是活实例的键，其余一律清掉 —— 否则一条黄点会挂在已经不存在的 Session 上。
		if (this._waitingKeys.size) {
			const liveKeys = new Set(this._sessionKeysByInstanceId.values());
			for (const key of [...this._waitingKeys]) {
				if (!liveKeys.has(key)) {
					this._waitingKeys.delete(key);
				}
			}
		}
	}

	//#endregion
}
