// Sketch-driven solid operation cases, moved unchanged from part-model.ts. Shared geometry/state stays with its owner.
import { BrepError, type Brep } from '../brep/brep-core.js';
import { prismaticFromProfile } from '../features/prismatic-solid.js';
import { draftedExtrusion } from '../features/drafted-extrusion.js';
import { revolveProfile, revolveMassProperties } from '../features/revolve.js';
import { transformBrep } from '../brep/brep-transform.js';
import { loftSolid, type LoftInput, type LoftSectionFrame, type LoftSectionInput } from '../features/loft.js';
import type { XY } from '../brep/curved-arrangement.js';
import type { ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import type { MassProperties } from '../brep/solid-mass.js';
import type { CadPartDim, CadPartFeature, CadPartPoint2, Frame, Result, Solid, SweepStep } from './part-types.js';
import type { Tools } from './part-model.js';

// Private structural dependency contract; the evaluator passes one module-level frozen bag.
interface ProfileSolidHelpers {
  readonly isRecord: (value: unknown) => value is Record<string, unknown>;
  readonly CadPartLimits: { readonly copies: number };
  readonly placed: (frame: Frame | undefined, compute: () => Result) => () => Result;
  readonly sweepBrep: (profile: readonly ProfileSegmentInput[], steps: readonly SweepStep[], at: string, fail: Tools['fail'], through?: XY, sideTags?: readonly string[]) => { brep: Brep; mass: (density: number) => MassProperties };
  readonly guideInFrame: (guide: Record<string, unknown>, frame: Frame | undefined) => Record<string, unknown>;
}
const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });

