import { tileSpans } from './tile.js';

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
export type Tint = [number, number, number];
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
export type PathFillV5 = { color: Color; rule: 'evenodd' | 'nonzero' };
export type PathLinearFill = { from: Point; to: Point; startColor: Color; endColor: Color };
export type PathFillV22 = PathFillV5 | { rule: 'evenodd' | 'nonzero'; linear: PathLinearFill };
export type PathRadialFill = { center: Point; radius: number; startColor: Color; endColor: Color };
export type PathFillV23 = PathFillV22 | { rule: 'evenodd' | 'nonzero'; radial: PathRadialFill };
export type PathStroke = { color: Color; width: number };
export type PathCap = 'butt' | 'square' | 'round';
export type PathStrokeV18 = PathStroke & { cap: PathCap };
export type PathJoin = 'bevel' | 'round';
export type PathStrokeV19 = PathStrokeV18 & { join: PathJoin };
export type PathDash = { lengths: number[]; offset: number };
export type PathStrokeV20 = PathStrokeV19 & { dash: PathDash };
export type PathJoinV21 = PathJoin | 'miter';
export type PathStrokeV21 = Omit<PathStrokeV20, 'join'> & { join: PathJoinV21; miterLimit: number };
export type PathNodeV2 = Base & { kind: 'path'; commands: PathCommand[]; fill?: PathFill; stroke?: PathStroke };
export type PathNodeV5 = Base & { kind: 'path'; commands: PathCommand[]; fill?: PathFillV5; stroke?: PathStroke };
export type SourceRect = { x: number; y: number; width: number; height: number };
export type HitArea = { x: number; y: number; width: number; height: number };
export type ImageNode = Base & { kind: 'image'; imageId: string; width: number; height: number;
  opacity: number; sampling: 'nearest' | 'linear'; sourceRect?: SourceRect };
export type ImageNodeV6 = ImageNode & { anchorX: number; anchorY: number };
export type ImageNodeV7 = ImageNodeV6 & { tint: Tint };
export type ImageNodeV8 = ImageNodeV7 & { blendMode: 'normal' | 'add' };
export type ImageAssetInput = { width: number; height: number; pixels: Uint8Array };
export type GroupNodeV2 = Omit<GroupNode, 'children'> & { children: NodeV2[] };
export type FrameNodeV2 = Omit<FrameNode, 'children'> & { children: NodeV2[] };
export type NodeV2 = GroupNodeV2 | FrameNodeV2 | RectNode | LineNode | PathNodeV2;
export type GroupNodeV3 = Omit<GroupNode, 'children'> & { children: NodeV3[] };
export type FrameNodeV3 = Omit<FrameNode, 'children'> & { children: NodeV3[] };
export type NodeV3 = GroupNodeV3 | FrameNodeV3 | RectNode | LineNode | PathNodeV2 | ImageNode;
export type GlyphQuad = { sourceRect: SourceRect; x: number; y: number; width: number; height: number;
  textStart: number; textEnd: number };
export type GlyphRunNode = Base & { kind: 'glyphRun'; atlasId: string; text: string; baseline: number;
  opacity: number; sampling: 'nearest' | 'linear'; glyphs: GlyphQuad[] };
