export type ErrorCode = 'INVALID_SCENE' | 'SCENE_LIMIT' | 'INVALID_VIEW' | 'INVALID_SIZE' |
  'WEBGL_UNAVAILABLE' | 'CONTEXT_LOST' | 'DISPOSED' | 'SERIALIZATION' | 'UNSUPPORTED_FEATURE' |
  'INVALID_ASSET' | 'ASSET_LIMIT' | 'ASSET_IN_USE';

export class Canvas2DError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'Canvas2DError';
  }
}

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type View = { panX: number; panY: number; zoom: number };
export type Color = [number, number, number, number];
export type Transform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
type Base = { id: string; layer: number; transform: Transform };
export type GroupNode = Base & { kind: 'group'; children: Node[] };
export type FrameNode = Base & { kind: 'frame'; width: number; height: number; fill: Color; clip: boolean; children: Node[] };
export type RectNode = Base & { kind: 'rect'; width: number; height: number; fill: Color };
export type LineNode = Base & { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; stroke: Color };
export type PathCommand =
  | { kind: 'M'; x: number; y: number }
  | { kind: 'L'; x: number; y: number }
  | { kind: 'Q'; cx: number; cy: number; x: number; y: number }
  | { kind: 'C'; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number }
  | { kind: 'Z' };
export type PathNode = Base & { kind: 'path'; commands: PathCommand[]; width: number; stroke: Color };
export type Node = GroupNode | FrameNode | RectNode | LineNode | PathNode;
export type PathFill = { color: Color; rule: 'evenodd' };
export type PathStroke = { color: Color; width: number };
export type PathNodeV2 = Base & { kind: 'path'; commands: PathCommand[]; fill?: PathFill; stroke?: PathStroke };
export type SourceRect = { x: number; y: number; width: number; height: number };
export type ImageNode = Base & { kind: 'image'; imageId: string; width: number; height: number;
  opacity: number; sampling: 'nearest' | 'linear'; sourceRect?: SourceRect };
export type ImageAssetInput = { width: number; height: number; pixels: Uint8Array };
export type GroupNodeV2 = Omit<GroupNode, 'children'> & { children: NodeV2[] };
export type FrameNodeV2 = Omit<FrameNode, 'children'> & { children: NodeV2[] };
export type NodeV2 = GroupNodeV2 | FrameNodeV2 | RectNode | LineNode | PathNodeV2;
export type GroupNodeV3 = Omit<GroupNode, 'children'> & { children: NodeV3[] };
export type FrameNodeV3 = Omit<FrameNode, 'children'> & { children: NodeV3[] };
export type NodeV3 = GroupNodeV3 | FrameNodeV3 | RectNode | LineNode | PathNodeV2 | ImageNode;
export type OldGroupNode = Omit<GroupNode, 'children'> & { children: OldNode[] };
export type OldFrameNode = Omit<FrameNode, 'children'> & { children: OldNode[] };
export type OldNode = OldGroupNode | OldFrameNode | RectNode | LineNode;
export type SceneV0 = { version: 0; unit: 'logical-px'; contextId: string; nodes: OldNode[] };
export type SceneV1 = { version: 1; unit: 'logical-px'; contextId: string; nodes: Node[] };
export type SceneV2 = { version: 2; unit: 'logical-px'; contextId: string; nodes: NodeV2[] };
export type SceneV3 = { version: 3; unit: 'logical-px'; contextId: string; nodes: NodeV3[] };
export type Scene = SceneV0 | SceneV1 | SceneV2 | SceneV3;

const MAX_BYTES = 1024 * 1024;
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function fail(code: ErrorCode, message: string): never { throw new Canvas2DError(code, message); }

function object(value: unknown, keys: string[], path: string, seen: WeakSet<object>, code: ErrorCode = 'INVALID_SCENE'): Record<string, unknown> {
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(code, `${path} must be a plain object`);
  }
  if (seen.has(value)) fail(code, `${path} repeats an object`);
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== 'string' || !keys.includes(key))) {
    fail(code, `${path} has unknown or missing fields`);
  }
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(code, `${path}.${key} must be a data field`);
    }
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string, seen: WeakSet<object>): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('INVALID_SCENE', `${path} must be an array`);
  }
  if (seen.has(value)) fail('INVALID_SCENE', `${path} repeats an array`);
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
    fail('INVALID_SCENE', `${path} must be dense without extra fields`);
  }
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail('INVALID_SCENE', `${path}[${i}] must be a data item`);
    }
  }
  return value;
}

