// Independent P2 checkpoint checks. No import from build.ts: dimensions and closed forms come from brief.md.
// This is a geometry checkpoint, not supplier, mould-tooling or product acceptance.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { engineeringOf } from './engineering';
import { Assembly, part } from '../../../packages/barocss-cad-model/src/api';
import type { StudioDoc } from '../../../packages/barocss-cad-model/src/engine/doc';

export interface OutputFile { path: string; data: string | Uint8Array }
export interface Check { id: string; ok: boolean; detail: string; code?: string }
export interface EnclosureCheck { ok: boolean; checks: Check[]; files?: OutputFile[] }

export function failure(error: unknown): { code: string; message: string } {
  const e = error as { code?: unknown; message?: unknown } | null;
  return { code: typeof e?.code === 'string' ? e.code : 'P2_CHECK', message: typeof e?.message === 'string' ? e.message : String(error) };
}

// Closed forms in mm³, independent of the modelling recipe and the kernel's mass implementation.
// The sink's fins meet its base without overlap. The board has four through bores. The insert is an annulus.
export const VOLUMES: Readonly<Record<string, number>> = {
  'heat-sink': 28 * 28 * 3 + 6 * 1.5 * 28 * 12,
  board: 62 * 52 * 1.6 - 4 * Math.PI * 1.7 ** 2 * 1.6,
  'cell-18650': Math.PI * 9.2 ** 2 * 65,
  'insert-m3': Math.PI * (2 ** 2 - 1.5 ** 2) * 5,
};
export function checkVolume(name: string, actual: number): Check {
  const expected = VOLUMES[name], tolerance = 1e-9 * Math.abs(expected);
  return { id: `volume:${name}`, ok: Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance,
    detail: JSON.stringify({ actual, expected, tolerance }) };
}

/** Validate any saved P2 document, without comparing its bytes or feature ids to the builder. */
export async function checkEnclosure(doc: StudioDoc, o: { files?: boolean; engineering?: boolean; engineeringOnly?: boolean } = {}): Promise<EnclosureCheck> {
  const checks: Check[] = [], files: OutputFile[] = [], a = new Assembly('enclosure-handheld', doc);
  const expected = ['cover', 'board', 'heat-sink', 'cell', ...Array.from({ length: 4 }, (_, i) => [`insert-${i + 1}`, `case-screw-${i + 1}`, `board-screw-${i + 1}`]).flat()];
  const names = (doc.instances ?? []).map(i => i.name);
  checks.push({ id: 'parts', ok: doc.nodes.length > 0 && names.length === expected.length && new Set(names).size === names.length && expected.every(n => names.includes(n)), detail: names.join(', ') });
  if (!o.engineeringOnly) {
    try {
      const problems = a.problems(), locked = new Set((doc.mates ?? []).filter(m => m.kind === 'lock').map(m => m.b.part));
      checks.push({ id: 'locks', ok: problems.length === 0 && (doc.instances ?? []).length === 16 && (doc.instances ?? []).every(i => locked.has(i.id)), detail: JSON.stringify({ problems, locked: locked.size }) });
    } catch (e) { const f = failure(e); checks.push({ id: 'locks', ok: false, code: f.code, detail: f.message }); }
    for (const [role, name] of [['heat-sink', 'heat-sink'], ['board', 'board'], ['cell-18650', 'cell'], ['insert-m3', 'insert-1']] as const) {
      try {
        const d = (doc.instances ?? []).find(i => i.name === name)?.doc;
        if (!d) { checks.push({ id: `volume:${role}`, ok: false, detail: `Missing ${name}` }); continue; }
        const p = part(role, d);
        // Explicit density avoids assuming a material for the board and cell placeholders.
        const volume = p.bodies().reduce((sum, key) => sum + p.body(key).mass({ density: 1 }).volume, 0);
        checks.push(checkVolume(role, volume));
      } catch (e) { const f = failure(e); checks.push({ id: `volume:${role}`, ok: false, code: f.code, detail: f.message }); }
    }
    try {
      const before = JSON.stringify(doc), closed = a.meshes(), exploded = a.meshes({ explode: 1 });
      checks.push({ id: 'exploded', ok: closed.length > 0 && closed.length === exploded.length && exploded.some((m, i) => m.positions.some((v, k) => v !== closed[i].positions[k])) && JSON.stringify(a.doc) === before, detail: `${closed.length} meshes; display only` });
    } catch (e) { const f = failure(e); checks.push({ id: 'exploded', ok: false, code: f.code, detail: f.message }); }
  }
  if (o.engineering !== false && checks[0].ok) {
    const engineering = await engineeringOf(doc);
    checks.push(...engineering.checks); files.push(...engineering.files);
  }
  // Required acceptance remains open. Do not infer supplier rows from the stand-in opening's dimensions.
  checks.push({ id: 'board-screw-rows', ok: false, code: 'P2_FASTENER_ROWS_REQUIRED', detail: 'PG-12: shipped fastener sample has no length 5. Board screws are unthreaded stand-ins.' });
  checks.push({ id: 'connector-rows', ok: false, code: 'P2_CONNECTOR_ROWS_REQUIRED', detail: 'PG-11: no person-supplied connector rows. The USB opening is a stand-in.' });
  if (o.files) files.push({ path: 'checks.json', data: JSON.stringify(checks, null, 2) + '\n' });
  return { ok: checks.every(c => c.ok), checks, ...(o.files ? { files } : {}) };
}

if (process.argv[1]?.endsWith('check.mjs')) {
  try {
    const outputIndex = process.argv.indexOf('--out'), output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
    if (outputIndex >= 0 && !output) throw Object.assign(new Error('--out requires a directory'), { code: 'P2_OUTPUT_REQUIRED' });
    const result = await checkEnclosure(JSON.parse(readFileSync(process.argv[2], 'utf8')) as StudioDoc, { files: !!output, engineeringOnly: process.argv.includes('--engineering-only') });
    if (output) for (const file of result.files ?? []) { const target = join(output, file.path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, file.data); }
    console.log(JSON.stringify({ ...result, ...(result.files ? { files: result.files.map(f => f.path) } : {}) }, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (e) { console.error(JSON.stringify(failure(e))); process.exitCode = 1; }
}
