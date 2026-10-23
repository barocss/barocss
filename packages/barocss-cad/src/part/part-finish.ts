// R5.3 (D223): the edge finishes of the part model — fillet and chamfer — moved out of part-model.ts's operation() as
// they were there. `finishEdges` stays in part-model.ts (the shells use it too) and comes in the helpers. The dispatcher
// calls `finishOperation` for those kinds.
import { type FilletReport } from '../rolling-ball.js';
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
      const radii = varying ? (f.radii as { at: CadPartPoint3; radius: CadPartDim }[]).map((p, k) => ({ at: xyz(p?.at, `radii[${k}].at`), radius: dim(p?.radius as CadPartDim, `radii[${k}].radius`, true) })) : undefined;
      const sec = f.kind === 'fillet' ? f.section : undefined;
      if (sec !== undefined && (typeof sec !== 'object' || !['circular', 'conic', 'g2'].includes((sec as { kind?: string }).kind ?? ''))) fail('INPUT', 'section must be { kind: circular | conic (rho) | g2 (tension?) }');
      if (sec?.kind === 'conic' && !(typeof sec.rho === 'number' && sec.rho > 0 && sec.rho < 1)) fail('INPUT', 'a conic section needs rho between 0 and 1');
      if (sec?.kind === 'g2' && sec.tension !== undefined && !(typeof sec.tension === 'number' && sec.tension > 0 && sec.tension < 1)) fail('INPUT', 'a G2 section\'s tension lies between 0 and 1');
      const shape = sec?.kind === 'conic' ? { kind: 'conic' as const, rho: sec.rho } : sec?.kind === 'g2' ? { kind: 'g2' as const, tension: sec.tension ?? 0.5 } : undefined;
      const size = radii ? Math.max(...radii.map(p => p.radius)) : dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => {
        const t = target[0], kind = f.kind as 'chamfer' | 'fillet', reports: FilletReport[] = [], solid = finishEdges(t, f.edges as string[], size, kind, at, fail, reports, radii, shape);
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
