/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// allow-any-unicode-file

import { isActiveElement, isKeyboardEvent } from '../../../base/browser/dom.js';
import { IContextViewProvider } from '../../../base/browser/ui/contextview/contextview.js';
import { IListMouseEvent, IListRenderer, IListTouchEvent, IListVirtualDelegate } from '../../../base/browser/ui/list/list.js';
import { IPagedListOptions, IPagedRenderer, PagedList } from '../../../base/browser/ui/list/listPaging.js';
import { IKeyboardNavigationEventFilter, IListAccessibilityProvider, IListOptions, IListOptionsUpdate, IListStyles, IMultipleSelectionController, isSelectionRangeChangeEvent, isSelectionSingleChangeEvent, List, TypeNavigationMode } from '../../../base/browser/ui/list/listWidget.js';
import { ITableColumn, ITableRenderer, ITableVirtualDelegate } from '../../../base/browser/ui/table/table.js';
import { ITableOptions, ITableOptionsUpdate, ITableStyles, Table } from '../../../base/browser/ui/table/tableWidget.js';
import { IAbstractTreeOptions, IAbstractTreeOptionsUpdate, RenderIndentGuides, TreeFindMatchType, TreeFindMode } from '../../../base/browser/ui/tree/abstractTree.js';
import { AsyncDataTree, CompressibleAsyncDataTree, IAsyncDataTreeNode, IAsyncDataTreeOptions, IAsyncDataTreeOptionsUpdate, ICompressibleAsyncDataTreeOptions, ICompressibleAsyncDataTreeOptionsUpdate, ITreeCompressionDelegate } from '../../../base/browser/ui/tree/asyncDataTree.js';
import { DataTree, IDataTreeOptions } from '../../../base/browser/ui/tree/dataTree.js';
import { CompressibleObjectTree, ICompressibleObjectTreeOptions, ICompressibleObjectTreeOptionsUpdate, ICompressibleTreeRenderer, IObjectTreeOptions, ObjectTree } from '../../../base/browser/ui/tree/objectTree.js';
import { IAsyncDataSource, IDataSource, ITreeEvent, ITreeRenderer } from '../../../base/browser/ui/tree/tree.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { combinedDisposable, Disposable, DisposableStore, dispose, IDisposable, toDisposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, IScopedContextKeyService, RawContextKey } from '../../contextkey/common/contextkey.js';
import { InputFocusedContextKey } from '../../contextkey/common/contextkeys.js';
import { IContextViewService } from '../../contextview/browser/contextView.js';
import { IEditorOptions } from '../../editor/common/editor.js';
import { createDecorator, IInstantiationService, ServicesAccessor } from '../../instantiation/common/instantiation.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { ResultKind } from '../../keybinding/common/keybindingResolver.js';
import { Registry } from '../../registry/common/platform.js';
import { defaultFindWidgetStyles, defaultListStyles, getListStyles, IStyleOverride } from '../../theme/browser/defaultStyles.js';

export type ListWidget = List<any> | PagedList<any> | ObjectTree<any, any> | DataTree<any, any, any> | AsyncDataTree<any, any, any> | Table<any>;
export type WorkbenchListWidget = WorkbenchList<any> | WorkbenchPagedList<any> | WorkbenchObjectTree<any, any> | WorkbenchCompressibleObjectTree<any, any> | WorkbenchDataTree<any, any, any> | WorkbenchAsyncDataTree<any, any, any> | WorkbenchCompressibleAsyncDataTree<any, any, any> | WorkbenchTable<any>;

export const IListService = createDecorator<IListService>('listService');

export interface IListService {

	readonly _serviceBrand: undefined;

	/**
	 * Returns the currently focused list widget if any.
	 */
	readonly lastFocusedList: WorkbenchListWidget | undefined;
}

interface IRegisteredList {
	widget: WorkbenchListWidget;
	extraContextKeys?: (IContextKey<boolean>)[];
}

export class ListService implements IListService {

	declare readonly _serviceBrand: undefined;

	private readonly disposables = new DisposableStore();
	private lists: IRegisteredList[] = [];
	private _lastFocusedWidget: WorkbenchListWidget | undefined = undefined;

	get lastFocusedList(): WorkbenchListWidget | undefined {
		return this._lastFocusedWidget;
	}

	constructor() { }

	private setLastFocusedList(widget: WorkbenchListWidget | undefined): void {
		if (widget === this._lastFocusedWidget) {
			return;
		}

		this._lastFocusedWidget?.getHTMLElement().classList.remove('last-focused');
		this._lastFocusedWidget = widget;
		this._lastFocusedWidget?.getHTMLElement().classList.add('last-focused');
	}

	register(widget: WorkbenchListWidget, extraContextKeys?: (IContextKey<boolean>)[]): IDisposable {
		if (this.lists.some(l => l.widget === widget)) {
			throw new Error('Cannot register the same widget multiple times');
		}

		// Keep in our lists list
		const registeredList: IRegisteredList = { widget, extraContextKeys };
		this.lists.push(registeredList);

		// Check for currently being focused
		if (isActiveElement(widget.getHTMLElement())) {
			this.setLastFocusedList(widget);
		}

		return combinedDisposable(
			widget.onDidFocus(() => this.setLastFocusedList(widget)),
			toDisposable(() => this.lists.splice(this.lists.indexOf(registeredList), 1)),
			widget.onDidDispose(() => {
				this.lists = this.lists.filter(l => l !== registeredList);
				if (this._lastFocusedWidget === widget) {
					this.setLastFocusedList(undefined);
				}
			})
		);
	}

	dispose(): void {
		this.disposables.dispose();
	}
}

export const RawWorkbenchListScrollAtBoundaryContextKey = new RawContextKey<'none' | 'top' | 'bottom' | 'both'>('listScrollAtBoundary', 'none');
export const WorkbenchListScrollAtTopContextKey = ContextKeyExpr.or(
	RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('top'),
	RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('both'));
export const WorkbenchListScrollAtBottomContextKey = ContextKeyExpr.or(
	RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('bottom'),
	RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo('both'));

export const RawWorkbenchListFocusContextKey = new RawContextKey<boolean>('listFocus', true);
export const WorkbenchTreeStickyScrollFocused = new RawContextKey<boolean>('treestickyScrollFocused', false);
export const WorkbenchListSupportsMultiSelectContextKey = new RawContextKey<boolean>('listSupportsMultiselect', true);
export const WorkbenchListFocusContextKey = ContextKeyExpr.and(RawWorkbenchListFocusContextKey, ContextKeyExpr.not(InputFocusedContextKey), WorkbenchTreeStickyScrollFocused.negate());
export const WorkbenchListHasSelectionOrFocus = new RawContextKey<boolean>('listHasSelectionOrFocus', false);
export const WorkbenchListDoubleSelection = new RawContextKey<boolean>('listDoubleSelection', false);
export const WorkbenchListMultiSelection = new RawContextKey<boolean>('listMultiSelection', false);
export const WorkbenchListSelectionNavigation = new RawContextKey<boolean>('listSelectionNavigation', false);
export const WorkbenchListSupportsFind = new RawContextKey<boolean>('listSupportsFind', true);
export const WorkbenchTreeElementCanCollapse = new RawContextKey<boolean>('treeElementCanCollapse', false);
export const WorkbenchTreeElementHasParent = new RawContextKey<boolean>('treeElementHasParent', false);
export const WorkbenchTreeElementCanExpand = new RawContextKey<boolean>('treeElementCanExpand', false);
export const WorkbenchTreeElementHasChild = new RawContextKey<boolean>('treeElementHasChild', false);
export const WorkbenchTreeFindOpen = new RawContextKey<boolean>('treeFindOpen', false);
const WorkbenchListTypeNavigationModeKey = 'listTypeNavigationMode';

