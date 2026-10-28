// R5.3 (D223): the edge finishes of the part model — fillet and chamfer — moved out of part-model.ts's operation() as
// they were there. `finishEdges` stays in part-model.ts (the shells use it too) and comes in the helpers. The dispatcher
// calls `finishOperation` for those kinds.
import { type FilletReport } from '../blend/rolling-ball.js';
import type { CadPartDim, CadPartPoint3, CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';

/** A fillet or chamfer feature's evaluation (part-model.ts's operation() for these kinds). */
export function finishOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xyz, solids, fail, at } = t;
  const { finishEdges, CadPartLimits } = k;
  switch (f.kind) {
    case 'chamfer': case 'fillet': {
      const target = solids(f.target, 'target'), varying = f.kind === 'fillet' && f.radii !== undefined;
      if (varying && f.radius !== undefined) fail('INPUT', 'give radius or radii, not both');
      if (varying && (!Array.isArray(f.radii) || f.radii.length < 2 || f.radii.length > 16)) fail('INPUT', 'radii must list 2 to 16 points, each { at: [x, y, z], radius }');
      const authored = varying ? (f.radii as { at: CadPartPoint3; radius: CadPartDim; atEnd?: unknown }[]).map((p, k) => {
        if (p?.atEnd !== undefined && p.atEnd !== true) fail('INPUT', `radii[${k}].atEnd is true or left out`);
        return { at: xyz(p?.at, `radii[${k}].at`), radius: dim(p?.radius as CadPartDim, `radii[${k}].radius`, true), atEnd: p?.atEnd === true };
      }) : undefined;
      if (authored && authored.filter(p => p.atEnd).length > 2) fail('INPUT', 'at most two radii are at the chain\'s ends');
      const sec = f.kind === 'fillet' ? f.section : undefined;
      if (sec !== undefined && (typeof sec !== 'object' || !['circular', 'conic', 'g2'].includes((sec as { kind?: string }).kind ?? ''))) fail('INPUT', 'section must be { kind: circular | conic (rho) | g2 (tension?) }');
      if (sec?.kind === 'conic' && !(typeof sec.rho === 'number' && sec.rho > 0 && sec.rho < 1)) fail('INPUT', 'a conic section needs rho between 0 and 1');
      if (sec?.kind === 'g2' && sec.tension !== undefined && !(typeof sec.tension === 'number' && sec.tension > 0 && sec.tension < 1)) fail('INPUT', 'a G2 section\'s tension lies between 0 and 1');
      const shape = sec?.kind === 'conic' ? { kind: 'conic' as const, rho: sec.rho } : sec?.kind === 'g2' ? { kind: 'g2' as const, tension: sec.tension ?? 0.5 } : undefined;
      const size = authored ? Math.max(...authored.map(p => p.radius)) : dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => {
        const t = target[0], kind = f.kind as 'chamfer' | 'fillet', reports: FilletReport[] = [];
        const radii = authored && atChainEnds(authored, k.brepOf(t, 'target'), f.edges as string[], fail);
        const solid = finishEdges(t, f.edges as string[], size, kind, at, fail, reports, radii, shape);
        // A body that left the upright family keeps how it was made, so that it can still be shelled — past a
        // variable-radius fillet too (its hollow's radius is the outer one less the wall, D108), not past a conic or G2 one.
        const base = t.solid.kind === 'upright' ? t.solid.solid : t.history?.base, before = t.solid.kind === 'upright' ? [] : t.history?.finishes ?? [];
        const history = solid.kind === 'brep' && base && !shape ? { base, finishes: [...before, { kind, edges: f.edges as string[], size, id: at, ...(radii ? { radii } : {}) }] } : undefined;
        return { kind: 'solid', parts: [{ solid, ...(history ? { history } : {}), ...(reports.length ? { fillet: reports } : {}) }] };
      };
    }
  }
  throw new Error(`finishOperation: ${f.kind} is not one of its features`);
}

type Point = [number, number, number];
/**
 * The radii with the points `atEnd` ones stand for on this body: the two ends of the open chain the edges make, each
 * radius at the end nearest its authored point (a pair: the pairing nearer in all). Other points are kept as given.
 */
function atChainEnds(radii: readonly { at: Point; radius: number; atEnd: boolean }[], brep: ReturnType<PartHelpers['brepOf']>,
  names: readonly string[], fail: Tools['fail']): { at: Point; radius: number }[] {
  const plain = radii.map(p => ({ at: p.at, radius: p.radius })), ending = radii.flatMap((p, i) => p.atEnd ? [i] : []);
  if (!ending.length) return plain;
  const uses = new Map<string, number>();
  for (const name of names) {
    const e = brep.edges.find(x => x.name === name);
    if (!e) fail('SELECTION', `no edge named ${name}`);
    for (const v of e!.vertices) uses.set(v, (uses.get(v) ?? 0) + 1);
  }
  const ends = [...uses].filter(([, n]) => n === 1).map(([v]) => brep.vertices.find(x => x.id === v)!.point as Point);
  if (ends.length !== 2) fail('SELECTION', 'a radius at the chain\'s end needs the edges to make one open chain');
  const d = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  if (ending.length === 1) { const p = radii[ending[0]].at; plain[ending[0]].at = [...(d(p, ends[0]) <= d(p, ends[1]) ? ends[0] : ends[1])]; return plain; }
  const [i, j] = ending, keep = d(radii[i].at, ends[0]) + d(radii[j].at, ends[1]) <= d(radii[i].at, ends[1]) + d(radii[j].at, ends[0]);
  plain[i].at = [...ends[keep ? 0 : 1]]; plain[j].at = [...ends[keep ? 1 : 0]];
  return plain;
}
