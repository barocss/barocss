import { evaluateCadPart, type CadPartSnapshot } from '@barocss/cad';
import { bodyMesh, type DisplayMesh } from './mesh';
import { friendly, type FriendlyError } from './errors';
import { bodyKeyOf, toPartDocument } from './part';
import type { StudioDoc } from './doc';

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

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const output = snapshotOf(doc).outputs.find(o => bodyKeyOf(o.id) === key);
    return output ? output.exportStl() : null;
  } catch { return null; }
}