/**
 * @deprecated in favor of WorkbenchListTypeNavigationModeKey
 */
const WorkbenchListAutomaticKeyboardNavigationLegacyKey = 'listAutomaticKeyboardNavigation';

function createScopedContextKeyService(contextKeyService: IContextKeyService, widget: ListWidget): IScopedContextKeyService {
	const result = contextKeyService.createScoped(widget.getHTMLElement());
	RawWorkbenchListFocusContextKey.bindTo(result);
	return result;
}

// Note: We must declare IScrollObservarable as the arithmetic of concrete classes,
// instead of object type like { onDidScroll: Event<any>; ... }. The latter will not mark
// those properties as referenced during tree-shaking, causing them to be shaked away.
type IScrollObservarable = Exclude<WorkbenchListWidget, WorkbenchPagedList<any>> | List<any>;

function createScrollObserver(contextKeyService: IContextKeyService, widget: IScrollObservarable): IDisposable {
	const listScrollAt = RawWorkbenchListScrollAtBoundaryContextKey.bindTo(contextKeyService);
	const update = () => {
		const atTop = widget.scrollTop === 0;

		// We need a threshold `1` since scrollHeight is rounded.
		// https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight#determine_if_an_element_has_been_totally_scrolled
		const atBottom = widget.scrollHeight - widget.renderHeight - widget.scrollTop < 1;
		if (atTop && atBottom) {
			listScrollAt.set('both');
		} else if (atTop) {
			listScrollAt.set('top');
		} else if (atBottom) {
			listScrollAt.set('bottom');
		} else {
			listScrollAt.set('none');
		}
	};
	update();
	return widget.onDidScroll(update);
}

const multiSelectModifierSettingKey = 'workbench.list.multiSelectModifier';
const openModeSettingKey = 'workbench.list.openMode';
const horizontalScrollingKey = 'workbench.list.horizontalScrolling';
const defaultFindModeSettingKey = 'workbench.list.defaultFindMode';
const typeNavigationModeSettingKey = 'workbench.list.typeNavigationMode';
/** @deprecated in favor of `workbench.list.defaultFindMode` and `workbench.list.typeNavigationMode` */
const keyboardNavigationSettingKey = 'workbench.list.keyboardNavigation';
const scrollByPageKey = 'workbench.list.scrollByPage';
const defaultFindMatchTypeSettingKey = 'workbench.list.defaultFindMatchType';
const treeIndentKey = 'workbench.tree.indent';
const treeRenderIndentGuidesKey = 'workbench.tree.renderIndentGuides';
const listSmoothScrolling = 'workbench.list.smoothScrolling';
const mouseWheelScrollSensitivityKey = 'workbench.list.mouseWheelScrollSensitivity';
const fastScrollSensitivityKey = 'workbench.list.fastScrollSensitivity';
const treeExpandMode = 'workbench.tree.expandMode';
const treeStickyScroll = 'workbench.tree.enableStickyScroll';
const treeStickyScrollMaxElements = 'workbench.tree.stickyScrollMaxItemCount';

function useAltAsMultipleSelectionModifier(configurationService: IConfigurationService): boolean {
	return configurationService.getValue(multiSelectModifierSettingKey) === 'alt';
}

class MultipleSelectionController<T> extends Disposable implements IMultipleSelectionController<T> {
	private useAltAsMultipleSelectionModifier: boolean;

	constructor(private configurationService: IConfigurationService) {
		super();

		this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
				this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(this.configurationService);
			}
		}));
	}

	isSelectionSingleChangeEvent(event: IListMouseEvent<T> | IListTouchEvent<T>): boolean {
		if (this.useAltAsMultipleSelectionModifier) {
			return event.browserEvent.altKey;
		}

		return isSelectionSingleChangeEvent(event);
	}

	isSelectionRangeChangeEvent(event: IListMouseEvent<T> | IListTouchEvent<T>): boolean {
		return isSelectionRangeChangeEvent(event);
	}
}

function toWorkbenchListOptions<T>(
	accessor: ServicesAccessor,
	options: IListOptions<T>,
): [IListOptions<T>, IDisposable] {
	const configurationService = accessor.get(IConfigurationService);
	const keybindingService = accessor.get(IKeybindingService);

	const disposables = new DisposableStore();
	const result: IListOptions<T> = {
		...options,
		keyboardNavigationDelegate: { mightProducePrintableCharacter(e) { return keybindingService.mightProducePrintableCharacter(e); } },
		smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
		mouseWheelScrollSensitivity: configurationService.getValue<number>(mouseWheelScrollSensitivityKey),
		fastScrollSensitivity: configurationService.getValue<number>(fastScrollSensitivityKey),
		multipleSelectionController: options.multipleSelectionController ?? disposables.add(new MultipleSelectionController(configurationService)),
		keyboardNavigationEventFilter: createKeyboardNavigationEventFilter(keybindingService),
		scrollByPage: Boolean(configurationService.getValue(scrollByPageKey))
	};

	return [result, disposables];
}

export interface IWorkbenchListOptionsUpdate extends IListOptionsUpdate {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchListOptions<T> extends IWorkbenchListOptionsUpdate, IResourceNavigatorOptions, IListOptions<T> {
	readonly selectionNavigation?: boolean;
}

export class WorkbenchList<T> extends List<T> {

	readonly contextKeyService: IScopedContextKeyService;
	private listSupportsMultiSelect: IContextKey<boolean>;
	private listHasSelectionOrFocus: IContextKey<boolean>;
	private listDoubleSelection: IContextKey<boolean>;
	private listMultiSelection: IContextKey<boolean>;
	private horizontalScrolling: boolean | undefined;
	private _useAltAsMultipleSelectionModifier: boolean;
	private navigator: ListResourceNavigator<T>;
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.navigator.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: IListRenderer<T, any>[],
		options: IWorkbenchListOptions<T>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
		const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);

		super(user, container, delegate, renderers,
			{
				keyboardSupport: false,
				...workbenchListOptions,
				horizontalScrolling,
			}
		);

		this.disposables.add(workbenchListOptionsDisposable);

		this.contextKeyService = createScopedContextKeyService(contextKeyService, this);

		this.disposables.add(createScrollObserver(this.contextKeyService, this));

