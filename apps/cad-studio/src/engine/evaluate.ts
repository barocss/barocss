import { cad } from '@barocss/cad';
import { bodyMesh, type DisplayMesh } from './mesh';
import { friendly, type FriendlyError } from './errors';
import type { StudioDoc } from './doc';

export interface BodyResult {
  key: string; family: string; mesh: DisplayMesh;
  volumeMM3: number | null; massG: number | null;
}
export type EvalResult =
  | { ok: true; revision: number; bodies: BodyResult[]; ms: number }
  | { ok: false; revision: number; error: FriendlyError; ms: number };

const ALUMINIUM = 2700;

export function evaluateDoc(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    if (!Object.keys(doc.outputs).length) return { ok: true, revision, bodies: [], ms: 0 };
    const snapshot = cad.load(JSON.stringify(doc));
    const bodies: BodyResult[] = [];
    for (const [key, body] of Object.entries(snapshot.bodies)) {
      let volumeMM3: number | null = null, massG: number | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mass: any = snapshot.massProperties(key, { densityKgPerM3: ALUMINIUM });
        const v = mass?.values?.volumeMM3 ?? mass?.volumeMM3 ?? mass?.exact?.volumeMM3;
        volumeMM3 = typeof v === 'number' ? v : v && typeof v === 'object' && 'numerator' in v ? Number(v.numerator) / Number(v.denominator) : null;
        const m = mass?.values?.massKG ?? mass?.massKG;
        massG = typeof m === 'number' ? m * 1000 : null;
      } catch { /* mass is unavailable for some body families */ }
      bodies.push({ key, family: body.family, mesh: bodyMesh(body, revision, quality), volumeMM3, massG });
    }
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const snapshot = cad.load(JSON.stringify(doc));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bytes: any = snapshot.exportStl(key);
    return bytes instanceof Uint8Array ? bytes : bytes?.bytes instanceof Uint8Array ? bytes.bytes : null;
  } catch { return null; }
}
