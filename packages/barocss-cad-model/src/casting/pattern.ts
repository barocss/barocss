// IM8b (O108): a casting's pattern — the part with its machining allowance on the faces marked machined (each flat face
// moved out by it, the studio's offset-face), then scaled up by the shrinkage about the part's box centre (the studio's
// scale); written as a document (its STEP is the pattern's) and `pattern.json`, the factors, their bands and pages.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { materialIdOf } from '../app/bodies';
import { materialData } from '../library/materials';
import { castingProfileOf, hasCastingRules, noCastingRules } from '../engine/castingRuleRows';
import { dispatchTool, type ChatState } from '../chat/tools';
import { machinedFaces, machiningOf, machiningView, partExtent, shrinkByDimension, shrinkOf, shrinkView, type MachiningAllowance, type ShrinkAllowance } from './allowances';
import { r6 } from '../util/round';

type Evaluate = Parameters<typeof dispatchTool>[3];
export type PatternCode = 'PATTERN_NOT_CASTING' | 'PATTERN_ONE_BODY' | 'PATTERN_MATERIAL' | 'PATTERN_SHRINK' | 'PATTERN_ALLOWANCE' | 'PATTERN_FACE' | 'PATTERN_BUILD';
export interface PatternFile {
  readonly format: 'barocss-pattern'; readonly version: 1; readonly process: string; readonly material: string; readonly family: string;
  readonly shrink: Omit<ShrinkAllowance, never> & { readonly factor: number; readonly simplification: string; readonly byDimension: readonly { axis: string; extentMM: number; factor: number; band: string }[] };
  readonly machining: (Omit<MachiningAllowance, never> & { readonly faces: readonly string[] }) | null;
  readonly pivot: readonly number[]; readonly part: { readonly min: readonly number[]; readonly max: readonly number[] }; readonly pattern: { readonly min: readonly number[]; readonly max: readonly number[] };
  readonly note: string;
}
export type PatternResult = { ok: true; doc: StudioDoc; bodies: BodyResult[]; file: PatternFile } | { ok: false; code: PatternCode; message: string };

const failed = (code: PatternCode, message: string): PatternResult => ({ ok: false, code, message });

/** The pattern of a one-body cast part: its machining allowance on the marked flat faces, then its shrinkage. */
export async function patternOf(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<PatternResult> {
  const profile = castingProfileOf(doc, doc.process);
  if (profile?.id === 'sand-casting' && !hasCastingRules(doc, profile.id)) return failed('PATTERN_NOT_CASTING', noCastingRules(profile.id));
  if (!profile?.allowances) return failed('PATTERN_NOT_CASTING', `${profile ? profile.label : 'no process'}: a pattern needs a casting process with allowance tables (sand casting)`);
  if (bodies.length !== 1) return failed('PATTERN_ONE_BODY', `a pattern is of one body; the part has ${bodies.length}`);
  const id = materialIdOf(doc, bodies[0]) ?? null, m = id ? materialData(id) : undefined;
  if (!m?.castFamily) return failed('PATTERN_MATERIAL', m ? `${m.label} is not a casting alloy` : 'the material is not set (set_material): none is assumed');
  const box = partExtent(bodies), family = m.castFamily;
  const shrink = shrinkOf(doc, profile, family, box.largestMM);
  if (!shrink.ok) return failed('PATTERN_SHRINK', shrink.why);
  const marked = machinedFaces(doc, bodies);
  if (marked.missing.length) return failed('PATTERN_FACE', `marked machined but not on the part: ${marked.missing.join(', ')}`);
  const curved = marked.found.filter(f => !f.flat);
  if (curved.length) return failed('PATTERN_FACE', `only flat faces take a machining allowance here: ${curved.map(f => f.name).join(', ')}`);
  const machining = marked.found.length ? machiningOf(doc, profile, family, box.largestMM) : null;
  if (machining && !machining.ok) return failed('PATTERN_ALLOWANCE', machining.why);
  let state = { doc, bodies: [...bodies], turnBase: doc } as never as ChatState;
  const run = async (args: Record<string, unknown>): Promise<string | null> => {
    const r = await dispatchTool(state, 'run_command', args, evaluate);
    if (r.isError) { try { return String(JSON.parse(r.content).error ?? r.content); } catch { return r.content; } }
    state = r.state; return null;
  };
  // (Each machined face out by the allowance, then the whole scaled about the part's box centre.)
  if (machining?.ok) for (const f of marked.found) { const why = await run({ command: 'offset-face', faces: [f.name], values: { d: machining.mm } }); if (why) return failed('PATTERN_BUILD', `${f.name}: ${why}`); }
  if (state.bodies.length !== 1) return failed('PATTERN_BUILD', `the allowance left ${state.bodies.length} bodies`);
  const pivot = [0, 1, 2].map(k => r6((box.min[k] + box.max[k]) / 2)), factor = 1 + shrink.ratio;
  const why = await run({ command: 'scale', bodies: [state.bodies[0].key], values: { factor, px: pivot[0], py: pivot[1], pz: pivot[2] } });
  if (why) return failed('PATTERN_BUILD', `scale: ${why}`);
  const after = partExtent(state.bodies), sv = shrinkView(shrink);
  const file: PatternFile = {
    format: 'barocss-pattern', version: 1, process: profile.id, material: m.id, family,
    shrink: { ...sv, ratio: r6(sv.ratio), factor: r6(factor), simplification: 'one factor by the largest extent, for the whole pattern; a pattern maker may scale each dimension by its own band (byDimension)', byDimension: sv.basis === 'table' ? shrinkByDimension(doc, profile, family, bodies) : [] },
    machining: machining?.ok ? { ...machiningView(machining), faces: marked.found.map(f => f.name) } : null,
    pivot, part: { min: box.min.map(r6), max: box.max.map(r6) }, pattern: { min: after.min.map(r6), max: after.max.map(r6) },
    note: `the pattern: ${machining?.ok ? `${machining.mm} mm on ${marked.found.length} machined face${marked.found.length === 1 ? '' : 's'}, then ` : ''}scaled ${r6(factor)} about the part's box centre; check the values with your foundry`,
  };
  return { ok: true, doc: state.doc, bodies: state.bodies, file };
}
