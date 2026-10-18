import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';
import { confirmDocLibrary, libraryById, libraryEntry, shareRefusal } from '../src/library/libraries';
import { checkLibraryForSharing, UNLICENSED } from '../src/library/sharing';
import { createChatServer } from '../server/chatServer';
import { registerTeamLibraries } from '../server/cadMcp';

// LIB4 (D64): agent tools — list, insert, snap, author — and the data rules for team and user libraries.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }

/** A small library an agent writes: a spacer (a tube) whose bore takes an M5 screw. */
const SPACER = {
  format: 'barocss-cad-library', version: 1, id: 'agent-spacers', name: 'Spacers', libraryVersion: '0.1.0', units: 'mm', license: 'CC0-1.0',
  parts: [{ id: 'spacer', name: 'Spacer', parameters: { od: { value: 10, unit: 'mm', source: 'chosen' }, id: { value: 5.3, unit: 'mm', estimate: true }, h: { value: 8, unit: 'mm', min: 1, source: 'chosen' } },
    variants: [{ id: 'h8', values: { h: 8 } }, { id: 'h12', values: { h: 12 } }],
    recipe: [{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: { expr: 'od / 2' } }, { id: 't', kind: 'extrude', sketch: 's', height: { expr: 'h' } },
      { id: 'b', kind: 'hole', target: 't', center: [0, 0], radius: { expr: 'id / 2' } }] }],
};

test('the acceptance flow through the agent tools: list the T-slot library, insert a 20×20 rail and an M5 slot nut, snap the nut into the top slot 40 mm along — real mates, the nut under the lips; save and reopen, the same bodies', async () => {
  let s = await stateOf(emptyDoc());
  const listed = parse((await runTool(s, 'list_library', {}, evaluate)).content);
  const t = listed.libraries.find((l: { id: string }) => l.id === 'tslot-20');
  assert.ok(t && t.source === 'built-in' && /CC0/.test(t.license) && t.estimates > 0);
  assert.deepEqual(t.parts.map((p: { id: string }) => p.id), ['profile', 'slot-nut-m5', 'end-cap', 'angle-bracket']);
  assert.deepEqual(t.parts[0].variants.map((v: { id: string }) => v.id), ['2020', '2040']);
  assert.ok(t.parts[0].interfaces.some((i: { id: string; role: string }) => i.id === 'slot-t1' && i.role === 't-slot'));
  // Assemblies change only by the user's approval (D41): the agent inserts directly, is told to propose, proposes.
  const direct = await runTool(s, 'insert_part', { library: 'tslot-20', part: 'profile', variant: '2020' }, evaluate);
  assert.ok(direct.isError); assert.equal(parse(direct.content).code, 'needs_approval');
  const p = await runTool(s, 'propose', { title: 'a rail with a nut', ops: [
    { tool: 'insert_part', args: { library: 'tslot-20', part: 'profile', variant: '2020', params: { L: 200 }, name: 'Rail' } },
    { tool: 'insert_part', args: { library: 'tslot-20', part: 'slot-nut-m5', name: 'Nut', position: [0, 60, 0] } },
    { tool: 'snap_part', args: { a: { part: 'p1', interface: 'slot-t1' }, b: { part: 'p2', interface: 'seat' }, offset: [40, 0, 0] } }] }, evaluate);
  assert.ok(!p.isError, p.content); assert.deepEqual(parse(p.content).risk.approval, ['assembly', 'mates']);
  const accepted = await acceptProposal(p.state, 'P1', evaluate); assert.ok('state' in accepted, JSON.stringify(accepted));
  s = accepted.state;
  assert.deepEqual(s.doc.mates!.map(m => [m.kind, m.a.part, m.b.part]), [['coincident', 'p1', 'p2']]);
  assert.deepEqual(s.doc.instances!.find(i => i.id === 'p2')!.position.map(v => +v.toFixed(9)), [0, 8.2, 35]);
  // The tools say what they did (through the dispatcher, as a proposal replays them): estimates warned, mates made.
  const warned = parse((await dispatchTool(await stateOf(emptyDoc()), 'insert_part', { library: 'tslot-20', part: 'profile', variant: '2020' }, evaluate)).content);
  assert.ok(warned.warnings.some((w: string) => /estimate/.test(w)) && warned.interfaces.some((i: { id: string }) => i.id === 'slot-t1'));
  // Refused, saying why: a nut onto an end.
  const bad = await dispatchTool(s, 'snap_part', { a: { part: 'p1', interface: 'end1' }, b: { part: 'p2', interface: 'seat' } }, evaluate);
  assert.ok(bad.isError); assert.match(parse(bad.content).error, /profile-end and slot-nut do not mate/);
  // Saved and reopened: the same parts and volumes.
  const read = readStudioDoc(JSON.stringify(s.doc)); assert.ok('doc' in read);
  const again = (read as { doc: StudioDoc }).doc;
  for (const id of ['p1', 'p2']) {
    const [x, y] = await Promise.all([evaluate(s.doc.instances!.find(i => i.id === id)!.doc), evaluate(again.instances!.find(i => i.id === id)!.doc)]);
    assert.ok(x?.ok && y?.ok && Math.abs(x.bodies[0].volumeMM3! - y.bodies[0].volumeMM3!) < 1e-9);
  }
  assert.equal(again.mates!.length, 1);
});

