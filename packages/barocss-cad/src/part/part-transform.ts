// Transform and pattern operation cases, moved unchanged from part-model.ts. Shared geometry/state stays with its owner.
import { fillCutSnapshot, fillCutPlacements } from '../features/fill-cut-pattern.js';
import { curveCutOffsets } from '../features/curve-cut-pattern.js';
import type { BrepAffine } from '../brep/brep-transform.js';
import type { Point } from '../types.js';
import type { CadPartAxis, CadPartDim, CadPartFeature, CadPartPoint3, Part, Result, Solid } from './part-types.js';
import type { Tools } from './part-model.js';

// Private structural dependency contract; the evaluator passes one module-level frozen bag.
interface TransformHelpers {
  readonly boolean: (a: Solid, b: Solid, op: 'union' | 'difference' | 'intersection', at: string, edgeFitTolerance?: number) => Solid;
  readonly affine: (s: Solid, m: BrepAffine['matrix'], o: readonly number[], rename?: ((n: string) => string) | string) => Solid;
  readonly rotation: (axis: CadPartAxis, deg: number, pivot: Point) => { m: BrepAffine['matrix']; o: Point };
  readonly moveAll: (parts: readonly Part[], m: BrepAffine['matrix'], o: Point, preserveNativeSI?: boolean) => Result;
  readonly unionAll: (list: Solid[], at: string) => Solid;
  readonly rotate: (s: Solid, axis: CadPartAxis, deg: number, pivot: Point, rename?: (n: string) => string) => Solid;
  readonly CadPartLimits: { readonly copies: number; readonly length: number };
}
const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
const many = (parts: Solid[]): Result => ({ kind: 'solid', parts: parts.map(solid => ({ solid })) });