		this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
		this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);

		const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
		listSelectionNavigation.set(Boolean(options.selectionNavigation));

		this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
		this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
		this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
		this.horizontalScrolling = options.horizontalScrolling;

		this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.disposables.add(this.contextKeyService);
		this.disposables.add((listService as ListService).register(this));

		this.updateStyles(options.overrideStyles);

		this.disposables.add(this.onDidChangeSelection(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.contextKeyService.bufferChangeEvents(() => {
				this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
				this.listMultiSelection.set(selection.length > 1);
				this.listDoubleSelection.set(selection.length === 2);
			});
		}));
		this.disposables.add(this.onDidChangeFocus(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
		}));
		this.disposables.add(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
				this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
			}

			let options: IListOptionsUpdate = {};

			if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
				const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
				options = { ...options, horizontalScrolling };
			}
			if (e.affectsConfiguration(scrollByPageKey)) {
				const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
				options = { ...options, scrollByPage };
			}
			if (e.affectsConfiguration(listSmoothScrolling)) {
				const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
				options = { ...options, smoothScrolling };
			}
			if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
				const mouseWheelScrollSensitivity = configurationService.getValue<number>(mouseWheelScrollSensitivityKey);
				options = { ...options, mouseWheelScrollSensitivity };
			}
			if (e.affectsConfiguration(fastScrollSensitivityKey)) {
				const fastScrollSensitivity = configurationService.getValue<number>(fastScrollSensitivityKey);
				options = { ...options, fastScrollSensitivity };
			}
			if (Object.keys(options).length > 0) {
				this.updateOptions(options);
			}
		}));

		this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
		this.disposables.add(this.navigator);
	}

	override updateOptions(options: IWorkbenchListOptionsUpdate): void {
		super.updateOptions(options);

		if (options.overrideStyles !== undefined) {
			this.updateStyles(options.overrideStyles);
		}

		if (options.multipleSelectionSupport !== undefined) {
			this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
		}
	}

	private updateStyles(styles: IStyleOverride<IListStyles> | undefined): void {
		this.style(styles ? getListStyles(styles) : defaultListStyles);
	}

	get useAltAsMultipleSelectionModifier(): boolean {
		return this._useAltAsMultipleSelectionModifier;
	}
}

export interface IWorkbenchPagedListOptions<T> extends IWorkbenchListOptionsUpdate, IResourceNavigatorOptions, IPagedListOptions<T> {
	readonly selectionNavigation?: boolean;
}

export class WorkbenchPagedList<T> extends PagedList<T> {

	readonly contextKeyService: IScopedContextKeyService;
	private readonly disposables: DisposableStore;
	private listSupportsMultiSelect: IContextKey<boolean>;
	private _useAltAsMultipleSelectionModifier: boolean;
	private horizontalScrolling: boolean | undefined;
	private navigator: ListResourceNavigator<T>;
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.navigator.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<number>,
		renderers: IPagedRenderer<T, any>[],
		options: IWorkbenchPagedListOptions<T>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
		const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
		super(user, container, delegate, renderers,
			{
				keyboardSupport: false,
				...workbenchListOptions,
				horizontalScrolling,
			}
		);

		this.disposables = new DisposableStore();
		this.disposables.add(workbenchListOptionsDisposable);

		this.contextKeyService = createScopedContextKeyService(contextKeyService, this);

		this.disposables.add(createScrollObserver(this.contextKeyService, this.widget));

		this.horizontalScrolling = options.horizontalScrolling;

		this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
		this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);

		const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
		listSelectionNavigation.set(Boolean(options.selectionNavigation));

		this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.disposables.add(this.contextKeyService);
		this.disposables.add((listService as ListService).register(this));

		this.updateStyles(options.overrideStyles);

		this.disposables.add(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
				this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
			}

			let options: IListOptionsUpdate = {};

			if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
				const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
				options = { ...options, horizontalScrolling };
			}
			if (e.affectsConfiguration(scrollByPageKey)) {
				const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
				options = { ...options, scrollByPage };
			}
			if (e.affectsConfiguration(listSmoothScrolling)) {
				const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
				options = { ...options, smoothScrolling };
			}
			if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
				const mouseWheelScrollSensitivity = configurationService.getValue<number>(mouseWheelScrollSensitivityKey);
				options = { ...options, mouseWheelScrollSensitivity };
			}
			if (e.affectsConfiguration(fastScrollSensitivityKey)) {
				const fastScrollSensitivity = configurationService.getValue<number>(fastScrollSensitivityKey);
				options = { ...options, fastScrollSensitivity };
			}
			if (Object.keys(options).length > 0) {
				this.updateOptions(options);
			}
		}));

		this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
		this.disposables.add(this.navigator);
	}

	override updateOptions(options: IWorkbenchListOptionsUpdate): void {
		super.updateOptions(options);

		if (options.overrideStyles !== undefined) {
			this.updateStyles(options.overrideStyles);
		}

		if (options.multipleSelectionSupport !== undefined) {
			this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
		}
	}

	private updateStyles(styles: IStyleOverride<IListStyles> | undefined): void {
		this.style(styles ? getListStyles(styles) : defaultListStyles);
	}

	get useAltAsMultipleSelectionModifier(): boolean {
		return this._useAltAsMultipleSelectionModifier;
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}

export interface IWorkbenchTableOptionsUpdate extends ITableOptionsUpdate {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchTableOptions<T> extends IWorkbenchTableOptionsUpdate, IResourceNavigatorOptions, ITableOptions<T> {
	readonly selectionNavigation?: boolean;
}

export class WorkbenchTable<TRow> extends Table<TRow> {

	readonly contextKeyService: IScopedContextKeyService;
	private listSupportsMultiSelect: IContextKey<boolean>;
	private listHasSelectionOrFocus: IContextKey<boolean>;
	private listDoubleSelection: IContextKey<boolean>;
	private listMultiSelection: IContextKey<boolean>;
	private horizontalScrolling: boolean | undefined;
	private _useAltAsMultipleSelectionModifier: boolean;
	private navigator: TableResourceNavigator<TRow>;
	get onDidOpen(): Event<IOpenEvent<TRow | undefined>> { return this.navigator.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: ITableVirtualDelegate<TRow>,
		columns: ITableColumn<TRow, any>[],
		renderers: ITableRenderer<TRow, any>[],
		options: IWorkbenchTableOptions<TRow>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		const horizontalScrolling = typeof options.horizontalScrolling !== 'undefined' ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
		const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);

		super(user, container, delegate, columns, renderers,
			{
				keyboardSupport: false,
				...workbenchListOptions,
				horizontalScrolling,
			}
		);

		this.disposables.add(workbenchListOptionsDisposable);

		this.contextKeyService = createScopedContextKeyService(contextKeyService, this);

		this.disposables.add(createScrollObserver(this.contextKeyService, this));

		this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
		this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);

		const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
		listSelectionNavigation.set(Boolean(options.selectionNavigation));

		this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
		this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
		this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
		this.horizontalScrolling = options.horizontalScrolling;

		this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.disposables.add(this.contextKeyService);
		this.disposables.add((listService as ListService).register(this));

		this.updateStyles(options.overrideStyles);

