import { Canvas2DError, validatePoint, validateScene } from './schema.js';
import type { GroupNodeV6, ImageNodeV6, Point, SceneV6, Transform } from './schema.js';
import type { Hit } from './renderer.js';

export type ContainerSpec = Pick<GroupNodeV6, 'id' | 'layer' | 'transform'>;
export type SpriteSpec = Omit<ImageNodeV6, 'kind'>;
export type DisplayHandle = ContainerHandle | SpriteHandle;
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
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type ContainerHandle = StageHandle & {
  readonly kind: 'container'; readonly id: string; readonly data: ContainerSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
};
export type SpriteHandle = {
  readonly kind: 'sprite'; readonly id: string; readonly data: SpriteSpec;
  setTransform(transform: Transform): void;
  setLayer(layer: number): void;
  setAnchor(x: number, y: number): void;
  setOpacity(opacity: number): void;
  onPointer(type: PointerEventType, listener: PointerListener): () => void;
};
export type DisplayTree = {
  readonly stage: StageHandle;
  createContainer(spec: ContainerSpec): ContainerHandle;
  createSprite(spec: SpriteSpec): SpriteHandle;
  get(id: string): DisplayHandle | null;
  dispatchPointer(input: PointerInput): void;
  snapshot(): SceneV6;
};

type RecordNode = {
  data: GroupNodeV6 | ImageNodeV6 | null;
  parent: RecordNode | null;
  children: RecordNode[];
  handle: StageHandle | DisplayHandle;
};

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

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
  const checked = validateScene({ version: 6, unit: 'logical-px', contextId, nodes: [] }) as SceneV6;
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

  function toNode(record: RecordNode): GroupNodeV6 | ImageNodeV6 {
    const data = record.data;
    if (!data) invalid('stage has no scene node');
    if (data.kind === 'group') return { ...data, children: record.children.map(toNode) };
    return data;
  }
  function validateRoots(changed: RecordNode): void {
    validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
      nodes: root.children.map(toNode) });
    let top = changed;
    while (top.parent) top = top.parent;
    if (top !== root) {
      validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
        nodes: [toNode(top)] });
    }
  }
  function known(handle: DisplayHandle): RecordNode {
    const record = handle !== null && typeof handle === 'object' ? records.get(handle) : undefined;
    if (!record || record === root) invalid('display object belongs to another tree');
    return record;
  }
  function mutate(record: RecordNode, data: GroupNodeV6 | ImageNodeV6): void {
    const previous = record.data;
    record.data = data;
    try { validateRoots(record); }
    catch (error) { record.data = previous; throw error; }
    record.data = validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
      nodes: [toNode(record)] }).nodes[0] as GroupNodeV6 | ImageNodeV6;
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
    };
  }
  root.handle = Object.freeze(parentMethods(root));
  records.set(root.handle, root);

  return Object.freeze({
    stage: root.handle,
    createContainer(spec: ContainerSpec): ContainerHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform']);
      const node = validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'group', ...fields, children: [] }] }).nodes[0] as GroupNodeV6;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as ContainerHandle };
      const parent = parentMethods(record);
      const handle: ContainerHandle = Object.freeze({
        kind: 'container' as const, get id() { return (record.data as GroupNodeV6).id; },
        get data() { const { kind: _kind, children: _children, ...data } = record.data as GroupNodeV6;
          return structuredClone(data) as ContainerSpec; },
        get children() { return parent.children; },
        addChild: parent.addChild, removeChild: parent.removeChild,
        onPointer: parent.onPointer,
        ...common(record),
      });
      record.handle = handle; records.set(handle, record);
      return handle;
    },
    createSprite(spec: SpriteSpec): SpriteHandle {
      const fields = exactSpec(spec, ['id', 'layer', 'transform', 'imageId', 'width', 'height',
        'opacity', 'sampling', 'anchorX', 'anchorY'], ['sourceRect']);
      const node = validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
        nodes: [{ kind: 'image', ...fields }] }).nodes[0] as ImageNodeV6;
      const record: RecordNode = { data: node, parent: null, children: [], handle: null as unknown as SpriteHandle };
      const handle: SpriteHandle = Object.freeze({
        kind: 'sprite' as const, get id() { return (record.data as ImageNodeV6).id; },
        get data() { const { kind: _kind, ...data } = record.data as ImageNodeV6;
          return structuredClone(data) as SpriteSpec; },
        ...common(record),
        onPointer(type, listener) { return onPointer(record, type, listener); },
        setAnchor(x: number, y: number) { mutate(record, { ...(record.data as ImageNodeV6), anchorX: x, anchorY: y }); },
        setOpacity(opacity: number) { mutate(record, { ...(record.data as ImageNodeV6), opacity }); },
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
        if (hit.kind !== 'image') {
          throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree pointer target must be an image');
        }
        target = findRecord(hit.id);
        if (!target || target.data?.kind !== 'image') invalid('pointer hit is not an attached sprite');
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
    snapshot(): SceneV6 {
      return validateScene({ version: 6, unit: 'logical-px', contextId: checked.contextId,
        nodes: root.children.map(toNode) }) as SceneV6;
    },
  });
}

export function createDisplayTreeFromScene(scene: unknown): DisplayTree {
  const accepted = validateScene(scene);
  if (accepted.version !== 6) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'display tree reconstruction requires Scene v6');
  }
  const allowed = (nodes: SceneV6['nodes']): void => {
    for (const node of nodes) {
      if (node.kind === 'group') allowed(node.children);
      else if (node.kind !== 'image') {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', `display tree cannot reconstruct ${node.kind}`);
      }
    }
  };
  allowed(accepted.nodes);
  const tree = createDisplayTree(accepted.contextId);
  const attach = (parent: StageHandle, nodes: SceneV6['nodes']): void => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        const { kind: _kind, children, ...spec } = node;
        const handle = tree.createContainer(spec);
        parent.addChild(handle);
        attach(handle, children);
      } else if (node.kind === 'image') {
        const { kind: _kind, ...spec } = node;
        parent.addChild(tree.createSprite(spec));
      }
    }
  };
  attach(tree.stage, accepted.nodes);
  return tree;
}
