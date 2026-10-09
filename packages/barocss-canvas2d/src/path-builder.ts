import { Canvas2DError, validatePoint, validateScene } from './schema.js';
import type { PathCommand, PathNodeV5, Point } from './schema.js';

export type PathBuilder = {
  moveTo(x: number, y: number): PathBuilder;
  lineTo(x: number, y: number): PathBuilder;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): PathBuilder;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): PathBuilder;
  closePath(): PathBuilder;
  rect(x: number, y: number, width: number, height: number): PathBuilder;
  roundRect(x: number, y: number, width: number, height: number, radius: number): PathBuilder;
  circle(cx: number, cy: number, radius: number): PathBuilder;
  ellipse(cx: number, cy: number, radiusX: number, radiusY: number): PathBuilder;
  arc(cx: number, cy: number, radius: number, startAngle: number, sweepAngle: number): PathBuilder;
  polygon(points: readonly Point[]): PathBuilder;
  polyline(points: readonly Point[]): PathBuilder;
  clear(): PathBuilder;
  build(): PathCommand[];
};

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }
function scalar(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) ||
      value < -1e6 || value > 1e6) invalid('path builder coordinate is outside Scene range');
  return value;
}
function positive(value: number): number {
  if (scalar(value) <= 0) invalid('path builder dimension must be positive');
  return value;
}
function point(x: number, y: number): { x: number; y: number } {
  return { x: scalar(x), y: scalar(y) };
}

function vertices(points: readonly Point[], min: number, shape: string): Point[] {
  if (!Array.isArray(points) || Object.getPrototypeOf(points) !== Array.prototype) {
    invalid(`path builder ${shape} needs an ordinary array`);
  }
  const length = Object.getOwnPropertyDescriptor(points, 'length')?.value;
  if (!Number.isInteger(length) || length < min || length > 128 || Reflect.ownKeys(points).length !== length + 1) {
    invalid(`path builder ${shape} needs ${min} to 128 dense points`);
  }
  const result: Point[] = [];
  for (let index = 0; index < length; index++) {
    const field = Object.getOwnPropertyDescriptor(points, String(index));
    if (!field || !field.enumerable || !('value' in field)) invalid(`path builder ${shape} needs data points`);
    const vertex = validatePoint(field.value);
    const previous = result[index - 1];
    if (previous && previous.x === vertex.x && previous.y === vertex.y) {
      invalid(`path builder ${shape} has a repeated edge`);
    }
    result.push(vertex);
  }
  const first = result[0], last = result[result.length - 1];
  if (first.x === last.x && first.y === last.y) invalid(`path builder ${shape} repeats its first point`);
  return result;
}

function checkSequence(commands: PathCommand[]): void {
  if (commands.length > 256) throw new Canvas2DError('SCENE_LIMIT', 'path builder exceeds 256 commands');
  let open = false, drawable = false;
  let current = { x: 0, y: 0 }, start = current;
  for (const command of commands) {
    if (command.kind === 'M') {
      if (open && !drawable) invalid('path builder has an empty subpath');
      current = { x: command.x, y: command.y }; start = current;
      open = true; drawable = false;
    } else if (command.kind === 'Z') {
      if (!open || (!drawable && current.x === start.x && current.y === start.y)) {
        invalid('path builder cannot close an empty subpath');
      }
      current = start; open = false; drawable = false;
    } else {
      if (!open) invalid('path builder command needs moveTo');
      if (command.kind === 'Q') {
        drawable ||= current.x !== command.x || current.y !== command.y ||
          current.x !== command.cx || current.y !== command.cy;
      } else if (command.kind === 'C') {
        drawable ||= current.x !== command.x || current.y !== command.y ||
          current.x !== command.c1x || current.y !== command.c1y ||
          current.x !== command.c2x || current.y !== command.c2y;
      } else drawable ||= current.x !== command.x || current.y !== command.y;
      current = { x: command.x, y: command.y };
    }
  }
}