function number(value: unknown, path: string, min: number, max: number, code: ErrorCode = 'INVALID_SCENE'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || value < min || value > max) {
    fail(code, `${path} is outside its finite range`);
  }
  return value;
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) fail('INVALID_SCENE', `${path} is not a valid ID`);
  return value;
}

export function validateImageAssetId(value: unknown): string {
  if (typeof value !== 'string' || !idPattern.test(value)) fail('INVALID_ASSET', 'asset ID is invalid');
  return value;
}

export function copyImageAsset(value: unknown): ImageAssetInput {
  const seen = new WeakSet<object>();
  const raw = object(value, ['width', 'height', 'pixels'], 'asset', seen, 'INVALID_ASSET');
  const width = number(raw.width, 'asset.width', 1, 4096, 'INVALID_ASSET');
  const height = number(raw.height, 'asset.height', 1, 4096, 'INVALID_ASSET');
  if (!Number.isInteger(width) || !Number.isInteger(height)) fail('INVALID_ASSET', 'asset dimensions must be integers');
  const pixels = raw.pixels;
  if (!(pixels instanceof Uint8Array) || Object.getPrototypeOf(pixels) !== Uint8Array.prototype ||
      (typeof SharedArrayBuffer !== 'undefined' && pixels.buffer instanceof SharedArrayBuffer) ||
      pixels.byteLength !== width * height * 4) fail('INVALID_ASSET', 'asset pixels must be exact RGBA8 bytes');
  return { width, height, pixels: new Uint8Array(pixels) };
}

function transform(value: unknown, path: string, seen: WeakSet<object>): Transform {
  const raw = object(value, ['x', 'y', 'scaleX', 'scaleY', 'rotation'], path, seen);
  return {
    x: number(raw.x, `${path}.x`, -1e6, 1e6), y: number(raw.y, `${path}.y`, -1e6, 1e6),
    scaleX: number(raw.scaleX, `${path}.scaleX`, 0.01, 100),
    scaleY: number(raw.scaleY, `${path}.scaleY`, 0.01, 100),
    rotation: number(raw.rotation, `${path}.rotation`, -2 * Math.PI, 2 * Math.PI),
  };
}

function color(value: unknown, path: string, seen: WeakSet<object>): Color {
  const raw = array(value, path, seen);
  if (raw.length !== 4) fail('INVALID_SCENE', `${path} must have four components`);
  return raw.map((component, index) => number(component, `${path}[${index}]`, 0, 1)) as Color;
}