/** Resolve the same inputs now and return the same deferred operation closure. */
export function profileSolidOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: ProfileSolidHelpers): () => Result {
  const { dim, xy, ref, fail, at } = t;
  const { isRecord, CadPartLimits, placed, sweepBrep, guideInFrame } = k;
  switch (f.kind) {
    case 'extrude': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      const h = dim(f.height as CadPartDim, 'height'), from = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from');
      if (h === 0) fail('PARAMETER', 'height must not be zero');
      const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      const draft = f.draft === undefined ? 0 : f.draft as unknown;
      if (typeof draft !== 'number' || !Number.isFinite(draft) || !(Math.abs(draft) < 89)) fail('INPUT', 'draft must be a number of degrees below 89 in size');
      if (draft === 0) return placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(regions ? { regions } : {}), ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), height: Math.abs(h), from: h > 0 ? from : from + h, tag: at }) }));
      if (regions?.length || holes?.length) fail('CAPABILITY', 'a drafted extrude takes one loop (no regions or holes) yet');
      // Built upwards from the sketch plane, then turned over for a downward extrude (the walls lean
      // away from the sketch plane either way).
      return placed(frame, () => {
        let brep: Brep;
        try { brep = draftedExtrusion({ profile: outer, z0: 0, z1: Math.abs(h), draft: draft as number, tag: at, id: at, ...(tags ? { sideTags: tags.outer } : {}) }); }
        catch (cause) { if (cause instanceof BrepError) fail(/not supported yet/.test(cause.message) ? 'CAPABILITY' : 'PARAMETER', cause.message.replace(/^B-rep: drafted extrusion: /, '')); throw cause; }
        return one({ kind: 'brep', brep: transformBrep(brep!, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, h > 0 ? 1 : -1], offset: [0, 0, from] }) });
      });
    }
    case 'revolve': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length) fail('CAPABILITY', 'revolve takes one outer loop with optional holes (no regions)');
      const ax = f.axis as { origin?: CadPartPoint2; direction?: unknown } | undefined;
      // The axis lies in the sketch plane: along its X or Y, or any direction [dx, dy] there.
      const free = Array.isArray(ax?.direction) && ax!.direction.length === 2 && ax!.direction.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.hypot(...(ax!.direction as number[])) > 1e-12;
      if (!isRecord(ax) || (ax.direction !== 'x' && ax.direction !== 'y' && !free)) fail('INPUT', 'axis must be { origin: [x, y], direction: "x" | "y" | [dx, dy] }');
      const origin = xy(ax!.origin, 'axis origin'), deg = f.angle === undefined ? 360 : f.angle as number;
      if (typeof deg !== 'number' || !(deg > 0 && deg <= 360)) fail('INPUT', 'angle must be in (0, 360]');
      const rtags = (sketch as Extract<Result, { kind: 'sketch' }>).tags;
      const input = { id: at, profile: (sketch as Extract<Result, { kind: 'sketch' }>).outer, axis: { origin, direction: (free ? ax!.direction : ax!.direction === 'x' ? [1, 0] : [0, 1]) as XY }, angle: deg, ...((sketch as Extract<Result, { kind: 'sketch' }>).holes?.length ? { holes: (sketch as Extract<Result, { kind: 'sketch' }>).holes } : {}), ...(rtags ? { sideTags: rtags.outer, holeTags: rtags.holes } : {}) };
      return placed((sketch as Extract<Result, { kind: 'sketch' }>).frame, () => ({ kind: 'solid', parts: [{ solid: { kind: 'brep', brep: revolveProfile(input) }, mass: (density: number) => revolveMassProperties(input, density), revolved: input }] }));
    }
    case 'sweep': {
      const sketch = ref(f.sketch, 'sketch').result;
      if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
      if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'sweep takes a sketch of one loop (no regions or holes) yet');
      const path = f.path as unknown;
      if (!Array.isArray(path) || !path.length || path.length > CadPartLimits.copies) fail('INPUT', 'path must list 1 to 64 steps');
      const steps = (path as unknown[]).map((st, i): { kind: 'straight'; length: number } | { kind: 'bend'; radius: number; angle: number; toward: 'x' | '-x' | 'y' | '-y' } => {
        if (!isRecord(st)) return fail('INPUT', `path[${i}] must be a step`);
        if (st.kind === 'straight') return { kind: 'straight', length: dim(st.length as CadPartDim, `path[${i}].length`, true) };
        if (st.kind === 'bend') {
          const a = st.angle, toward = st.toward;
          if (typeof a !== 'number' || !(a > 0 && a <= 180)) fail('INPUT', `path[${i}].angle must be in (0, 180]`);
          if (toward !== 'x' && toward !== '-x' && toward !== 'y' && toward !== '-y') fail('INPUT', `path[${i}].toward must be x, -x, y or -y`);
          return { kind: 'bend', radius: dim(st.radius as CadPartDim, `path[${i}].radius`, true), angle: a as number, toward: toward as 'x' | '-x' | 'y' | '-y' };
        }
        return fail('INPUT', `path[${i}].kind must be straight or bend`);
      });
      const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
      return placed(frame, () => { const { brep, mass } = sweepBrep(outer, steps, at, fail, undefined, tags?.outer); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass, swept: { profile: outer, steps, ...(tags ? { sideTags: tags.outer } : {}) } }] }; });
    }
    case 'loft': {
      const list = f.sections as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'sections must list 2 to 64 sections');
      const framedSections = (list as unknown[]).some(sec => isRecord(sec) && (sec.frame !== undefined || Object.hasOwn(sec, 'profile')));
      // (CG1.3: a general guide — kind nurbs — on sketches stacked along their plane's normal takes the z path.)
      const nurbsGuide = isRecord(f.guide) && (f.guide as { kind?: unknown }).kind === 'nurbs' && !framedSections;
      if ((f.guide !== undefined && !nurbsGuide) || framedSections) {
        if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
        const framed = (list as unknown[]).map((sec, i) => {
          if (!isRecord(sec) || sec.frame === undefined || sec.z !== undefined) return fail('INPUT', `sections[${i}] need an explicit frame without z`);
          if (Object.hasOwn(sec, 'profile')) {
            if (Object.hasOwn(sec, 'sketch') || !isRecord(sec.profile) || sec.profile.kind !== 'ellipse') return fail('INPUT', `sections[${i}] must provide an ellipse profile or a sketch, never both`);
            return { profile: sec.profile as unknown as Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>, frame: sec.frame as unknown as LoftSectionFrame, tags: undefined };
          }
          if (typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch or an inline ellipse profile`);
          const sketch = ref(sec.sketch, 'sketch').result;
          if (sketch.kind !== 'sketch') return fail('REFERENCE', `${sec.sketch} is not a sketch`);
          if (sketch.regions?.length || sketch.holes?.length) return fail('CAPABILITY', 'oriented loft sections need one loop without holes');
          return { profile: sketch.outer, frame: sec.frame as unknown as LoftSectionFrame, tags: sketch.tags };
        });
        return () => {
          const { brep, mass } = loftSolid({ id: at, name: at, sections: framed, smooth: f.smooth === true, ...(f.guide !== undefined ? { guide: f.guide as LoftInput['guide'] } : {}), ...(framed[0].tags ? { sideTags: framed[0].tags.outer } : {}) });
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] };
        };
      }
      const sections = (list as unknown[]).map((sec, i) => {
        if (!isRecord(sec) || typeof sec.sketch !== 'string') return fail('INPUT', `sections[${i}] must name a sketch`);
        const sketch = ref(sec.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${sec.sketch} is not a sketch`);
        if ((sketch as Extract<Result, { kind: 'sketch' }>).regions?.length || (sketch as Extract<Result, { kind: 'sketch' }>).holes?.length) fail('CAPABILITY', 'loft sections are sketches of one loop (no regions or holes) yet');
        const { outer, frame, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        return { profile: outer, z: dim(sec.z as CadPartDim, `sections[${i}].z`), frame, tags };
      });
      // The sections stack along one sketch plane's normal.
      const frame = sections[0].frame;
      if (sections.some(x => JSON.stringify(x.frame) !== JSON.stringify(frame))) fail('INPUT', 'loft sections must be sketched on the same plane');
      sections.forEach((s, i) => { if (i && !(s.z > sections[i - 1].z)) fail('PARAMETER', `sections[${i}] must lie above sections[${i - 1}] (z ${s.z} ≤ ${sections[i - 1].z})`); });
      if (f.smooth !== undefined && typeof f.smooth !== 'boolean') fail('INPUT', 'smooth must be true or false');
      const guide = nurbsGuide ? { guide: guideInFrame(f.guide as Record<string, unknown>, frame) as LoftInput['guide'] } : {};
      return placed(frame, () => { const { brep, mass } = loftSolid({ id: at, name: at, sections: sections.map(({ profile, z }) => ({ profile, z })), smooth: f.smooth === true, ...guide, ...(sections[0].tags ? { sideTags: sections[0].tags.outer } : {}) }); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, mass }] }; });
    }
    default: return fail('INPUT', `unknown profile solid kind ${f.kind}`);
  }
}
