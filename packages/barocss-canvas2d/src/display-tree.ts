import { Canvas2DError, validatePoint, validateScene } from './schema.js';
import type { NineSliceInsets, TilePattern, SceneV11, HitMode, FrameNodeV11, GlyphRunNodeV11, GroupNodeV11, ImageNodeV13, PathNodeV11, RectNodeV11, Point, SceneV6, SceneV7, SceneV8, SceneV9, SceneV10, SceneV12, SceneV13, SceneV14, SourceRect, Transform, Tint, LineNodeV11 } from './schema.js';
import type { Hit } from './renderer.js';
import { tessellatePath } from './path.js';

type WithPivot<T> = T & { pivot?: Point };
type AuthoredNode = WithPivot<GroupNodeV11 | ImageNodeV13 | PathNodeV11 | RectNodeV11 | GlyphRunNodeV11 | FrameNodeV11 | LineNodeV11>;
export type ContainerSpec = WithPivot<Pick<GroupNodeV11, 'id' | 'layer' | 'transform'> & { visible?: boolean; alpha?: number; hitMode?: HitMode }>;
export type ContainerData = WithPivot<Pick<GroupNodeV11, 'id' | 'layer' | 'transform' | 'visible' | 'alpha' | 'hitMode'>>;
export type SpriteData = WithPivot<Omit<ImageNodeV13, 'kind'>>;
export type SpriteSpec = Omit<SpriteData, 'tint' | 'blendMode' | 'visible' | 'alpha' | 'hitMode'> & {
  tint?: Tint; blendMode?: ImageNodeV13['blendMode']; visible?: boolean; alpha?: number; hitMode?: HitMode;
};
export type PathData = WithPivot<Omit<PathNodeV11, 'kind'>>;
export type PathSpec = Omit<PathData, 'visible' | 'alpha' | 'hitMode'> & { visible?: boolean; alpha?: number; hitMode?: HitMode };
export type PathPaint = Pick<PathNodeV11, 'commands' | 'fill' | 'stroke'>;
export type RectData = WithPivot<Omit<RectNodeV11, 'kind'>>;
export type RectSpec = Omit<RectData, 'visible' | 'alpha' | 'hitMode'> & { visible?: boolean; alpha?: number; hitMode?: HitMode };
export type RectPaint = Pick<RectNodeV11, 'width' | 'height' | 'fill'>;
export type GlyphRunData = WithPivot<Omit<GlyphRunNodeV11, 'kind'>>;
export type GlyphRunSpec = Omit<GlyphRunData, 'visible' | 'alpha' | 'hitMode'> & { visible?: boolean; alpha?: number; hitMode?: HitMode };
export type GlyphRunLayout = Pick<GlyphRunNodeV11, 'atlasId' | 'text' | 'baseline' | 'opacity' | 'sampling' | 'glyphs'>;
export type FrameSpec = WithPivot<Omit<Pick<FrameNodeV11, 'id' | 'layer' | 'transform' | 'width' | 'height' | 'fill' | 'clip' | 'visible' | 'alpha' | 'hitMode'>, 'visible' | 'alpha' | 'hitMode'> & { visible?: boolean; alpha?: number; hitMode?: HitMode }>;
export type FrameData = WithPivot<Pick<FrameNodeV11, 'id' | 'layer' | 'transform' | 'width' | 'height' | 'fill' | 'clip' | 'visible' | 'alpha' | 'hitMode'>>;
export type FramePaint = Pick<FrameNodeV11, 'width' | 'height' | 'fill' | 'clip'>;
export type LineData = WithPivot<Omit<LineNodeV11, 'kind'>>;
export type LineSpec = Omit<LineData, 'visible' | 'alpha' | 'hitMode'> & { visible?: boolean; alpha?: number; hitMode?: HitMode };
export type LinePaint = Pick<LineNodeV11, 'x1' | 'y1' | 'x2' | 'y2' | 'width' | 'stroke'>;
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
export type HoverEventType = 'pointerenter' | 'pointerleave';
export type HoverInput = { pointerId: number; point: Point; hit: Hit | null };
export type DisplayHoverEvent = {
  readonly type: HoverEventType;
  readonly pointerId: number;
  readonly point: Readonly<Point>;
  readonly target: DisplayHandle;
  readonly currentTarget: DisplayHandle;
};
export type HoverListener = (event: DisplayHoverEvent) => void;
export type WorldBounds = { x: number; y: number; width: number; height: number };
export type StageHandle = {
  readonly children: readonly DisplayHandle[];
  getWorldBounds(): WorldBounds | null;
  addChild(child: DisplayHandle): void;
  removeChild(child: DisplayHandle): void;
  setChildIndex(child: DisplayHandle, index: number): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
type PointConversion = {
  toWorld(localPoint: Point): Point;
  toLocal(worldPoint: Point): Point;
  getWorldBounds(): WorldBounds | null;
  getLocalBounds(): WorldBounds | null;
  setPivot(x: number, y: number): void;
};
export type ContainerHandle = StageHandle & PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'container'; readonly id: string; readonly data: ContainerData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
};
export type FrameHandle = StageHandle & PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'frame'; readonly id: string; readonly data: FrameData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
  setFrame(paint: FramePaint): void;
};
export type SpriteHandle = PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'sprite'; readonly id: string; readonly data: SpriteData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
  setAnchor(x: number, y: number): void;
  setSize(width: number, height: number): void;
  setOpacity(opacity: number): void;
  setTint(tint: Tint): void;
  setBlendMode(mode: ImageNodeV13['blendMode']): void;
  setSampling(sampling: 'nearest' | 'linear'): void;
  setSourceRect(rect: SourceRect | null): void;
  setSlice(slice: NineSliceInsets | null): void;
  setTile(tile: TilePattern | null): void;
  setImageSource(imageId: string, sourceRect?: SourceRect | null): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type RectHandle = PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'rect'; readonly id: string; readonly data: RectData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
  setRect(paint: RectPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type LineHandle = PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'line'; readonly id: string; readonly data: LineData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
  setLine(paint: LinePaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type PathHandle = PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'path'; readonly id: string; readonly data: PathData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
  setPath(paint: PathPaint): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type GlyphRunHandle = PointConversion & {
  onHover(type: HoverEventType, listener: HoverListener): () => void;
  readonly kind: 'glyphRun'; readonly id: string; readonly data: GlyphRunData;
  setTransform(transform: Transform): void;
  setPosition(x: number, y: number): void;
  setScale(scaleX: number, scaleY: number): void;
  setRotation(rotation: number): void;
  setLayer(layer: number): void;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  setHitMode(mode: HitMode): void;
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
  capturePointer(pointerId: number, handle: DisplayHandle): void;
  releasePointer(pointerId: number): void;
  getPointerCapture(pointerId: number): DisplayHandle | null;
  dispatchPointer(input: PointerInput): void;
  dispatchHover(input: HoverInput): void;
  snapshot(): SceneV14;
};

type RecordNode = {
  data: AuthoredNode | null;
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

function pose(transform: Transform, pivot?: Point): Matrix {
  const c = Math.cos(transform.rotation), s = Math.sin(transform.rotation);
  const a = c * transform.scaleX, b = s * transform.scaleX;
  const skew = -s * transform.scaleY, d = c * transform.scaleY;
  return [a, b, skew, d,
    transform.x - a * (pivot?.x ?? 0) - skew * (pivot?.y ?? 0),
    transform.y - b * (pivot?.x ?? 0) - d * (pivot?.y ?? 0)];
}

function boundedPoint(x: number, y: number): Point {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
    throw new Canvas2DError('SCENE_LIMIT', 'converted point exceeds the supported world range');
  }
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

type Edges = { left: number; top: number; right: number; bottom: number };

function union(a: Edges | null, b: Edges | null): Edges | null {
  if (!a) return b;
  if (!b) return a;
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

function intersect(a: Edges, b: Edges): Edges {
  return { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
}

function inside(box: Edges | null, clip: Edges | undefined): Edges | null {
  if (!box || !clip) return box;
  const cut = intersect(box, clip);
  return cut.left <= cut.right && cut.top <= cut.bottom ? cut : null;
}

function transformed(m: Matrix, x: number, y: number): Point {
  return boundedPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
}

function enclose(m: Matrix, points: readonly Point[]): Edges | null {
  let box: Edges | null = null;
  for (const point of points) {
    const { x, y } = transformed(m, point.x, point.y);
    const rounded = boundedPoint(Math.fround(x), Math.fround(y));
    box = union(box, { left: Math.min(x, rounded.x), top: Math.min(y, rounded.y),
      right: Math.max(x, rounded.x), bottom: Math.max(y, rounded.y) });
  }
  return box;
}

function quad(m: Matrix, x: number, y: number, width: number, height: number): Edges {
  return enclose(m, [{ x, y }, { x: x + width, y },
    { x: x + width, y: y + height }, { x, y: y + height }])!;
}

function ownBounds(data: Exclude<RecordNode['data'], null>, m: Matrix): Edges | null {
  if (data.kind === 'group') return null;
  if (data.kind === 'frame' || data.kind === 'rect') return quad(m, 0, 0, data.width, data.height);
  if (data.kind === 'image') return quad(m, -data.anchorX * data.width,
    -data.anchorY * data.height, data.width, data.height);
  if (data.kind === 'glyphRun') {
    let box: Edges | null = null;
    for (const glyph of data.glyphs) {
      box = union(box, quad(m, glyph.x, data.baseline + glyph.y, glyph.width, glyph.height));
    }
    return box;
  }
  if (data.kind === 'line') {
    const dx = data.x2 - data.x1, dy = data.y2 - data.y1;
    const half = data.width / (2 * Math.hypot(dx, dy));
    const nx = -dy * half, ny = dx * half;
    return enclose(m, [{ x: data.x1 + nx, y: data.y1 + ny },
      { x: data.x2 + nx, y: data.y2 + ny },
      { x: data.x2 - nx, y: data.y2 - ny },
      { x: data.x1 - nx, y: data.y1 - ny }]);
  }
  const points: Point[] = [];
  for (const command of data.commands) {
    if (command.kind === 'Z') continue;
    points.push({ x: command.x, y: command.y });
    if (command.kind === 'Q') points.push({ x: command.cx, y: command.cy });
    if (command.kind === 'C') points.push({ x: command.c1x, y: command.c1y },
      { x: command.c2x, y: command.c2y });
  }
  const box = enclose(m, points);
  if (!box || !data.stroke) return box;
  const half = data.stroke.width / 2;
  const x = Math.hypot(m[0], m[2]) * half;
  const y = Math.hypot(m[1], m[3]) * half;
  const lower = boundedPoint(box.left - x, box.top - y);
  const upper = boundedPoint(box.right + x, box.bottom + y);
  const roundedLower = boundedPoint(Math.fround(lower.x), Math.fround(lower.y));
  const roundedUpper = boundedPoint(Math.fround(upper.x), Math.fround(upper.y));
  return { left: Math.min(lower.x, roundedLower.x), top: Math.min(lower.y, roundedLower.y),
    right: Math.max(upper.x, roundedUpper.x), bottom: Math.max(upper.y, roundedUpper.y) };
}

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

function checkPathGeometry(node: PathNodeV11): void {
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
  const checked = validateScene({ version: 14, unit: 'logical-px', contextId, nodes: [] }) as SceneV14;
  const root: RecordNode = { data: null, parent: null, children: [], handle: null as unknown as StageHandle };
  const records = new WeakMap<object, RecordNode>();
  const listeners = new WeakMap<RecordNode, Map<PointerEventType, { listener: PointerListener }[]>>();
  const hoverListeners = new WeakMap<RecordNode, Map<HoverEventType, { listener: HoverListener }[]>>();
  const hoverRoutes = new Map<number, RecordNode[]>();
  const pointerCaptures = new Map<number, RecordNode>();
  const pointerTypes: readonly PointerEventType[] = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel'];
  const hoverTypes: readonly HoverEventType[] = ['pointerenter', 'pointerleave'];

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
  function onHover(record: RecordNode, type: HoverEventType, listener: HoverListener): () => void {
    if (!hoverTypes.includes(type)) invalid('hover event type is unsupported');
    if (typeof listener !== 'function') invalid('hover listener must be a function');
    let byType = hoverListeners.get(record);
    if (!byType) { byType = new Map(); hoverListeners.set(record, byType); }
    let callbacks = byType.get(type);
    if (!callbacks) { callbacks = []; byType.set(type, callbacks); }
    if (callbacks.length >= 32) throw new Canvas2DError('SCENE_LIMIT', 'hover listener limit is 32 per type and handle');
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
  function clearHoverRoutesThrough(record: RecordNode): void {
    for (const [pointerId, route] of hoverRoutes) {
      if (route.includes(record)) hoverRoutes.delete(pointerId);
    }
  }
  function clearPointerCapturesThrough(record: RecordNode): void {
    for (const [pointerId, target] of pointerCaptures) {
      for (let cursor: RecordNode | null = target; cursor; cursor = cursor.parent) {
        if (cursor === record) { pointerCaptures.delete(pointerId); break; }
      }
    }
  }
  function isAttached(record: RecordNode): boolean {
    let top = record;
    while (top.parent) top = top.parent;
    return top === root;
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
  function checkedPointerId(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      invalid('pointer ID must be a non-negative safe integer');
    }
    return value;
  }
  function claimedTarget(value: unknown): RecordNode | null {
    if (value === null) return null;
    const hit = exactSpec(value, ['id', 'kind']);
    if (typeof hit.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(hit.id)) {
      invalid('pointer hit ID is invalid');
    }
    if (!['frame', 'rect', 'line', 'path', 'image', 'glyphRun'].includes(hit.kind as string)) {
      invalid('pointer hit kind is invalid');
    }
    const target = findRecord(hit.id);
    if (!target || target.data?.kind !== hit.kind) invalid('pointer hit is not an attached display handle');
    for (let cursor: RecordNode | null = target; cursor && cursor !== root; cursor = cursor.parent) {
      if (cursor.data?.visible === false || cursor.data?.alpha === 0 || cursor.data?.hitMode === 'none') {
        invalid('pointer hit is hidden, transparent or disabled');
      }
    }
    return target;
  }

  function toNode(record: RecordNode): AuthoredNode {
    const data = record.data;
    if (!data) invalid('stage has no scene node');
    if (data.kind === 'group' || data.kind === 'frame') return { ...data, children: record.children.map(toNode) };
    return data;
  }
  function validateRoots(changed: RecordNode): void {
    validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
      nodes: root.children.map(toNode) });
    let top = changed;
    while (top.parent) top = top.parent;
    if (top !== root) {
      validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(top)] });
    }
  }
  function known(handle: DisplayHandle): RecordNode {
    const record = handle !== null && typeof handle === 'object' ? records.get(handle) : undefined;
    if (!record || record === root) invalid('display object belongs to another tree');
    return record;
  }
  function mutate(record: RecordNode, data: AuthoredNode): void {
    const previous = record.data;
    record.data = data;
    try {
      validateRoots(record);
      const accepted = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(record)] }).nodes[0] as AuthoredNode;
      if (accepted.kind === 'path') checkPathGeometry(accepted);
      record.data = accepted;
    } catch (error) { record.data = previous; throw error; }
  }
  function worldMatrix(record: RecordNode): Matrix {
    const ancestors: RecordNode[] = [];
    for (let current: RecordNode | null = record; current?.data; current = current.parent) ancestors.push(current);
    let matrix: Matrix = identity;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      matrix = multiply(matrix, pose(ancestors[i].data!.transform, ancestors[i].data!.pivot));
    }
    if (matrix.some(value => !Number.isFinite(value))) {
      throw new Canvas2DError('SCENE_LIMIT', 'composed transform is not finite');
    }
    return matrix;
  }
  function subtreeBounds(record: RecordNode, origin: Matrix, ancestorClip?: Edges): WorldBounds | null {
    function visit(current: RecordNode, matrix: Matrix, clip: Edges | undefined): Edges | null {
      const data = current.data;
      let box = data ? inside(ownBounds(data, matrix), clip) : null;
      const childClip = data?.kind === 'frame' && data.clip
        ? (clip ? intersect(clip, quad(matrix, 0, 0, data.width, data.height))
          : quad(matrix, 0, 0, data.width, data.height)) : clip;
      for (const child of current.children) {
        box = union(box, visit(child, multiply(matrix, pose(child.data!.transform, child.data!.pivot)), childClip));
      }
      return box;
    }
    const box = visit(record, origin, ancestorClip);
    if (!box) return null;
    const size = boundedPoint(box.right - box.left, box.bottom - box.top);
    return { x: box.left, y: box.top, width: size.x, height: size.y };
  }
  function worldBounds(record: RecordNode): WorldBounds | null {
    let ancestorClip: Edges | undefined;
    for (let ancestor = record.parent; ancestor?.data; ancestor = ancestor.parent) {
      if (ancestor.data.kind === 'frame' && ancestor.data.clip) {
        const frame = quad(worldMatrix(ancestor), 0, 0, ancestor.data.width, ancestor.data.height);
        ancestorClip = ancestorClip ? intersect(ancestorClip, frame) : frame;
      }
    }
    return subtreeBounds(record, record === root ? identity : worldMatrix(record), ancestorClip);
  }
  function common(record: RecordNode) {
    return {
      getWorldBounds() { return worldBounds(record); },
      getLocalBounds() { return subtreeBounds(record, identity); },
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
      setPivot(x: number, y: number) {
        const data = record.data;
        if (!data) invalid('stage has no pivot');
        mutate(record, { ...data, pivot: { x, y } });
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
      setAlpha(alpha: number) {
        const data = record.data;
        if (!data) invalid('stage has no alpha');
        mutate(record, { ...data, alpha });
      },
      setHitMode(mode: HitMode) {
        const data = record.data;
        if (!data) invalid('stage has no hit mode');
        mutate(record, { ...data, hitMode: mode });
      },
    };
  }
  function parentMethods(parent: RecordNode): StageHandle {
    return {
      get children() { return parent.children.map(child => child.handle as DisplayHandle); },
      getWorldBounds() { return worldBounds(parent); },
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
        clearHoverRoutesThrough(record);
        clearPointerCapturesThrough(record);
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
      if (!isAttached(record) || !isAttached(destination)) invalid('child and target must be attached');
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
      clearHoverRoutesThrough(record);
    },
    createContainer(spec: ContainerSpec): ContainerHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform'], ['visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'group', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto', children: [] }] }).nodes[0] as GroupNodeV11;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as ContainerHandle };
      const parent = parentMethods(record);
      const handle: ContainerHandle = Object.freeze({
        kind: 'container' as const, get id() { return (record.data as GroupNodeV11).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as GroupNodeV11;
          return structuredClone(data) as ContainerData; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild, setChildIndex: parent.setChildIndex,
        onPointer: parent.onPointer,
        onHover(type, listener) { return onHover(record, type, listener); },
        ...common(record),
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createSprite(spec: SpriteSpec): SpriteHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'imageId', 'width', 'height',
        'opacity', 'sampling', 'anchorX', 'anchorY'], ['sourceRect', 'slice', 'tile', 'tint', 'blendMode', 'visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'image', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto',
          tint: Object.hasOwn(fields, 'tint') ? fields.tint : [1, 1, 1],
          blendMode: Object.hasOwn(fields, 'blendMode') ? fields.blendMode : 'normal' }] }).nodes[0] as ImageNodeV13;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as SpriteHandle };
      const handle: SpriteHandle = Object.freeze({
        kind: 'sprite' as const, get id() { return (record.data as ImageNodeV13).id; },
        get data() { const { kind: _kind, ...data } = record.data as ImageNodeV13;
          return structuredClone(data) as SpriteData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        onHover(type, listener) { return onHover(record, type, listener); },
        setAnchor(x: number, y: number) { mutate(record, { ...(record.data as ImageNodeV13), anchorX: x, anchorY: y }); },
        setSize(width: number, height: number) {
          mutate(record, { ...(record.data as ImageNodeV13), width, height });
        },
        setOpacity(opacity: number) { mutate(record, { ...(record.data as ImageNodeV13), opacity }); },
        setTint(tint: Tint) { mutate(record, { ...(record.data as ImageNodeV13), tint }); },
        setBlendMode(blendMode: ImageNodeV13['blendMode']) {
          mutate(record, { ...(record.data as ImageNodeV13), blendMode });
        },
        setSampling(sampling: 'nearest' | 'linear') {
          mutate(record, { ...(record.data as ImageNodeV13), sampling });
        },
        setSourceRect(rect: SourceRect | null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV13;
          mutate(record, rect === null ? withoutCrop : { ...withoutCrop, sourceRect: rect });
        },
        setSlice(slice: NineSliceInsets | null) {
          const { slice: _prior, ...withoutSlice } = record.data as ImageNodeV13;
          mutate(record, slice === null ? withoutSlice : { ...withoutSlice, slice });
        },
        setTile(tile: TilePattern | null) {
          const { tile: _prior, ...withoutTile } = record.data as ImageNodeV13;
          mutate(record, tile === null ? withoutTile : { ...withoutTile, tile });
        },
        setImageSource(imageId: string, sourceRect: SourceRect | null = null) {
          const { sourceRect: _prior, ...withoutCrop } = record.data as ImageNodeV13;
          mutate(record, sourceRect === null
            ? { ...withoutCrop, imageId }
            : { ...withoutCrop, imageId, sourceRect });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createPath(spec: PathSpec): PathHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'commands'], ['fill', 'stroke', 'visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'path', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto' }] }).nodes[0] as PathNodeV11;
      checkPathGeometry(node);
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as PathHandle };
      const handle: PathHandle = Object.freeze({
        kind: 'path' as const, get id() { return (record.data as PathNodeV11).id; },
        get data() { const { kind: _kind, ...data } = record.data as PathNodeV11;
          return structuredClone(data) as PathData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        onHover(type, listener) { return onHover(record, type, listener); },
        setPath(paint: PathPaint) {
          const fields = exactSpec(paint, ['commands'], ['fill', 'stroke']);
          const { commands: _commands, fill: _fill, stroke: _stroke, ...base } = record.data as PathNodeV11 & { pivot?: Point };
          mutate(record, { ...base, ...fields } as PathNodeV11 & { pivot?: Point });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createRect(spec: RectSpec): RectHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill'], ['visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'rect', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto' }] }).nodes[0] as RectNodeV11;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as RectHandle };
      const handle: RectHandle = Object.freeze({
        kind: 'rect' as const, get id() { return (record.data as RectNodeV11).id; },
        get data() { const { kind: _kind, ...data } = record.data as RectNodeV11;
          return structuredClone(data) as RectData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        onHover(type, listener) { return onHover(record, type, listener); },
        setRect(paint: RectPaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill']);
          mutate(record, { ...(record.data as RectNodeV11), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createGlyphRun(spec: GlyphRunSpec): GlyphRunHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'atlasId', 'text', 'baseline',
        'opacity', 'sampling', 'glyphs'], ['visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'glyphRun', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto' }] }).nodes[0] as GlyphRunNodeV11;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as GlyphRunHandle };
      const handle: GlyphRunHandle = Object.freeze({
        kind: 'glyphRun' as const, get id() { return (record.data as GlyphRunNodeV11).id; },
        get data() { const { kind: _kind, ...data } = record.data as GlyphRunNodeV11;
          return structuredClone(data) as GlyphRunData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        onHover(type, listener) { return onHover(record, type, listener); },
        setLayout(layout: GlyphRunLayout) {
          const fields = exactSpec(layout, ['atlasId', 'text', 'baseline', 'opacity', 'sampling', 'glyphs']);
          mutate(record, { ...(record.data as GlyphRunNodeV11), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createFrame(spec: FrameSpec): FrameHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'width', 'height', 'fill', 'clip'], ['visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'frame', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto', children: [] }] }).nodes[0] as FrameNodeV11;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as FrameHandle };
      const parent = parentMethods(record);
      const handle: FrameHandle = Object.freeze({
        kind: 'frame' as const, get id() { return (record.data as FrameNodeV11).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as FrameNodeV11;
          return structuredClone(data) as FrameData; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild, setChildIndex: parent.setChildIndex,
        onPointer: parent.onPointer,
        onHover(type, listener) { return onHover(record, type, listener); },
        ...common(record),
        setFrame(paint: FramePaint) {
          const fields = exactSpec(paint, ['width', 'height', 'fill', 'clip']);
          mutate(record, { ...(record.data as FrameNodeV11), ...fields });
        },
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createLine(spec: LineSpec): LineHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'x1', 'y1', 'x2', 'y2', 'width', 'stroke'], ['visible', 'alpha', 'hitMode', 'pivot']);
      const node = validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'line', ...fields, visible: Object.hasOwn(fields, 'visible') ? fields.visible : true,
          alpha: Object.hasOwn(fields, 'alpha') ? fields.alpha : 1,
          hitMode: Object.hasOwn(fields, 'hitMode') ? fields.hitMode : 'auto' }] }).nodes[0] as LineNodeV11;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as LineHandle };
      const handle: LineHandle = Object.freeze({
        kind: 'line' as const, get id() { return (record.data as LineNodeV11).id; },
        get data() { const { kind: _kind, ...data } = record.data as LineNodeV11;
          return structuredClone(data) as LineData; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        onHover(type, listener) { return onHover(record, type, listener); },
        setLine(paint: LinePaint) {
          const fields = exactSpec(paint, ['x1', 'y1', 'x2', 'y2', 'width', 'stroke']);
          mutate(record, { ...(record.data as LineNodeV11), ...fields });
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
    capturePointer(pointerId: number, handle: DisplayHandle): void {
      const id = checkedPointerId(pointerId);
      const target = known(handle);
      if (!isAttached(target)) invalid('pointer capture target is detached');
      if (!pointerCaptures.has(id) && pointerCaptures.size >= 16) {
        throw new Canvas2DError('SCENE_LIMIT', 'pointer capture limit is 16');
      }
      pointerCaptures.set(id, target);
    },
    releasePointer(pointerId: number): void {
      pointerCaptures.delete(checkedPointerId(pointerId));
    },
    getPointerCapture(pointerId: number): DisplayHandle | null {
      return (pointerCaptures.get(checkedPointerId(pointerId))?.handle as DisplayHandle | undefined) ?? null;
    },
    dispatchPointer(input: PointerInput): void {
      const fields = exactSpec(input, ['type', 'pointerId', 'point', 'hit']);
      const type = checkedPointerType(fields.type);
      const pointerId = checkedPointerId(fields.pointerId);
      const point = validatePoint(fields.point);
      const spatialTarget = claimedTarget(fields.hit);
      const target = pointerCaptures.get(pointerId) ?? spatialTarget;
      const route: RecordNode[] = [];
      for (let cursor: RecordNode | null = target ?? root; cursor; cursor = cursor.parent) route.push(cursor);
      const planned = route.map(record => ({ record,
        callbacks: (listeners.get(record)?.get(type) ?? []).map(registration => registration.listener) }));
      let stopped = false;
      try {
        for (const { record, callbacks } of planned) {
          for (const callback of callbacks) {
            callback(Object.freeze({ type, pointerId, point: Object.freeze({ ...point }),
              target: (target?.handle as DisplayHandle | undefined) ?? null,
              currentTarget: record.handle,
              stopPropagation() { stopped = true; } }));
          }
          if (stopped) break;
        }
      } finally {
        if (type === 'pointerup' || type === 'pointercancel') pointerCaptures.delete(pointerId);
      }
    },
    dispatchHover(input: HoverInput): void {
      const fields = exactSpec(input, ['pointerId', 'point', 'hit']);
      const pointerId = checkedPointerId(fields.pointerId);
      const point = validatePoint(fields.point);
      const target = claimedTarget(fields.hit);
      const next: RecordNode[] = [];
      for (let cursor = target; cursor && cursor !== root; cursor = cursor.parent) next.push(cursor);
      const previous = hoverRoutes.get(pointerId) ?? [];
      if (next.length > 0 && previous.length === 0 && hoverRoutes.size >= 16) {
        throw new Canvas2DError('SCENE_LIMIT', 'hover pointer limit is 16');
      }
      let shared = 0;
      while (shared < previous.length && shared < next.length &&
          previous[previous.length - 1 - shared] === next[next.length - 1 - shared]) shared++;
      const changes: { type: HoverEventType; record: RecordNode; callbacks: HoverListener[] }[] = [];
      for (const record of previous.slice(0, previous.length - shared)) {
        changes.push({ type: 'pointerleave', record,
          callbacks: (hoverListeners.get(record)?.get('pointerleave') ?? []).map(entry => entry.listener) });
      }
      for (const record of next.slice(0, next.length - shared).reverse()) {
        changes.push({ type: 'pointerenter', record,
          callbacks: (hoverListeners.get(record)?.get('pointerenter') ?? []).map(entry => entry.listener) });
      }
      if (next.length === 0) hoverRoutes.delete(pointerId);
      else hoverRoutes.set(pointerId, next);
      for (const { type, record, callbacks } of changes) {
        const handle = record.handle as DisplayHandle;
        const event: DisplayHoverEvent = Object.freeze({ type, pointerId,
          point: Object.freeze({ ...point }), target: handle, currentTarget: handle });
        for (const callback of callbacks) callback(event);
      }
    },
    snapshot(): SceneV14 {
      return validateScene({ version: 14, unit: 'logical-px', contextId: checked.contextId,
        nodes: root.children.map(toNode) }) as SceneV14;
    },
  });
}

export function createDisplayTreeFromScene(scene: unknown): DisplayTree {
  const accepted = validateScene(scene);
  if (accepted.version !== 6 && accepted.version !== 7 && accepted.version !== 8 && accepted.version !== 9 && accepted.version !== 10 && accepted.version !== 11 && accepted.version !== 12 && accepted.version !== 13 && accepted.version !== 14) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree reconstruction requires Scene v6 through v14');
  }
  type ReconstructNode = SceneV6['nodes'][number] | SceneV7['nodes'][number] | SceneV8['nodes'][number] | SceneV9['nodes'][number] | SceneV10['nodes'][number] | SceneV11['nodes'][number] | SceneV12['nodes'][number] | SceneV13['nodes'][number] | SceneV14['nodes'][number];
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