test('an agent writes a library as data: checked at once (builds in each variant, no fits to fail), kept with the document marked as the agent\'s; not shared until a person confirms it; unlicensed is private use only; imported models refused; the team folder takes a library only when its own run of the check passes', async () => {
  let s = await stateOf(emptyDoc());
  let r = await runTool(s, 'add_library', { library: SPACER }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const out = parse(r.content);
  assert.deepEqual([out.check.ok, out.check.built, out.check.fits, out.license, out.estimates, out.authored_by], [true, 2, 0, 'CC0-1.0', 1, 'agent']);
  assert.deepEqual(s.doc.libraries!.map(l => [l.library.id, l.authoredBy, l.confirmed]), [['agent-spacers', 'agent', false]]);
  const listed = parse((await runTool(s, 'list_library', { library: 'agent-spacers' }, evaluate)).content).libraries[0];
  assert.deepEqual([listed.source, listed.authored_by, listed.confirmed], ['user', 'agent', false]);
  // Its parts insert like any.
  r = await dispatchTool(s, 'insert_part', { library: 'agent-spacers', part: 'spacer', variant: 'h12' }, evaluate); assert.ok(!r.isError, r.content);
  // Not shared before a person confirms it; then it may be.
  assert.match(shareRefusal('agent-spacers')!, /written by an agent: a person confirms it/);
  s = { ...s, doc: confirmDocLibrary(s.doc, 'agent-spacers') };
  assert.equal(s.doc.libraries![0].confirmed, true); assert.equal(libraryEntry('agent-spacers')!.confirmed, true); assert.equal(shareRefusal('agent-spacers'), null);
  // Without a licence: loads, private use only, never shared.
  const { license: _l, ...unlicensed } = { ...SPACER, id: 'agent-unlicensed' };
  r = await runTool(s, 'add_library', { library: unlicensed }, evaluate); assert.ok(!r.isError, r.content);
  assert.equal(parse(r.content).license, UNLICENSED); assert.match(shareRefusal('agent-unlicensed')!, /no licence: unlicensed — private use only/);
  // A library whose part does not build fails its check (said), and so is never shared.
  const broken = { ...SPACER, id: 'agent-broken', parts: [{ ...SPACER.parts[0], parameters: { ...SPACER.parts[0].parameters, id: { value: 12, unit: 'mm', estimate: true } } }] };
  const bc = checkLibraryForSharing(broken);
  assert.equal(bc.ok, false); assert.ok(bc.problems.length >= 1, JSON.stringify(bc));
  // Another model's geometry is not a library part.
  const imported = { ...SPACER, id: 'agent-import', parts: [{ ...SPACER.parts[0], recipe: [{ id: 'x', kind: 'import', step: 'ISO-10303-21;' }] }] };
  r = await runTool(s, 'add_library', { library: imported }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /import carries another model's geometry/);
  // The team folder (the chat server): a check run there, kept beside the library with its time and kernel.
  const team = mkdtempSync(join(tmpdir(), 'cad-team-libs-')), handler = createChatServer({ mcpScript: 'x', workDir: mkdtempSync(join(tmpdir(), 'cad-chat-')), teamLibraries: team });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat/libraries`, headers = { origin: 'http://127.0.0.1:52020', 'content-type': 'application/json' };
  try {
    const post = (body: unknown) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).then(async x => ({ status: x.status, json: await x.json() as Record<string, any> }));
    let p = await post({ library: SPACER, authoredBy: 'agent' });
    assert.equal(p.status, 422); assert.match(p.json.error, /a person confirms it/);
    p = await post({ library: unlicensed }); assert.equal(p.status, 422); assert.match(p.json.error, /no licence/);
    p = await post({ library: broken }); assert.equal(p.status, 422); assert.match(p.json.error, /did not pass its check/);
    p = await post({ library: SPACER, authoredBy: 'agent', confirmed: true });
    assert.equal(p.status, 200, JSON.stringify(p.json)); assert.equal(p.json.check.ok, true);
    assert.deepEqual(readdirSync(team).sort(), ['agent-spacers.check.json', 'agent-spacers.json']);
    const kept = JSON.parse(readFileSync(join(team, 'agent-spacers.check.json'), 'utf8'));
    assert.deepEqual([kept.ok, kept.kernel, kept.library, kept.version, kept.built], [true, '0.0.0-experimental', 'agent-spacers', '0.1.0', 2]); assert.ok(!Number.isNaN(Date.parse(kept.at)));
    const listed2 = await fetch(url, { headers: { origin: 'http://127.0.0.1:52020' } }).then(x => x.json()) as { libraries: { library: { id: string }; check: { ok: boolean } }[] };
    assert.deepEqual(listed2.libraries.map(l => [l.library.id, l.check.ok]), [['agent-spacers', true]]);
    // The agent's process reads the same folder: the team library is there for insert_part.
    const teamCopy = { ...SPACER, id: 'team-spacers' };
    writeFileSync(join(team, 'team-spacers.json'), JSON.stringify(teamCopy));
    assert.equal(registerTeamLibraries(team), 2); assert.equal(libraryEntry('team-spacers')!.source, 'team');
  } finally { await new Promise(done => server.close(done)); }
  assert.ok(libraryById('tslot-20'));
});
