import { evaluateCadPart, type CadPartSnapshot, exportStep } from '@barocss/cad';
import { bodyMesh, type DisplayMesh } from './mesh';
import { friendly, type FriendlyError } from './errors';
import { bodyKeyOf, toPartDocument } from './part';
import { placedDoc, type StudioDoc } from './doc';

export interface BodyResult {
  key: string;
  /** 'upright' (Z-prismatic: holes, fillets, curved Booleans), 'planar' or 'curved' (general B-rep). */
  family: string; mesh: DisplayMesh;
  volumeMM3: number | null; massG: number | null;
}
export type EvalResult =
  | { ok: true; revision: number; bodies: BodyResult[]; ms: number }
  | { ok: false; revision: number; error: FriendlyError; ms: number };

const ALUMINIUM = 2700;
// The last successful evaluation: unchanged features are reused by the next one.
let last: CadPartSnapshot | null = null;

function snapshotOf(doc: StudioDoc): CadPartSnapshot {
  const part = toPartDocument(doc);
  return last ? last.withDocument(part) : evaluateCadPart(part);
}

export function evaluateDoc(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const snapshot = snapshotOf(doc); last = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => {
      let volumeMM3: number | null = null, massG: number | null = null;
      try { const m = o.massProperties(ALUMINIUM); volumeMM3 = m.volumeMM3; massG = m.massKG * 1000; } catch { /* no positive volume */ }
      return { key: bodyKeyOf(o.id), family: o.representation, mesh: bodyMesh(o.brep, revision, quality), volumeMM3, massG };
    });
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/** Another part's bodies on their own (instances: not through the main part's cache). */
export function evaluatePart(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const bodies: BodyResult[] = evaluateCadPart(toPartDocument(doc)).outputs.map(o => {
      let volumeMM3: number | null = null, massG: number | null = null;
      try { const m = o.massProperties(ALUMINIUM); volumeMM3 = m.volumeMM3; massG = m.massKG * 1000; } catch { /* no positive volume */ }
      return { key: bodyKeyOf(o.id), family: o.representation, mesh: bodyMesh(o.brep, revision, quality), volumeMM3, massG };
    });
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/** The whole part (every visible body, and its placed instances) as one STEP file, or the reason it cannot be written. */
export function stepFor(doc: StudioDoc, name: string): { text: string } | { error: string } {
  try {
    const breps = snapshotOf(doc).outputs.map(o => o.brep);
    for (const inst of doc.instances ?? []) if (!inst.hidden) breps.push(...evaluateCadPart(toPartDocument(placedDoc(inst))).outputs.map(o => o.brep));
    if (!breps.length) return { error: 'There is no body to export.' };
    return { text: exportStep(breps, { name }) };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const output = snapshotOf(doc).outputs.find(o => bodyKeyOf(o.id) === key);
    return output ? output.exportStl() : null;
  } catch { return null; }
}
