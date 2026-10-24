// P1, cad-model's facade: the studio commands the engine needs — gear and gear-mesh, spring, fastener — and rows loaded
// from a person's file (rows rule b). Each part equals what the agent's run_command and load_rows write for the same
// calls, byte for byte; a Boolean's tool callback may take several verbs (its new body chosen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { part, BarocssError } from '../src/api';
import type { StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { runTool, type ChatState } from '../src/chat/tools';
import { receivePersonRowFiles } from '../src/engine/rowFiles';
import { sha256Hex } from '../src/util/digest';

const SIZES = { name: 'fastener-sizes.json', text: readFileSync(join(import.meta.dirname, '../samples/rows/fastener-sizes.json'), 'utf8') };

async function agentDoc(calls: [string, Record<string, unknown>][], rowFiles?: ChatState['rowFiles']): Promise<StudioDoc> {
  const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
    let s: ChatState = { doc: part().doc, bodies: [], ...(rowFiles ? { rowFiles } : {}) };
    for (const [tool, args] of calls) {
      const r = await runTool(s, tool, args, evaluate);
      assert.ok(!r.isError, `${tool}: ${r.content}`);
      s = r.state;
    }
    return s.doc;
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
}

test('gear and gear-mesh: what run_command writes', async () => {
  const p = part('g').gear({ m: 1.5, teeth: 20, b: 10, bore: 20, x: 0, y: 0, z: 0 }).gearMesh({ teeth: 40, dir: 0, bore: 16 });
  const agent = await agentDoc([
    ['run_command', { command: 'gear', values: { m: 1.5, teeth: 20, b: 10, bore: 20, x: 0, y: 0, z: 0 } }],
    ['run_command', { command: 'gear-mesh', bodies: ['b0'], values: { teeth: 40, dir: 0, bore: 16 } }],
  ]);
  assert.equal(JSON.stringify(p.doc), JSON.stringify(agent));
  assert.equal(p.bodies().length, 2);
});

test('spring: what run_command writes', async () => {
  const values = { type: 'compression', d: 2.5, D: 18, n: 5, p: 6, ends: 'closed-ground', hand: 'right', x: 0, y: 0, z: 0 };
  assert.equal(JSON.stringify(part('s').spring(values).doc), JSON.stringify(await agentDoc([['run_command', { command: 'spring', values }]])));
});

test('rows from a person\'s file, then a fastener from them: what load_rows and run_command write', async () => {
  const p = part('b').loadRows('fastener-sizes', SIZES).fastener({ kind: 'hex-bolt', size: 'M8', length: '60', joint: 'free', x: 0, y: 0, z: 0, model: 'cosmetic' });
  // (The person's file received as the studio's Library receives it, its conversation the file's own digest.)
  const files = receivePersonRowFiles(sha256Hex(new TextEncoder().encode(`${SIZES.name}\n${SIZES.text}`)).slice(0, 24), [{ ...SIZES, turn: 1 }], 1);
  const agent = await agentDoc([
    ['load_rows', { kind: 'fastener-sizes', file: files.files[0].id }],
    ['run_command', { command: 'fastener', values: { kind: 'hex-bolt', size: 'M8', length: '60', joint: 'free', x: 0, y: 0, z: 0, model: 'cosmetic', insert: 'part' } }],
  ], files);
  assert.equal(JSON.stringify(p.doc), JSON.stringify(agent));
  // (The same file twice: the same bytes — the build stays deterministic.)
  assert.equal(JSON.stringify(part('b').loadRows('fastener-sizes', SIZES).doc), JSON.stringify(part('b').loadRows('fastener-sizes', SIZES).doc));
  // (Without the rows, the command's own refusal.)
  assert.throws(() => part('b').fastener({ kind: 'hex-bolt', size: 'M8', length: '60', x: 0, y: 0, z: 0 }), e => e instanceof BarocssError);
});

test('a Boolean\'s tool callback takes several verbs: the body it makes is the one they act on', () => {
  const finned = part('f').box({ w: 20, d: 20, h: 20, x: -10, y: -10 })
    .union(p => p.box({ w: 40, d: 40, h: 2, x: -20, y: -20, z: 4 }).linearPattern({ axis: 'z', spacing: 6, count: 3 }));
  assert.equal(finned.bodies().length, 1);
  const v = finned.mass({ density: 1 }).volumeMM3, expected = 20 * 20 * 20 + 3 * (40 * 40 - 20 * 20) * 2;
  assert.ok(Math.abs(v - expected) < 1e-6 * expected, `${v} vs ${expected}`);
  // (Before the tool makes a body, there is nothing for its verbs to act on.)
  assert.throws(() => part('f').box({ w: 1, d: 1, h: 1 }).union(p => p.fillet(b => b.edges(), { radius: 0.1 })), e => e instanceof BarocssError && e.code === 'NO_BODY');
});