function commands(value: unknown, path: string, seen: WeakSet<object>, requireClosed = false): PathCommand[] {
  const raw = array(value, path, seen);
  if (raw.length < 2 || raw.length > 256) fail('SCENE_LIMIT', `${path} needs 2..256 commands`);
  let open = false, drawable = false, anyDrawable = false, contours = 0;
  let current: Point = { x: 0, y: 0 }, start: Point = { x: 0, y: 0 };
  const result: PathCommand[] = [];
  for (let index = 0; index < raw.length; index++) {
    const item = raw[index], itemPath = `${path}[${index}]`;
    if (!item || typeof item !== 'object') fail('INVALID_SCENE', `${itemPath} must be a command`);
    const descriptor = Object.getOwnPropertyDescriptor(item, 'kind');
    if (!descriptor || !('value' in descriptor)) fail('INVALID_SCENE', `${itemPath}.kind is invalid`);
    const kind = descriptor.value;
    const fields = kind === 'M' || kind === 'L' ? ['kind', 'x', 'y'] :
      kind === 'Q' ? ['kind', 'cx', 'cy', 'x', 'y'] :
      kind === 'C' ? ['kind', 'c1x', 'c1y', 'c2x', 'c2y', 'x', 'y'] :
      kind === 'Z' ? ['kind'] : null;
    if (!fields) fail('INVALID_SCENE', `${itemPath}.kind is unsupported`);
    const data = object(item, fields, itemPath, seen);
    if (kind === 'M') {
      if (open && !drawable) fail('INVALID_SCENE', `${itemPath} follows an empty subpath`);
      if (open && requireClosed) fail('INVALID_SCENE', `${itemPath} follows an open filled contour`);
      anyDrawable ||= drawable;
      if (++contours > 8 && requireClosed) fail('SCENE_LIMIT', `${path} exceeds 8 contours`);
      current = { x: number(data.x, `${itemPath}.x`, -1e6, 1e6),
        y: number(data.y, `${itemPath}.y`, -1e6, 1e6) };
      start = current; open = true; drawable = false;
      result.push({ kind: 'M', ...current });
      continue;
    }
    if (!open) fail('INVALID_SCENE', `${itemPath} needs a preceding M`);
    if (kind === 'Z') {
      if (!drawable && current.x === start.x && current.y === start.y) fail('INVALID_SCENE', `${itemPath} closes an empty subpath`);
      anyDrawable ||= drawable || current.x !== start.x || current.y !== start.y;
      result.push({ kind: 'Z' }); open = false; drawable = false; current = start;
      continue;
    }
    const end = { x: number(data.x, `${itemPath}.x`, -1e6, 1e6),
      y: number(data.y, `${itemPath}.y`, -1e6, 1e6) };
    if (kind === 'L') {
      drawable ||= current.x !== end.x || current.y !== end.y;
      result.push({ kind: 'L', ...end });
    } else if (kind === 'Q') {
      const control = { cx: number(data.cx, `${itemPath}.cx`, -1e6, 1e6),
        cy: number(data.cy, `${itemPath}.cy`, -1e6, 1e6) };
      drawable ||= current.x !== end.x || current.y !== end.y || current.x !== control.cx || current.y !== control.cy;
      result.push({ kind: 'Q', ...control, ...end });
    } else {
      const control = {
        c1x: number(data.c1x, `${itemPath}.c1x`, -1e6, 1e6),
        c1y: number(data.c1y, `${itemPath}.c1y`, -1e6, 1e6),
        c2x: number(data.c2x, `${itemPath}.c2x`, -1e6, 1e6),
        c2y: number(data.c2y, `${itemPath}.c2y`, -1e6, 1e6),
      };
      drawable ||= current.x !== end.x || current.y !== end.y ||
        current.x !== control.c1x || current.y !== control.c1y ||
        current.x !== control.c2x || current.y !== control.c2y;
      result.push({ kind: 'C', ...control, ...end });
    }
    current = end;
  }
  if (open && !drawable) fail('INVALID_SCENE', `${path} ends with an empty subpath`);
  if (open && requireClosed) fail('INVALID_SCENE', `${path} ends with an open filled contour`);
  anyDrawable ||= drawable;
  if (!anyDrawable) fail('INVALID_SCENE', `${path} has no stroke`);
  return result;
}

