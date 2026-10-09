import { Canvas2DError } from './schema.js';
import type { PathCommand, Point, View } from './schema.js';

export type PolygonMask = { commands: PathCommand[] };
export type PolygonMaskMatrix = readonly [number, number, number, number, number, number];
type MaskError = 'INVALID_SCENE' | 'UNSUPPORTED_FEATURE' | 'SCENE_LIMIT';

function fail(code: MaskError, message: string): never { throw new Canvas2DError(code, message); }
function record(value: unknown, keys: string[], seen: WeakSet<object>): Record<string, unknown> {
  if (!value || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) || seen.has(value)) {
    fail('INVALID_SCENE', 'polygon mask needs distinct plain data records');
  }
  seen.add(value);
  const fields = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
    fail('INVALID_SCENE', 'polygon mask has unknown or missing fields');
  }
  const copied: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field?.enumerable || !('value' in field)) fail('INVALID_SCENE', 'polygon mask needs own data fields');
    copied[key] = field.value;
  }
  return copied;
}
function coordinate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > 1e6) {
    fail('INVALID_SCENE', 'polygon mask coordinate exceeds the finite local range');
  }
  return value;
}
function cross(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function same(a: Point, b: Point): boolean { return a.x === b.x && a.y === b.y; }
function onSegment(a: Point, b: Point, p: Point): boolean {
  return cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}
function edgesMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC === 0 && onSegment(a, b, c)) || (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) || (cdB === 0 && onSegment(c, d, b)) ||
    (abC * abD < 0 && cdA * cdB < 0);
}
function topology(points: Point[], transformed: boolean): void {
  const invalid: MaskError = transformed ? 'SCENE_LIMIT' : 'INVALID_SCENE';
  const unsupported: MaskError = transformed ? 'SCENE_LIMIT' : 'UNSUPPORTED_FEATURE';
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (same(points[i], points[j])) fail(invalid, 'polygon mask has repeated or collapsed vertices');
  }
  if (points.slice(2).every(p => cross(points[0], points[1], p) === 0)) {
    fail(invalid, 'polygon mask has zero area');
  }
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const previous = points[(i + points.length - 1) % points.length];
    if (cross(previous, a, b) === 0 &&
        (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > 0) {
      fail(unsupported, 'polygon mask backtracks');
    }
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (edgesMeet(a, b, points[j], points[(j + 1) % points.length])) {
        fail(unsupported, 'polygon mask crosses or touches itself');
      }
    }
    if (i > 0 && i + 1 < points.length) area += cross(points[0], a, b);
  }
  if (!Number.isFinite(area) || area === 0) fail(invalid, 'polygon mask has zero or nonfinite area');
}

