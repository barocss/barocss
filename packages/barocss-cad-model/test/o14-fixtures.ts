// O14's mount fixtures (the fingerprint's and the tests'): a 160 × 100 × 10 plate with the sample mount rows (and a
// test-only servo row, an estimate: no datasheet sample), and each kind of mount cut into its top by the command.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { dispatchTool } from '../src/chat/tools';
import type { StudioMountRow } from '../src/engine/mountRows';

export const MOUNT_SAMPLE = JSON.parse(readFileSync(resolve(import.meta.dirname, '../samples/rows/mounts.json'), 'utf8')) as { rows: StudioMountRow[] };
export const SERVO_TEST: StudioMountRow = { id: 'servo-test', type: 'servo', holes: { pattern: 'rect', spacingMM: [48, 10], diameterMM: 4.2 }, shaftMM: 6, shaftOffsetMM: [10, 0], shaftHeightMM: 0, bodyMM: [40, 20], clearanceMM: 0.5, estimate: true };
const plate = (): StudioDoc => ({ ...rectanglePart(160, 100, 10), mounts: { version: 1, rows: [...MOUNT_SAMPLE.rows, SERVO_TEST] } });
let revision = 1;
/** A plate with one mount on its top (the command's values), or the mount's refusal thrown. */
export async function mountedPlate(values: Record<string, unknown>): Promise<StudioDoc> {
  const doc = plate(), e = evaluateDoc(doc, revision++);
  if (!e.ok) throw new Error(e.error.title);
  const r = await dispatchTool({ doc, bodies: e.bodies }, 'run_command', { command: 'mount', faces: ['n1.top'], values }, async d => evaluateDoc(d, revision++));
  if (r.isError) throw new Error(r.content);
  return r.state.doc;
}
/** Every fixture: its name, its values. */
export const O14_MOUNTS: [string, Record<string, unknown>][] = [
  ['nema17', { row: 'nema17', x: 80, y: 50 }], ['nema17-recess-90', { row: 'nema17', x: 80, y: 50, pilot: 'recess', turn: '90' }],
  ['nema23', { row: 'nema23', x: 80, y: 50 }], ['servo', { row: 'servo-test', x: 90, y: 50 }], ['ucp204', { row: 'ucp204', x: 80, y: 50 }], ['ucfl204', { row: 'ucfl204', x: 80, y: 50 }],
];
