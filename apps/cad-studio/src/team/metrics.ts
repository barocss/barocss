// Per-role metrics on seeded defects (A8.5, O37). Each scenario labels, patch by patch, the detector its seeded defect
// is for (a gate, the Verifier, a reviewer, the lease or contract or assembly gate of a part), or none. A detector
// "flags" a patch when it fails or cannot decide it (undecided, a review skipped); it is "clear" when it passes; it did
// not run when an earlier gate stopped the patch or it had nothing to check (a skipped gate) — and then the patch is not
// counted for it. Over every patch it ran on: true and false positives and negatives, precision and recall. The
// scripted roles' numbers are computed here; the same report with live roles waits for the owner (O30).
import type { Trace } from '@barocss/cad-model/team/team';
import type { PartTrace } from '@barocss/cad-model/team/parts';

export type Detection = 'flag' | 'clear' | 'not_run';
export interface Labelled { case: string; traces: (Trace | PartTrace)[]; seeded: (string | string[] | null)[] }
export interface DetectorMetrics { detector: string; tp: number; fp: number; fn: number; tn: number; evaluated: number; precision: number | null; recall: number | null; misses: string[]; falseAlarms: string[] }

/** What each detector made of one patch. */
export function detections(t: Trace | PartTrace): Record<string, Detection> {
  const out: Record<string, Detection> = {};
  for (const g of t.gates) out[g.gate] = g.verdict === 'fail' || g.verdict === 'undecided' ? 'flag' : g.verdict === 'pass' ? 'clear' : 'not_run';
  if ('verifier' in t && t.verifier) out.verifier = t.verifier.accept ? 'clear' : 'flag';
  if ('reviews' in t && t.reviews) for (const r of t.reviews) out[`reviewer-${r.role}`] = r.verdict === 'accept' ? 'clear' : 'flag';
  return out;
}
/** The metrics of every detector over the labelled runs; the requirements role's own patches (the brief) left out. */
export function metricsOf(runs: readonly Labelled[]): DetectorMetrics[] {
  const m = new Map<string, DetectorMetrics>(), get = (d: string) => { let x = m.get(d); if (!x) { x = { detector: d, tp: 0, fp: 0, fn: 0, tn: 0, evaluated: 0, precision: null, recall: null, misses: [], falseAlarms: [] }; m.set(d, x); } return x; };
  for (const r of runs) r.traces.forEach((t, i) => {
    if ('by' in t.patch && t.patch.by === 'requirements') return;
    const seeded = r.seeded[i], truth = new Set(seeded === null || seeded === undefined ? [] : Array.isArray(seeded) ? seeded : [seeded]);
    for (const [d, v] of Object.entries(detections(t))) {
      if (v === 'not_run') continue;
      const x = get(d), pos = truth.has(d), at = `${r.case} #${i}`;
      x.evaluated++;
      if (v === 'flag' && pos) x.tp++; else if (v === 'flag') { x.fp++; x.falseAlarms.push(at); } else if (pos) { x.fn++; x.misses.push(at); } else x.tn++;
    }
    // (A label for a detector that never ran on the patch is a miss too: the defect went past it unseen.)
    for (const d of truth) if (!(d in detections(t)) || detections(t)[d] === 'not_run') { const x = get(d); x.fn++; x.misses.push(`${r.case} #${i} (not run)`); }
  });
  for (const x of m.values()) { x.precision = x.tp + x.fp ? x.tp / (x.tp + x.fp) : null; x.recall = x.tp + x.fn ? x.tp / (x.tp + x.fn) : null; }
  return [...m.values()].sort((a, b) => a.detector.localeCompare(b.detector));
}