		this.disposables.add(this.onDidChangeSelection(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.contextKeyService.bufferChangeEvents(() => {
				this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
				this.listMultiSelection.set(selection.length > 1);
				this.listDoubleSelection.set(selection.length === 2);
			});
		}));
		this.disposables.add(this.onDidChangeFocus(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
		}));
		this.disposables.add(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
				this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
			}

			let options: IListOptionsUpdate = {};

			if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === undefined) {
				const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
				options = { ...options, horizontalScrolling };
			}
			if (e.affectsConfiguration(scrollByPageKey)) {
				const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
				options = { ...options, scrollByPage };
			}
			if (e.affectsConfiguration(listSmoothScrolling)) {
				const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
				options = { ...options, smoothScrolling };
			}
			if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
				const mouseWheelScrollSensitivity = configurationService.getValue<number>(mouseWheelScrollSensitivityKey);
				options = { ...options, mouseWheelScrollSensitivity };
			}
			if (e.affectsConfiguration(fastScrollSensitivityKey)) {
				const fastScrollSensitivity = configurationService.getValue<number>(fastScrollSensitivityKey);
				options = { ...options, fastScrollSensitivity };
			}
			if (Object.keys(options).length > 0) {
				this.updateOptions(options);
			}
		}));

		this.navigator = new TableResourceNavigator(this, { configurationService, ...options });
		this.disposables.add(this.navigator);
	}

	override updateOptions(options: IWorkbenchTableOptionsUpdate): void {
		super.updateOptions(options);

		if (options.overrideStyles !== undefined) {
			this.updateStyles(options.overrideStyles);
		}

		if (options.multipleSelectionSupport !== undefined) {
			this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
		}
	}

	private updateStyles(styles: IStyleOverride<ITableStyles> | undefined): void {
		this.style(styles ? getListStyles(styles) : defaultListStyles);
	}

	get useAltAsMultipleSelectionModifier(): boolean {
		return this._useAltAsMultipleSelectionModifier;
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}

export interface IOpenEvent<T> {
	editorOptions: IEditorOptions;
	sideBySide: boolean;
	element: T;
	browserEvent?: UIEvent;
}

export interface IResourceNavigatorOptions {
	readonly configurationService?: IConfigurationService;
	readonly openOnSingleClick?: boolean;
}

export interface SelectionKeyboardEvent extends KeyboardEvent {
	preserveFocus?: boolean;
	pinned?: boolean;
	__forceEvent?: boolean;
}

export function getSelectionKeyboardEvent(typeArg = 'keydown', preserveFocus?: boolean, pinned?: boolean): SelectionKeyboardEvent {
	const e = new KeyboardEvent(typeArg);
	(<SelectionKeyboardEvent>e).preserveFocus = preserveFocus;
	(<SelectionKeyboardEvent>e).pinned = pinned;
	(<SelectionKeyboardEvent>e).__forceEvent = true;

	return e;
}

abstract class ResourceNavigator<T> extends Disposable {

	private openOnSingleClick: boolean;

	private readonly _onDidOpen = this._register(new Emitter<IOpenEvent<T | undefined>>());
	readonly onDidOpen: Event<IOpenEvent<T | undefined>> = this._onDidOpen.event;

	constructor(
		protected readonly widget: ListWidget,
		options?: IResourceNavigatorOptions
	) {
		super();

		this._register(Event.filter(this.widget.onDidChangeSelection, e => isKeyboardEvent(e.browserEvent))(e => this.onSelectionFromKeyboard(e)));
		this._register(this.widget.onPointer((e: { browserEvent: MouseEvent; element: T | undefined }) => this.onPointer(e.element, e.browserEvent)));
		this._register(this.widget.onMouseDblClick((e: { browserEvent: MouseEvent; element: T | undefined }) => this.onMouseDblClick(e.element, e.browserEvent)));

		if (typeof options?.openOnSingleClick !== 'boolean' && options?.configurationService) {
			this.openOnSingleClick = options?.configurationService.getValue(openModeSettingKey) !== 'doubleClick';
			this._register(options?.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(openModeSettingKey)) {
					this.openOnSingleClick = options?.configurationService!.getValue(openModeSettingKey) !== 'doubleClick';
				}
			}));
		} else {
			this.openOnSingleClick = options?.openOnSingleClick ?? true;
		}
	}

	private onSelectionFromKeyboard(event: ITreeEvent<any>): void {
		if (event.elements.length !== 1) {
			return;
		}

		const selectionKeyboardEvent = event.browserEvent as SelectionKeyboardEvent;
		const preserveFocus = typeof selectionKeyboardEvent.preserveFocus === 'boolean' ? selectionKeyboardEvent.preserveFocus : true;
		const pinned = typeof selectionKeyboardEvent.pinned === 'boolean' ? selectionKeyboardEvent.pinned : !preserveFocus;
		const sideBySide = false;

		this._open(this.getSelectedElement(), preserveFocus, pinned, sideBySide, event.browserEvent);
	}

	private onPointer(element: T | undefined, browserEvent: MouseEvent): void {
		if (!this.openOnSingleClick) {
			return;
		}

		const isDoubleClick = browserEvent.detail === 2;

		if (isDoubleClick) {
			return;
		}

		const isMiddleClick = browserEvent.button === 1;
		const preserveFocus = true;
		const pinned = isMiddleClick;
		const sideBySide = browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey;

		this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
	}

	private onMouseDblClick(element: T | undefined, browserEvent?: MouseEvent): void {
		if (!browserEvent) {
			return;
		}

		// copied from AbstractTree
		const target = browserEvent.target as HTMLElement;
		const onTwistie = target.classList.contains('monaco-tl-twistie')
			|| (target.classList.contains('monaco-icon-label') && target.classList.contains('folder-icon') && browserEvent.offsetX < 16);

		if (onTwistie) {
			return;
		}

		const preserveFocus = false;
		const pinned = true;
		const sideBySide = (browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey);

		this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
	}

	private _open(element: T | undefined, preserveFocus: boolean, pinned: boolean, sideBySide: boolean, browserEvent?: UIEvent): void {
		if (!element) {
			return;
		}

		this._onDidOpen.fire({
			editorOptions: {
				preserveFocus,
				pinned,
				revealIfVisible: true
			},
			sideBySide,
			element,
			browserEvent
		});
	}

	abstract getSelectedElement(): T | undefined;
}

class ListResourceNavigator<T> extends ResourceNavigator<T> {

	protected override readonly widget: List<T> | PagedList<T>;

	constructor(
		widget: List<T> | PagedList<T>,
		options: IResourceNavigatorOptions
	) {
		super(widget, options);
		this.widget = widget;
	}

	getSelectedElement(): T | undefined {
		return this.widget.getSelectedElements()[0];
	}
}

class TableResourceNavigator<TRow> extends ResourceNavigator<TRow> {

	protected declare readonly widget: Table<TRow>;

	constructor(
		widget: Table<TRow>,
		options: IResourceNavigatorOptions
	) {
		super(widget, options);
	}

	getSelectedElement(): TRow | undefined {
		return this.widget.getSelectedElements()[0];
	}
}

class TreeResourceNavigator<T, TFilterData> extends ResourceNavigator<T> {

	protected declare readonly widget: ObjectTree<T, TFilterData> | CompressibleObjectTree<T, TFilterData> | DataTree<any, T, TFilterData> | AsyncDataTree<any, T, TFilterData> | CompressibleAsyncDataTree<any, T, TFilterData>;

	constructor(
		widget: ObjectTree<T, TFilterData> | CompressibleObjectTree<T, TFilterData> | DataTree<any, T, TFilterData> | AsyncDataTree<any, T, TFilterData> | CompressibleAsyncDataTree<any, T, TFilterData>,
		options: IResourceNavigatorOptions
	) {
		super(widget, options);
	}

