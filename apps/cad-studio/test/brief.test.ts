import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { applyBrief, briefGaps, confirmField, patchBrief, readBrief, type Brief } from '../src/chat/brief';

// A6.1 (O24): the brief. The conformance fixtures (hand-written: their expected gaps and what the studio does with the
// process and material) through the tool; an assumption never replacing what the user stated; the studio's confirm;
// a stated material giving the bodies' mass; the script's brief(); the field kept through open and the v2 path.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a6/briefs');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const call = async (s: ChatState, tool: string, args: object) => dispatchTool(s, tool, args, evaluate);

test('the brief fixtures (conformance/a6/briefs): gaps, completeness, the process and material applied or not, the typed refusals', async () => {
  const files = readdirSync(CASES).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 10, `${files.length} cases`);
  for (const f of files) {
    const c = JSON.parse(readFileSync(join(CASES, f), 'utf8')), patches = c.input.patches as object[];
    let s: ChatState = { doc: emptyDoc(), bodies: [] }, error: string | undefined;
    for (const [k, fields] of patches.entries()) {
      const r = await call(s, 'set_brief', { fields });
      if (r.isError) { assert.equal(k, patches.length - 1, `${c.case}: only the last patch may be refused`); error = JSON.parse(r.content).error; assert.equal(r.state, s, `${c.case}: a refusal changes nothing`); continue; }
      s = r.state;
    }
    if (c.expect.error) assert.match(error ?? '', new RegExp(`^\\[${c.expect.error}\\]`), `${c.case}: ${error}`); else assert.equal(error, undefined, `${c.case}: ${error}`);
    const g = JSON.parse((await call(s, 'get_brief', {})).content);
    assert.deepEqual(g.gaps.map((x: { field: string; why: string }) => ({ field: x.field, why: x.why })), c.expect.gaps, `${c.case} gaps`);
    assert.ok(g.gaps.every((x: { ask: string }) => x.ask.endsWith('?')), `${c.case}: every gap has its question`);
    assert.equal(g.complete, c.expect.complete, `${c.case} complete`);
    assert.equal(s.doc.process ?? null, c.expect.doc_process, `${c.case} the part's process`);
    for (const k of ['process', 'material'] as const) {
      if (c.expect[k] === null) { assert.equal(g[k], null, `${c.case} ${k}`); continue; }
      for (const [field, v] of Object.entries(c.expect[k] as object)) assert.equal(g[k][field], v, `${c.case} ${k}.${field}`);
    }
    if (c.expect.process && !c.expect.process.checked) assert.match(g.process.note, /intent/);
    if (c.expect.material && !c.expect.material.library) assert.match(g.material.note, /not in the material library/);
  }
});

test('an assumption never replaces or clears what the user stated; the user\'s own new words do; all or nothing', () => {
  const stated = { value: 'petg', basis: 'stated', source: 'PETG' }, b = patchBrief(undefined, { material: stated });
  assert.ok('brief' in b);
  for (const bad of [{ material: { value: 'pla', basis: 'assumed', why: 'cheaper' } }, { material: { value: 'pla', basis: 'ambiguous', why: 'PLA or PETG' } }, { material: null }]) {
    const r = patchBrief(b.brief, bad); assert.ok('error' in r && r.error.code === 'STATED_KEPT' && /PETG/.test(r.error.message), JSON.stringify(r));
  }
  const again = patchBrief(b.brief, { material: { value: 'pla', basis: 'stated', source: 'make it PLA after all' } });
  assert.ok('brief' in again && again.brief!.material!.value === 'pla');
  // (All or nothing: a good field beside a refused one is not applied either.)
  const mixed = patchBrief(b.brief, { purpose: { value: 'a hook', basis: 'assumed', why: 'x' }, quantity: { value: 2.5, basis: 'stated', source: 'two and a half' } });
  assert.ok('error' in mixed && mixed.error.code === 'BAD_FIELD');
  for (const bad of [{ nope: { value: 1, basis: 'stated', source: 'x' } }, { process: { value: 'laser', basis: 'stated', source: 'x' } }, { envelope: { value: { x: 1, y: 0, z: 2 }, basis: 'assumed' } }, { interfaces: { value: [], basis: 'assumed' } }, { purpose: { value: 'x', basis: 'guessed' } }]) {
    const r = patchBrief(undefined, bad); assert.ok('error' in r && r.error.code === 'BAD_FIELD', JSON.stringify(bad));
  }
  // (Clearing an assumed field, and clearing the last field, leaves no brief.)
  const a = patchBrief(undefined, { finish: { value: 'matte', basis: 'assumed', why: 'a bracket' } });
  assert.ok('brief' in a); const cleared = patchBrief(a.brief, { finish: null });
  assert.ok('brief' in cleared && cleared.brief === undefined && cleared.changed[0] === 'finish');
});

