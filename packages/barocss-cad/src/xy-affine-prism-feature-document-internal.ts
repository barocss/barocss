/** Shared bounded authored-data helpers. Callers own diagnostics and descriptor-safe snapshots. */
export type FeatureReject = (code: 'INPUT' | 'IDENTITY' | 'REVISION' | 'PARAMETER', detail: string) => never;
export function featureFields(v: unknown, keys: string[], fail: FeatureReject): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) fail('INPUT', 'Exact own record required');
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== keys.length || !keys.every(k => Object.hasOwn(o, k))) fail('INPUT', 'Exact fields required: ' + keys.join(','));
  return o;
}
export function featureIdentity(v: unknown, max: number, fail: FeatureReject): void {
  if (!(typeof v === 'string' && v.length <= max && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v))) fail('IDENTITY', 'Bounded ASCII identity required');
}
export function featureRevision(v: unknown, fail: FeatureReject): void {
  if (!(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000000000 && !Object.is(v, -0))) fail('REVISION', 'Revision integer 0..1000000000 without negative zero required');
}
export function featureLength(v: unknown, fail: FeatureReject): void {
  if (!(typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000)) fail('PARAMETER', 'Finite literal millimetres within +/-10000 required');
}
export function signedJson(v: unknown): string {
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(signedJson).join(',') + ']';
  if (v !== null && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signedJson((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v);
}
