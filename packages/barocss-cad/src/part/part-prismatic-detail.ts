// Prismatic detail operation cases, moved unchanged from part-model.ts. Shared geometry/state stays with its owner.
import { profileRelief, type ReliefSketch } from '../features/profile-relief.js';
import type { Brep } from '../brep/brep-core.js';
import type { PrismaticSolid } from '../features/prismatic-solid.js';
import type { Point } from '../types.js';
import type { CadPartDim, CadPartFeature, CadPartPoint2, CadPartPoint3, Part, Result, Solid } from './part-types.js';
import type { Tools } from './part-model.js';

// Private structural dependency contract; the evaluator passes one module-level frozen bag.
interface PrismaticDetailHelpers {
  readonly CadPartLimits: { readonly edges: number; readonly length: number };
  readonly lineOnly: (s: PrismaticSolid) => boolean;
  readonly brepOf: (part: Part, id: string) => Brep;
  readonly boxSolid: (min: Point, max: Point, tag: string) => Solid;
  readonly boolean: (a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number) => Solid;
  readonly empty: (s: Solid) => boolean;
  readonly exactVolume: (s: Solid) => number;
}
const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });

/** Resolve the same inputs now and return the same deferred operation closure. */
export function prismaticDetailOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PrismaticDetailHelpers): () => Result {
  const { dim, xy, xyz, solids, ref, fail, at } = t;
  const { CadPartLimits, lineOnly, brepOf, boxSolid, boolean, empty, exactVolume } = k;
  switch (f.kind) {
    case 'rib': {
      const target = solids(f.target, 'target'), min = xyz(f.min as CadPartPoint3, 'min'), max = xyz(f.max as CadPartPoint3, 'max');
      if (target.length !== 1) fail('REFERENCE', 'rib target must be one nonempty solid');
      if (!min.every((v, k) => v < max[k])) fail('PARAMETER', 'rib min must be below max on every axis');
      const source = target[0].solid, body = brepOf({ solid: source }, at);
      if (body.bodies.length !== 1 || body.bodies[0].kind !== 'solid') fail('REFERENCE', 'rib target must be one nonempty solid');
      // Stay in the existing straight-sided prismatic Boolean and volume path; no curved quadrature admission.
      if (source.kind !== 'upright' || !lineOnly(source.solid)) fail('CAPABILITY', 'rib requires a straight-sided upright prismatic target');
      return () => {
        const rib = boxSolid(min, max, at);
        const overlap = boolean(source, rib, 'intersection', at);
        const overlapVolume = empty(overlap) ? 0 : exactVolume(overlap);
        if (!(Number.isFinite(overlapVolume) && overlapVolume > 0)) fail('GEOMETRY', 'rib must have positive volume overlap with its target');
        const added = boolean(rib, source, 'difference', at);
        const addedVolume = empty(added) ? 0 : exactVolume(added);
        if (!(Number.isFinite(addedVolume) && addedVolume > 0)) fail('GEOMETRY', 'rib must add positive volume outside its target');
        const joined = boolean(source, rib, 'union', at), joinedBrep = brepOf({ solid: joined }, at);
        const volume = empty(joined) ? 0 : exactVolume(joined);
        if (joinedBrep.bodies.length !== 1 || joinedBrep.bodies[0].kind !== 'solid' || !(Number.isFinite(volume) && volume > 0)) fail('GEOMETRY', 'rib union must be one nonempty solid');
        return one(joined);
      };
    }
    case 'profile-relief': {
      const target = solids(f.target, 'target'), names = f.sketches as unknown, selected = f.faces as unknown, depth = dim(f.depth as CadPartDim, 'depth', true), mode = f.mode;
      if (mode !== 'emboss' && mode !== 'engrave') fail('INPUT', 'profile relief mode must be emboss or engrave');
      if (!Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== 'string' || !selected[0] || selected[0].includes('+')) fail('INPUT', 'profile relief faces must contain exactly one exact cap face name');
      const face = (selected as string[])[0];
      if (f.clearance !== undefined && (typeof f.clearance !== 'number' || !Number.isFinite(f.clearance) || f.clearance < 0 || f.clearance > CadPartLimits.length)) fail('INPUT', 'profile relief clearance must be a finite nonnegative native length');
      if (!Array.isArray(names) || !names.length || names.length > CadPartLimits.edges) fail('INPUT', 'profile relief needs 1..64 distinct component sketch references');
      if (target.length !== 1) fail('REFERENCE', 'profile relief target must be one nonempty solid');
      const source = target[0].solid;
      if (source.kind !== 'upright' || !lineOnly(source.solid) || source.solid.slabs.length !== 1) fail('CAPABILITY', 'profile relief requires one line-only upright slab');
      const seen = new Set<string>(), sketches: ReliefSketch[] = [];
      for (const name of names as unknown[]) {
        if (typeof name !== 'string' || !name || seen.has(name)) fail('INPUT', 'profile relief needs distinct component sketch names');
        seen.add(name as string);
        const sketch = ref(name, 'component sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', 'profile relief component references must name sketches');
        sketches.push(sketch as Extract<Result, { kind: 'sketch' }>);
      }
      return () => one({ kind: 'upright', solid: profileRelief((source as Extract<Solid, { kind: 'upright' }>).solid, brepOf(target[0], at), face as string, sketches, depth, mode as 'emboss' | 'engrave', f.clearance as number | undefined, at, fail) });
    }
    case 'rectangular-relief': {
      const target = solids(f.target, 'target'), min = xy(f.min as CadPartPoint2, 'min'), max = xy(f.max as CadPartPoint2, 'max'), depth = dim(f.depth as CadPartDim, 'depth', true), mode = f.mode;
      if (mode !== 'emboss' && mode !== 'engrave') fail('INPUT', 'rectangular relief mode must be emboss or engrave');
      if (!min.every((v, k) => v < max[k])) fail('PARAMETER', 'rectangular relief min must be below max on both axes');
      if (target.length !== 1) fail('REFERENCE', 'rectangular relief target must be one nonempty solid');
      const source = target[0].solid, body = brepOf({ solid: source }, at);
      if (body.bodies.length !== 1 || body.bodies[0].kind !== 'solid') fail('REFERENCE', 'rectangular relief target must be one nonempty solid');
      const prism = source.kind === 'upright' && lineOnly(source.solid) && source.solid.slabs.length === 1 ? source.solid : fail('CAPABILITY', 'rectangular relief requires one straight-sided upright slab with a planar top');
      const slab = prism.slabs[0];
      if (!(depth < slab.z1 - slab.z0)) fail('PARAMETER', 'rectangular relief depth must be below the target height');
      const top = dim(slab.z1 + depth, 'relief tool top');
      return () => {
        // Full-height support tests the actual footprint, including holes and concavities, not its AABB.
        const support = boxSolid([min[0], min[1], slab.z0], [max[0], max[1], slab.z1], `${at}.support`);
        if (!empty(boolean(support, source, 'difference', at))) fail('GEOMETRY', 'rectangular relief footprint must be fully supported by the target top');
        // Existing material seats the raised rectangle; the external portion adds exactly the authored depth.
        const tool = boxSolid([min[0], min[1], slab.z1 - depth], [max[0], max[1], top], at);
        const overlap = boolean(source, tool, 'intersection', at), removed = empty(overlap) ? 0 : exactVolume(overlap);
        if (!(Number.isFinite(removed) && removed > 0)) fail('GEOMETRY', 'rectangular relief must overlap positive target volume');
        if (mode === 'emboss') {
          const extra = boolean(tool, source, 'difference', at), added = empty(extra) ? 0 : exactVolume(extra);
          if (!(Number.isFinite(added) && added > 0)) fail('GEOMETRY', 'rectangular relief must add positive volume');
        }
        const result = boolean(source, tool, mode === 'emboss' ? 'union' : 'difference', at), resultBrep = brepOf({ solid: result }, at);
        const volume = empty(result) ? 0 : exactVolume(result);
        if (resultBrep.bodies.length !== 1 || resultBrep.bodies[0].kind !== 'solid' || !(Number.isFinite(volume) && volume > 0)) fail('GEOMETRY', 'rectangular relief result must be one nonempty solid');
        const sourceVolume = exactVolume(source), change = mode === 'emboss' ? volume - sourceVolume : sourceVolume - volume;
        if (!(Number.isFinite(change) && change > 0)) fail('GEOMETRY', 'rectangular relief must change positive target volume');
        return one(result);
      };
    }
    default: return fail('INPUT', `unknown prismatic detail kind ${f.kind}`);
  }
}
