// The rules a pattern of instances keeps (assembly/patterns.ts), without the assembly's solver: the editing ops refuse by
// them, expandPatterns skips a pattern that breaks them, and Open (engine/migrate.ts) refuses a file whose pattern does.
import type { InstancePattern } from '../engine/doc';

/** The most occurrences a pattern holds, the seed counted, and the least; the farthest a neighbour is, in mm. */
export const PATTERN_MAX = 64, PATTERN_MIN = 2, PATTERN_SPACING_MAX = 100000;

const finite3 = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x));

/** Why a pattern's values are not good (naming the part and the bound), or undefined. Takes a pattern read from a file as it is. */
export function patternProblem(who: string, p: InstancePattern): string | undefined {
  const bad = (what: string) => `Pattern of ${who}: ${what}`;
  if (!Number.isInteger(p.count) || p.count < PATTERN_MIN || p.count > PATTERN_MAX) return bad(`count is a whole number from ${PATTERN_MIN} to ${PATTERN_MAX} (the seed counts as one), not ${String(p.count)}.`);
  if (p.kind === 'linear') {
    if (!finite3(p.dir) || !p.dir.some(v => v !== 0)) return bad('dir is [x, y, z], not all zero.');
    if (typeof p.spacing !== 'number' || !Number.isFinite(p.spacing) || p.spacing === 0 || Math.abs(p.spacing) > PATTERN_SPACING_MAX) return bad(`spacing is the gap between neighbours in mm: not 0, and at most ${PATTERN_SPACING_MAX} either way, not ${String(p.spacing)}.`);
  } else if (p.kind === 'circular') {
    if (!finite3(p.origin)) return bad('origin is [x, y, z] in mm, a point on the axis.');
    if (!finite3(p.axis) || !p.axis.some(v => v !== 0)) return bad('axis is [x, y, z], not all zero.');
    if (typeof p.angle !== 'number' || !Number.isFinite(p.angle) || p.angle === 0) return bad(`angle is the turn between neighbours in degrees and not 0, not ${String(p.angle)}.`);
    // (A full circle is count × angle = 360: the copy after the last stands on the seed, so more would put two on one spot.)
    if (Math.abs(p.angle * p.count) > 360 + 1e-9) return bad(`angle × count is at most 360 degrees in size, so no two stand on one spot; ${p.angle} × ${p.count} is ${p.angle * p.count}.`);
  } else return bad('kind is linear or circular.');
  if (p.skip !== undefined && !Array.isArray(p.skip)) return bad('skip is a list of occurrence numbers.');
  for (const k of p.skip ?? []) if (!Number.isInteger(k) || k < 1 || k >= p.count) return bad(`skip lists occurrence numbers from 1 to ${p.count - 1} (the seed, 0, stays), not ${String(k)}.`);
  return undefined;
}

interface Placed { id: string; name?: string; pattern?: unknown }
/**
 * The first thing wrong with a document's patterns (each pattern's values, a repeated pattern id, a pattern whose
 * occurrence would take the id of a placed part), or undefined. A pattern whose seed is gone is left to expandPatterns.
 */
export function patternsProblem(doc: { instances?: readonly Placed[]; instancePatterns?: readonly InstancePattern[] }): string | undefined {
  const patterns = doc.instancePatterns;
  if (patterns === undefined) return undefined;
  if (!Array.isArray(patterns)) return 'The model\'s instancePatterns is a list of patterns.';
  const own = (Array.isArray(doc.instances) ? doc.instances : []).filter(i => i && typeof i === 'object' && !i.pattern), taken = new Set(own.map(i => i.id)), ids = new Set<string>();
  for (const p of patterns) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || typeof p.seed !== 'string') return 'Each pattern has an id and a seed (the id of a placed part).';
    if (ids.has(p.id)) return `Pattern ${p.id} is listed twice.`;
    ids.add(p.id);
    const seed = own.find(i => i.id === p.seed), who = seed?.name ?? p.seed, why = patternProblem(who, p);
    if (why) return why;
    for (let k = 1; k < p.count; k++) if (!(p.skip ?? []).includes(k) && taken.has(`${p.id}-${k}`)) return `Pattern of ${who}: occurrence ${k} would be numbered ${p.id}-${k}, which a placed part has already; rename that part's id or use another pattern.`;
  }
  return undefined;
}