export type GroupNodeV4 = Omit<GroupNode, 'children'> & { children: NodeV4[] };
export type FrameNodeV4 = Omit<FrameNode, 'children'> & { children: NodeV4[] };
export type NodeV4 = GroupNodeV4 | FrameNodeV4 | RectNode | LineNode | PathNodeV2 | ImageNode | GlyphRunNode;
export type GroupNodeV5 = Omit<GroupNode, 'children'> & { children: NodeV5[] };
export type FrameNodeV5 = Omit<FrameNode, 'children'> & { children: NodeV5[] };
export type NodeV5 = GroupNodeV5 | FrameNodeV5 | RectNode | LineNode | PathNodeV5 | ImageNode | GlyphRunNode;
export type GroupNodeV6 = Omit<GroupNode, 'children'> & { children: NodeV6[] };
export type FrameNodeV6 = Omit<FrameNode, 'children'> & { children: NodeV6[] };
export type NodeV6 = GroupNodeV6 | FrameNodeV6 | RectNode | LineNode | PathNodeV5 | ImageNodeV6 | GlyphRunNode;
export type GroupNodeV7 = Omit<GroupNode, 'children'> & { children: NodeV7[] };
export type FrameNodeV7 = Omit<FrameNode, 'children'> & { children: NodeV7[] };
export type NodeV7 = GroupNodeV7 | FrameNodeV7 | RectNode | LineNode | PathNodeV5 | ImageNodeV7 | GlyphRunNode;
export type GroupNodeV8 = Omit<GroupNode, 'children'> & { children: NodeV8[] };
export type FrameNodeV8 = Omit<FrameNode, 'children'> & { children: NodeV8[] };
export type NodeV8 = GroupNodeV8 | FrameNodeV8 | RectNode | LineNode | PathNodeV5 | ImageNodeV8 | GlyphRunNode;
type Visible<T> = T & { visible: boolean };
export type GroupNodeV9 = Visible<Omit<GroupNode, 'children'> & { children: NodeV9[] }>;
export type FrameNodeV9 = Visible<Omit<FrameNode, 'children'> & { children: NodeV9[] }>;
export type RectNodeV9 = Visible<RectNode>;
export type LineNodeV9 = Visible<LineNode>;
export type PathNodeV9 = Visible<PathNodeV5>;
export type ImageNodeV9 = Visible<ImageNodeV8>;
export type GlyphRunNodeV9 = Visible<GlyphRunNode>;
export type NodeV9 = GroupNodeV9 | FrameNodeV9 | RectNodeV9 | LineNodeV9 | PathNodeV9 | ImageNodeV9 | GlyphRunNodeV9;
type WithAlpha<T> = T & { alpha: number };
export type GroupNodeV10 = WithAlpha<Omit<GroupNodeV9, 'children'> & { children: NodeV10[] }>;
export type FrameNodeV10 = WithAlpha<Omit<FrameNodeV9, 'children'> & { children: NodeV10[] }>;
export type RectNodeV10 = WithAlpha<RectNodeV9>;
export type LineNodeV10 = WithAlpha<LineNodeV9>;
export type PathNodeV10 = WithAlpha<PathNodeV9>;
export type ImageNodeV10 = WithAlpha<ImageNodeV9>;
export type GlyphRunNodeV10 = WithAlpha<GlyphRunNodeV9>;
export type NodeV10 = GroupNodeV10 | FrameNodeV10 | RectNodeV10 | LineNodeV10 | PathNodeV10 | ImageNodeV10 | GlyphRunNodeV10;
export type HitMode = 'auto' | 'none';
type WithHitMode<T> = T & { hitMode: HitMode };
export type GroupNodeV11 = WithHitMode<Omit<GroupNodeV10, 'children'> & { children: NodeV11[] }>;
export type FrameNodeV11 = WithHitMode<Omit<FrameNodeV10, 'children'> & { children: NodeV11[] }>;
export type RectNodeV11 = WithHitMode<RectNodeV10>;
export type LineNodeV11 = WithHitMode<LineNodeV10>;
export type PathNodeV11 = WithHitMode<PathNodeV10>;
export type ImageNodeV11 = WithHitMode<ImageNodeV10>;
export type GlyphRunNodeV11 = WithHitMode<GlyphRunNodeV10>;
export type NodeV11 = GroupNodeV11 | FrameNodeV11 | RectNodeV11 | LineNodeV11 | PathNodeV11 | ImageNodeV11 | GlyphRunNodeV11;
export type NineSliceInsets = { left: number; right: number; top: number; bottom: number };
export type TilePattern = { width: number; height: number; offsetX: number; offsetY: number };
export type GroupNodeV12 = Omit<GroupNodeV11, 'children'> & { children: NodeV12[] };
export type FrameNodeV12 = Omit<FrameNodeV11, 'children'> & { children: NodeV12[] };
export type ImageNodeV12 = ImageNodeV11 & { slice?: NineSliceInsets };
export type NodeV12 = GroupNodeV12 | FrameNodeV12 | RectNodeV11 | LineNodeV11 | PathNodeV11 | ImageNodeV12 | GlyphRunNodeV11;
export type GroupNodeV13 = Omit<GroupNodeV12, 'children'> & { children: NodeV13[] };
export type FrameNodeV13 = Omit<FrameNodeV12, 'children'> & { children: NodeV13[] };
export type ImageNodeV13 = ImageNodeV12 & { tile?: TilePattern };
export type NodeV13 = GroupNodeV13 | FrameNodeV13 | RectNodeV11 | LineNodeV11 | PathNodeV11 | ImageNodeV13 | GlyphRunNodeV11;
type WithPivot<T> = T & { pivot?: Point };
export type GroupNodeV14 = WithPivot<Omit<GroupNodeV13, 'children'> & { children: NodeV14[] }>;
export type FrameNodeV14 = WithPivot<Omit<FrameNodeV13, 'children'> & { children: NodeV14[] }>;
export type RectNodeV14 = WithPivot<RectNodeV11>;
export type LineNodeV14 = WithPivot<LineNodeV11>;
export type PathNodeV14 = WithPivot<PathNodeV11>;
export type ImageNodeV14 = WithPivot<ImageNodeV13>;
export type GlyphRunNodeV14 = WithPivot<GlyphRunNodeV11>;
export type NodeV14 = GroupNodeV14 | FrameNodeV14 | RectNodeV14 | LineNodeV14 | PathNodeV14 | ImageNodeV14 | GlyphRunNodeV14;
export type GroupNodeV15 = Omit<GroupNodeV14, 'children'> & { children: NodeV15[] };
export type FrameNodeV15 = Omit<FrameNodeV14, 'children'> & { children: NodeV15[] };
export type NodeV15 = GroupNodeV15 | FrameNodeV15 | RectNodeV14 | LineNodeV14 | PathNodeV14 | ImageNodeV14 | GlyphRunNodeV14;
export type GroupNodeV16 = Omit<GroupNodeV15, 'children'> & { children: NodeV16[] };
export type FrameNodeV16 = Omit<FrameNodeV15, 'children'> & { children: NodeV16[] };
export type ImageNodeV16 = ImageNodeV14 & { hitArea?: HitArea };
export type NodeV16 = GroupNodeV16 | FrameNodeV16 | RectNodeV14 | LineNodeV14 | PathNodeV14 | ImageNodeV16 | GlyphRunNodeV14;
export type GroupNodeV17 = Omit<GroupNodeV16, 'children'> & { hitArea?: HitArea; children: NodeV17[] };
export type FrameNodeV17 = Omit<FrameNodeV16, 'children'> & { children: NodeV17[] };
export type NodeV17 = GroupNodeV17 | FrameNodeV17 | RectNodeV14 | LineNodeV14 | PathNodeV14 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV18 = Omit<PathNodeV14, 'stroke'> & { stroke?: PathStrokeV18 };
export type GroupNodeV18 = Omit<GroupNodeV17, 'children'> & { children: NodeV18[] };
export type FrameNodeV18 = Omit<FrameNodeV17, 'children'> & { children: NodeV18[] };
export type NodeV18 = GroupNodeV18 | FrameNodeV18 | RectNodeV14 | LineNodeV14 | PathNodeV18 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV19 = Omit<PathNodeV14, 'stroke'> & { stroke?: PathStrokeV19 };
export type GroupNodeV19 = Omit<GroupNodeV18, 'children'> & { children: NodeV19[] };
export type FrameNodeV19 = Omit<FrameNodeV18, 'children'> & { children: NodeV19[] };
export type NodeV19 = GroupNodeV19 | FrameNodeV19 | RectNodeV14 | LineNodeV14 | PathNodeV19 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV20 = Omit<PathNodeV14, 'stroke'> & { stroke?: PathStrokeV20 };
export type GroupNodeV20 = Omit<GroupNodeV19, 'children'> & { children: NodeV20[] };
export type FrameNodeV20 = Omit<FrameNodeV19, 'children'> & { children: NodeV20[] };
export type NodeV20 = GroupNodeV20 | FrameNodeV20 | RectNodeV14 | LineNodeV14 | PathNodeV20 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV21 = Omit<PathNodeV14, 'stroke'> & { stroke?: PathStrokeV21 };
export type GroupNodeV21 = Omit<GroupNodeV20, 'children'> & { children: NodeV21[] };
export type FrameNodeV21 = Omit<FrameNodeV20, 'children'> & { children: NodeV21[] };
export type NodeV21 = GroupNodeV21 | FrameNodeV21 | RectNodeV14 | LineNodeV14 | PathNodeV21 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV22 = Omit<PathNodeV21, 'fill'> & { fill?: PathFillV22 };
export type GroupNodeV22 = Omit<GroupNodeV21, 'children'> & { children: NodeV22[] };
export type FrameNodeV22 = Omit<FrameNodeV21, 'children'> & { children: NodeV22[] };
export type NodeV22 = GroupNodeV22 | FrameNodeV22 | RectNodeV14 | LineNodeV14 | PathNodeV22 | ImageNodeV16 | GlyphRunNodeV14;
export type PathNodeV23 = Omit<PathNodeV22, 'fill'> & { fill?: PathFillV23 };
export type GroupNodeV23 = Omit<GroupNodeV22, 'children'> & { children: NodeV23[] };
export type FrameNodeV23 = Omit<FrameNodeV22, 'children'> & { children: NodeV23[] };
export type NodeV23 = GroupNodeV23 | FrameNodeV23 | RectNodeV14 | LineNodeV14 | PathNodeV23 | ImageNodeV16 | GlyphRunNodeV14;
export type OldGroupNode = Omit<GroupNode, 'children'> & { children: OldNode[] };
export type OldFrameNode = Omit<FrameNode, 'children'> & { children: OldNode[] };
export type OldNode = OldGroupNode | OldFrameNode | RectNode | LineNode;
export type SceneV0 = { version: 0; unit: 'logical-px'; contextId: string; nodes: OldNode[] };
export type SceneV1 = { version: 1; unit: 'logical-px'; contextId: string; nodes: Node[] };
export type SceneV2 = { version: 2; unit: 'logical-px'; contextId: string; nodes: NodeV2[] };
export type SceneV3 = { version: 3; unit: 'logical-px'; contextId: string; nodes: NodeV3[] };
export type SceneV4 = { version: 4; unit: 'logical-px'; contextId: string; nodes: NodeV4[] };
export type SceneV5 = { version: 5; unit: 'logical-px'; contextId: string; nodes: NodeV5[] };
export type SceneV6 = { version: 6; unit: 'logical-px'; contextId: string; nodes: NodeV6[] };
export type SceneV7 = { version: 7; unit: 'logical-px'; contextId: string; nodes: NodeV7[] };
export type SceneV8 = { version: 8; unit: 'logical-px'; contextId: string; nodes: NodeV8[] };
export type SceneV9 = { version: 9; unit: 'logical-px'; contextId: string; nodes: NodeV9[] };
export type SceneV10 = { version: 10; unit: 'logical-px'; contextId: string; nodes: NodeV10[] };
export type SceneV11 = { version: 11; unit: 'logical-px'; contextId: string; nodes: NodeV11[] };
export type SceneV12 = { version: 12; unit: 'logical-px'; contextId: string; nodes: NodeV12[] };
export type SceneV13 = { version: 13; unit: 'logical-px'; contextId: string; nodes: NodeV13[] };
export type SceneV14 = { version: 14; unit: 'logical-px'; contextId: string; nodes: NodeV14[] };
export type SceneV15 = { version: 15; unit: 'logical-px'; contextId: string; nodes: NodeV15[] };
export type SceneV16 = { version: 16; unit: 'logical-px'; contextId: string; nodes: NodeV16[] };
export type SceneV17 = { version: 17; unit: 'logical-px'; contextId: string; nodes: NodeV17[] };
export type SceneV18 = { version: 18; unit: 'logical-px'; contextId: string; nodes: NodeV18[] };
export type SceneV19 = { version: 19; unit: 'logical-px'; contextId: string; nodes: NodeV19[] };
export type SceneV20 = { version: 20; unit: 'logical-px'; contextId: string; nodes: NodeV20[] };
export type SceneV21 = { version: 21; unit: 'logical-px'; contextId: string; nodes: NodeV21[] };
export type SceneV22 = { version: 22; unit: 'logical-px'; contextId: string; nodes: NodeV22[] };
export type SceneV23 = { version: 23; unit: 'logical-px'; contextId: string; nodes: NodeV23[] };
export type Scene = SceneV0 | SceneV1 | SceneV2 | SceneV3 | SceneV4 | SceneV5 | SceneV6 | SceneV7 | SceneV8 | SceneV9 | SceneV10 | SceneV11 | SceneV12 | SceneV13 | SceneV14 | SceneV15 | SceneV16 | SceneV17 | SceneV18 | SceneV19 | SceneV20 | SceneV21 | SceneV22 | SceneV23;

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

