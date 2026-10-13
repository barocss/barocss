import type { CadStlExport } from '@barocss/cad';

export interface ModelingStlBinding {
  outputName: string; solidId: string; revision: number;
  acceptedTaskToken: string; requestTaskToken: string;
}
/** A bounded file handoff, not a native geometry/mesh authority or editable model. */
export interface CadEditorStlExport extends ModelingStlBinding {
  readonly format: 'binary-stl'; readonly lengthUnit: 'mm';
  readonly sourceFrame: 'authored-xyz-no-axis-conversion';
  readonly bytes: readonly number[]; readonly byteLength: number; readonly triangleCount: number;
  readonly maximumVertexDisplacementMM: number;
}
const HEADER = 'BaroCSS binary STL | mm convention | approximate facets';
const KEYS = ['outputName', 'solidId', 'revision', 'acceptedTaskToken', 'requestTaskToken', 'format', 'lengthUnit',
  'sourceFrame', 'bytes', 'byteLength', 'triangleCount', 'maximumVertexDisplacementMM'];
function ownRecord(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length) throw Error('Invalid STL transfer fields.');
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error('STL transfer requires own data.');
    result[key] = descriptor.value;
  }
  return result;
}
/** Receiving-side byte/identity admission; native qualification belongs to exportStl. */
export function validateModelingStlExport(value: unknown, expected: ModelingStlBinding): CadEditorStlExport {
  const data = ownRecord(value, KEYS);
  if (typeof expected.outputName !== 'string' || typeof expected.acceptedTaskToken !== 'string' || typeof expected.requestTaskToken !== 'string'
    || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(expected.outputName)
    || ['__proto__', 'prototype', 'constructor'].includes(expected.outputName)
    || typeof expected.solidId !== 'string' || !expected.solidId.length || expected.solidId.length > 128
    || !Number.isSafeInteger(expected.revision) || expected.revision < 0
    || !/^[A-Za-z0-9_-]{1,48}$/.test(expected.acceptedTaskToken)
    || !/^[A-Za-z0-9_-]{1,48}$/.test(expected.requestTaskToken)
    || Object.entries(expected).some(([key, entry]) => data[key] !== entry)
    || data.format !== 'binary-stl' || data.lengthUnit !== 'mm' || data.sourceFrame !== 'authored-xyz-no-axis-conversion'
    || typeof data.triangleCount !== 'number' || !Number.isSafeInteger(data.triangleCount) || data.triangleCount < 1 || data.triangleCount > 40
    || data.byteLength !== 84 + 50 * data.triangleCount
    || typeof data.maximumVertexDisplacementMM !== 'number' || !Number.isFinite(data.maximumVertexDisplacementMM)
    || data.maximumVertexDisplacementMM < 0) throw Error('STL output identity or metadata differs from the accepted model.');
  if (!Array.isArray(data.bytes) || Object.getPrototypeOf(data.bytes) !== Array.prototype
    || data.bytes.length !== data.byteLength || data.bytes.length > 2084
    || Reflect.ownKeys(data.bytes).length !== data.bytes.length + 1) throw Error('Invalid bounded STL bytes.');
  const bytes: number[] = [];
  for (let i = 0; i < data.bytes.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(data.bytes, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value)
      || descriptor.value < 0 || descriptor.value > 255) throw Error('STL requires dense byte data.');
    bytes.push(descriptor.value);
  }
  for (let i = 0; i < 80; i++) if (bytes[i] !== (i < HEADER.length ? HEADER.charCodeAt(i) : 0)) throw Error('Invalid STL header.');
  const view = new DataView(Uint8Array.from(bytes).buffer);
  if (view.getUint32(80, true) !== data.triangleCount) throw Error('STL facet count differs from its bytes.');
  for (let offset = 84; offset < bytes.length; offset += 50) {
    const values = Array.from({ length: 12 }, (_, i) => view.getFloat32(offset + 4 * i, true));
    if (!values.every(Number.isFinite) || view.getUint16(offset + 48, true) !== 0) throw Error('Invalid STL facet data.');
    const [nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz] = values;
    const x = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const z = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(Math.hypot(nx, ny, nz) - 1) > 1e-5 || !(x * nx + y * ny + z * nz > 0))
      throw Error('STL facet is collapsed or its normal is inconsistent.');
  }
  return Object.freeze({ ...expected, format: 'binary-stl', lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    bytes: Object.freeze(bytes), byteLength: bytes.length, triangleCount: data.triangleCount,
    maximumVertexDisplacementMM: data.maximumVertexDisplacementMM });
}

/** Project only the genuine provider's file bytes and scalar loss, not native certificates. */
export function createModelingStlExport(result: CadStlExport, binding: ModelingStlBinding): CadEditorStlExport {
  if (result.family !== 'convex-planar' || result.outputName !== binding.outputName
    || result.details.report.solidId !== binding.solidId || result.details.native.report.solidId !== binding.solidId
    || result.details.report.sourceFrame !== 'authored-xyz-no-axis-conversion'
    || result.details.report.byteLength !== result.byteLength || result.details.report.triangleCount !== result.triangleCount)
    throw Error('Native STL export differs from its accepted output.');
  return validateModelingStlExport({ ...binding, format: result.format, lengthUnit: result.lengthUnit,
    sourceFrame: result.details.report.sourceFrame, bytes: result.bytes, byteLength: result.byteLength,
    triangleCount: result.triangleCount, maximumVertexDisplacementMM: result.maximumVertexDisplacementMM }, binding);
}

/** Own only this invocation's anchor and URL. A click is not proof of disk persistence. */
export function downloadModelingStl(value: CadEditorStlExport): void {
  const data = ownRecord(value, KEYS);
  const result = validateModelingStlExport(value, { outputName: data.outputName as string, solidId: data.solidId as string,
    revision: data.revision as number, acceptedTaskToken: data.acceptedTaskToken as string, requestTaskToken: data.requestTaskToken as string });
  const anchor = document.createElement('a');
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes)], { type: 'model/stl' }));
    anchor.href = url; anchor.download = result.outputName + '.stl';
    document.body.append(anchor); anchor.click();
  } finally { anchor.remove(); if (url !== undefined) URL.revokeObjectURL(url); }
}
