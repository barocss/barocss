// R5.3 (D225): the part model's shell and thicken features, moved out of part-model.ts's operation() as they were
// there. `shellOf` stays in part-model.ts and comes in the helpers. The dispatcher calls `shellOperation` for those kinds.
import { BrepError } from '../brep/brep-core.js';
import { isMeshBrepError } from '../mesh/mesh-brep.js';
import { type Point } from '../types.js';
import { thickenSolid } from '../brep/thicken-solid.js';
import { validateSurface } from '../core/math.js';
import type { CadPartDim, Solid, CadPartFeature, Result, Tools, PartHelpers } from './part-model.js';

/** A shell or thicken feature's evaluation (part-model.ts's operation() for these kinds). */
export function shellOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, solids, fail, at } = t;
  const { isRecord, CadPartLimits, shellOf } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'thicken': {
      const g = f.surface as Record<string, unknown>, t = dim(f.thickness as CadPartDim, 'thickness', true), side = f.side ?? 'normal';
      if (!isRecord(g)) fail('INPUT', 'surface must be a NURBS surface { degreeU, degreeV, knotsU, knotsV, controlPoints, weights }');
      if (side !== 'normal' && side !== 'reverse' && side !== 'both') fail('INPUT', 'side must be normal, reverse or both');
      const surface = { kind: 'surface' as const, id: 'surface', degreeU: g.degreeU as number, degreeV: g.degreeV as number, knotsU: g.knotsU as number[], knotsV: g.knotsV as number[], controlPoints: g.controlPoints as Point[][], weights: g.weights as number[][] };
      try { validateSurface(surface); } catch (cause) { fail('INPUT', `surface: ${cause instanceof Error ? cause.message : String(cause)}`); }
      return () => {
        try { return one({ kind: 'brep', brep: thickenSolid({ id: at, surface, thickness: t, side: side as 'normal' }) }); }
        catch (cause) {
          const m = cause instanceof BrepError ? /CAPABILITY: shell: (.*)$/s.exec(cause.message) : null;
          if (m) fail('CAPABILITY', m[1]);
          if (cause instanceof RangeError || isMeshBrepError(cause)) fail('GEOMETRY', cause.message);
          throw cause;
        }
      };
    }
    case 'shell': {
      const target = solids(f.target, 'target'), t = dim(f.thickness as CadPartDim, 'thickness', true);
      const open = f.open === undefined ? [] : f.open as unknown;
      if (!Array.isArray(open) || open.length > CadPartLimits.edges || !open.every(x => typeof x === 'string')) fail('INPUT', 'open must list up to 64 face names');
      if (target.length !== 1) fail('REFERENCE', 'shell one part at a time (name it as id/k)');
      return () => ({ kind: 'solid', parts: [shellOf(target[0], t, open as string[], at, fail)] });
    }
  }
  throw new Error(`shellOperation: ${f.kind} is not one of its features`);
}
