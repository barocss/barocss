import { Canvas2DError, validatePoint, validateScene } from './schema.js';
import type { FrameNodeV7, GlyphRunNode, GroupNodeV7, ImageNodeV7, PathNodeV5, RectNode, Point, SceneV6, SceneV7, SourceRect, Transform, Tint, LineNode } from './schema.js';
import type { Hit } from './renderer.js';
import { tessellatePath } from './path.js';

export type ContainerSpec = Pick<GroupNodeV7, 'id' | 'layer' | 'transform'>;
export type SpriteData = Omit<ImageNodeV7, 'kind'>;
export type SpriteSpec = Omit<SpriteData, 'tint'> & { tint?: Tint };
export type PathSpec = Omit<PathNodeV5, 'kind'>;
export type PathPaint = Pick<PathNodeV5, 'commands' | 'fill' | 'stroke'>;
export type RectSpec = Omit<RectNode, 'kind'>;
export type RectPaint = Pick<RectNode, 'width' | 'height' | 'fill'>;
export type GlyphRunSpec = Omit<GlyphRunNode, 'kind'>;
export type GlyphRunLayout = Pick<GlyphRunNode, 'atlasId' | 'text' | 'baseline' | 'opacity' | 'sampling' | 'glyphs'>;
export type FrameSpec = Pick<FrameNodeV7, 'id' | 'layer' | 'transform' | 'width' | 'height' | 'fill' | 'clip'>;
export type FramePaint = Pick<FrameNodeV7, 'width' | 'height' | 'fill' | 'clip'>;
export type LineSpec = Omit<LineNode, 'kind'>;
export type LinePaint = Pick<LineNode, 'x1' | 'y1' | 'x2' | 'y2' | 'width' | 'stroke'>;
export type DisplayHandle = ContainerHandle | SpriteHandle | PathHandle | RectHandle | GlyphRunHandle | FrameHandle | LineHandle;
export type PointerEventType = 'pointerdown' | 'pointerup' | 'pointermove' | 'pointercancel';
export type DisplayPointerEvent = {
  readonly type: PointerEventType;
  readonly pointerId: number;
  readonly point: Readonly<Point>;
  readonly target: DisplayHandle | null;
  readonly currentTarget: StageHandle | DisplayHandle;
  stopPropagation(): void;
};
export type PointerInput = { type: PointerEventType; pointerId: number; point: Point; hit: Hit | null };
export type PointerListener = (event: DisplayPointerEvent) => void;
export type StageHandle = {
  readonly children: readonly DisplayHandle[];
  addChild(child: DisplayHandle): void;
  removeChild(child: DisplayHandle): void;
  setChildIndex(child: DisplayHandle, index: number): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type ContainerHandle = StageHandle & {
  readonly kind: 'container'; readonly id: string; readonly data: ContainerSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
};
export type FrameHandle = StageHandle & {
  readonly kind: 'frame'; readonly id: string; readonly data: FrameSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setFrame(paint: FramePaint): void;
};
export type SpriteHandle = {
  readonly kind: 'sprite'; readonly id: string; readonly data: SpriteData;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setAnchor(x: number, y: number): void;
  setSize(width: number, height: number): void;
  setOpacity(opacity: number): void;
  setTint(tint: Tint): void;
  setSampling(sampling: 'nearest' | 'linear'): void;
  setSourceRect(rect: SourceRect | null): void;
  setImageSource(imageId: string, sourceRect?: SourceRect | null): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type RectHandle = {
  readonly kind: 'rect'; readonly id: string; readonly data: RectSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setRect(paint: RectPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type LineHandle = {
  readonly kind: 'line'; readonly id: string; readonly data: LineSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setLine(paint: LinePaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type PathHandle = {
  readonly kind: 'path'; readonly id: string; readonly data: PathSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setPath(paint: PathPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type GlyphRunHandle = {
  readonly kind: 'glyphRun'; readonly id: string; readonly data: GlyphRunSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setLayout(layout: GlyphRunLayout): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type DisplayTree = {
  readonly stage: StageHandle;
  createContainer(spec: ContainerSpec): ContainerHandle;
  createSprite(spec: SpriteSpec): SpriteHandle;
  createPath(spec: PathSpec): PathHandle;
  createRect(spec: RectSpec): RectHandle;
  createGlyphRun(spec: GlyphRunSpec): GlyphRunHandle;
  createFrame(spec: FrameSpec): FrameHandle;
  createLine(spec: LineSpec): LineHandle;
  reparentChild(child: DisplayHandle, target: StageHandle | ContainerHandle | FrameHandle, index: number): void;
  get(id: string): DisplayHandle | null;
  dispatchPointer(input: PointerInput): void;
  snapshot(): SceneV7;
};

type RecordNode = {
  data: GroupNodeV7 | ImageNodeV7 | PathNodeV5 | RectNode | GlyphRunNode | FrameNodeV7 | LineNode | null;
  parent: RecordNode | null;
  children: RecordNode[];
  handle: StageHandle | DisplayHandle;
};

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

function checkPathGeometry(node: PathNodeV5): void {
  // The handle has no renderer view. Check authored geometry at the baseline view;
  // the renderer checks the composed transform and active device view on update.
  tessellatePath(node, [1, 0, 0, 1, 0, 0], { panX: 0, panY: 0, zoom: 1 }, 1, 1);
}

function exactSpec(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return invalid('display object spec must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length < required.length || keys.length > required.length + optional.length ||
      keys.some(key => typeof key !== 'string' || ![...required, ...optional].includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) {
    return invalid('display object spec has unknown or missing fields');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !('value' in descriptor)) invalid(`display object spec.${key} must be a data field`);
    result[key] = descriptor.value;
  }
  return result;
}

export function createDisplayTree(contextId: string): DisplayTree {
  const checked = validateScene({ version: 7, unit: 'logical-px', contextId, nodes: [] }) as SceneV7;
  const root: RecordNode = { data: null, parent: null, children: [], handle: null as unknown as StageHandle };
  const records = new WeakMap<object, RecordNode>();
  const listeners = new WeakMap<RecordNode, Map<PointerEventType, { listener: PointerListener }[]>>();
  const pointerTypes: readonly PointerEventType[] = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel'];

  function checkedPointerType(type: unknown): PointerEventType {
    if (!pointerTypes.includes(type as PointerEventType)) invalid('pointer event type is unsupported');
    return type as PointerEventType;
  }
  function onPointer(record: RecordNode, type: PointerEventType, listener: PointerListener): () => void {
    const checkedType = checkedPointerType(type);
    if (typeof listener !== 'function') invalid('pointer listener must be a function');
    let byType = listeners.get(record);
    if (!byType) { byType = new Map(); listeners.set(record, byType); }
    let callbacks = byType.get(checkedType);
    if (!callbacks) { callbacks = []; byType.set(checkedType, callbacks); }
    if (callbacks.length >= 32) throw new Canvas2DError('SCENE_LIMIT', 'pointer listener limit is 32 per type and handle');
    const registration = { listener };
    callbacks.push(registration);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const index = callbacks.indexOf(registration);
      if (index >= 0) callbacks.splice(index, 1);
    };
  }
  function findRecord(id: string): RecordNode | null {
    const find = (children: RecordNode[]): RecordNode | null => {
      for (const child of children) {
        if (child.data?.id === id) return child;
        const descendant = find(child.children);
        if (descendant) return descendant;
      }
      return null;
    };
    return find(root.children);
  }

  function toNode(record: RecordNode): GroupNodeV7 | ImageNodeV7 | PathNodeV5 | RectNode | GlyphRunNode | FrameNodeV7 | LineNode {
    const data = record.data;
    if (!data) invalid('stage has no scene node');
    if (data.kind === 'group' || data.kind === 'frame') return { ...data, children: record.children.map(toNode) };
    return data;
  }
  function validateRoots(changed: RecordNode): void {
    validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
      nodes: root.children.map(toNode) });
    let top = changed;
    while (top.parent) top = top.parent;
    if (top !== root) {
      validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(top)] });
    }
  }
  function known(handle: DisplayHandle): RecordNode {
    const record = handle !== null && typeof handle === 'object' ? records.get(handle) : undefined;
    if (!record || record === root) invalid('display object belongs to another tree');
    return record;
  }
  function mutate(record: RecordNode, data: GroupNodeV7 | ImageNodeV7 | PathNodeV5 | RectNode | GlyphRunNode | FrameNodeV7 | LineNode): void {
    const previous = record.data;
    record.data = data;
    try {
      validateRoots(record);
      const accepted = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(record)] }).nodes[0] as GroupNodeV7 | ImageNodeV7 | PathNodeV5 | RectNode | GlyphRunNode | FrameNodeV7 | LineNode;
      if (accepted.kind === 'path') checkPathGeometry(accepted);
      record.data = accepted;
    } catch (error) { record.data = previous; throw error; }
  }
  function common(record: RecordNode) {
    return {
      setTransform(transform: Transform) {
        const data = record.data;
        if (!data) invalid('stage has no transform');
        mutate(record, { ...data, transform });
      },
      setLayer(layer: number) {
        const data = record.data;
        if (!data) invalid('stage has no layer');
        mutate(record, { ...data, layer });
      },
    };
  }
  function parentMethods(parent: RecordNode): StageHandle {
    return {
      get children() { return parent.children.map(child => child.handle as DisplayHandle); },
      onPointer(type, listener) { return onPointer(parent, type, listener); },
      addChild(child: DisplayHandle) {
        const record = known(child);
        if (record.parent) invalid('display object already has a parent');
        for (let cursor: RecordNode | null = parent; cursor; cursor = cursor.parent) {
          if (cursor === record) invalid('display tree cannot contain a parent cycle');
        }
        parent.children.push(record); record.parent = parent;
        try { validateRoots(parent); }
        catch (error) { parent.children.pop(); record.parent = null; throw error; }
      },
      removeChild(child: DisplayHandle) {
        const record = known(child);
        const index = parent.children.indexOf(record);
        if (index < 0) invalid('display object is not a child of this parent');
        parent.children.splice(index, 1); record.parent = null;
      },
      setChildIndex(child: DisplayHandle, index: number) {
        const record = known(child);
        const previous = parent.children.indexOf(record);
        if (previous < 0) invalid('display object is not a child of this parent');
        if (!Number.isInteger(index) || Object.is(index, -0) ||
            index < 0 || index >= parent.children.length) invalid('child index is outside its range');
        if (previous === index) return;
        parent.children.splice(previous, 1);
        parent.children.splice(index, 0, record);
        try { validateRoots(parent); }
        catch (error) {
          parent.children.splice(index, 1);
          parent.children.splice(previous, 0, record);
          throw error;
        }
      },
    };
  }
  root.handle = Object.freeze(parentMethods(root));
  records.set(root.handle, root);

  return Object.freeze({
    stage: root.handle,
    reparentChild(child: DisplayHandle, target: StageHandle | ContainerHandle | FrameHandle, index: number): void {
      const record = known(child);
      const destination = target !== null && typeof target === 'object' ? records.get(target) : undefined;
      if (!destination || (destination !== root && destination.data?.kind !== 'group' &&
          destination.data?.kind !== 'frame')) invalid('target is not a parent in this display tree');
      const source = record.parent;
      if (!source || source === destination) invalid('child must have a different parent');
      const attached = (node: RecordNode) => {
        let top = node;
        while (top.parent) top = top.parent;
        return top === root;
      };
      if (!attached(record) || !attached(destination)) invalid('child and target must be attached');
      if (!Number.isInteger(index) || Object.is(index, -0) ||
          index < 0 || index > destination.children.length) invalid('child index is outside its range');
      for (let cursor: RecordNode | null = destination; cursor; cursor = cursor.parent) {
        if (cursor === record) invalid('display tree cannot contain a parent cycle');
      }
      const previous = source.children.indexOf(record);
      source.children.splice(previous, 1);
      destination.children.splice(index, 0, record);
      record.parent = destination;
      try { validateRoots(destination); }
      catch (error) {
        destination.children.splice(index, 1);
        source.children.splice(previous, 0, record);
        record.parent = source;
        throw error;
      }
    },
    createContainer(spec: ContainerSpec): ContainerHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'group', ...fields, children: [] }] }).nodes[0] as GroupNodeV7;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as ContainerHandle };
      const parent = parentMethods(record);
      const handle: ContainerHandle = Object.freeze({
        kind: 'container' as const, get id() { return (record.data as GroupNodeV7).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as GroupNodeV7;
          return structuredClone(data) as ContainerSpec; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild, setChildIndex: parent.setChildIndex,
        onPointer: parent.onPointer,
        ...common(record),
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createSprite(spec: SpriteSpec): SpriteHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'imageId', 'width', 'height',
        'opacity', 'sampling', 'anchorX', 'anchorY'], ['sourceRect', 'tint']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'image', ...fields, tint: Object.hasOwn(fields, 'tint') ? fields.tint : [1, 1, 1] }] }).nodes[0] as ImageNodeV7;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as SpriteHandle };
      const handle: SpriteHandle = Object.freeze({
        kind: 'sprite' as const, get id() { return (record.data as ImageNodeV7).id; },
        get data() { const { kind: _kind, ...data } = record.data as ImageNodeV7;
          return structuredClone(data) as SpriteData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setAnchor(x: number, y: number) { mutate(record, { ...(record.data as ImageNodeV7), anchorX: x, anchorY: y }); },
        setSize(width: number, height: number) {
          mutate(record, { ...(record.data as ImageNodeV7), width, height });
        },
        setOpacity(opacity: number) { mutate(record, { ...(record.data as ImageNodeV7), opacity }); },
        setTint(tint: Tint) { mutate(record, { ...(record.data as ImageNodeV7), tint }); },
        setSampling(sampling: 'nearest' | 'linear') {
          mutate(record, { ...(record.data as ImageNodeV7), sampling });
        },
        setSourceRect(rect: SourceRect | null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV7;
          mutate(record, rect === null ? withoutCrop : { ...withoutCrop, sourceRect: rect });
        },
        setImageSource(imageId: string, sourceRect: SourceRect | null = null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV7;
          mutate(record, sourceRect === null
            ? { ...withoutCrop, imageId }
            : { ...withoutCrop, imageId, sourceRect });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createPath(spec: PathSpec): PathHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'commands'], ['fill', 'stroke']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'path', ...fields }] }).nodes[0] as PathNodeV5;
      checkPathGeometry(node);
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as PathHandle };
      const handle: PathHandle = Object.freeze({
        kind: 'path' as const, get id() { return (record.data as PathNodeV5).id; },
        get data() { const { kind: _kind, ...data } = record.data as PathNodeV5;
          return structuredClone(data) as PathSpec; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setPath(paint: PathPaint) {
          const fields = exactSpec(paint, ['commands'], ['fill', 'stroke']);
          const { kind, id, layer, transform } = record.data as PathNodeV5;
          mutate(record, { kind, id, layer, transform, ...fields } as PathNodeV5);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createRect(spec: RectSpec): RectHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'rect', ...fields }] }).nodes[0] as RectNode;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as RectHandle };
      const handle: RectHandle = Object.freeze({
        kind: 'rect' as const, get id() { return (record.data as RectNode).id; },
        get data() { const { kind: _kind, ...data } = record.data as RectNode;
          return structuredClone(data) as RectSpec; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setRect(paint: RectPaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill']);
          const { kind, id, layer, transform } = record.data as RectNode;
          mutate(record, { kind, id, layer, transform, ...fields } as RectNode);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createGlyphRun(spec: GlyphRunSpec): GlyphRunHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'atlasId', 'text', 'baseline',
        'opacity', 'sampling', 'glyphs']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'glyphRun', ...fields }] }).nodes[0] as GlyphRunNode;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as GlyphRunHandle };
      const handle: GlyphRunHandle = Object.freeze({
        kind: 'glyphRun' as const, get id() { return (record.data as GlyphRunNode).id; },
        get data() { const { kind: _kind, ...data } = record.data as GlyphRunNode;
          return structuredClone(data) as GlyphRunSpec; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setLayout(layout: GlyphRunLayout) {
          const fields = exactSpec(layout, ['atlasId', 'text', 'baseline', 'opacity', 'sampling', 'glyphs']);
          const { kind, id, layer, transform } = record.data as GlyphRunNode;
          mutate(record, { kind, id, layer, transform, ...fields } as GlyphRunNode);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createFrame(spec: FrameSpec): FrameHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill', 'clip']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'frame', ...fields, children: [] }] }).nodes[0] as FrameNodeV7;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as FrameHandle };
      const parent = parentMethods(record);
      const handle: FrameHandle = Object.freeze({
        kind: 'frame' as const, get id() { return (record.data as FrameNodeV7).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as FrameNodeV7;
          return structuredClone(data) as FrameSpec; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild, setChildIndex: parent.setChildIndex,
        onPointer: parent.onPointer,
        ...common(record),
        setFrame(paint: FramePaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill', 'clip']);
          mutate(record, { ...(record.data as FrameNodeV7), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createLine(spec: LineSpec): LineHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'x1', 'y1', 'x2', 'y2', 'width', 'stroke']);
      const node = validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'line', ...fields }] }).nodes[0] as LineNode;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as LineHandle };
      const handle: LineHandle = Object.freeze({
        kind: 'line' as const, get id() { return (record.data as LineNode).id; },
        get data() { const { kind: _kind, ...data } = record.data as LineNode;
          return structuredClone(data) as LineSpec; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setLine(paint: LinePaint) {
          const fields = exactSpec(paint, ['x1', 'y1', 'x2', 'y2', 'width', 'stroke']);
          mutate(record, { ...(record.data as LineNode), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    get(id: string): DisplayHandle | null {
      if (typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)) {
        invalid('display object ID is invalid');
      }
      return (findRecord(id)?.handle as DisplayHandle | undefined) ?? null;
    },
    dispatchPointer(input: PointerInput): void {
      const fields = exactSpec(input, ['type', 'pointerId', 'point', 'hit']);
      const type = checkedPointerType(fields.type);
      const pointerId = fields.pointerId;
      if (typeof pointerId !== 'number' || !Number.isSafeInteger(pointerId) || pointerId < 0 || Object.is(pointerId, -0)) {
        invalid('pointer ID must be a non-negative safe integer');
      }
      const point = validatePoint(fields.point);
      let target: RecordNode | null = null;
      if (fields.hit !== null) {
        const hit = exactSpec(fields.hit, ['id', 'kind']);
        if (typeof hit.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(hit.id)) {
          invalid('pointer hit ID is invalid');
        }
        if (!['frame', 'rect', 'line', 'path', 'image', 'glyphRun'].includes(hit.kind as string)) {
          invalid('pointer hit kind is invalid');
        }
        if (hit.kind !== 'image' && hit.kind !== 'path' && hit.kind !== 'rect' && hit.kind !== 'glyphRun' && hit.kind !== 'frame' && hit.kind !== 'line') {
          throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree pointer target must be an image, path, rect, glyph run, frame or line');
        }
        target = findRecord(hit.id);
        if (!target || target.data?.kind !== hit.kind) invalid('pointer hit is not an attached display handle');
      }
      const route: RecordNode[] = [];
      for (let cursor: RecordNode | null = target ?? root; cursor; cursor = cursor.parent) route.push(cursor);
      const planned = route.map(record => ({ record,
        callbacks: (listeners.get(record)?.get(type) ?? []).map(registration => registration.listener) }));
      let stopped = false;
      for (const { record, callbacks } of planned) {
        for (const callback of callbacks) {
          callback(Object.freeze({ type, pointerId, point: Object.freeze({ ...point }),
            target: (target?.handle as DisplayHandle | undefined) ?? null,
            currentTarget: record.handle,
            stopPropagation() { stopped = true; } }));
        }
        if (stopped) break;
      }
    },
    snapshot(): SceneV7 {
      return validateScene({ version: 7, unit: 'logical-px', contextId: checked.contextId,
        nodes: root.children.map(toNode) }) as SceneV7;
    },
  });
}

export function createDisplayTreeFromScene(scene: unknown): DisplayTree {
  const accepted = validateScene(scene);
  if (accepted.version !== 6 && accepted.version !== 7) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree reconstruction requires Scene v6 or v7');
  }
  type ReconstructNode = SceneV6['nodes'][number] | SceneV7['nodes'][number];
  const allowed = (nodes: readonly ReconstructNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'group' || node.kind === 'frame') allowed(node.children);
      else if (node.kind !== 'image' && node.kind !== 'path' && node.kind !== 'rect' && node.kind !== 'glyphRun' && node.kind !== 'line') {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree cannot reconstruct this node kind');
      }
    }
  };
  allowed(accepted.nodes);
  const tree = createDisplayTree(accepted.contextId);
  const attach = (parent: StageHandle, nodes: readonly ReconstructNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        const { kind: _kind, children, ...spec } = node;
        const handle = tree.createContainer(spec);
        parent.addChild(handle);
        attach(handle, children);
      } else if (node.kind === 'frame') {
        const { kind: _kind, children, ...spec } = node;
        const handle = tree.createFrame(spec);
        parent.addChild(handle);
        attach(handle, children);
      } else if (node.kind === 'image') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createSprite(spec));
      } else if (node.kind === 'path') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createPath(spec));
      } else if (node.kind === 'rect') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createRect(spec));
      } else if (node.kind === 'glyphRun') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createGlyphRun(spec));

      } else if (node.kind === 'line') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createLine(spec));
      }
    }
  };
  attach(tree.stage, accepted.nodes);
  return tree;
}