	getSelectedElement(): T | undefined {
		return this.widget.getSelection()[0] ?? undefined;
	}
}

function createKeyboardNavigationEventFilter(keybindingService: IKeybindingService): IKeyboardNavigationEventFilter {
	let inMultiChord = false;

	return event => {
		if (event.toKeyCodeChord().isModifierKey()) {
			return false;
		}

		if (inMultiChord) {
			inMultiChord = false;
			return false;
		}

		const result = keybindingService.softDispatch(event, event.target);

		if (result.kind === ResultKind.MoreChordsNeeded) {
			inMultiChord = true;
			return false;
		}

		inMultiChord = false;
		return result.kind === ResultKind.NoMatchingKb;
	};
}

export interface IWorkbenchObjectTreeOptionsUpdate<T> extends IAbstractTreeOptionsUpdate<T> {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchObjectTreeOptions<T, TFilterData> extends IObjectTreeOptions<T, TFilterData>, IWorkbenchObjectTreeOptionsUpdate<T>, IResourceNavigatorOptions {
	readonly accessibilityProvider: IListAccessibilityProvider<T>;
	readonly selectionNavigation?: boolean;
	readonly scrollToActiveElement?: boolean;
}

export class WorkbenchObjectTree<T extends NonNullable<any>, TFilterData = void> extends ObjectTree<T, TFilterData> {

	private internals: WorkbenchTreeInternals<any, T, TFilterData>;
	get contextKeyService(): IContextKeyService { return this.internals.contextKeyService; }
	get useAltAsMultipleSelectionModifier(): boolean { return this.internals.useAltAsMultipleSelectionModifier; }
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.internals.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ITreeRenderer<T, TFilterData, any>[],
		options: IWorkbenchObjectTreeOptions<T, TFilterData>,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		// eslint-disable-next-line local/code-no-any-casts
		const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options as any);
		super(user, container, delegate, renderers, treeOptions);
		this.disposables.add(disposable);
		this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
		this.disposables.add(this.internals);
	}

	override updateOptions(options: IWorkbenchObjectTreeOptionsUpdate<T | null> = {}): void {
		super.updateOptions(options);

		if (options.overrideStyles) {
			this.internals.updateStyleOverrides(options.overrideStyles);
		}

		this.internals.updateOptions(options);
	}
}

export interface IWorkbenchCompressibleObjectTreeOptionsUpdate<T> extends ICompressibleObjectTreeOptionsUpdate<T> {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchCompressibleObjectTreeOptions<T, TFilterData> extends IWorkbenchCompressibleObjectTreeOptionsUpdate<T>, ICompressibleObjectTreeOptions<T, TFilterData>, IResourceNavigatorOptions {
	readonly accessibilityProvider: IListAccessibilityProvider<T>;
	readonly selectionNavigation?: boolean;
}

export class WorkbenchCompressibleObjectTree<T extends NonNullable<any>, TFilterData = void> extends CompressibleObjectTree<T, TFilterData> {

	private internals: WorkbenchTreeInternals<any, T, TFilterData>;
	get contextKeyService(): IContextKeyService { return this.internals.contextKeyService; }
	get useAltAsMultipleSelectionModifier(): boolean { return this.internals.useAltAsMultipleSelectionModifier; }
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.internals.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ICompressibleTreeRenderer<T, TFilterData, any>[],
		options: IWorkbenchCompressibleObjectTreeOptions<T, TFilterData>,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		// eslint-disable-next-line local/code-no-any-casts
		const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options as any);
		super(user, container, delegate, renderers, treeOptions);
		this.disposables.add(disposable);
		this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
		this.disposables.add(this.internals);
	}

	override updateOptions(options: IWorkbenchCompressibleObjectTreeOptionsUpdate<T | null> = {}): void {
		super.updateOptions(options);

		if (options.overrideStyles) {
			this.internals.updateStyleOverrides(options.overrideStyles);
		}

		this.internals.updateOptions(options);
	}
}

export interface IWorkbenchDataTreeOptionsUpdate<T> extends IAbstractTreeOptionsUpdate<T> {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchDataTreeOptions<T, TFilterData> extends IWorkbenchDataTreeOptionsUpdate<T>, IDataTreeOptions<T, TFilterData>, IResourceNavigatorOptions {
	readonly accessibilityProvider: IListAccessibilityProvider<T>;
	readonly selectionNavigation?: boolean;
}

export class WorkbenchDataTree<TInput, T, TFilterData = void> extends DataTree<TInput, T, TFilterData> {

	private internals: WorkbenchTreeInternals<TInput, T, TFilterData>;
	get contextKeyService(): IContextKeyService { return this.internals.contextKeyService; }
	get useAltAsMultipleSelectionModifier(): boolean { return this.internals.useAltAsMultipleSelectionModifier; }
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.internals.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ITreeRenderer<T, TFilterData, any>[],
		dataSource: IDataSource<TInput, T>,
		options: IWorkbenchDataTreeOptions<T, TFilterData>,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		// eslint-disable-next-line local/code-no-any-casts
		const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options as any);
		super(user, container, delegate, renderers, dataSource, treeOptions);
		this.disposables.add(disposable);
		this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
		this.disposables.add(this.internals);
	}

	override updateOptions(options: IWorkbenchDataTreeOptionsUpdate<T | null> = {}): void {
		super.updateOptions(options);

		if (options.overrideStyles !== undefined) {
			this.internals.updateStyleOverrides(options.overrideStyles);
		}

		this.internals.updateOptions(options);
	}
}

export interface IWorkbenchAsyncDataTreeOptionsUpdate<T> extends IAsyncDataTreeOptionsUpdate<T> {
	readonly overrideStyles?: IStyleOverride<IListStyles>;
}

export interface IWorkbenchAsyncDataTreeOptions<T, TFilterData> extends IWorkbenchAsyncDataTreeOptionsUpdate<T>, IAsyncDataTreeOptions<T, TFilterData>, IResourceNavigatorOptions {
	readonly accessibilityProvider: IListAccessibilityProvider<T>;
	readonly selectionNavigation?: boolean;
}

export class WorkbenchAsyncDataTree<TInput, T, TFilterData = void> extends AsyncDataTree<TInput, T, TFilterData> {

	private internals: WorkbenchTreeInternals<TInput, T, TFilterData>;
	get contextKeyService(): IContextKeyService { return this.internals.contextKeyService; }
	get useAltAsMultipleSelectionModifier(): boolean { return this.internals.useAltAsMultipleSelectionModifier; }
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.internals.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		delegate: IListVirtualDelegate<T>,
		renderers: ITreeRenderer<T, TFilterData, any>[],
		dataSource: IAsyncDataSource<TInput, T>,
		options: IWorkbenchAsyncDataTreeOptions<T, TFilterData>,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		// eslint-disable-next-line local/code-no-any-casts
		const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options as any);
		super(user, container, delegate, renderers, dataSource, treeOptions);
		this.disposables.add(disposable);
		this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
		this.disposables.add(this.internals);
	}

	override updateOptions(options: IWorkbenchAsyncDataTreeOptionsUpdate<IAsyncDataTreeNode<TInput, T> | null> = {}): void {
		super.updateOptions(options);

		if (options.overrideStyles) {
			this.internals.updateStyleOverrides(options.overrideStyles);
		}

		this.internals.updateOptions(options);
	}
}

