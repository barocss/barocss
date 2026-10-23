// O10 step B: the last evaluation's rebuild, read only. Each feature of the part built again or reused, with its own
// wall time and kernel calls (the kernel's profile, D228); the mates that cannot be met and the loops among them; all
// tied to the document's revision. It changes neither geometry nor history.
import type { CadPartProfileCalls } from '@barocss/cad';
import type { EvalResult } from '../engine/evaluate';
import { featureLabel, type StudioDoc } from '../engine/doc';
import { nodeIndexOf } from '../engine/ids';
import { tablesFor } from '../assembly/faces';
import { LOOP_REASON, solveAssembly } from '../assembly/mates';
import { revisionOf } from './revision';

/** A feature's part in the evaluation: built again, reused, or an input with no body of its own (a sketch). */
export type RebuildState = 'built' | 'reused' | 'input';
export interface RebuildFeature { id: string; node: number | null; label: string; state: RebuildState; ms: number; calls: CadPartProfileCalls }
/** Parts placed by mates in a loop (A by B by A): none of them can be solved. */
export interface RebuildLoop { parts: string[]; mates: string[] }
export interface RebuildReport {
  /** The document's revision (team/revision) and the evaluation the times are from. */
  revision: string; evaluation: number;
  features: RebuildFeature[];
  /** The features built again: how many, their time together, the slowest's id; and how many were reused (inputs are neither). */
  built: number; builtMs: number; slowest: string | null; reused: number;
  mates: { mate: string; reason: string }[];
  loops: RebuildLoop[];
  /** What the times leave out. */
  limits: string;
}

export const REBUILD_LIMITS = 'Wall time (performance.now) of the part\'s own features; a reused feature\'s is its lookup. Not counted: meshes and B-reps worked out afterwards for display, placed copies and other parts\' evaluations. The feature tree refers only to earlier features, so only mates can make a loop.';

/** The rebuild of `result`, the evaluation of `doc` (null when it failed or was not profiled). */
export function rebuildReport(doc: StudioDoc, result: EvalResult): RebuildReport | null {
  if (!result.ok || !result.rebuild) return null;
  const { profile, evaluated, reused } = result.rebuild, fresh = new Set(evaluated), kept = new Set(reused);
  const features: RebuildFeature[] = [];
  let built = 0, builtMs = 0, slowest: RebuildFeature | null = null;
  for (const id of Object.keys(profile)) {
    const i = nodeIndexOf(doc.nodes, id), f: RebuildFeature = { id, node: i >= 0 ? i : null, label: i >= 0 ? featureLabel(doc.nodes[i], i, doc.nodes) : id, state: fresh.has(id) ? 'built' : kept.has(id) ? 'reused' : 'input', ms: profile[id].ms, calls: { ...profile[id].calls } };
    features.push(f);
    if (f.state !== 'built') continue;
    built++; builtMs += f.ms;
    if (!slowest || f.ms > slowest.ms) slowest = f;
  }
  const mates = mateProblems(doc);
  return { revision: revisionOf(doc), evaluation: result.revision, features, built, builtMs, slowest: slowest?.id ?? null, reused: kept.size, mates, loops: loopsOf(doc, mates), limits: REBUILD_LIMITS };
}

/** The mates that cannot be met, as the studio's solver refuses them. */
function mateProblems(doc: StudioDoc): { mate: string; reason: string }[] {
  if (!doc.mates?.length || !doc.instances?.length) return [];
  return solveAssembly(doc.instances, doc.mates, tablesFor(doc), doc.instances).problems.map(p => ({ mate: p.mate, reason: p.reason }));
}

/** The mates refused as closing a loop, grouped by the parts they join (each loop once, in the document's order). */
function loopsOf(doc: StudioDoc, problems: readonly { mate: string; reason: string }[]): RebuildLoop[] {
  const looped = new Set(problems.filter(p => p.reason.startsWith(LOOP_REASON)).map(p => p.mate));
  const root = new Map<string, string>(), find = (k: string): string => { let r = k; while (root.get(r) !== r) r = root.get(r)!; root.set(k, r); return r; };
  const ms = (doc.mates ?? []).filter(m => looped.has(m.id));
  for (const m of ms) for (const p of [m.a.part, m.b.part]) if (!root.has(p)) root.set(p, p);
  for (const m of ms) root.set(find(m.a.part), find(m.b.part));
  const loops = new Map<string, RebuildLoop>();
  for (const m of ms) {
    const r = find(m.b.part), loop = loops.get(r) ?? { parts: [], mates: [] }; loops.set(r, loop);
    loop.mates.push(m.id);
    for (const p of [m.a.part, m.b.part]) if (!loop.parts.includes(p)) loop.parts.push(p);
  }
  return [...loops.values()];
}