test('the studio\'s confirm: an assumed field stated by the user, with who and when; an assumed process then becomes the part\'s', () => {
  const p = patchBrief(undefined, { purpose: { value: 'a hook', basis: 'stated', source: 'a coat hook' }, process: { value: 'fdm', basis: 'assumed', why: 'one off' }, material: { value: 'pla', basis: 'assumed', why: 'easy to print' } });
  assert.ok('brief' in p);
  const doc0 = applyBrief(emptyDoc(), p.brief);
  assert.equal(doc0.process, undefined, 'an assumed process is not applied');
  assert.deepEqual(briefGaps(p.brief).map(g => g.field), ['process', 'material']);
  const c = confirmField(p.brief!, 'process', '2026-10-20T10:00:00.000Z') as Brief, doc1 = applyBrief(doc0, c);
  assert.deepEqual(c.process, { value: 'fdm', basis: 'stated', why: 'one off', confirmed: { by: 'user', at: '2026-10-20T10:00:00.000Z' } });
  assert.equal(doc1.process, 'fdm');
  assert.deepEqual(briefGaps(c).map(g => g.field), ['material']);
  assert.ok('error' in (confirmField(c, 'quantity', 'now') as object));
  // (Kept through a save: readBrief keeps the fields that fit and drops what does not.)
  const back = readBrief(JSON.parse(JSON.stringify({ ...c, bogus: 1, quantity: { value: -1, basis: 'stated' } })));
  assert.deepEqual(back, c);
  assert.equal(readBrief({ version: 2, purpose: c.purpose }), undefined);
});

test('a stated library material is the bodies\' (mass no longer assumed); an assumed or unknown one is not', async () => {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  s = (await call(s, 'run_command', { command: 'box', values: { w: 10, d: 10, h: 10, x: 0, y: 0, z: 0 } })).state;
  const mass = async () => JSON.parse((await call(s, 'mass_properties', {})).content).bodies[0];
  const m0 = await mass(); assert.equal(m0.assumed, true, JSON.stringify(m0));
  for (const [material, assumed] of [[{ value: 'steel', basis: 'assumed', why: 'strong' }, true], [{ value: 'Delrin 150', basis: 'stated', source: 'Delrin' }, true], [{ value: 'steel', basis: 'stated', source: 'mild steel' }, false]] as const) {
    s = (await call(s, 'set_brief', { fields: { material } })).state;
    const m = await mass(), json = JSON.stringify(m);
    assert.equal(m.assumed, assumed, `${material.value} ${material.basis}: ${json}`);
    if (!assumed) assert.ok(Math.abs(m.mass_g - 1000 * 7.85 / 1000) < 1e-6, json);
  }
  // (A body's own material still wins.)
  const key = s.bodies[0].key, own = { ...s.doc, bodies: { ...(s.doc.bodies ?? {}), [key]: { material: 'al6061' } } };
  const m = JSON.parse((await call({ ...s, doc: own }, 'mass_properties', {})).content).bodies[0];
  assert.ok(Math.abs(m.mass_g - 2.7) < 1e-6, JSON.stringify(m));
});

test('the script\'s brief() and the v2 path (requirements.brief / requirements.gaps) do what set_brief and get_brief do', async () => {
  const s0: ChatState = { doc: emptyDoc(), bodies: [] };
  const r = await call(s0, 'run_script', { source: 'brief({purpose: {value: "a hook", basis: "stated", source: "a coat hook"}, process: {value: "fdm", basis: "stated", source: "printed"}})\nbox({w: 10, d: 10, h: 10})' });
  assert.ok(!r.isError, r.content);
  assert.equal(r.state.doc.brief?.purpose?.value, 'a hook'); assert.equal(r.state.doc.process, 'fdm');
  const v2 = await call(s0, 'requirements', { action: 'brief', fields: { material: { value: 'pla', basis: 'assumed', why: 'x' } } });
  assert.ok(!v2.isError && v2.state.doc.brief?.material?.basis === 'assumed', v2.content);
  const gaps = JSON.parse((await call(v2.state, 'requirements', { action: 'gaps' })).content);
  assert.deepEqual(gaps.gaps.map((g: { field: string }) => g.field), ['purpose', 'process', 'material']);
});
