import { Canvas2DError, validatePoint, validateScene } from './schema.js';
import type { FrameNodeV9, GlyphRunNodeV9, GroupNodeV9, ImageNodeV9, PathNodeV9, RectNodeV9, Point, SceneV6, SceneV7, SceneV8, SceneV9, SourceRect, Transform, Tint, LineNodeV9 } from './schema.js';
import type { Hit } from './renderer.js';
import { tessellatePath } from './path.js';

export type ContainerSpec = Pick<GroupNodeV9, 'id' | 'layer' | 'transform'> & { visible?: boolean };
export type ContainerData = Pick<GroupNodeV9, 'id' | 'layer' | 'transform' | 'visible'>;
export type SpriteData = Omit<ImageNodeV9, 'kind'>;
export type SpriteSpec = Omit<SpriteData, 'tint' | 'blendMode' | 'visible'> & {
  tint?: Tint; blendMode?: ImageNodeV9['blendMode']; visible?: boolean;
};
export type PathData = Omit<PathNodeV9, 'kind'>;
export type PathSpec = Omit<PathData, 'visible'> & { visible?: boolean };
export type PathPaint = Pick<PathNodeV9, 'commands' | 'fill' | 'stroke'>;
export type RectData = Omit<RectNodeV9, 'kind'>;
export type RectSpec = Omit<RectData, 'visible'> & { visible?: boolean };
export type RectPaint = Pick<RectNodeV9, 'width' | 'height' | 'fill'>;
export type GlyphRunData = Omit<GlyphRunNodeV9, 'kind'>;
export type GlyphRunSpec = Omit<GlyphRunData, 'visible'> & { visible?: boolean };
export type GlyphRunLayout = Pick<GlyphRunNodeV9, 'atlasId' | 'text' | 'baseline' | 'opacity' | 'sampling' | 'glyphs'>;
export type FrameSpec = Omit<Pick<FrameNodeV9, 'id' | 'layer' | 'transform' | 'width' | 'height' | 'fill' | 'clip' | 'visible'>, 'visible'> & { visible?: boolean };
export type FrameData = Pick<FrameNodeV9, 'id' | 'layer' | 'transform' | 'width' | 'height' | 'fill' | 'clip' | 'visible'>;
export type FramePaint = Pick<FrameNodeV9, 'width' | 'height' | 'fill' | 'clip'>;
export type LineData = Omit<LineNodeV9, 'kind'>;
export type LineSpec = Omit<LineData, 'visible'> & { visible?: boolean };
export type LinePaint = Pick<LineNodeV9, 'x1' | 'y1' | 'x2' | 'y2' | 'width' | 'stroke'>;
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
type PointConversion = {
  toWorld(localPoint: Point): Point;
  toLocal(worldPoint: Point): Point;
};
export type ContainerHandle = StageHandle & PointConversion & {
  readonly kind: 'container'; readonly id: string; readonly data: ContainerData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
};
export type FrameHandle = StageHandle & PointConversion & {
  readonly kind: 'frame'; readonly id: string; readonly data: FrameData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setFrame(paint: FramePaint): void;
};
export type SpriteHandle = PointConversion & {
  readonly kind: 'sprite'; readonly id: string; readonly data: SpriteData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAnchor(x: number, y: number): void;
  setSize(width: number, height: number): void;
  setOpacity(opacity: number): void;
  setTint(tint: Tint): void;
  setBlendMode(mode: ImageNodeV9['blendMode']): void;
  setSampling(sampling: 'nearest' | 'linear'): void;
  setSourceRect(rect: SourceRect | null): void;
  setImageSource(imageId: string, sourceRect?: SourceRect | null): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type RectHandle = PointConversion & {
  readonly kind: 'rect'; readonly id: string; readonly data: RectData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setRect(paint: RectPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type LineHandle = PointConversion & {
  readonly kind: 'line'; readonly id: string; readonly data: LineData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setLine(paint: LinePaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type PathHandle = PointConversion & {
  readonly kind: 'path'; readonly id: string; readonly data: PathData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setPath(paint: PathPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type GlyphRunHandle = PointConversion & {
  readonly kind: 'glyphRun'; readonly id: string; readonly data: GlyphRunData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
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
  snapshot(): SceneV9;
};

type RecordNode = {
  data: GroupNodeV9 | ImageNodeV9 | PathNodeV9 | RectNodeV9 | GlyphRunNodeV9 | FrameNodeV9 | LineNodeV9 | null;
  parent: RecordNode | null;
  children: RecordNode[];
  handle: StageHandle | DisplayHandle;
};

type Matrix = [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function pose(transform: Transform): Matrix {
  const c = Math.cos(transform.rotation), s = Math.sin(transform.rotation);
  return [c * transform.scaleX, s * transform.scaleX,
    -s * transform.scaleY, c * transform.scaleY, transform.x, transform.y];
}

function boundedPoint(x: number, y: number): Point {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
    throw new Canvas2DError('SCENE_LIMIT', 'converted point exceeds the supported world range');
  }
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

function checkPathGeometry(node: PathNodeV9): void {
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
  const checked = validateScene({ version: 9, unit: 'logical-px', contextId, nodes: [] }) as SceneV9;
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

  function toNode(record: RecordNode): GroupNodeV9 | ImageNodeV9 | PathNodeV9 | RectNodeV9 | GlyphRunNodeV9 | FrameNodeV9 | LineNodeV9 {
    const data = record.data;
    if (!data) invalid('stage has no scene node');
    if (data.kind === 'group' || data.kind === 'frame') return { ...data, children: record.children.map(toNode) };
    return data;
  }
  function validateRoots(changed: RecordNode): void {
    validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
      nodes: root.children.map(toNode) });
    let top = changed;
    while (top.parent) top = top.parent;
    if (top !== root) {
      validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(top)] });
    }
  }
  function known(handle: DisplayHandle): RecordNode {
    const record = handle !== null && typeof handle === 'object' ? records.get(handle) : undefined;
    if (!record || record === root) invalid('display object belongs to another tree');
    return record;
  }
  function mutate(record: RecordNode, data: GroupNodeV9 | ImageNodeV9 | PathNodeV9 | RectNodeV9 | GlyphRunNodeV9 | FrameNodeV9 | LineNodeV9): void {
    const previous = record.data;
    record.data = data;
    try {
      validateRoots(record);
      const accepted = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(record)] }).nodes[0] as GroupNodeV9 | ImageNodeV9 | PathNodeV9 | RectNodeV9 | GlyphRunNodeV9 | FrameNodeV9 | LineNodeV9;
      if (accepted.kind === 'path') checkPathGeometry(accepted);
      record.data = accepted;
    } catch (error) { record.data = previous; throw error; }
  }
  function worldMatrix(record: RecordNode): Matrix {
    const ancestors: RecordNode[] = [];
    for (let current: RecordNode | null = record; current?.data; current = current.parent) ancestors.push(current);
    let matrix: Matrix = identity;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      matrix = multiply(matrix, pose(ancestors[i].data!.transform));
    }
    if (matrix.some(value => !Number.isFinite(value))) {
      throw new Canvas2DError('SCENE_LIMIT', 'composed transform is not finite');
    }
    return matrix;
  }
  function common(record: RecordNode) {
    return {
      toWorld(localPoint: Point): Point {
        const point = validatePoint(localPoint);
        const m = worldMatrix(record);
        return boundedPoint(m[0] * point.x + m[2] * point.y + m[4],
          m[1] * point.x + m[3] * point.y + m[5]);
      },
      toLocal(worldPoint: Point): Point {
        const point = validatePoint(worldPoint);
        const m = worldMatrix(record);
        const det = m[0] * m[3] - m[1] * m[2];
        if (!Number.isFinite(det) || det === 0) {
          throw new Canvas2DError('SCENE_LIMIT', 'composed transform cannot be inverted');
        }
        const x = point.x - m[4], y = point.y - m[5];
        return boundedPoint((m[3] * x - m[2] * y) / det,
          (m[0] * y - m[1] * x) / det);
      },
      setTransform(transform: Transform) {
        const data = record.data;
        if (!data) invalid('stage has no transform');
        mutate(record, { ...data, transform });
      },
      setPosition(x: number, y: number) {
        const data = record.data;
        if (!data) invalid('stage has no transform');
        mutate(record, { ...data, transform: { ...data.transform, x, y } });
      },
      setScale(scaleX: number, scaleY: number) {
        const data = record.data;
        if (!data) invalid('stage has no transform');
        mutate(record, { ...data, transform: { ...data.transform, scaleX, scaleY } });
      },
      setRotation(rotation: number) {
        const data = record.data;
        if (!data) invalid('stage has no transform');
        mutate(record, { ...data, transform: { ...data.transform, rotation } });
      },
      setLayer(layer: number) {
        const data = record.data;
        if (!data) invalid('stage has no layer');
        mutate(record, { ...data, layer });
      },
      setVisible(visible: boolean) {
        const data = record.data;
        if (!data) invalid('stage has no visibility');
        mutate(record, { ...data, visible });
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
      const fields = exactSpec(spec, ['id', 'layer', 'transform'], ['visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'group', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true, children: [] }] }).nodes[0] as GroupNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as ContainerHandle };
      const parent = parentMethods(record);
      const handle: ContainerHandle = Object.freeze({
        kind: 'container' as const, get id() { return (record.data as GroupNodeV9).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as GroupNodeV9;
          return structuredClone(data) as ContainerData; },
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
        'opacity', 'sampling', 'anchorX', 'anchorY'], ['sourceRect', 'tint', 'blendMode', 'visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'image', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          tint: Object.hasOwn(fields, 'tint') ? fields.tint : [1, 1, 1],
          blendMode: Object.hasOwn(fields, 'blendMode') ? fields.blendMode : 'normal' }] }).nodes[0] as ImageNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as SpriteHandle };
      const handle: SpriteHandle = Object.freeze({
        kind: 'sprite' as const, get id() { return (record.data as ImageNodeV9).id; },
        get data() { const { kind: _kind, ...data } = record.data as ImageNodeV9;
          return structuredClone(data) as SpriteData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setAnchor(x: number, y: number) { mutate(record, { ...(record.data as ImageNodeV9), anchorX: x, anchorY: y }); },
        setSize(width: number, height: number) {
          mutate(record, { ...(record.data as ImageNodeV9), width, height });
        },
        setOpacity(opacity: number) { mutate(record, { ...(record.data as ImageNodeV9), opacity }); },
        setTint(tint: Tint) { mutate(record, { ...(record.data as ImageNodeV9), tint }); },
        setBlendMode(blendMode: ImageNodeV9['blendMode']) {
          mutate(record, { ...(record.data as ImageNodeV9), blendMode });
        },
        setSampling(sampling: 'nearest' | 'linear') {
          mutate(record, { ...(record.data as ImageNodeV9), sampling });
        },
        setSourceRect(rect: SourceRect | null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV9;
          mutate(record, rect === null ? withoutCrop : { ...withoutCrop, sourceRect: rect });
        },
        setImageSource(imageId: string, sourceRect: SourceRect | null = null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV9;
          mutate(record, sourceRect === null
            ? { ...withoutCrop, imageId }
            : { ...withoutCrop, imageId, sourceRect });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createPath(spec: PathSpec): PathHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'commands'], ['fill', 'stroke', 'visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'path', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true }] }).nodes[0] as PathNodeV9;
      checkPathGeometry(node);
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as PathHandle };
      const handle: PathHandle = Object.freeze({
        kind: 'path' as const, get id() { return (record.data as PathNodeV9).id; },
        get data() { const { kind: _kind, ...data } = record.data as PathNodeV9;
          return structuredClone(data) as PathData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setPath(paint: PathPaint) {
          const fields = exactSpec(paint, ['commands'], ['fill', 'stroke']);
          const { kind, id, layer, transform, visible } = record.data as PathNodeV9;
          mutate(record, { kind, id, layer, transform, visible, ...fields } as PathNodeV9);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createRect(spec: RectSpec): RectHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill'], ['visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'rect', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true }] }).nodes[0] as RectNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as RectHandle };
      const handle: RectHandle = Object.freeze({
        kind: 'rect' as const, get id() { return (record.data as RectNodeV9).id; },
        get data() { const { kind: _kind, ...data } = record.data as RectNodeV9;
          return structuredClone(data) as RectData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setRect(paint: RectPaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill']);
          const { kind, id, layer, transform, visible } = record.data as RectNodeV9;
          mutate(record, { kind, id, layer, transform, visible, ...fields } as RectNodeV9);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createGlyphRun(spec: GlyphRunSpec): GlyphRunHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'atlasId', 'text', 'baseline',
        'opacity', 'sampling', 'glyphs'], ['visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'glyphRun', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true }] }).nodes[0] as GlyphRunNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as GlyphRunHandle };
      const handle: GlyphRunHandle = Object.freeze({
        kind: 'glyphRun' as const, get id() { return (record.data as GlyphRunNodeV9).id; },
        get data() { const { kind: _kind, ...data } = record.data as GlyphRunNodeV9;
          return structuredClone(data) as GlyphRunData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setLayout(layout: GlyphRunLayout) {
          const fields = exactSpec(layout, ['atlasId', 'text', 'baseline', 'opacity', 'sampling', 'glyphs']);
          const { kind, id, layer, transform, visible } = record.data as GlyphRunNodeV9;
          mutate(record, { kind, id, layer, transform, visible, ...fields } as GlyphRunNodeV9);
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createFrame(spec: FrameSpec): FrameHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill', 'clip'], ['visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'frame', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true, children: [] }] }).nodes[0] as FrameNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as FrameHandle };
      const parent = parentMethods(record);
      const handle: FrameHandle = Object.freeze({
        kind: 'frame' as const, get id() { return (record.data as FrameNodeV9).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as FrameNodeV9;
          return structuredClone(data) as FrameData; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild, setChildIndex: parent.setChildIndex,
        onPointer: parent.onPointer,
        ...common(record),
        setFrame(paint: FramePaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill', 'clip']);
          mutate(record, { ...(record.data as FrameNodeV9), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createLine(spec: LineSpec): LineHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'x1', 'y1', 'x2', 'y2', 'width', 'stroke'], ['visible']);
      const node = validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'line', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true }] }).nodes[0] as LineNodeV9;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as LineHandle };
      const handle: LineHandle = Object.freeze({
        kind: 'line' as const, get id() { return (record.data as LineNodeV9).id; },
        get data() { const { kind: _kind, ...data } = record.data as LineNodeV9;
          return structuredClone(data) as LineData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setLine(paint: LinePaint) {
          const fields = exactSpec(paint, ['x1', 'y1', 'x2', 'y2', 'width', 'stroke']);
          mutate(record, { ...(record.data as LineNodeV9), ...fields });
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
        for (let cursor: RecordNode | null = target; cursor && cursor !== root; cursor = cursor.parent) {
          if (cursor.data?.visible === false) invalid('pointer hit is hidden');
        }
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
    snapshot(): SceneV9 {
      return validateScene({ version: 9, unit: 'logical-px', contextId: checked.contextId,
        nodes: root.children.map(toNode) }) as SceneV9;
    },
  });
}

export function createDisplayTreeFromScene(scene: unknown): DisplayTree {
  const accepted = validateScene(scene);
  if (accepted.version !== 6 && accepted.version !== 7 && accepted.version !== 8 && accepted.version !== 9) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree reconstruction requires Scene v6, v7, v8 or v9');
  }
  type ReconstructNode = SceneV6['nodes'][number] | SceneV7['nodes'][number] | SceneV8['nodes'][number] | SceneV9['nodes'][number];
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