type Counter = { nodes: number; vertices: number; paths: number; ids: Set<string> };
function nodes(value: unknown, depth: number, path: string, ancestorRotated: boolean,
  seen: WeakSet<object>, counter: Counter, version: 0 | 1 | 2 | 3): (Node | NodeV2 | NodeV3)[] {
  if (depth > 16) fail('SCENE_LIMIT', 'scene depth exceeds 16');
  const raw = array(value, path, seen);
  if (raw.length > 256) fail('SCENE_LIMIT', 'scene has too many siblings');
  return raw.map((item, index): Node | NodeV2 | NodeV3 => {
    const nodePath = `${path}[${index}]`;
    if (item === null || typeof item !== 'object') fail('INVALID_SCENE', `${nodePath} must be a node`);
    const kindDescriptor = Object.getOwnPropertyDescriptor(item, 'kind');
    if (!kindDescriptor || !('value' in kindDescriptor)) fail('INVALID_SCENE', `${nodePath}.kind is invalid`);
    const kind = kindDescriptor.value;
    const common = ['kind', 'id', 'layer', 'transform'];
    let fields: string[];
    if (kind === 'group') fields = [...common, 'children'];
    else if (kind === 'frame') fields = [...common, 'width', 'height', 'fill', 'clip', 'children'];
    else if (kind === 'rect') fields = [...common, 'width', 'height', 'fill'];
    else if (kind === 'line') fields = [...common, 'x1', 'y1', 'x2', 'y2', 'width', 'stroke'];
    else if (kind === 'path' && version === 1) fields = [...common, 'commands', 'width', 'stroke'];
    else if (kind === 'path' && version >= 2) {
      const hasFill = Object.hasOwn(item, 'fill'), hasStroke = Object.hasOwn(item, 'stroke');
      if (!hasFill && !hasStroke) fail('INVALID_SCENE', `${nodePath} needs fill or stroke`);
      fields = [...common, 'commands', ...(hasFill ? ['fill'] : []), ...(hasStroke ? ['stroke'] : [])];
    }
    else if (kind === 'image' && version === 3) fields = [...common, 'imageId', 'width', 'height',
      'opacity', 'sampling', ...(Object.hasOwn(item, 'sourceRect') ? ['sourceRect'] : [])];
    else fail('INVALID_SCENE', `${nodePath}.kind is unsupported`);
    const data = object(item, fields, nodePath, seen);
    counter.nodes++;
    if (counter.nodes > 256) fail('SCENE_LIMIT', 'scene exceeds 256 nodes');
    const nodeId = id(data.id, `${nodePath}.id`);
    if (counter.ids.has(nodeId)) fail('INVALID_SCENE', `duplicate node ID ${nodeId}`);
    counter.ids.add(nodeId);
    const layer = number(data.layer, `${nodePath}.layer`, -1024, 1024);
    if (!Number.isInteger(layer)) fail('INVALID_SCENE', `${nodePath}.layer must be an integer`);
    const pose = transform(data.transform, `${nodePath}.transform`, seen);
    const rotated = ancestorRotated || pose.rotation !== 0;
    const base = { id: nodeId, layer, transform: pose };
    if (kind === 'group') return { kind, ...base, children: nodes(data.children, depth + 1, `${nodePath}.children`, rotated, seen, counter, version) } as Node | NodeV2 | NodeV3;
    if (kind === 'frame') {
      if (typeof data.clip !== 'boolean') fail('INVALID_SCENE', `${nodePath}.clip must be boolean`);
      if (data.clip && rotated) fail('INVALID_SCENE', `${nodePath} has unsupported rotated clip`);
      counter.vertices += 6;
      if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
      return { kind, ...base,
        width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1e6),
        height: number(data.height, `${nodePath}.height`, Number.MIN_VALUE, 1e6),
        fill: color(data.fill, `${nodePath}.fill`, seen), clip: data.clip as boolean,
        children: nodes(data.children, depth + 1, `${nodePath}.children`, rotated, seen, counter, version) } as Node | NodeV2 | NodeV3;
    }
    if (kind === 'path') {
      counter.paths++;
      if (counter.paths > 32) fail('SCENE_LIMIT', 'scene exceeds 32 paths');
      if (version >= 2) {
        const fill = !Object.hasOwn(data, 'fill') ? undefined : object(data.fill,
          ['color', 'rule'], `${nodePath}.fill`, seen);
        const stroke = !Object.hasOwn(data, 'stroke') ? undefined : object(data.stroke,
          ['color', 'width'], `${nodePath}.stroke`, seen);
        if (fill && fill.rule !== 'evenodd') fail('INVALID_SCENE', `${nodePath}.fill.rule is unsupported`);
        return { kind, ...base,
          commands: commands(data.commands, `${nodePath}.commands`, seen, !!fill),
          ...(fill ? { fill: { color: color(fill.color, `${nodePath}.fill.color`, seen), rule: 'evenodd' as const } } : {}),
          ...(stroke ? { stroke: { color: color(stroke.color, `${nodePath}.stroke.color`, seen),
            width: number(stroke.width, `${nodePath}.stroke.width`, Number.MIN_VALUE, 1000) } } : {}),
        };
      }
      return { kind, ...base,
        commands: commands(data.commands, `${nodePath}.commands`, seen),
        width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1000),
        stroke: color(data.stroke, `${nodePath}.stroke`, seen) };
    }
    if (kind === 'image') {
      counter.vertices += 6;
      if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
      if (data.sampling !== 'nearest' && data.sampling !== 'linear') {
        fail('INVALID_SCENE', `${nodePath}.sampling is unsupported`);
      }
      let sourceRect: SourceRect | undefined;
      if (Object.hasOwn(data, 'sourceRect')) {
        const rect = object(data.sourceRect, ['x', 'y', 'width', 'height'], `${nodePath}.sourceRect`, seen);
        const x = number(rect.x, `${nodePath}.sourceRect.x`, 0, 4096);
        const y = number(rect.y, `${nodePath}.sourceRect.y`, 0, 4096);
        const width = number(rect.width, `${nodePath}.sourceRect.width`, 1, 4096);
        const height = number(rect.height, `${nodePath}.sourceRect.height`, 1, 4096);
        if (![x, y, width, height].every(Number.isInteger)) fail('INVALID_SCENE', `${nodePath}.sourceRect needs integer pixels`);
        sourceRect = { x, y, width, height };
      }
      return { kind, ...base, imageId: id(data.imageId, `${nodePath}.imageId`),
        width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1e6),
        height: number(data.height, `${nodePath}.height`, Number.MIN_VALUE, 1e6),
        opacity: number(data.opacity, `${nodePath}.opacity`, 0, 1),
        sampling: data.sampling, ...(sourceRect ? { sourceRect } : {}) };
    }
    counter.vertices += 6;
    if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
    if (kind === 'rect') return { kind, ...base,
      width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1e6),
      height: number(data.height, `${nodePath}.height`, Number.MIN_VALUE, 1e6),
      fill: color(data.fill, `${nodePath}.fill`, seen) };
    const line = { kind: 'line' as const, ...base,
      x1: number(data.x1, `${nodePath}.x1`, -1e6, 1e6), y1: number(data.y1, `${nodePath}.y1`, -1e6, 1e6),
      x2: number(data.x2, `${nodePath}.x2`, -1e6, 1e6), y2: number(data.y2, `${nodePath}.y2`, -1e6, 1e6),
      width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1000),
      stroke: color(data.stroke, `${nodePath}.stroke`, seen) };
    if (line.x1 === line.x2 && line.y1 === line.y2) fail('INVALID_SCENE', `${nodePath} is a zero-length line`);
    return line;
  });
}