export interface IWorkbenchCompressibleAsyncDataTreeOptions<T, TFilterData> extends ICompressibleAsyncDataTreeOptions<T, TFilterData>, IResourceNavigatorOptions {
	readonly accessibilityProvider: IListAccessibilityProvider<T>;
	readonly overrideStyles?: IStyleOverride<IListStyles>;
	readonly selectionNavigation?: boolean;
}

export class WorkbenchCompressibleAsyncDataTree<TInput, T, TFilterData = void> extends CompressibleAsyncDataTree<TInput, T, TFilterData> {

	private internals: WorkbenchTreeInternals<TInput, T, TFilterData>;
	get contextKeyService(): IContextKeyService { return this.internals.contextKeyService; }
	get useAltAsMultipleSelectionModifier(): boolean { return this.internals.useAltAsMultipleSelectionModifier; }
	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.internals.onDidOpen; }

	constructor(
		user: string,
		container: HTMLElement,
		virtualDelegate: IListVirtualDelegate<T>,
		compressionDelegate: ITreeCompressionDelegate<T>,
		renderers: ICompressibleTreeRenderer<T, TFilterData, any>[],
		dataSource: IAsyncDataSource<TInput, T>,
		options: IWorkbenchCompressibleAsyncDataTreeOptions<T, TFilterData>,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		// eslint-disable-next-line local/code-no-any-casts
		const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options as any);
		super(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, treeOptions);
		this.disposables.add(disposable);
		this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
		this.disposables.add(this.internals);
	}

	override updateOptions(options: ICompressibleAsyncDataTreeOptionsUpdate<IAsyncDataTreeNode<TInput, T> | null>): void {
		super.updateOptions(options);
		this.internals.updateOptions(options);
	}
}

function getDefaultTreeFindMode(configurationService: IConfigurationService) {
	const value = configurationService.getValue<'highlight' | 'filter'>(defaultFindModeSettingKey);

	if (value === 'highlight') {
		return TreeFindMode.Highlight;
	} else if (value === 'filter') {
		return TreeFindMode.Filter;
	}

	const deprecatedValue = configurationService.getValue<'simple' | 'highlight' | 'filter'>(keyboardNavigationSettingKey);

	if (deprecatedValue === 'simple' || deprecatedValue === 'highlight') {
		return TreeFindMode.Highlight;
	} else if (deprecatedValue === 'filter') {
		return TreeFindMode.Filter;
	}

	return undefined;
}

function getDefaultTreeFindMatchType(configurationService: IConfigurationService) {
	const value = configurationService.getValue<'fuzzy' | 'contiguous'>(defaultFindMatchTypeSettingKey);

	if (value === 'fuzzy') {
		return TreeFindMatchType.Fuzzy;
	} else if (value === 'contiguous') {
		return TreeFindMatchType.Contiguous;
	}
	return undefined;
}