/** Resolve the same inputs now and return the same deferred operation closure. */
export function transformOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: TransformHelpers): () => Result {
  const { dim, xyz, integer, axisOf, solids, fail, at } = t;
  const { boolean, affine, rotation, moveAll, unionAll, rotate, CadPartLimits } = k;
  switch (f.kind) {
    case 'translate': {
      const target = solids(f.target, 'target'), o = xyz(f.offset as CadPartPoint3, 'offset');
      return () => moveAll(target, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, true);
    }
    case 'rotate': {
      const target = solids(f.target, 'target'), axis = axisOf(f.axis), deg = f.angle as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > 3600) fail('INPUT', 'angle must be a finite number of degrees');
      return () => { const { m, o } = rotation(axis, deg, pivot); return moveAll(target, m, o); };
    }
    case 'mirror': {
      const target = solids(f.target, 'target'), plane = f.plane;
      if (plane !== 'xy' && plane !== 'xz' && plane !== 'yz') fail('INPUT', 'plane must be xy, xz or yz');
      const m: BrepAffine['matrix'] = plane === 'xy' ? [1, 0, 0, 0, 1, 0, 0, 0, -1] : plane === 'xz' ? [1, 0, 0, 0, -1, 0, 0, 0, 1] : [-1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (!f.keep) return () => moveAll(target, m, [0, 0, 0]);
      return () => many(target.map(p => boolean(p.solid, affine(p.solid, m, [0, 0, 0], n => n + '@m'), 'union', at)));
    }
    case 'scale': {
      const target = solids(f.target, 'target'), k = f.factor as number, pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof k !== 'number' || !(k > 0 && k <= 1000 && Number.isFinite(k))) fail('INPUT', 'factor must be a positive number at most 1000');
      return () => moveAll(target, [k, 0, 0, 0, k, 0, 0, 0, k], [pivot[0] * (1 - k), pivot[1] * (1 - k), pivot[2] * (1 - k)]);
    }
    case 'linear-pattern': {
      // (A pattern of an empty result — an intersection that met nothing — is empty, as the Booleans take it: D190.)
      const target = solids(f.target, 'target', true), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => many(target.map(p => {
        const copies = Array.from({ length: count }, (_, k) => { if (!k) return p.solid; const o: Point = [0, 0, 0]; o['xyz'.indexOf(axis)] = spacing * k; return affine(p.solid, [1, 0, 0, 0, 1, 0, 0, 0, 1], o, n => `${n}@${k}`); });
        return unionAll(copies, at);
      }));
    }
    case 'linear-feature-pattern': {
      const { seed, tool } = t.cutSource(f.target), axis = axisOf(f.axis), spacing = dim(f.spacing as CadPartDim, 'spacing'), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      if (spacing === 0) fail('PARAMETER', 'spacing must not be zero');
      return () => {
        if (count === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = tool.slice(1).reduce<Solid>((acc, p) => boolean(acc, p.solid, 'union', at), tool[0].solid);
        // The seed already contains the original cut. Translate only its tool for the remaining cuts.
        let cut = seed.solid;
        for (let k = 1; k < count; k++) {
          const offset: Point = [0, 0, 0]; offset['xyz'.indexOf(axis)] = spacing * k;
          cut = boolean(cut, affine(joined, [1, 0, 0, 0, 1, 0, 0, 0, 1], offset, n => `${n}@${k}`), 'difference', at);
        }
        return one(cut);
      };
    }
    case 'rectangular-feature-pattern': {
      const axis = axisOf(f.axis), axis2 = axisOf(f.axis2);
      if (axis === axis2) fail('INPUT', 'rectangular feature pattern axes must be distinct');
      const spacing = dim(f.spacing as CadPartDim, 'spacing'), spacing2 = dim(f.spacing2 as CadPartDim, 'spacing2');
      if (spacing === 0 || spacing2 === 0) fail('PARAMETER', 'rectangular feature pattern spacing must not be zero');
      const count = integer(f.count, 'count', 1, CadPartLimits.copies), count2 = integer(f.count2, 'count2', 1, CadPartLimits.copies);
      const cells = count * count2;
      if (!Number.isSafeInteger(cells) || cells > CadPartLimits.copies) fail('INPUT', `rectangular feature pattern must have at most ${CadPartLimits.copies} cells`);
      const { seed, tool } = t.cutSource(f.target), first = 'xyz'.indexOf(axis), second = 'xyz'.indexOf(axis2);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (cells === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (let j = 0; j < count2; j++) for (let i = 0; i < count; i++) {
          if (i === 0 && j === 0) continue;
          const offset: Point = [0, 0, 0]; offset[first] = spacing * i; offset[second] = spacing2 * j;
          cut = boolean(cut, affine(joined, matrix, offset, `@${i},${j}`), 'difference', at);
        }
        return one(cut);
      };
    }
    case 'fill-feature-pattern': {
      const spacing = dim(f.spacing as CadPartDim, 'spacing'), spacing2 = dim(f.spacing2 as CadPartDim, 'spacing2');
      if (spacing === 0 || spacing2 === 0) fail('PARAMETER', 'fill feature pattern spacing must not be zero');
      const count = integer(f.count, 'count', 1, CadPartLimits.copies), count2 = integer(f.count2, 'count2', 1, CadPartLimits.copies);
      if (count * count2 > CadPartLimits.copies) fail('INPUT', `fill feature pattern must have at most ${CadPartLimits.copies} candidate cells`);
      const snapshot = fillCutSnapshot(f.region, f.anchor, fail);
      const placements = fillCutPlacements(snapshot.region, snapshot.anchor, spacing, count, spacing2, count2);
      const { seed, tool } = t.cutSource(f.target);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (!placements.length || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (const placement of placements) cut = boolean(cut, affine(joined, matrix, placement.offset, placement.suffix), 'difference', at);
        return one(cut);
      };
    }
    case 'curve-feature-pattern': {
      const spacing = dim(f.spacing as CadPartDim, 'spacing', true), count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const offsets = curveCutOffsets(f.path, spacing, count, CadPartLimits.length, fail);
      const { seed, tool } = t.cutSource(f.target);
      const matrix: BrepAffine['matrix'] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return () => {
        if (count === 1 || !tool.length) return { kind: 'solid', parts: [seed] };
        const joined = unionAll(tool.map(p => p.solid), at);
        let cut = seed.solid;
        for (let k = 1; k < count; k++) cut = boolean(cut, affine(joined, matrix, offsets[k], `@${k}`), 'difference', at);
        return one(cut);
      };
    }
    case 'circular-pattern': {
      const target = solids(f.target, 'target', true), axis = axisOf(f.axis), deg = f.angle as number, count = integer(f.count, 'count', 1, CadPartLimits.copies);
      const pivot = f.pivot === undefined ? [0, 0, 0] as Point : xyz(f.pivot as CadPartPoint3, 'pivot');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || deg === 0 || Math.abs(deg) > 360) fail('INPUT', 'angle must be a nonzero step of at most 360°');
      if (axis !== 'z' && Math.round(deg / 90) * 90 !== deg) fail('CAPABILITY', 'patterns about X or Y must step by multiples of 90°');
      return () => many(target.map(p => {
        return unionAll(Array.from({ length: count }, (_, k) => k ? rotate(p.solid, axis, deg * k, pivot, n => `${n}@${k}`) : p.solid), at);
      }));
    }
    default: return fail('INPUT', `unknown transform or pattern kind ${f.kind}`);
  }
}
