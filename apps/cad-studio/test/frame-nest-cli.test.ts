import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';

// FRb (O116): cad-cli nest — FR S0's mitred L (40 × 40 × 3, long points 320 and 220) into 600 mm bars at a 3 mm kerf:
// one bar, 320 + 3 + 220 = 543 used, the offcut 57 (closed forms); nesting.json and nesting.csv; with no list, exit 1 and
// NEST_NO_STOCK; a 300 mm bar alone, the 320 piece NEST_TOO_LONG, exit 1.

const RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const L = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: RHS, corners: { default: 'mitre' } } as never);

test('FRb cad-cli nest: the mitred L into 600 mm bars at a 3 mm kerf — exit 0, one bar, 543 used and the offcut 57, in nesting.json and nesting.csv; no list, NEST_NO_STOCK; a 300 mm bar, the 320 piece too long — exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frame-nest-')), part = join(dir, 'l.bcad'), list = join(dir, 'lengths.json'), short = join(dir, 'short.json');
  writeFileSync(part, encodeStudioFile(L));
  writeFileSync(list, JSON.stringify([{ id: 'B600', length: 600, source: 'a test value' }])); writeFileSync(short, JSON.stringify([{ id: 'B300', length: 300, source: 'a test value' }]));
  const cli = (...a: string[]) => spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'nest', ...a], { encoding: 'utf8', timeout: 120000 });
  let r = cli(part, '-o', join(dir, 'out'), '--list', list, '--kerf', '3');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const n = JSON.parse(readFileSync(join(dir, 'out/nesting.json'), 'utf8'));
  assert.equal(n.bars.length, 1); assert.deepEqual([n.bars[0].used, n.bars[0].kerf, n.bars[0].offcut], [540, 3, 57]);
  assert.deepEqual(n.kerf, { value: 3, basis: 'set' }); assert.equal(n.sections[0].method, 'exact'); assert.equal(n.totals.waste, 57);
  const csv = readFileSync(join(dir, 'out/nesting.csv'), 'utf8').trim().split('\n');
  assert.equal(csv.length, 3); assert.match(csv[1], /^1,B600,.*,600,.*320.*220.*,540,3,57$/); assert.equal(csv[2], 'total,,,600,,540,3,57');
  r = cli(part, '-o', join(dir, 'none')); assert.equal(r.status, 1); assert.match(r.stdout, /NEST_NO_STOCK/);
  r = cli(part, '-o', join(dir, 'short'), '--list', short); assert.equal(r.status, 1, r.stderr + r.stdout); assert.match(r.stdout, /NEST_TOO_LONG/);
});