function workbenchTreeDataPreamble<T, TFilterData, TOptions extends IAbstractTreeOptions<T, TFilterData> | IAsyncDataTreeOptions<T, TFilterData>>(
	accessor: ServicesAccessor,
	options: TOptions,
): { options: TOptions; getTypeNavigationMode: () => TypeNavigationMode | undefined; disposable: IDisposable } {
	const configurationService = accessor.get(IConfigurationService);
	const contextViewService = accessor.get(IContextViewService);
	const contextKeyService = accessor.get(IContextKeyService);
	const instantiationService = accessor.get(IInstantiationService);

	const getTypeNavigationMode = () => {
		// give priority to the context key value to specify a value
		const modeString = contextKeyService.getContextKeyValue<'automatic' | 'trigger'>(WorkbenchListTypeNavigationModeKey);

		if (modeString === 'automatic') {
			return TypeNavigationMode.Automatic;
		} else if (modeString === 'trigger') {
			return TypeNavigationMode.Trigger;
		}

		// also check the deprecated context key to set the mode to 'trigger'
		const modeBoolean = contextKeyService.getContextKeyValue<boolean>(WorkbenchListAutomaticKeyboardNavigationLegacyKey);

		if (modeBoolean === false) {
			return TypeNavigationMode.Trigger;
		}

		// finally, check the setting
		const configString = configurationService.getValue<'automatic' | 'trigger'>(typeNavigationModeSettingKey);

		if (configString === 'automatic') {
			return TypeNavigationMode.Automatic;
		} else if (configString === 'trigger') {
			return TypeNavigationMode.Trigger;
		}

		return undefined;
	};

	const horizontalScrolling = options.horizontalScrolling !== undefined ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
	const [workbenchListOptions, disposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
	const paddingBottom = options.paddingBottom;
	const renderIndentGuides = options.renderIndentGuides !== undefined ? options.renderIndentGuides : configurationService.getValue<RenderIndentGuides>(treeRenderIndentGuidesKey);

	return {
		getTypeNavigationMode,
		disposable,
		// eslint-disable-next-line local/code-no-dangerous-type-assertions
		options: {
			// ...options, // TODO@Joao why is this not splatted here?
			keyboardSupport: false,
			...workbenchListOptions,
			indent: typeof configurationService.getValue(treeIndentKey) === 'number' ? configurationService.getValue(treeIndentKey) : undefined,
			renderIndentGuides,
			smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
			defaultFindMode: options.defaultFindMode ?? getDefaultTreeFindMode(configurationService),
			defaultFindMatchType: options.defaultFindMatchType ?? getDefaultTreeFindMatchType(configurationService),
			horizontalScrolling,
			scrollByPage: Boolean(configurationService.getValue(scrollByPageKey)),
			paddingBottom: paddingBottom,
			hideTwistiesOfChildlessElements: options.hideTwistiesOfChildlessElements,
			expandOnlyOnTwistieClick: options.expandOnlyOnTwistieClick ?? (configurationService.getValue<'singleClick' | 'doubleClick'>(treeExpandMode) === 'doubleClick'),
			contextViewProvider: contextViewService as IContextViewProvider,
			findWidgetStyles: defaultFindWidgetStyles,
			enableStickyScroll: Boolean(configurationService.getValue(treeStickyScroll)),
			stickyScrollMaxItemCount: Number(configurationService.getValue(treeStickyScrollMaxElements)),
		} as TOptions
	};
}

interface IWorkbenchTreeInternalsOptionsUpdate {
	readonly multipleSelectionSupport?: boolean;
}

class WorkbenchTreeInternals<TInput, T, TFilterData> {

	readonly contextKeyService: IScopedContextKeyService;
	private listSupportsMultiSelect: IContextKey<boolean>;
	private listSupportFindWidget: IContextKey<boolean>;
	private hasSelectionOrFocus: IContextKey<boolean>;
	private hasDoubleSelection: IContextKey<boolean>;
	private hasMultiSelection: IContextKey<boolean>;
	private treeElementCanCollapse: IContextKey<boolean>;
	private treeElementHasParent: IContextKey<boolean>;
	private treeElementCanExpand: IContextKey<boolean>;
	private treeElementHasChild: IContextKey<boolean>;
	private treeFindOpen: IContextKey<boolean>;
	private treeStickyScrollFocused: IContextKey<boolean>;
	private _useAltAsMultipleSelectionModifier: boolean;
	private disposables: IDisposable[] = [];

	private navigator: TreeResourceNavigator<T, TFilterData>;

	get onDidOpen(): Event<IOpenEvent<T | undefined>> { return this.navigator.onDidOpen; }

	constructor(
		private tree: WorkbenchObjectTree<T, TFilterData> | WorkbenchCompressibleObjectTree<T, TFilterData> | WorkbenchDataTree<TInput, T, TFilterData> | WorkbenchAsyncDataTree<TInput, T, TFilterData> | WorkbenchCompressibleAsyncDataTree<TInput, T, TFilterData>,
		options: IWorkbenchObjectTreeOptions<T, TFilterData> | IWorkbenchCompressibleObjectTreeOptions<T, TFilterData> | IWorkbenchDataTreeOptions<T, TFilterData> | IWorkbenchAsyncDataTreeOptions<T, TFilterData> | IWorkbenchCompressibleAsyncDataTreeOptions<T, TFilterData>,
		getTypeNavigationMode: () => TypeNavigationMode | undefined,
		overrideStyles: IStyleOverride<IListStyles> | undefined,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IListService listService: IListService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		this.contextKeyService = createScopedContextKeyService(contextKeyService, tree);

		this.disposables.push(createScrollObserver(this.contextKeyService, tree));

		this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
		this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);

		const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
		listSelectionNavigation.set(Boolean(options.selectionNavigation));

		this.listSupportFindWidget = WorkbenchListSupportsFind.bindTo(this.contextKeyService);
		this.listSupportFindWidget.set(options.findWidgetEnabled ?? true);

		this.hasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
		this.hasDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
		this.hasMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);

		this.treeElementCanCollapse = WorkbenchTreeElementCanCollapse.bindTo(this.contextKeyService);
		this.treeElementHasParent = WorkbenchTreeElementHasParent.bindTo(this.contextKeyService);
		this.treeElementCanExpand = WorkbenchTreeElementCanExpand.bindTo(this.contextKeyService);
		this.treeElementHasChild = WorkbenchTreeElementHasChild.bindTo(this.contextKeyService);

		this.treeFindOpen = WorkbenchTreeFindOpen.bindTo(this.contextKeyService);
		this.treeStickyScrollFocused = WorkbenchTreeStickyScrollFocused.bindTo(this.contextKeyService);

		this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.updateStyleOverrides(overrideStyles);

		const updateCollapseContextKeys = () => {
			const focus = tree.getFocus()[0];

			if (!focus) {
				return;
			}

			const node = tree.getNode(focus);
			this.treeElementCanCollapse.set(node.collapsible && !node.collapsed);
			this.treeElementHasParent.set(!!tree.getParentElement(focus));
			this.treeElementCanExpand.set(node.collapsible && node.collapsed);
			this.treeElementHasChild.set(!!tree.getFirstElementChild(focus));
		};

		const interestingContextKeys = new Set();
		interestingContextKeys.add(WorkbenchListTypeNavigationModeKey);
		interestingContextKeys.add(WorkbenchListAutomaticKeyboardNavigationLegacyKey);

		this.disposables.push(
			this.contextKeyService,
			(listService as ListService).register(tree),
			tree.onDidChangeSelection(() => {
				const selection = tree.getSelection();
				const focus = tree.getFocus();

				this.contextKeyService.bufferChangeEvents(() => {
					this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
					this.hasMultiSelection.set(selection.length > 1);
					this.hasDoubleSelection.set(selection.length === 2);
				});
			}),
			tree.onDidChangeFocus(() => {
				const selection = tree.getSelection();
				const focus = tree.getFocus();

				this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
				updateCollapseContextKeys();
			}),
			tree.onDidChangeCollapseState(updateCollapseContextKeys),
			tree.onDidChangeModel(updateCollapseContextKeys),
			tree.onDidChangeFindOpenState(enabled => this.treeFindOpen.set(enabled)),
			tree.onDidChangeStickyScrollFocused(focused => this.treeStickyScrollFocused.set(focused)),
			configurationService.onDidChangeConfiguration(e => {
				let newOptions: IAbstractTreeOptionsUpdate<unknown> = {};
				if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
					this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
				}
				if (e.affectsConfiguration(treeIndentKey)) {
					const indent = configurationService.getValue<number>(treeIndentKey);
					newOptions = { ...newOptions, indent };
				}
				if (e.affectsConfiguration(treeRenderIndentGuidesKey) && options.renderIndentGuides === undefined) {
					const renderIndentGuides = configurationService.getValue<RenderIndentGuides>(treeRenderIndentGuidesKey);
					newOptions = { ...newOptions, renderIndentGuides };
				}
				if (e.affectsConfiguration(listSmoothScrolling)) {
					const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
					newOptions = { ...newOptions, smoothScrolling };
				}
				if (e.affectsConfiguration(defaultFindModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
					const defaultFindMode = getDefaultTreeFindMode(configurationService);
					newOptions = { ...newOptions, defaultFindMode };
				}
				if (e.affectsConfiguration(typeNavigationModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
					const typeNavigationMode = getTypeNavigationMode();
					newOptions = { ...newOptions, typeNavigationMode };
				}
				if (e.affectsConfiguration(defaultFindMatchTypeSettingKey)) {
					const defaultFindMatchType = getDefaultTreeFindMatchType(configurationService);
					newOptions = { ...newOptions, defaultFindMatchType };
				}
				if (e.affectsConfiguration(horizontalScrollingKey) && options.horizontalScrolling === undefined) {
					const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
					newOptions = { ...newOptions, horizontalScrolling };
				}
				if (e.affectsConfiguration(scrollByPageKey)) {
					const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
					newOptions = { ...newOptions, scrollByPage };
				}
				if (e.affectsConfiguration(treeExpandMode) && options.expandOnlyOnTwistieClick === undefined) {
					newOptions = { ...newOptions, expandOnlyOnTwistieClick: configurationService.getValue<'singleClick' | 'doubleClick'>(treeExpandMode) === 'doubleClick' };
				}
				if (e.affectsConfiguration(treeStickyScroll)) {
					const enableStickyScroll = configurationService.getValue<boolean>(treeStickyScroll);
					newOptions = { ...newOptions, enableStickyScroll };
				}
				if (e.affectsConfiguration(treeStickyScrollMaxElements)) {
					const stickyScrollMaxItemCount = Math.max(1, configurationService.getValue<number>(treeStickyScrollMaxElements));
					newOptions = { ...newOptions, stickyScrollMaxItemCount };
				}
				if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
					const mouseWheelScrollSensitivity = configurationService.getValue<number>(mouseWheelScrollSensitivityKey);
					newOptions = { ...newOptions, mouseWheelScrollSensitivity };
				}
				if (e.affectsConfiguration(fastScrollSensitivityKey)) {
					const fastScrollSensitivity = configurationService.getValue<number>(fastScrollSensitivityKey);
					newOptions = { ...newOptions, fastScrollSensitivity };
				}
				if (Object.keys(newOptions).length > 0) {
					tree.updateOptions(newOptions);
				}
			}),
			this.contextKeyService.onDidChangeContext(e => {
				if (e.affectsSome(interestingContextKeys)) {
					tree.updateOptions({ typeNavigationMode: getTypeNavigationMode() });
				}
			})
		);

		this.navigator = new TreeResourceNavigator(tree, { configurationService, ...options });
		this.disposables.push(this.navigator);
	}

	get useAltAsMultipleSelectionModifier(): boolean {
		return this._useAltAsMultipleSelectionModifier;
	}

	updateOptions(options: IWorkbenchTreeInternalsOptionsUpdate): void {
		if (options.multipleSelectionSupport !== undefined) {
			this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
		}
	}

	updateStyleOverrides(overrideStyles?: IStyleOverride<IListStyles>): void {
		this.tree.style(overrideStyles ? getListStyles(overrideStyles) : defaultListStyles);
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

configurationRegistry.registerConfiguration({
	id: 'workbench',
	order: 7,
	title: localize('workbenchConfigurationTitle', "工作台"),
	type: 'object',
	properties: {
		[multiSelectModifierSettingKey]: {
			type: 'string',
			enum: ['ctrlCmd', 'alt'],
			markdownEnumDescriptions: [
				localize('multiSelectModifier.ctrlCmd', "映射为 `Ctrl` (Windows 和 Linux) 或 `Command` (macOS)。"),
				localize('multiSelectModifier.alt', "映射为 `Alt` (Windows 和 Linux) 或 `Option` (macOS)。")
			],
			default: 'ctrlCmd',
			description: localize({
				key: 'multiSelectModifier',
				comment: [
					'- `ctrlCmd` refers to a value the setting can take and should not be localized.',
					'- `Control` and `Command` refer to the modifier keys Ctrl or Cmd on the keyboard and can be localized.'
				]
			}, "在通过鼠标多选树和列表条目时使用的修改键 (例如“资源管理器”、“打开的编辑器”和“源代码管理”视图)。“在侧边打开”功能所需的鼠标动作 (若可用) 将会相应调整，不与多选修改键冲突。")
		},
		[openModeSettingKey]: {
			type: 'string',
			enum: ['singleClick', 'doubleClick'],
			default: 'singleClick',
			description: localize({
				key: 'openModeModifier',
				comment: ['`singleClick` and `doubleClick` refers to a value the setting can take and should not be localized.']
			}, "控制如何使用鼠标打开树和列表中的项(若支持)。请注意，如果此设置不适用，某些树和列表可能会选择忽略它。")
		},
		[horizontalScrollingKey]: {
			type: 'boolean',
			default: false,
			description: localize('horizontalScrolling setting', "控制工作台上的列表和树是否支持水平滚动。警告: 打开此设置会影响性能。")
		},
		[scrollByPageKey]: {
			type: 'boolean',
			default: false,
			description: localize('list.scrollByPage', "控制在滚动条中单击时是否逐页单击。")
		},
		[treeIndentKey]: {
			type: 'number',
			default: 8,
			minimum: 4,
			maximum: 40,
			description: localize('tree indent setting', "控制树缩进(以像素为单位)。")
		},
		[treeRenderIndentGuidesKey]: {
			type: 'string',
			enum: ['none', 'onHover', 'always'],
			default: 'onHover',
			description: localize('render tree indent guides', "控制树是否应呈现缩进参考线。")
		},
		[listSmoothScrolling]: {
			type: 'boolean',
			default: false,
			description: localize('list smoothScrolling setting', "控制列表和树是否具有平滑滚动效果。"),
		},
		[mouseWheelScrollSensitivityKey]: {
			type: 'number',
			default: 1,
			markdownDescription: localize('Mouse Wheel Scroll Sensitivity', "对鼠标滚轮滚动事件的 `deltaX` 和 `deltaY` 乘上的系数。")
		},
		[fastScrollSensitivityKey]: {
			type: 'number',
			default: 5,
			markdownDescription: localize('Fast Scroll Sensitivity', "按下\"Alt\"时滚动速度倍增。")
		},
		[defaultFindModeSettingKey]: {
			type: 'string',
			enum: ['highlight', 'filter'],
			enumDescriptions: [
				localize('defaultFindModeSettingKey.highlight', "搜索时突出显示元素。进一步向上和向下导航将仅遍历突出显示的元素。"),
				localize('defaultFindModeSettingKey.filter', "搜索时筛选元素。")
			],
			default: 'highlight',
			description: localize('defaultFindModeSettingKey', "控制工作台中列表和树的默认查找模式。")
		},
		[keyboardNavigationSettingKey]: {
			type: 'string',
			enum: ['simple', 'highlight', 'filter'],
			enumDescriptions: [
				localize('keyboardNavigationSettingKey.simple', "简单键盘导航聚焦与键盘输入相匹配的元素。仅对前缀进行匹配。"),
				localize('keyboardNavigationSettingKey.highlight', "高亮键盘导航会突出显示与键盘输入相匹配的元素。进一步向上和向下导航将仅遍历突出显示的元素。"),
				localize('keyboardNavigationSettingKey.filter', "筛选器键盘导航将筛选出并隐藏与键盘输入不匹配的所有元素。")
			],
			default: 'highlight',
			description: localize('keyboardNavigationSettingKey', "控制工作台中的列表和树的键盘导航样式。它可为“简单”、“突出显示”或“筛选”。"),
			deprecated: true,
			deprecationMessage: localize('keyboardNavigationSettingKeyDeprecated', "请改用 \"workbench.list.defaultFindMode\" 和 \"workbench.list.typeNavigationMode\"。")
		},
		[defaultFindMatchTypeSettingKey]: {
			type: 'string',
			enum: ['fuzzy', 'contiguous'],
			enumDescriptions: [
				localize('defaultFindMatchTypeSettingKey.fuzzy', "在搜索时使用模糊匹配。"),
				localize('defaultFindMatchTypeSettingKey.contiguous', "在搜索时使用连续匹配。")
			],
			default: 'fuzzy',
			description: localize('defaultFindMatchTypeSettingKey', "控制在工作台中搜索列表和树时使用的匹配类型。")
		},
		[treeExpandMode]: {
			type: 'string',
			enum: ['singleClick', 'doubleClick'],
			default: 'singleClick',
			description: localize('expand mode', "控制在单击文件夹名称时如何扩展树文件夹。请注意，如果不适用，某些树和列表可能会选择忽略此设置。"),
		},
		[treeStickyScroll]: {
			type: 'boolean',
			default: true,
			description: localize('sticky scroll', "控制是否在树中启用粘性滚动。"),
		},
		[treeStickyScrollMaxElements]: {
			type: 'number',
			minimum: 1,
			default: 7,
			markdownDescription: localize('sticky scroll maximum items', "控制启用 {0} 时树中显示的粘滞元素数。", '`#workbench.tree.enableStickyScroll#`'),
		},
		[typeNavigationModeSettingKey]: {
			type: 'string',
			enum: ['automatic', 'trigger'],
			default: 'automatic',
			markdownDescription: localize('typeNavigationMode2', "控制类型导航在工作台的列表和树中的工作方式。如果设置为`trigger`，则在运行 `list.triggerTypeNavigation` 命令后，类型导航将开始。"),
		}
	}
});