export function copyPolygonMask(value: unknown): PolygonMask {
  const seen = new WeakSet<object>();
  const raw = record(value, ['commands'], seen).commands;
  if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype || seen.has(raw)) {
    fail('INVALID_SCENE', 'polygon mask commands must be an ordinary array');
  }
  seen.add(raw);
  // Match the existing Path command bound while classifying valid unsupported command forms.
  if (raw.length > 256) fail('SCENE_LIMIT', 'polygon mask commands exceed the Path limit');
  const own = Reflect.ownKeys(raw);
  if (own.length !== raw.length + 1 || own.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= raw.length))) {
    fail('INVALID_SCENE', 'polygon mask commands must be dense without extra fields');
  }
  const commands: PathCommand[] = [];
  let open = false, contours = 0, curves = false, drawable = false;
  let current: Point | null = null;
  for (let i = 0; i < raw.length; i++) {
    const item = Object.getOwnPropertyDescriptor(raw, String(i));
    if (!item?.enumerable || !('value' in item)) fail('INVALID_SCENE', 'polygon mask command must be a data item');
    const command = item.value;
    const kindField = command && typeof command === 'object' ? Object.getOwnPropertyDescriptor(command, 'kind') : null;
    if (!kindField || !('value' in kindField)) fail('INVALID_SCENE', 'polygon mask command kind must be data');
    const kind = kindField.value;
    const keys = kind === 'M' || kind === 'L' ? ['kind', 'x', 'y'] : kind === 'Q'
      ? ['kind', 'cx', 'cy', 'x', 'y'] : kind === 'C'
        ? ['kind', 'c1x', 'c1y', 'c2x', 'c2y', 'x', 'y'] : kind === 'Z' ? ['kind'] : null;
    if (!keys) fail('INVALID_SCENE', 'polygon mask command kind is invalid');
    const fields = record(command, keys, seen);
    const copied: Record<string, unknown> & { kind: PathCommand['kind'] } = { kind };
    for (const key of keys) if (key !== 'kind') copied[key] = coordinate(fields[key]);
    if (kind === 'M') {
      if (open) fail('INVALID_SCENE', 'polygon mask contour is open');
      open = true; contours++; drawable = false;
    } else if (!open) fail('INVALID_SCENE', 'polygon mask command is outside a contour');
    if (kind === 'Z') {
      if (!drawable) fail('INVALID_SCENE', 'polygon mask contour is empty');
      open = false;
    } else {
      const end = { x: copied.x as number, y: copied.y as number };
      if (kind !== 'M') {
        drawable ||= !same(current!, end) || keys.some(key => key !== 'kind' && key !== 'x' && key !== 'y' &&
          copied[key] !== (key.endsWith('x') ? current!.x : current!.y));
      }
      current = end;
    }
    curves ||= kind === 'Q' || kind === 'C';
    commands.push(copied as PathCommand);
  }
  if (open || contours === 0) fail('INVALID_SCENE', 'polygon mask requires a closed contour');
  if (curves || contours !== 1) fail('UNSUPPORTED_FEATURE', 'polygon mask supports one M/L/Z contour without curves');
  const points = commands.slice(0, -1).map(command => {
    const p = command as Point;
    return { x: p.x, y: p.y };
  });
  if (points.length < 3) fail('INVALID_SCENE', 'polygon mask needs at least three vertices');
  if (points.length > 33) fail('SCENE_LIMIT', 'polygon mask exceeds 32 vertices');
  if (points.length === 33) {
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      if (same(points[i], points[j])) fail('INVALID_SCENE', 'polygon mask has repeated vertices');
    }
    fail('SCENE_LIMIT', 'polygon mask exceeds 32 vertices');
  }
  topology(points, false);
  return { commands };
}

export function compilePolygonMask(mask: PolygonMask, matrix: PolygonMaskMatrix, view: View,
  dpr: number): Float32Array {
  if (!Number.isFinite(dpr) || dpr <= 0 || !Number.isFinite(view.zoom) || view.zoom <= 0) {
    fail('SCENE_LIMIT', 'polygon mask requires finite positive device scaling');
  }
  const local = copyPolygonMask(mask).commands.slice(0, -1) as Point[];
  const accepted: Point[] = [], device: Point[] = [];
  for (const p of local) {
    const x = matrix[0] * p.x + matrix[2] * p.y + matrix[4];
    const y = matrix[1] * p.x + matrix[3] * p.y + matrix[5];
    const dx = (x * view.zoom + view.panX) * dpr, dy = (y * view.zoom + view.panY) * dpr;
    if (![x, y, dx, dy].every(v => Number.isFinite(v) && Math.abs(v) <= 1e9)) {
      fail('SCENE_LIMIT', 'polygon mask exceeds finite world or device range');
    }
    const rounded = { x: Math.fround(x), y: Math.fround(y) };
    accepted.push(rounded);
    const roundedDx = (rounded.x * view.zoom + view.panX) * dpr;
    const roundedDy = (rounded.y * view.zoom + view.panY) * dpr;
    if (![roundedDx, roundedDy].every(v => Number.isFinite(v) && Math.abs(v) <= 1e9)) {
      fail('SCENE_LIMIT', 'polygon mask Float32 projection exceeds device range');
    }
    device.push({ x: Math.fround(roundedDx), y: Math.fround(roundedDy) });
  }
  topology(accepted, true); topology(device, true);
  return new Float32Array(accepted.flatMap(p => [p.x, p.y]));
}

export function insidePolygonMask(contour: Float32Array, point: Point): boolean {
  let inside = false;
  const count = contour.length / 2;
  for (let i = 0, previous = count - 1; i < count; previous = i++) {
    const a = { x: contour[previous * 2], y: contour[previous * 2 + 1] };
    const b = { x: contour[i * 2], y: contour[i * 2 + 1] };
    if (onSegment(a, b, point)) return true;
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

export function polygonMaskBounds(contour: Float32Array): { x: number; y: number; width: number; height: number } {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < contour.length; i += 2) {
    left = Math.min(left, contour[i]); top = Math.min(top, contour[i + 1]);
    right = Math.max(right, contour[i]); bottom = Math.max(bottom, contour[i + 1]);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