function pathDash(value: unknown, path: string, seen: WeakSet<object>): PathDash {
  const raw = object(value, ['lengths', 'offset'], path, seen);
  const values = array(raw.lengths, `${path}.lengths`, seen);
  if (values.length !== 0 && (values.length < 2 || values.length > 8 || values.length % 2 !== 0)) {
    fail('INVALID_SCENE', `${path}.lengths must have an even 2–8 entries`);
  }
  const lengths = values.map((item, index) => number(item, `${path}.lengths[${index}]`, 0.25, 1000));
  if (lengths.reduce((sum, length) => sum + length, 0) > 4096) {
    fail('INVALID_SCENE', `${path}.lengths period exceeds 4096`);
  }
  const offset = number(raw.offset, `${path}.offset`, -4096, 4096);
  if (lengths.length === 0 && offset !== 0) fail('INVALID_SCENE', `${path}.offset needs a pattern`);
  return { lengths, offset };
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

function transform(value: unknown, path: string, seen: WeakSet<object>, version: number): Transform {
  const raw = object(value, ['x', 'y', 'scaleX', 'scaleY', 'rotation'], path, seen);
  const signedScale = (value: unknown, key: string): number => {
    const scale = number(value, `${path}.${key}`, -100, 100);
    if (Math.abs(scale) < 0.01) fail('INVALID_SCENE', `${path}.${key} magnitude must be at least 0.01`);
    return scale;
  };
  return {
    x: number(raw.x, `${path}.x`, -1e6, 1e6), y: number(raw.y, `${path}.y`, -1e6, 1e6),
    scaleX: version >= 15 ? signedScale(raw.scaleX, 'scaleX') : number(raw.scaleX, `${path}.scaleX`, 0.01, 100),
    scaleY: version >= 15 ? signedScale(raw.scaleY, 'scaleY') : number(raw.scaleY, `${path}.scaleY`, 0.01, 100),
    rotation: number(raw.rotation, `${path}.rotation`, -2 * Math.PI, 2 * Math.PI),
  };
}

function color(value: unknown, path: string, seen: WeakSet<object>): Color {
  const raw = array(value, path, seen);
  if (raw.length !== 4) fail('INVALID_SCENE', `${path} must have four components`);
  return raw.map((component, index) => number(component, `${path}[${index}]`, 0, 1)) as Color;
}

function linearFill(value: unknown, path: string, seen: WeakSet<object>): PathLinearFill {
  const raw = object(value, ['from', 'to', 'startColor', 'endColor'], path, seen);
  const from = object(raw.from, ['x', 'y'], `${path}.from`, seen);
  const to = object(raw.to, ['x', 'y'], `${path}.to`, seen);
  const start = { x: number(from.x, `${path}.from.x`, -1e6, 1e6),
    y: number(from.y, `${path}.from.y`, -1e6, 1e6) };
  const end = { x: number(to.x, `${path}.to.x`, -1e6, 1e6),
    y: number(to.y, `${path}.to.y`, -1e6, 1e6) };
  if (Math.hypot(end.x - start.x, end.y - start.y) < 0.001) {
    fail('INVALID_SCENE', `${path} endpoints are too close`);
  }
  return { from: start, to: end,
    startColor: color(raw.startColor, `${path}.startColor`, seen),
    endColor: color(raw.endColor, `${path}.endColor`, seen) };
}

function radialFill(value: unknown, path: string, seen: WeakSet<object>): PathRadialFill {
  const raw = object(value, ['center', 'radius', 'startColor', 'endColor'], path, seen);
  const center = object(raw.center, ['x', 'y'], `${path}.center`, seen);
  return { center: { x: number(center.x, `${path}.center.x`, -1e6, 1e6),
    y: number(center.y, `${path}.center.y`, -1e6, 1e6) },
  radius: number(raw.radius, `${path}.radius`, 0.001, 1e6),
  startColor: color(raw.startColor, `${path}.startColor`, seen),
  endColor: color(raw.endColor, `${path}.endColor`, seen) };
}

function tint(value: unknown, path: string, seen: WeakSet<object>): Tint {
  const raw = array(value, path, seen);
  if (raw.length !== 3) fail('INVALID_SCENE', `${path} must have three components`);
  return raw.map((component, index) => number(component, `${path}[${index}]`, 0, 1)) as Tint;
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

function sourcePixels(value: unknown, path: string, seen: WeakSet<object>): SourceRect {
  const rect = object(value, ['x', 'y', 'width', 'height'], path, seen);
  const x = number(rect.x, `${path}.x`, 0, 4096);
  const y = number(rect.y, `${path}.y`, 0, 4096);
  const width = number(rect.width, `${path}.width`, 1, 4096);
  const height = number(rect.height, `${path}.height`, 1, 4096);
  if (![x, y, width, height].every(Number.isInteger)) fail('INVALID_SCENE', `${path} needs integer pixels`);
  return { x, y, width, height };
}

function nineSliceInsets(value: unknown, path: string, seen: WeakSet<object>): NineSliceInsets {
  const raw = object(value, ['left', 'right', 'top', 'bottom'], path, seen);
  const inset = (key: keyof NineSliceInsets): number => {
    const result = number(raw[key], `${path}.${key}`, 0, 4096);
    if (!Number.isSafeInteger(result)) fail('INVALID_SCENE', `${path}.${key} must be an integer pixel count`);
    return result;
  };
  return { left: inset('left'), right: inset('right'), top: inset('top'), bottom: inset('bottom') };
}

function tilePattern(value: unknown, path: string, seen: WeakSet<object>): TilePattern {
  const raw = object(value, ['width', 'height', 'offsetX', 'offsetY'], path, seen);
  return {
    width: number(raw.width, `${path}.width`, 1, 4096),
    height: number(raw.height, `${path}.height`, 1, 4096),
    offsetX: number(raw.offsetX, `${path}.offsetX`, -1e6, 1e6),
    offsetY: number(raw.offsetY, `${path}.offsetY`, -1e6, 1e6),
  };
}

function interactionRect(value: unknown, path: string, seen: WeakSet<object>): HitArea {
  const raw = object(value, ['x', 'y', 'width', 'height'], path, seen);
  return {
    x: number(raw.x, `${path}.x`, -1e6, 1e6),
    y: number(raw.y, `${path}.y`, -1e6, 1e6),
    width: number(raw.width, `${path}.width`, Number.MIN_VALUE, 1e6),
    height: number(raw.height, `${path}.height`, Number.MIN_VALUE, 1e6),
  };
}

function validText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) {
    fail('INVALID_SCENE', `${path} needs 1..512 UTF-16 units`);
  }
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('INVALID_SCENE', `${path} has an unpaired surrogate`);
    } else if (unit >= 0xdc00 && unit <= 0xdfff) fail('INVALID_SCENE', `${path} has an unpaired surrogate`);
  }
  return value;
}