export function validateScene(value: unknown): Scene {
  const seen = new WeakSet<object>();
  const raw = object(value, ['version', 'unit', 'contextId', 'nodes'], 'scene', seen);
  if ((raw.version !== 0 && raw.version !== 1 && raw.version !== 2 && raw.version !== 3) || raw.unit !== 'logical-px') fail('INVALID_SCENE', 'unsupported scene version or unit');
  const version = raw.version as 0 | 1 | 2 | 3;
  const contextId = id(raw.contextId, 'scene.contextId');
  const parsedNodes = nodes(raw.nodes, 1, 'scene.nodes', false, seen,
    { nodes: 0, vertices: 0, paths: 0, ids: new Set() }, version);
  const scene: Scene = version === 0
    ? { version: 0, unit: 'logical-px', contextId, nodes: parsedNodes as OldNode[] }
    : version === 1 ? { version: 1, unit: 'logical-px', contextId, nodes: parsedNodes as Node[] }
    : version === 2 ? { version: 2, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV2[] }
    : { version: 3, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV3[] };
  if (new TextEncoder().encode(JSON.stringify(scene)).length > MAX_BYTES) fail('SCENE_LIMIT', 'scene snapshot exceeds 1 MiB');
  return scene;
}

export function parseSceneJSON(text: string): Scene {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) fail('SERIALIZATION', 'JSON input exceeds 1 MiB');
  let value: unknown;
  try { value = JSON.parse(text); } catch { fail('SERIALIZATION', 'invalid JSON'); }
  return validateScene(value);
}

export function stringifySceneJSON(scene: unknown): string { return JSON.stringify(validateScene(scene)); }

export function validateView(value: unknown): View {
  const seen = new WeakSet<object>();
  const raw = object(value, ['panX', 'panY', 'zoom'], 'view', seen, 'INVALID_VIEW');
  return { panX: number(raw.panX, 'view.panX', -1e6, 1e6, 'INVALID_VIEW'),
    panY: number(raw.panY, 'view.panY', -1e6, 1e6, 'INVALID_VIEW'),
    zoom: number(raw.zoom, 'view.zoom', 0.05, 64, 'INVALID_VIEW') };
}

export function validateSize(value: unknown, dpr: unknown): { size: Size; dpr: number; backingWidth: number; backingHeight: number } {
  const seen = new WeakSet<object>();
  const raw = object(value, ['width', 'height'], 'size', seen, 'INVALID_SIZE');
  const width = number(raw.width, 'size.width', 1, 8192, 'INVALID_SIZE');
  const height = number(raw.height, 'size.height', 1, 8192, 'INVALID_SIZE');
  if (!Number.isInteger(width) || !Number.isInteger(height)) fail('INVALID_SIZE', 'logical size must use integer pixels');
  const ratio = number(dpr, 'dpr', 0.5, 4, 'INVALID_SIZE');
  const backingWidth = Math.round(width * ratio), backingHeight = Math.round(height * ratio);
  if (backingWidth * backingHeight > 16_000_000) fail('INVALID_SIZE', 'backing pixels exceed 16 million');
  return { size: { width, height }, dpr: ratio, backingWidth, backingHeight };
}

export function validatePoint(value: unknown): Point {
  const seen = new WeakSet<object>();
  const raw = object(value, ['x', 'y'], 'point', seen);
  return { x: number(raw.x, 'point.x', -1e6, 1e6), y: number(raw.y, 'point.y', -1e6, 1e6) };
}
