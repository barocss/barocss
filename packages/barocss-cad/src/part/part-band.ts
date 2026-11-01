// B2: the part model's band surface feature (features/band-surface.ts does the geometry). Both sides are read with
// ref(), never consumed: the bodies stay. Stored names are checked on each side's own body ([REFERENCE_MOVED], as a
// fillet's are), then resolved exactly — a lost name refuses, nothing is renamed or retargeted.
import { bandSurface, BandError, type BandSideInput } from '../features/band-surface.js';
import { checkExpected, expectOf } from './part-expect.js';
import type { CadPartFeature, Result, Tools } from './part-model.js';
import { brepOf, isRecord } from './part-model.js';

const KEYS = new Set(['id', 'kind', 'a', 'b', 'flip', 'expect', 'suppressed']);
const MAX_NAMES = 32;

/** A band surface feature's evaluation (part-model.ts's operation() for this kind). */
export function bandOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result {
  const { fail, ref, at } = t;
  if (Object.hasOwn(f, 'thickness') || Object.hasOwn(f, 'side')) fail('CAPABILITY', '[BAND_PROFILE] band thickening waits on exact thicken (#2258)');
  for (const key of Object.keys(f)) if (!KEYS.has(key)) fail('INPUT', `a band surface has no field ${key}`);
  if (f.flip !== undefined && typeof f.flip !== 'boolean') fail('INPUT', 'flip must be true or false');
  const expect = expectOf(f, fail), seen = new Set<string>();
  const sides = (['a', 'b'] as const).map((key): BandSideInput & { names: string[] } => {
    const side = f[key] as unknown, label = key.toUpperCase();
    if (!isRecord(side) || typeof side.target !== 'string' || !Array.isArray(side.edges)) return fail('INPUT', `${key} must be { target, edges } (a body and edge names)`);
    const names = side.edges as unknown[];
    if (!names.length || names.length > MAX_NAMES || !names.every(n => typeof n === 'string' && n !== '')) return fail('INPUT', `${key}.edges must list 1 to ${MAX_NAMES} edge names`);
    for (const n of names as string[]) { if (seen.has(n)) fail('INPUT', `the edge name ${n} appears twice: a name is on one side only, once`); seen.add(n); }
    const { id, part, result } = ref(side.target, `band side ${label}`);
    if (result.kind !== 'solid') return fail('REFERENCE', `band side ${label}: ${id} is a sketch, not a body`);
    const parts = result.parts, picked = part === null ? parts : [parts[part]];
    if (picked.length !== 1) return fail('REFERENCE', `band side ${label}: take one body (name it as id/k)`);
    return { body: side.target, brep: brepOf(picked[0], at), names: names as string[] };
  });
  return () => {
    if (expect) for (const s of sides) checkExpected(s.brep, new Map([...expect].filter(([n]) => s.names.includes(n))), true, 'band surface', fail);
    try {
      const out = bandSurface({ id: at, a: sides[0], b: sides[1], ...(f.flip === true ? { flip: true } : {}) });
      return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: out.brep }, band: out.report }] };
    } catch (cause) {
      if (cause instanceof BandError) return fail(cause.refusal, cause.message);
      throw cause;
    }
  };
}
