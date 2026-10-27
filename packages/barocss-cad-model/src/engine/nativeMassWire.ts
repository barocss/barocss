// Private native-file provenance. Public bodies, saved documents and mesh packets carry no added fields.
import { readNativeSIInertia, type NativeSIInertiaResult } from '@barocss/cad/internal/native-si-mass';
import type { BodyResult } from './evaluate';

export type MassFields = Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'>;
export interface NativeMassSource { epoch: number; requestId: number; revision: number; slot: string }
interface Basis { result: NativeSIInertiaResult; rotations: number[][] }
export type NativeMassEnvelope = NativeMassSource & { bodyKey: string | null; massRef: number | null; signature: string } & (
  | { kind: 'pending' }
  | { kind: 'ready'; basis: Basis }
);
const tensors = new WeakMap<object, { basis: Basis; signature: string }>();
const pending = new WeakMap<object, NativeMassEnvelope>();
const patches = new WeakMap<object, NativeMassEnvelope>();
const unavailable = { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'untracked' } as const;

// Preserve negative zero; reject neither absent fields nor an explicit unavailable mass.
const signature = (value: unknown): string => JSON.stringify(value, (_k, v) => typeof v === 'number' && Object.is(v, -0) ? '\u0000-0' : v);
const tensorSignature = (body: Pick<BodyResult, 'inertia'>): string => signature(body.inertia ?? null);
function fieldsSignature(body: Partial<BodyResult>): string {
  return signature([body.volume ?? null, body.mass ?? null, body.centroid ?? null, body.inertia ?? null, body.volumeBasis ?? null, body.massPlace ?? null]);
}
function remember(body: Pick<BodyResult, 'inertia'>, basis: Basis): void {
  if (body.inertia) tensors.set(body.inertia, { basis, signature: tensorSignature(body) });
}
function basisOf(body: Pick<BodyResult, 'inertia'>): Basis {
  const have = body.inertia && tensors.get(body.inertia);
  return have && have.signature === tensorSignature(body) ? have.basis : { result: unavailable, rotations: [] };
}
/** Read only the already cached Kernel mass result. No extra mass integration. */
export function rememberNativeMass(body: Pick<BodyResult, 'inertia'>, props: Parameters<typeof readNativeSIInertia>[0]): void {
  remember(body, { result: readNativeSIInertia(props), rotations: [] });
}
/** Retain the exact placement sequence; do not rotate the public tensor again. */
export function placeNativeMass(before: Pick<BodyResult, 'inertia'>, after: Pick<BodyResult, 'inertia'>, rotation: readonly number[]): void {
  const basis = basisOf(before);
  remember(after, { result: basis.result, rotations: [...basis.rotations, [...rotation]] });
}
/** Old SI placement arithmetic, then the exporter applies the material ratio once. */
export function nativeSIOfBody(body: Pick<BodyResult, 'inertia'>): NativeSIInertiaResult {
  const basis = basisOf(body);
  if (!basis.result.ok) return basis.result;
  let inertia = basis.result.inertia;
  for (const m of basis.rotations) {
    const R = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
    inertia = R.map((_, i) => R.map((__, j) => { let v = 0; for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += R[i][k] * inertia[k][l] * R[j][l]; return v; })) as unknown as typeof inertia;
  }
  return { ok: true, inertia, density: basis.result.density };
}
/** The worker posts this beside its result, never inside a public body or a mesh packet. */
export function nativeMassEnvelope(source: NativeMassSource, body: MassFields & Partial<Pick<BodyResult, 'key' | 'massRef' | 'massPlace'>>, massRef: number | null = body.massRef ?? null): NativeMassEnvelope {
  const common = { ...source, bodyKey: body.key ?? null, massRef, signature: fieldsSignature(body) };
  return body.massRef !== undefined ? { ...common, kind: 'pending' } : { ...common, kind: 'ready', basis: basisOf(body) };
}
function sameSource(a: NativeMassSource, b: NativeMassSource): boolean {
  return a.epoch === b.epoch && a.requestId === b.requestId && a.revision === b.revision && a.slot === b.slot;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const vector = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && Array.from(v).every(x => typeof x === 'number' && Number.isFinite(x));
function validFields(body: Partial<BodyResult>): boolean {
  const scalar = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
  if (!scalar(body.volume) || !scalar(body.mass)) return false;
  if (body.centroid !== undefined && !vector(body.centroid, 3)) return false;
  if (body.inertia !== undefined && (!Array.isArray(body.inertia) || body.inertia.length !== 3 || !Array.from(body.inertia).every(row => vector(row, 3)))) return false;
  if (body.volumeBasis !== undefined && (body.volumeBasis.method !== 'tessellated' || !scalar(body.volumeBasis.bound))) return false;
  return body.massPlace === undefined || (Array.isArray(body.massPlace) && Array.from(body.massPlace).every(p => record(p) && vector(p.m, 9) && vector(p.t, 3)));
}
function validBasis(v: unknown): v is Basis {
  if (!record(v) || !Array.isArray(v.rotations) || !v.rotations.every(m => vector(m, 9)) || !record(v.result)) return false;
  const r = v.result;
  if (r.ok === true) return typeof r.density === 'number' && Number.isFinite(r.density) && r.density > 0 && Array.isArray(r.inertia) && r.inertia.length === 3 && r.inertia.every(row => vector(row, 3));
  return r.ok === false && r.code === 'NATIVE_SI_PROVENANCE_UNAVAILABLE' && ['untracked', 'revolved', 'transformed', 'combined', 'difference'].includes(r.reason as string);
}
function plainJSON(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 32 || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  seen.add(value);
  const valid = (Array.isArray(value) ? Array.from(value) : Object.values(value)).every(v => plainJSON(v, seen, depth + 1));
  seen.delete(value); return valid;
}
function validEnvelope(value: unknown, source: NativeMassSource): value is NativeMassEnvelope {
  if (!plainJSON(value)) return false;
  if (!record(value) || !sameSource(value as unknown as NativeMassSource, source) || typeof value.signature !== 'string' || !(value.bodyKey === null || typeof value.bodyKey === 'string') || !(value.massRef === null || (Number.isSafeInteger(value.massRef) && (value.massRef as number) > 0))) return false;
  return value.kind === 'pending' || (value.kind === 'ready' && validBasis(value.basis));
}
/** A current result may bind only its own slot, body identity and exact public fields. */
export function receiveNativeMass(body: BodyResult, value: unknown, source: NativeMassSource): boolean {
  if (!validFields(body) || !validEnvelope(value, source) || value.bodyKey !== body.key || value.massRef !== (body.massRef ?? null) || value.signature !== fieldsSignature(body)) return false;
  if (value.kind === 'pending') { if (body.massRef === undefined) return false; pending.set(body, value); }
  else { if (body.massRef !== undefined) return false; remember(body, value.basis); }
  return true;
}
/** An unplaced deferred patch is accepted only from the current evaluation and its exact ref and fields. */
export function receiveNativeMassPatch(fields: MassFields, ref: number, value: unknown, source: NativeMassSource): boolean {
  if (!validFields(fields) || !validEnvelope(value, source) || value.kind !== 'ready' || value.bodyKey !== null || value.massRef !== ref || value.signature !== fieldsSignature(fields)) return false;
  patches.set(fields, value); remember(fields, value.basis); return true;
}
/** Ref reuse after a restart, old revisions and unrelated clones cannot patch a pending body. */
export function matchesNativeMassPatch(body: BodyResult, fields: MassFields): boolean {
  const before = pending.get(body), after = patches.get(fields);
  return validFields(body) && validFields(fields) && !!before && !!after && sameSource(before, after) && before.bodyKey === body.key && before.massRef === body.massRef && before.massRef === after.massRef && before.signature === fieldsSignature(body) && after.signature === fieldsSignature(fields);
}