type Counter = { nodes: number; vertices: number; paths: number; glyphRuns: number; ids: Set<string> };
function nodes(value: unknown, depth: number, path: string, ancestorRotated: boolean,
  seen: WeakSet<object>, counter: Counter, version: Scene['version']): (Node | NodeV2 | NodeV3 | NodeV4 | NodeV5 | NodeV6 | NodeV7 | NodeV8 | NodeV9 | NodeV10 | NodeV11 | NodeV12 | NodeV13 | NodeV14 | NodeV15 | NodeV16 | NodeV17 | NodeV18 | NodeV19 | NodeV20 | NodeV21 | NodeV22 | NodeV23)[] {
  if (depth > 16) fail('SCENE_LIMIT', 'scene depth exceeds 16');
  const raw = array(value, path, seen);
  if (raw.length > 256) fail('SCENE_LIMIT', 'scene has too many siblings');
  return raw.map((item, index): Node | NodeV2 | NodeV3 | NodeV4 | NodeV5 | NodeV6 | NodeV7 | NodeV8 | NodeV9 | NodeV10 | NodeV11 | NodeV12 | NodeV13 | NodeV14 | NodeV15 | NodeV16 | NodeV17 | NodeV18 | NodeV19 | NodeV20 | NodeV21 | NodeV22 | NodeV23 => {
    const nodePath = `${path}[${index}]`;
    if (item === null || typeof item !== 'object') fail('INVALID_SCENE', `${nodePath} must be a node`);
    const kindDescriptor = Object.getOwnPropertyDescriptor(item, 'kind');
    if (!kindDescriptor || !('value' in kindDescriptor)) fail('INVALID_SCENE', `${nodePath}.kind is invalid`);
    const kind = kindDescriptor.value;
    const common = ['kind', 'id', 'layer', 'transform', ...(version >= 9 ? ['visible'] : []),
      ...(version >= 10 ? ['alpha'] : []), ...(version >= 11 ? ['hitMode'] : []),
      ...(version >= 14 && Object.hasOwn(item, 'pivot') ? ['pivot'] : [])];
    let fields: string[];
    if (kind === 'group') fields = [...common, 'children',
      ...(version >= 17 && Object.hasOwn(item, 'hitArea') ? ['hitArea'] : [])];
    else if (kind === 'frame') fields = [...common, 'width', 'height', 'fill', 'clip', 'children'];
    else if (kind === 'rect') fields = [...common, 'width', 'height', 'fill'];
    else if (kind === 'line') fields = [...common, 'x1', 'y1', 'x2', 'y2', 'width', 'stroke'];
    else if (kind === 'path' && version === 1) fields = [...common, 'commands', 'width', 'stroke'];
    else if (kind === 'path' && version >= 2) {
      const hasFill = Object.hasOwn(item, 'fill'), hasStroke = Object.hasOwn(item, 'stroke');
      if (!hasFill && !hasStroke) fail('INVALID_SCENE', `${nodePath} needs fill or stroke`);
      fields = [...common, 'commands', ...(hasFill ? ['fill'] : []), ...(hasStroke ? ['stroke'] : [])];
    }
    else if (kind === 'image' && version >= 3) fields = [...common, 'imageId', 'width', 'height',
      'opacity', 'sampling', ...(version >= 6 ? ['anchorX', 'anchorY'] : []), ...(version >= 7 ? ['tint'] : []),
      ...(version >= 8 ? ['blendMode'] : []),
      ...(Object.hasOwn(item, 'sourceRect') ? ['sourceRect'] : []),
      ...(version >= 12 && Object.hasOwn(item, 'slice') ? ['slice'] : []),
      ...(version >= 13 && Object.hasOwn(item, 'tile') ? ['tile'] : []),
      ...(version >= 16 && Object.hasOwn(item, 'hitArea') ? ['hitArea'] : [])];
    else if (kind === 'glyphRun' && version >= 4) fields = [...common, 'atlasId', 'text', 'baseline',
      'opacity', 'sampling', 'glyphs'];
    else fail('INVALID_SCENE', `${nodePath}.kind is unsupported`);
    const data = object(item, fields, nodePath, seen);
    counter.nodes++;
    if (counter.nodes > 256) fail('SCENE_LIMIT', 'scene exceeds 256 nodes');
    const nodeId = id(data.id, `${nodePath}.id`);
    if (counter.ids.has(nodeId)) fail('INVALID_SCENE', `duplicate node ID ${nodeId}`);
    counter.ids.add(nodeId);
    const layer = number(data.layer, `${nodePath}.layer`, -1024, 1024);
    if (!Number.isInteger(layer)) fail('INVALID_SCENE', `${nodePath}.layer must be an integer`);
    const pose = transform(data.transform, `${nodePath}.transform`, seen, version);
    const rotated = ancestorRotated || pose.rotation !== 0;
    if (version >= 9 && typeof data.visible !== 'boolean') fail('INVALID_SCENE', `${nodePath}.visible must be boolean`);
    if (version >= 11 && data.hitMode !== 'auto' && data.hitMode !== 'none') {
      fail('INVALID_SCENE', `${nodePath}.hitMode is unsupported`);
    }
    const pivot = version >= 14 && Object.hasOwn(data, 'pivot')
      ? object(data.pivot, ['x', 'y'], `${nodePath}.pivot`, seen) : null;
    const base = { id: nodeId, layer, transform: pose,
      ...(version >= 9 ? { visible: data.visible as boolean } : {}),
      ...(version >= 10 ? { alpha: number(data.alpha, `${nodePath}.alpha`, 0, 1) } : {}),
      ...(version >= 11 ? { hitMode: data.hitMode as HitMode } : {}),
      ...(pivot ? { pivot: { x: number(pivot.x, `${nodePath}.pivot.x`, -1e6, 1e6),
        y: number(pivot.y, `${nodePath}.pivot.y`, -1e6, 1e6) } } : {}) };
    if (kind === 'group') return { kind, ...base,
      ...(Object.hasOwn(data, 'hitArea') ? { hitArea: interactionRect(data.hitArea, `${nodePath}.hitArea`, seen) } : {}),
      children: nodes(data.children, depth + 1, `${nodePath}.children`, rotated, seen, counter, version) } as NodeV18;
    if (kind === 'frame') {
      if (typeof data.clip !== 'boolean') fail('INVALID_SCENE', `${nodePath}.clip must be boolean`);
      if (data.clip && rotated) fail('INVALID_SCENE', `${nodePath} has unsupported rotated clip`);
      counter.vertices += 6;
      if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
      return { kind, ...base,
        width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1e6),
        height: number(data.height, `${nodePath}.height`, Number.MIN_VALUE, 1e6),
        fill: color(data.fill, `${nodePath}.fill`, seen), clip: data.clip as boolean,
        children: nodes(data.children, depth + 1, `${nodePath}.children`, rotated, seen, counter, version) } as Node | NodeV2 | NodeV3 | NodeV4 | NodeV5 | NodeV6 | NodeV7 | NodeV8 | NodeV9 | NodeV10 | NodeV11 | NodeV12;
    }
    if (kind === 'path') {
      counter.paths++;
      if (counter.paths > 32) fail('SCENE_LIMIT', 'scene exceeds 32 paths');
      if (version >= 2) {
        const fill = !Object.hasOwn(data, 'fill') ? undefined : object(data.fill,
          version >= 23 && data.fill !== null && typeof data.fill === 'object' && Object.hasOwn(data.fill, 'radial')
            ? ['radial', 'rule'] : version >= 22 && data.fill !== null && typeof data.fill === 'object' && Object.hasOwn(data.fill, 'linear')
              ? ['linear', 'rule'] : ['color', 'rule'], `${nodePath}.fill`, seen);
        const stroke = !Object.hasOwn(data, 'stroke') ? undefined : object(data.stroke,
          version >= 21 ? ['color', 'width', 'cap', 'join', 'dash', 'miterLimit'] : version >= 20 ? ['color', 'width', 'cap', 'join', 'dash'] : version >= 19 ? ['color', 'width', 'cap', 'join'] : version >= 18 ? ['color', 'width', 'cap'] : ['color', 'width'], `${nodePath}.stroke`, seen);
        if (fill && fill.rule !== 'evenodd' && !(version >= 5 && fill.rule === 'nonzero')) {
          fail('INVALID_SCENE', `${nodePath}.fill.rule is unsupported`);
        }
        return { kind, ...base,
          commands: commands(data.commands, `${nodePath}.commands`, seen, !!fill),
          ...(fill ? { fill: Object.hasOwn(fill, 'radial')
            ? { radial: radialFill(fill.radial, `${nodePath}.fill.radial`, seen),
              rule: fill.rule as 'evenodd' | 'nonzero' }
            : Object.hasOwn(fill, 'linear')
              ? { linear: linearFill(fill.linear, `${nodePath}.fill.linear`, seen),
                rule: fill.rule as 'evenodd' | 'nonzero' }
              : { color: color(fill.color, `${nodePath}.fill.color`, seen),
                rule: fill.rule as 'evenodd' | 'nonzero' } } : {}),
          ...(stroke ? { stroke: { color: color(stroke.color, `${nodePath}.stroke.color`, seen),
            width: number(stroke.width, `${nodePath}.stroke.width`, Number.MIN_VALUE, 1000),
            ...(version >= 18 ? { cap: stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round'
              ? stroke.cap : fail('INVALID_SCENE', `${nodePath}.stroke.cap is unsupported`) } : {}),
            ...(version >= 19 ? { join: stroke.join === 'bevel' || stroke.join === 'round' || (version >= 21 && stroke.join === 'miter')
              ? stroke.join : fail('INVALID_SCENE', `${nodePath}.stroke.join is unsupported`) } : {}),
            ...(version >= 20 ? { dash: pathDash(stroke.dash, `${nodePath}.stroke.dash`, seen) } : {}),
            ...(version >= 21 ? { miterLimit: number(stroke.miterLimit, `${nodePath}.stroke.miterLimit`, 1, 16) } : {}) } } : {}),
        } as PathNodeV23;
      }
      return { kind, ...base,
        commands: commands(data.commands, `${nodePath}.commands`, seen),
        width: number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1000),
        stroke: color(data.stroke, `${nodePath}.stroke`, seen) };
    }
    if (kind === 'image') {
      if (data.sampling !== 'nearest' && data.sampling !== 'linear') {
        fail('INVALID_SCENE', `${nodePath}.sampling is unsupported`);
      }
      if (version >= 8 && data.blendMode !== 'normal' && data.blendMode !== 'add') {
        fail('INVALID_SCENE', `${nodePath}.blendMode is unsupported`);
      }
      const sourceRect = Object.hasOwn(data, 'sourceRect')
        ? sourcePixels(data.sourceRect, `${nodePath}.sourceRect`, seen) : undefined;
      const width = number(data.width, `${nodePath}.width`, Number.MIN_VALUE, 1e6);
      const height = number(data.height, `${nodePath}.height`, Number.MIN_VALUE, 1e6);
      const slice = Object.hasOwn(data, 'slice')
        ? nineSliceInsets(data.slice, `${nodePath}.slice`, seen) : undefined;
      const tile = Object.hasOwn(data, 'tile')
        ? tilePattern(data.tile, `${nodePath}.tile`, seen) : undefined;
      const hitArea = Object.hasOwn(data, 'hitArea')
        ? interactionRect(data.hitArea, `${nodePath}.hitArea`, seen) : undefined;
      if (slice && (!sourceRect || slice.left + slice.right >= sourceRect.width ||
          slice.top + slice.bottom >= sourceRect.height ||
          slice.left + slice.right >= width || slice.top + slice.bottom >= height)) {
        fail('INVALID_SCENE', `${nodePath}.slice needs positive source and destination centers and an explicit crop`);
      }
      if (tile && (!sourceRect || slice)) {
        fail('INVALID_SCENE', `${nodePath}.tile needs an explicit crop and excludes slice`);
      }
      const columns = tile ? tileSpans(width, tile.width, tile.offsetX) : null;
      const rows = tile ? tileSpans(height, tile.height, tile.offsetY) : null;
      if (tile && (!columns || !rows || columns.length * rows.length > 2730)) {
        fail('SCENE_LIMIT', `${nodePath}.tile exceeds the scene vertex limit`);
      }
      counter.vertices += tile ? 6 * columns!.length * rows!.length : slice
        ? 6 * (1 + Number(slice.left > 0) + Number(slice.right > 0)) *
          (1 + Number(slice.top > 0) + Number(slice.bottom > 0)) : 6;
      if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
      return { kind, ...base, imageId: id(data.imageId, `${nodePath}.imageId`),
        width, height,
        opacity: number(data.opacity, `${nodePath}.opacity`, 0, 1),
        sampling: data.sampling,
        ...(version >= 6 ? {
          anchorX: number(data.anchorX, `${nodePath}.anchorX`, 0, 1),
          anchorY: number(data.anchorY, `${nodePath}.anchorY`, 0, 1),
        } : {}), ...(version >= 7 ? { tint: tint(data.tint, `${nodePath}.tint`, seen) } : {}),
        ...(version >= 8 ? { blendMode: data.blendMode as 'normal' | 'add' } : {}),
        ...(sourceRect ? { sourceRect } : {}), ...(slice ? { slice } : {}), ...(tile ? { tile } : {}),
        ...(hitArea ? { hitArea } : {}) };
    }
    if (kind === 'glyphRun') {
      if (++counter.glyphRuns > 32) fail('SCENE_LIMIT', 'scene exceeds 32 glyph runs');
      if (data.sampling !== 'nearest' && data.sampling !== 'linear') {
        fail('INVALID_SCENE', `${nodePath}.sampling is unsupported`);
      }
      const text = validText(data.text, `${nodePath}.text`);
      const rawGlyphs = array(data.glyphs, `${nodePath}.glyphs`, seen);
      if (rawGlyphs.length < 1 || rawGlyphs.length > 64) fail('SCENE_LIMIT', `${nodePath}.glyphs needs 1..64 items`);
      counter.vertices += rawGlyphs.length * 6;
      if (counter.vertices > 16384) fail('SCENE_LIMIT', 'scene geometry exceeds vertex limit');
      const glyphs = rawGlyphs.map((item, index): GlyphQuad => {
        const path = `${nodePath}.glyphs[${index}]`;
        const glyph = object(item, ['sourceRect', 'x', 'y', 'width', 'height', 'textStart', 'textEnd'], path, seen);
        const textStart = number(glyph.textStart, `${path}.textStart`, 0, text.length - 1);
        const textEnd = number(glyph.textEnd, `${path}.textEnd`, 1, text.length);
        if (!Number.isInteger(textStart) || !Number.isInteger(textEnd) || textStart >= textEnd ||
            (textStart > 0 && /[\uD800-\uDBFF]/.test(text[textStart - 1])) ||
            (textEnd < text.length && /[\uD800-\uDBFF]/.test(text[textEnd - 1]))) {
          fail('INVALID_SCENE', `${path} needs scalar-boundary text offsets`);
        }
        return { sourceRect: sourcePixels(glyph.sourceRect, `${path}.sourceRect`, seen),
          x: number(glyph.x, `${path}.x`, -1e6, 1e6), y: number(glyph.y, `${path}.y`, -1e6, 1e6),
          width: number(glyph.width, `${path}.width`, Number.MIN_VALUE, 1e6),
          height: number(glyph.height, `${path}.height`, Number.MIN_VALUE, 1e6), textStart, textEnd };
      });
      return { kind, ...base, atlasId: id(data.atlasId, `${nodePath}.atlasId`), text,
        baseline: number(data.baseline, `${nodePath}.baseline`, -1e6, 1e6),
        opacity: number(data.opacity, `${nodePath}.opacity`, 0, 1), sampling: data.sampling, glyphs };
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
  if ((!Number.isInteger(raw.version) || (raw.version as number) < 0 || (raw.version as number) > 23) || raw.unit !== 'logical-px') fail('INVALID_SCENE', 'unsupported scene version or unit');
  const version = raw.version as Scene['version'];
  const contextId = id(raw.contextId, 'scene.contextId');
  const parsedNodes = nodes(raw.nodes, 1, 'scene.nodes', false, seen,
    { nodes: 0, vertices: 0, paths: 0, glyphRuns: 0, ids: new Set() }, version);
  const scene: Scene = version === 0
    ? { version: 0, unit: 'logical-px', contextId, nodes: parsedNodes as OldNode[] }
    : version === 1 ? { version: 1, unit: 'logical-px', contextId, nodes: parsedNodes as Node[] }
    : version === 2 ? { version: 2, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV2[] }
    : version === 3 ? { version: 3, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV3[] }
    : version === 4 ? { version: 4, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV4[] }
    : version === 5 ? { version: 5, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV5[] }
    : version === 6 ? { version: 6, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV6[] }
    : version === 7 ? { version: 7, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV7[] }
    : version === 8 ? { version: 8, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV8[] }
    : version === 9 ? { version: 9, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV9[] }
    : version === 10 ? { version: 10, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV10[] }
    : version === 11 ? { version: 11, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV11[] }
    : version === 12 ? { version: 12, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV12[] }
    : version === 13 ? { version: 13, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV13[] }
    : version === 14 ? { version: 14, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV14[] }
    : version === 15 ? { version: 15, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV15[] }
    : version === 16 ? { version: 16, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV16[] }
    : version === 17 ? { version: 17, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV17[] }
    : version === 18 ? { version: 18, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV18[] }
    : version === 19 ? { version: 19, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV19[] }
    : version === 20 ? { version: 20, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV20[] }
    : version === 21 ? { version: 21, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV21[] }
    : version === 22 ? { version: 22, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV22[] }
    : { version: 23, unit: 'logical-px', contextId, nodes: parsedNodes as NodeV23[] };
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
