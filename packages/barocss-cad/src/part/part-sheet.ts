// R5.3 (D226): the part model's sheet-metal features — base and contour flanges, corner reliefs and edge flanges — moved
// out of part-model.ts's operation() as they were there. Their helpers stay in part-model.ts and come in the helpers.
// The dispatcher calls `sheetOperation` for those kinds.
import { type BendTable, isSheetMetalError, type SheetReport, bendAllowance, bendDeduction, bendTableProblem, contourFlangeSection, outsideSetback } from '../frame-sheet/sheet-metal.js';
import { type Point } from '../types.js';
import { prismaticFromProfile } from '../features/prismatic-solid.js';
import type { CadPartDim, CadPartPoint2, CadPartSketchPlane, Result, Solid, CadPartFeature, Tools, PartHelpers } from './part-model.js';

/** A sheet-metal feature's evaluation (part-model.ts's operation() for these kinds). */
export function sheetOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xy, xyz, solids, ref, fail, at } = t;
  const { isRecord, CadPartLimits, bendK, frameOf, framed, placed, sheetCornerRelief, sheetFlange, withSheet } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'sheet-base': case 'sheet-contour': {
      const T = dim(f.thickness as CadPartDim, 'thickness', true), R = dim(f.bendRadius as CadPartDim, 'bendRadius', true), K = f.kFactor, table = f.bendTable as BendTable | undefined;
      if ((K === undefined) === (table === undefined)) fail('PARAMETER', 'give the sheet a kFactor or a bendTable (one of them)');
      if (K !== undefined && (typeof K !== 'number' || !Number.isFinite(K) || K < 0 || K > 1)) fail('PARAMETER', 'kFactor must be a number from 0 to 1 (the neutral layer lies within the sheet)');
      const problem = table === undefined ? null : bendTableProblem(table);
      if (problem) fail('PARAMETER', `[BEND_TABLE] ${problem}`);
      const rules = K !== undefined ? { kFactor: K as number } : { bendTable: table! };
      if (f.kind === 'sheet-base') {
        const sketch = ref(f.sketch, 'sketch').result;
        if (sketch.kind !== 'sketch') fail('REFERENCE', `${f.sketch} is not a sketch`);
        const { outer, frame, regions, holes, tags } = sketch as Extract<Result, { kind: 'sketch' }>;
        if (regions?.length) fail('CAPABILITY', 'a sheet\'s base takes one outer loop (holes allowed) yet');
        if (f.reverse !== undefined && typeof f.reverse !== 'boolean') fail('INPUT', 'reverse must be true or false');
        const report: SheetReport = { thicknessMM: T, bendRadiusMM: R, ...rules, fixedFace: `${at}.top`, bends: [] };
        return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer, ...(holes ? { holes } : {}), ...(tags ? { sideTags: tags } : {}), heightMM: T, fromMM: f.reverse ? -T : 0, tag: at }) }))(), report);
      }
      const list = f.path as unknown;
      if (!Array.isArray(list) || list.length < 2 || list.length > CadPartLimits.copies) fail('INPUT', 'path must list 2 to 64 points');
      const path = (list as CadPartPoint2[]).map((p, i) => xy(p, `path[${i}]`));
      if (f.side !== 'left' && f.side !== 'right') fail('INPUT', 'side must be left or right (where the material lies, looking along the path)');
      const width = dim(f.width as CadPartDim, 'width', true), frame = f.plane === undefined ? undefined : frameOf(f.plane as CadPartSketchPlane, xyz, fail);
      let section: ReturnType<typeof contourFlangeSection>;
      try { section = contourFlangeSection(path, f.side as 'left' | 'right', T, R, at); }
      catch (cause) { if (isSheetMetalError(cause)) fail(cause.code, cause.message); throw cause; }
      const report: SheetReport = { thicknessMM: T, bendRadiusMM: R, ...rules, fixedFace: `${at}.leg0.a`, bends: section!.bends.map(b => {
        const angle = Math.abs(b.angle), k = bendK(rules, T, R, angle, `bend${b.vertex}`, fail);
        return { name: `${at}.bend${b.vertex}`, inner: b.inner, outer: b.outer, radiusMM: R, angleDegrees: angle * 180 / Math.PI, axis: { origin: framed(frame, [b.center[0], b.center[1], 0]), direction: frame ? [frame.m[2], frame.m[5], frame.m[8]] as Point : [0, 0, 1] as Point },
          allowanceMM: bendAllowance(angle, R, T, k.kFactor), setbackMM: outsideSetback(angle, R, T), deductionMM: bendDeduction(angle, R, T, k.kFactor), kFactor: k.kFactor, ...(k.use ? { table: k.use } : {}) };
      }) };
      return () => withSheet(placed(frame, () => one({ kind: 'upright', solid: prismaticFromProfile({ outer: section!.segments, heightMM: width, fromMM: 0, tag: at, names: { outer: section!.names, bottom: `${at}.front`, top: `${at}.back` } }) }))(), report);
    }
    case 'sheet-corner-relief': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a corner relief takes one sheet body');
      const p = parts[0];
      if (!p.sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      if (f.shape !== 'square' && f.shape !== 'round') fail('INPUT', 'shape must be square or round');
      if (typeof f.corner !== 'string') fail('INPUT', 'corner must name the edge of the corner (between its two thickness faces)');
      const size = dim(f.size as CadPartDim, 'size', true);
      return () => sheetCornerRelief(p, p.sheet!, at, f.corner as string, f.shape as 'square' | 'round', size, fail);
    }
    case 'sheet-flange': {
      const parts = solids(f.target, 'target');
      if (parts.length !== 1) fail('SELECTION', 'a flange takes one sheet body');
      const p = parts[0], sheet = p.sheet;
      if (!sheet) return fail('CAPABILITY', '[NOT_A_SHEET] the target is not sheet metal: made by a sheet feature (its holes and cuts carry it; moves, patterns and unions do not)');
      const T = sheet.thicknessMM, R = f.bendRadius === undefined ? sheet.bendRadiusMM : dim(f.bendRadius as CadPartDim, 'bendRadius', true), L = dim(f.length as CadPartDim, 'length', true);
      const deg = f.angleDegrees === undefined ? 90 : f.angleDegrees;
      if (typeof deg !== 'number' || !Number.isFinite(deg)) fail('INPUT', 'angleDegrees must be a number');
      if (!((deg as number) > 1e-6 && (deg as number) < 180 - 1e-6)) fail('PARAMETER', `[BEND_ANGLE] a flange bends between 0 and 180° (not ${deg}°: 180° is a hem, not supported yet)`);
      const measure = f.measure ?? 'outer', position = f.position ?? 'material-inside';
      if (measure !== 'outer' && measure !== 'inner' && measure !== 'tangent') fail('INPUT', 'measure must be outer, inner or tangent');
      if (position !== 'material-inside' && position !== 'material-outside' && position !== 'bend-outside') fail('INPUT', 'position must be material-inside, material-outside or bend-outside');
      const offs = f.offsets === undefined ? [0, 0] : f.offsets as unknown;
      if (!Array.isArray(offs) || offs.length !== 2) fail('INPUT', 'offsets must be [from the start, from the end]');
      const off = (offs as CadPartDim[]).map((v, i) => { const x = dim(v, `offsets[${i}]`); if (x < 0) fail('PARAMETER', 'offsets must not be negative'); return x; }) as [number, number];
      // (The relief has no defaults in the kernel (D119): its kind, and for a cut its width and depth, are given — or it
      // is refused where an end lies inside the edge. Absent: undefined; 'none': null.)
      const rl = f.relief as Record<string, unknown> | undefined;
      if (rl !== undefined && !isRecord(rl)) fail('INPUT', 'relief must be { kind, width, depth }');
      if (rl !== undefined && rl.kind !== 'rectangular' && rl.kind !== 'obround' && rl.kind !== 'none') fail('INPUT', 'relief.kind must be rectangular, obround or none');
      for (const k of ['width', 'depth'] as const) if (rl !== undefined && rl.kind !== 'none' && rl[k] === undefined) fail('PARAMETER', `[RELIEF_REQUIRED] a ${String(rl.kind)} relief needs its ${k} (mm): the kernel takes no default`);
      const relief = rl === undefined ? undefined : rl.kind === 'none' ? null : { kind: rl.kind as 'rectangular' | 'obround', width: dim(rl.width as CadPartDim, 'relief width', true), depth: dim(rl.depth as CadPartDim, 'relief depth', true) };
      if (typeof f.edge !== 'string') fail('INPUT', 'edge must name an edge of the sheet');
      const th = (deg as number) * Math.PI / 180, ossb = outsideSetback(th, R, T), issb = R * Math.tan(th / 2);
      const straight = measure === 'outer' ? L - ossb : measure === 'inner' ? L - issb : L;
      if (!(straight > 1e-6)) fail('PARAMETER', `[BEND_DOES_NOT_FIT] a flange ${L} mm long (${measure}) is within its bend's setback of ${+(measure === 'inner' ? issb : ossb).toFixed(6)} mm`);
      const trim = position === 'material-inside' ? ossb : position === 'material-outside' ? issb : 0, k = bendK(sheet, T, R, th, 'the flange', fail);
      return () => sheetFlange({ part: p, sheet, at, edge: f.edge as string, T, K: k, R, th, trim, straight, off, relief, fail });
    }
  }
  throw new Error(`sheetOperation: ${f.kind} is not one of its features`);
}
