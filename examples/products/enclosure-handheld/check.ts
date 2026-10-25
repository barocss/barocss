// Independent P2 checkpoint checks. No import from build.ts: dimensions and closed forms come from brief.md.
// This is a geometry checkpoint, not supplier, mould-tooling or product acceptance.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { engineeringOf } from './engineering';
import { Assembly, part } from '../../../packages/barocss-cad-model/src/api';
import { bodiesOf, materialOf } from '../../../packages/barocss-cad-model/src/api/core';
import { rowKey, validRowSupplies } from '../../../packages/barocss-cad-model/src/engine/rowSources';
import { sha256Hex } from '../../../packages/barocss-cad-model/src/util/digest';
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

// PG-12 is an approved-sample/geometry binding check. Serialized receipts alone do not attest human approval.
const SIZES_SHA256 = '5940ca3565427cfdb3fd91197ac76b946eba33b67c16f70328c0819a82d94e06';
const LENGTH_TOLERANCE = 1e-6;
const screwHex: readonly (readonly [number, number])[] = [[1.25, 0.721688], [0, 1.443376], [-1.25, 0.721688], [-1.25, -0.721688], [0, -1.443376], [1.25, -0.721688]];
// The producer rounds hex vertices to 1e-6 mm. These fixed vertices are an independent polygon oracle.
const socketArea = Math.abs(screwHex.reduce((sum, p, i) => {
  const q = screwHex[(i + 1) % screwHex.length]; return sum + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;
const screwVolume = Math.PI * ((5.5 / 2) ** 2 * 3 + (3 / 2) ** 2 * 5) - socketArea * (3 - 1.2);
const screwVolumeTolerance = 1e-9 * Math.abs(screwVolume);
const closeVector = (actual: readonly number[] | undefined, expected: readonly number[]) =>
  actual !== undefined && actual.length === expected.length && expected.every((v, k) => Number.isFinite(actual[k]) && Math.abs(actual[k] - v) <= LENGTH_TOLERANCE);

/** Check the four saved board screws; never accept names, bought flags, receipts or made metadata on their own. */
export function checkBoardScrewRows(doc: StudioDoc): Check {
  const problems: string[] = [], screws: Record<string, unknown>[] = [];
  try {
    // Independent file anchor: no import of the builder or its constants.
    const text = readFileSync(join(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8');
    if (sha256Hex(new TextEncoder().encode(text)) !== SIZES_SHA256) throw new Error('The approved sample file hash does not match.');
    type SizeRow = NonNullable<StudioDoc['fastenerSizes']>['rows'][number];
    const sample = JSON.parse(text) as { rows: SizeRow[] }, approved = sample.rows.filter(r => r.id === 'M3');
    if (approved.length !== 1 || !approved[0].capLengths.includes(5)) throw new Error('The approved M3 cap-length 5 row is missing.');
    const fingerprint = rowKey('fastener-sizes', approved[0]);
    const board = (doc.instances ?? []).filter(i => i.name === 'board');
    if (board.length !== 1 || !closeVector(board[0].position, [0, -26, 7]) || !closeVector(board[0].rotation, [0, 0, 0])) problems.push('The board placement is not the declared placement.');
    const candidates = (doc.instances ?? []).filter(i => i.name.startsWith('board-screw-'));
    const axes = [[4, -22], [58, -22], [58, 22], [4, 22]];
    if (candidates.length !== 4 || new Set(candidates.map(i => i.id)).size !== 4 || candidates.some(i => i.id === board[0]?.id)) problems.push('Four distinct board-screw instances are required.');
    for (const [k, [x, y]] of axes.entries()) {
      const name = `board-screw-${k + 1}`, found = candidates.filter(i => i.name === name), reasons: string[] = [];
      if (found.length !== 1) { screws.push({ name, reasons: ['Exactly one instance of this role is required.'] }); continue; }
      const instance = found[0], child = instance.doc;
      if (!closeVector(instance.position, [x, y, 2 + 5 + 1.6]) || !closeVector(instance.rotation, [0, 0, 0])) reasons.push('The screw placement is not the declared placement.');
      const locks = (doc.mates ?? []).filter(m => m.kind === 'lock' && m.b.part === instance.id);
      if (locks.length !== 1 || board.length !== 1 || locks[0].a.part !== board[0].id || !closeVector(locks[0].rel?.position, [x, y + 26, 1.6]) || !closeVector(locks[0].rel?.rotation, [0, 0, 0])) reasons.push('The screw must retain its declared lock relative to the board.');
      const rows = child.fastenerSizes?.rows.filter(r => r.id === 'M3') ?? [];
      if (child.fastenerSizes?.version !== 1 || rows.length !== 1 || !rows[0].capLengths.includes(5) || rowKey('fastener-sizes', rows[0]) !== fingerprint) reasons.push('The stored M3 row does not match the approved sample.');
      const supplies = validRowSupplies(child).filter(r => r.kind === 'fastener-sizes' && r.id === 'M3' && r.fingerprint === fingerprint);
      if (child.rowSources?.version !== 1 || !supplies.some(r => r.file.filename === 'fastener-sizes.json' && r.file.sha256 === SIZES_SHA256 && r.file.suppliedBy === 'person')) reasons.push('The current row has no matching approved-file receipt.');
      const measured: Record<string, unknown> = {};
      try {
        const bodies = bodiesOf(child);
        if (bodies.length !== 1 || bodies[0].ref?.side !== 'solid') throw new Error('The command must produce one solid body.');
        const body = bodies[0], terminalIndex = body.ref!.node, terminal = child.nodes[terminalIndex];
        if (!terminal || terminal.kind !== 'union' || !terminal.made || terminal.made.command !== 'fastener') throw new Error('The evaluated terminal body is not the recorded fastener command.');
        const v = terminal.made.values;
        if (v.kind !== 'socket-screw' || v.size !== 'M3' || v.length !== '5' || v.joint !== 'free' || v.model !== 'cosmetic' || v.x !== 0 || v.y !== 0 || v.z !== 0) reasons.push('The actual command values must be a local cosmetic socket M3x5.');
        const count = terminal.made.nodes ?? 2, first = terminalIndex - count + 1;
        if (!Number.isInteger(count) || count <= 0 || first !== 0 || terminalIndex !== child.nodes.length - 1) throw new Error('The fastener command span does not bind the whole evaluated body.');
        const reached = new Set<number>();
        const visit = (index: number): void => {
          if (!Number.isInteger(index) || index < first || index > terminalIndex) throw new Error('A body reference leaves the fastener command span.');
          if (reached.has(index)) return; reached.add(index);
          const node = child.nodes[index];
          const prior = (at: number) => { if (at >= index) throw new Error('The command span is not a forward construction.'); visit(at); };
          if (node.kind === 'union') {
            if (node.left.side !== 'solid' || node.right.side !== 'solid') throw new Error('A command union does not refer to its solids.');
            prior(node.left.node); prior(node.right.node);
          } else if (node.kind === 'extrude') prior(node.sketch);
          else if (node.kind !== 'sketch') throw new Error('The command span includes another geometry operation.');
        };
        visit(terminalIndex);
        if (reached.size !== count) throw new Error('The command span contains unrelated nodes.');
        const bounds = body.mesh.bounds, volume = part(name, child).body(body.key).mass({ density: 1 }).volume;
        Object.assign(measured, { volume, bounds, terminal: terminalIndex, commandNodes: count });
        if (!closeVector(bounds.min, [-2.75, -2.75, -5]) || !closeVector(bounds.max, [2.75, 2.75, 3]) || !Number.isFinite(volume) || Math.abs(volume - screwVolume) > screwVolumeTolerance) reasons.push('The same saved body geometry fails the independent bounds/volume oracle.');
        if (materialOf(child, body.key) !== 'steel') reasons.push('The screw material must remain steel.');
      } catch (e) { reasons.push(`Body binding: ${failure(e).message}`); }
      screws.push({ name, reasons, ...measured });
    }
  } catch (e) { problems.push(failure(e).message); }
  const ok = problems.length === 0 && screws.length === 4 && screws.every(s => (s.reasons as string[]).length === 0);
  return { id: 'board-screw-rows', ok, ...(!ok ? { code: 'P2_FASTENER_ROWS_REQUIRED' } : {}), detail: JSON.stringify({ scope: 'Approved sample and cosmetic fastener geometry only; product acceptance remains separate.', sampleSha256: SIZES_SHA256, expectedVolume: screwVolume, volumeTolerance: screwVolumeTolerance, lengthTolerance: LENGTH_TOLERANCE, problems, screws }) };
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
  checks.push(checkBoardScrewRows(doc));
  checks.push({ id: 'connector-rows', ok: false, code: 'P2_CONNECTOR_ROWS_REQUIRED', detail: 'PG-11: a verified connector input-to-feature binding has not been established in this saved document. The USB opening is a stand-in.' });
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
