import { prepareCamera, type MeshCamera } from '@barocss/gpu';

type Triple = [number, number, number];
type CssPoint = { xCss: number; yCss: number };

export interface ExtrusionHeightProjectionInput {
  anchorMM: Triple;
  normal: Triple;
  camera: MeshCamera;
  mmToSceneUnit: number;
  translate: Triple;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

/** Copied display data only. The accepted native endpoint and normal remain editing authority. */
export interface ExtrusionHeightProjection {
  readonly anchorMM: Readonly<Triple>;
  readonly normal: Readonly<Triple>;
  readonly translate: Readonly<Triple>;
  readonly mmToSceneUnit: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly view: readonly number[];
  readonly projection: readonly number[];
  readonly xCss: number;
  readonly yCss: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly depth: number;
  readonly normalDepth: number;
  readonly lengthCoefficient: number;
}

function ownData(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new RangeError('Height projection requires plain own data.');
  const actual = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  if (actual.length !== keys.length || !actual.every(key => typeof key === 'string' && keys.includes(key)
    && descriptors[key].enumerable === true && 'value' in descriptors[key]))
    throw new RangeError('Height projection fields must be exact own data.');
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError('Height projection values must be finite.');
  return value;
}

function triple(input: unknown): Triple {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== 3
    || Reflect.ownKeys(input).length !== 4) throw new RangeError('Height projection requires dense XYZ data.');
  return [0, 1, 2].map(index => {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || field.enumerable !== true || !('value' in field))
      throw new RangeError('Height projection XYZ fields must be own numbers.');
    return finite(field.value);
  }) as Triple;
}

function positive(value: unknown): number {
  const number = finite(value);
  if (number <= 0) throw new RangeError('Height projection scale and sizes must be positive.');
  return number;
}

function point(input: CssPoint): CssPoint {
  const data = ownData(input, ['xCss', 'yCss']);
  return { xCss: finite(data.xCss), yCss: finite(data.yCss) };
}

function clippedPoint(view: readonly number[], projection: readonly number[], position: Triple,
  cssWidth: number, cssHeight: number): { point: CssPoint; depth: number; x: number; y: number } | null {
  const x = view[0] * position[0] + view[4] * position[1] + view[8] * position[2] + view[12];
  const y = view[1] * position[0] + view[5] * position[1] + view[9] * position[2] + view[13];
  const z = view[2] * position[0] + view[6] * position[1] + view[10] * position[2] + view[14];
  const depth = -z, nx = projection[0] * x / depth, ny = projection[5] * y / depth;
  const nz = (projection[10] * z + projection[14]) / depth;
  if (depth <= 0 || ![depth, nx, ny, nz].every(Number.isFinite)
    || Math.abs(nx) > 1 || Math.abs(ny) > 1 || nz < -1 || nz > 1) return null;
  return { point: { xCss: cssWidth * (1 + nx) / 2, yCss: cssHeight * (1 - ny) / 2 }, depth, x, y };
}

/** Project one actual native endpoint along its native unit normal through the public F32 camera. */
export function createExtrusionHeightProjection(input: ExtrusionHeightProjectionInput): ExtrusionHeightProjection | null {
  const data = ownData(input, ['anchorMM', 'normal', 'camera', 'mmToSceneUnit', 'translate',
    'cssWidth', 'cssHeight', 'pixelWidth', 'pixelHeight']);
  const anchorMM = triple(data.anchorMM), normal = triple(data.normal), translate = triple(data.translate);
  if (Math.abs(Math.hypot(...normal) - 1) > 1e-7) throw new RangeError('An actual native unit normal is required.');
  const mmToSceneUnit = positive(data.mmToSceneUnit), cssWidth = positive(data.cssWidth), cssHeight = positive(data.cssHeight);
  const pixelWidth = positive(data.pixelWidth), pixelHeight = positive(data.pixelHeight);
  if (!Number.isInteger(pixelWidth) || !Number.isInteger(pixelHeight))
    throw new RangeError('Actual physical canvas sizes must be integers.');
  if (data.camera === undefined) throw new RangeError('The displayed camera is required.');
  const matrices = prepareCamera(data.camera as MeshCamera, pixelWidth / pixelHeight);
  const view = Array.from(matrices.view), projection = Array.from(matrices.projection);
  const position = anchorMM.map((value, axis) => value * mmToSceneUnit + translate[axis]) as Triple;
  const projected = clippedPoint(view, projection, position, cssWidth, cssHeight);
  if (!projected) return null;
  const a = view[0] * normal[0] + view[4] * normal[1] + view[8] * normal[2];
  const b = view[1] * normal[0] + view[5] * normal[1] + view[9] * normal[2];
  const c = view[2] * normal[0] + view[6] * normal[1] + view[10] * normal[2];
  const backLength = Math.hypot(view[2], view[6], view[10]);
  if (Math.abs(c) / backLength > 0.985) return null;
  const kX = cssWidth / 2 * projection[0] * (a * projected.depth + projected.x * c);
  const kY = -cssHeight / 2 * projection[5] * (b * projected.depth + projected.y * c);
  const normK = Math.hypot(kX, kY), lengthCoefficient = normK / projected.depth;
  if (!Number.isFinite(lengthCoefficient) || lengthCoefficient * mmToSceneUnit <= 1e-8) return null;
  return Object.freeze({ anchorMM: Object.freeze(anchorMM), normal: Object.freeze(normal), translate: Object.freeze(translate),
    mmToSceneUnit, cssWidth, cssHeight, view: Object.freeze(view), projection: Object.freeze(projection),
    xCss: projected.point.xCss, yCss: projected.point.yCss, dirX: kX / normK, dirY: kY / normK,
    depth: projected.depth, normalDepth: c, lengthCoefficient });
}

/** Forward-project a proposed endpoint only; no native geometry or GPU scene is changed. */
export function projectExtrusionHeight(frame: ExtrusionHeightProjection, deltaMM = 0): CssPoint | null {
  finite(deltaMM);
  const position = frame.anchorMM.map((value, axis) =>
    (deltaMM === 0 || frame.normal[axis] === 0 ? value : value + frame.normal[axis] * deltaMM)
      * frame.mmToSceneUnit + frame.translate[axis]) as Triple;
  return clippedPoint(frame.view, frame.projection, position, frame.cssWidth, frame.cssHeight)?.point ?? null;
}

/** Invert anchor-relative screen displacement; a fixed CSS handle offset is removed by current minus start. */
export function extrusionHeightDelta(frame: ExtrusionHeightProjection, startCss: CssPoint, currentCss: CssPoint): number | null {
  const start = point(startCss), current = point(currentCss);
  if (current.xCss === start.xCss && current.yCss === start.yCss) return 0;
  const dx = current.xCss - start.xCss, dy = current.yCss - start.yCss;
  const s = dx * frame.dirX + dy * frame.dirY;
  const depthTerm = s * frame.normalDepth, denominator = frame.lengthCoefficient + depthTerm;
  const denominatorScale = Math.max(frame.lengthCoefficient, Math.abs(depthTerm));
  if (![dx, dy, s, denominator].every(Number.isFinite) || denominator <= denominatorScale * 1e-10) return null;
  const sceneDelta = s * frame.depth / denominator, deltaMM = sceneDelta / frame.mmToSceneUnit;
  const remainingDepth = frame.depth - sceneDelta * frame.normalDepth;
  if (!Number.isFinite(deltaMM) || !Number.isFinite(remainingDepth) || remainingDepth <= frame.depth * 1e-10
    || projectExtrusionHeight(frame, deltaMM) === null) return null;
  return deltaMM === 0 ? 0 : deltaMM;
}