export function createPathBuilder(): PathBuilder {
  let commands: PathCommand[] = [];
  function append(next: PathCommand[]): PathBuilder {
    const candidate = [...commands, ...next];
    checkSequence(candidate);
    commands = candidate;
    return api;
  }
  const api: PathBuilder = Object.freeze({
    moveTo(x: number, y: number) { return append([{ kind: 'M', ...point(x, y) }]); },
    lineTo(x: number, y: number) { return append([{ kind: 'L', ...point(x, y) }]); },
    quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
      return append([{ kind: 'Q', cx: scalar(cx), cy: scalar(cy), ...point(x, y) }]);
    },
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
      return append([{ kind: 'C', c1x: scalar(c1x), c1y: scalar(c1y),
        c2x: scalar(c2x), c2y: scalar(c2y), ...point(x, y) }]);
    },
    closePath() { return append([{ kind: 'Z' }]); },
    rect(x: number, y: number, width: number, height: number) {
      const left = scalar(x), top = scalar(y), right = scalar(x + positive(width)), bottom = scalar(y + positive(height));
      return append([{ kind: 'M', x: left, y: top }, { kind: 'L', x: right, y: top },
        { kind: 'L', x: right, y: bottom }, { kind: 'L', x: left, y: bottom }, { kind: 'Z' }]);
    },
    roundRect(x: number, y: number, width: number, height: number, radius: number) {
      const left = scalar(x), top = scalar(y), w = positive(width), h = positive(height), r = positive(radius);
      if (r > Math.min(w, h) / 2) invalid('path builder radius exceeds half the smaller dimension');
      const right = scalar(left + w), bottom = scalar(top + h), k = 4 * (Math.SQRT2 - 1) / 3;
      const x0 = scalar(left + r), x1 = scalar(right - r);
      const y0 = scalar(top + r), y1 = scalar(bottom - r);
      const a = k * r;
      return append([{ kind: 'M', x: x0, y: top }, { kind: 'L', x: x1, y: top },
        { kind: 'C', c1x: scalar(x1 + a), c1y: top, c2x: right, c2y: scalar(y0 - a), x: right, y: y0 },
        { kind: 'L', x: right, y: y1 },
        { kind: 'C', c1x: right, c1y: scalar(y1 + a), c2x: scalar(x1 + a), c2y: bottom, x: x1, y: bottom },
        { kind: 'L', x: x0, y: bottom },
        { kind: 'C', c1x: scalar(x0 - a), c1y: bottom, c2x: left, c2y: scalar(y1 + a), x: left, y: y1 },
        { kind: 'L', x: left, y: y0 },
        { kind: 'C', c1x: left, c1y: scalar(y0 - a), c2x: scalar(x0 - a), c2y: top, x: x0, y: top },
        { kind: 'Z' }]);
    },
    circle(cx: number, cy: number, radius: number) {
      const x = scalar(cx), y = scalar(cy), r = positive(radius);
      const right = scalar(x + r), left = scalar(x - r), bottom = scalar(y + r), top = scalar(y - r);
      const k = 4 * (Math.SQRT2 - 1) / 3, a = scalar(x + k * r), b = scalar(x - k * r);
      const c = scalar(y + k * r), d = scalar(y - k * r);
      return append([{ kind: 'M', x: right, y },
        { kind: 'C', c1x: right, c1y: c, c2x: a, c2y: bottom, x, y: bottom },
        { kind: 'C', c1x: b, c1y: bottom, c2x: left, c2y: c, x: left, y },
        { kind: 'C', c1x: left, c1y: d, c2x: b, c2y: top, x, y: top },
        { kind: 'C', c1x: a, c1y: top, c2x: right, c2y: d, x: right, y },
        { kind: 'Z' }]);
    },
    ellipse(cx: number, cy: number, radiusX: number, radiusY: number) {
      const x = scalar(cx), y = scalar(cy), rx = positive(radiusX), ry = positive(radiusY);
      const right = scalar(x + rx), left = scalar(x - rx), bottom = scalar(y + ry), top = scalar(y - ry);
      const k = 4 * (Math.SQRT2 - 1) / 3, a = scalar(x + k * rx), b = scalar(x - k * rx);
      const c = scalar(y + k * ry), d = scalar(y - k * ry);
      return append([{ kind: 'M', x: right, y },
        { kind: 'C', c1x: right, c1y: c, c2x: a, c2y: bottom, x, y: bottom },
        { kind: 'C', c1x: b, c1y: bottom, c2x: left, c2y: c, x: left, y },
        { kind: 'C', c1x: left, c1y: d, c2x: b, c2y: top, x, y: top },
        { kind: 'C', c1x: a, c1y: top, c2x: right, c2y: d, x: right, y },
        { kind: 'Z' }]);
    },
    arc(cx: number, cy: number, radius: number, startAngle: number, sweepAngle: number) {
      const x = scalar(cx), y = scalar(cy), r = positive(radius);
      const start = scalar(startAngle), sweep = scalar(sweepAngle);
      if (Math.abs(start) > 2 * Math.PI || sweep === 0 || Math.abs(sweep) > 2 * Math.PI) {
        invalid('path builder arc angle is outside supported range');
      }
      const segments = Math.ceil(Math.abs(sweep) / (Math.PI / 2));
      const step = sweep / segments;
      const control = 4 / 3 * Math.tan(step / 4) * r;
      let current = { x: scalar(x + r * Math.cos(start)), y: scalar(y + r * Math.sin(start)) };
      const commands: PathCommand[] = [{ kind: 'M', ...current }];
      let drawable = false;
      for (let index = 0; index < segments; index++) {
        const a = start + index * step, b = start + (index + 1) * step;
        const cosA = Math.cos(a), sinA = Math.sin(a), cosB = Math.cos(b), sinB = Math.sin(b);
        const next = { kind: 'C' as const, c1x: scalar(x + r * cosA - control * sinA),
          c1y: scalar(y + r * sinA + control * cosA),
          c2x: scalar(x + r * cosB + control * sinB),
          c2y: scalar(y + r * sinB - control * cosB),
          x: scalar(x + r * cosB), y: scalar(y + r * sinB) };
        drawable ||= current.x !== next.x || current.y !== next.y ||
          current.x !== next.c1x || current.y !== next.c1y ||
          current.x !== next.c2x || current.y !== next.c2y;
        current = { x: next.x, y: next.y };
        commands.push(next);
      }
      if (!drawable) invalid('path builder arc has no drawable geometry');
      return append(commands);
    },
    polygon(points: readonly Point[]) {
      const corners = vertices(points, 3, 'polygon');
      const first = corners[0];
      return append([{ kind: 'M', ...first },
        ...corners.slice(1).map(vertex => ({ kind: 'L' as const, ...vertex })), { kind: 'Z' }]);
    },
    polyline(points: readonly Point[]) {
      const corners = vertices(points, 2, 'polyline');
      return append([{ kind: 'M', ...corners[0] },
        ...corners.slice(1).map(vertex => ({ kind: 'L' as const, ...vertex }))]);
    },
    clear() { commands = []; return api; },
    build() {
      const scene = validateScene({ version: 6, unit: 'logical-px', contextId: 'PathBuilder',
        nodes: [{ kind: 'path', id: 'BuiltPath', layer: 0,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, commands,
          stroke: { color: [0, 0, 0, 1], width: 1 } }] });
      return (scene.nodes[0] as PathNodeV5).commands;
    },
  });
  return api;
}
