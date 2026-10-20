import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { withLook } from '../src/app/bodies';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline } from '../src/team/baseline';
import { BUNDLE_FILES, verifyBundle, writeBundle, type Manifest } from '../src/team/bundle';
import { digestOf, sha256Hex } from '../src/team/digest';
import { userToken } from '../src/team/ecr';
import { massResult } from '../src/team/freshness';
import { runPartsScenario, type PartsScenario } from '../src/team/scripted';
import { encodeStudioFile } from '../src/engine/container';

// A8.6 (O32's addendum, O39): the export bundle. Written from the clean A8 assembly with its BOM baseline approved and
// every body's material set: complete, and verified complete in a fresh process (a spawned cad-cli). With a file
// deleted, a file edited, a result made stale, no approved baseline, a material with no source, a rewritten baseline:
// each listed, and never complete.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8/scenarios');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function bodiesOf(doc: StudioDoc) { const e = await evaluate(doc); assert.ok(e.ok); return e.bodies; }
async function assembly(material = true): Promise<StudioDoc> {
  let doc = (await runPartsScenario(JSON.parse(readFileSync(join(CASES, 'parts-clean.json'), 'utf8')) as PartsScenario, evaluate)).final;
  if (material) for (const inst of doc.instances!) { const b = (await bodiesOf(inst.doc))[0], d = withLook(inst.doc, b, { material: 'al6061' }); doc = { ...doc, instances: doc.instances!.map(i => (i.id === inst.id ? { ...i, doc: d } : i)) }; }
  return doc;
}
async function approved(doc: StudioDoc): Promise<StudioDoc> {
  const view = await bomView(doc, evaluate), d = draftBaseline(doc, deriveBom(view), view), r = await moveBaseline(d.doc, d.baseline.id, 'review', userToken('t'));
  return (await moveBaseline(r.doc, d.baseline.id, 'approved', userToken('t'), evaluate)).doc;
}
const reader = (files: Map<string, Uint8Array>) => (path: string) => files.get(path) ?? null;
const out = (dir: string, files: Map<string, Uint8Array>) => { mkdirSync(dir, { recursive: true }); for (const [p, b] of files) writeFileSync(join(dir, p), b); return dir; };
function cli(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise(ok => {
    const child = spawn(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = ''; child.stdout.on('data', c => { o += c; }); child.stderr.on('data', c => { e += c; });
    child.on('close', code => ok({ code: code ?? -1, out: o, err: e }));
  });
}

test('a complete bundle: the document, the approved baseline, sourced materials, current results, ECRs, the manifest; verified complete in a fresh process', async () => {
  const doc = await approved(await assembly()), b = await writeBundle(doc, evaluate);
  assert.deepEqual([b.manifest.complete, b.manifest.missing, b.manifest.stale], [true, [], []]);
  assert.deepEqual(b.manifest.files.map(f => f.path), [BUNDLE_FILES.document, BUNDLE_FILES.baseline, BUNDLE_FILES.materials, BUNDLE_FILES.results, BUNDLE_FILES.ecrs]);
  for (const f of b.manifest.files) assert.equal(f.sha256, sha256Hex(b.files.get(f.path)!));
  assert.equal(b.manifest.baseline?.id, 'BL1');
  const mats = JSON.parse(new TextDecoder().decode(b.files.get(BUNDLE_FILES.materials))).materials;
  assert.deepEqual(mats.map((m: { part: string; material: string; basis: string }) => [m.part, m.material, m.basis]), [['p1', 'al6061', 'body'], ['p2', 'al6061', 'body']]);
  assert.match(mats[0].sources.densityGPerCm3, /^S-DENS: BaroCSS typical density/);
  const results = JSON.parse(new TextDecoder().decode(b.files.get(BUNDLE_FILES.results))).results;
  assert.deepEqual(results.map((r: { result: { kind: string; part?: string } }) => `${r.result.kind}${r.result.part ? ` ${r.result.part}` : ''}`), ['bom', 'mass p1', 'mass p2']);
  assert.ok(results.every((r: { freshness: { state: string } }) => r.freshness.state === 'current'));
  assert.deepEqual(await verifyBundle(reader(b.files), evaluate), { complete: true, intact: true, missing: [], changed: [], stale: [], manifestSaidComplete: true });
  // (Read back by a fresh process from the files alone, and written by one from the saved part.)
  const tmp = mkdtempSync(join(tmpdir(), 'bundle-'));
  try {
    const v = await cli(['bundle', 'verify', out(join(tmp, 'a'), b.files)]);
    assert.equal(v.code, 0, v.err); assert.deepEqual(JSON.parse(v.out), { complete: true, intact: true, missing: [], changed: [], stale: [], manifestSaidComplete: true });
    writeFileSync(join(tmp, 'asm.bcad'), encodeStudioFile(doc));
    const w = await cli(['bundle', 'write', join(tmp, 'asm.bcad'), '-o', join(tmp, 'b')]);
    assert.equal(w.code, 0, w.err); assert.equal(JSON.parse(w.out).complete, true);
    assert.equal((await cli(['bundle', 'verify', join(tmp, 'b')])).code, 0);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('an incomplete bundle, each gap listed and never complete: a file deleted, a file edited, a result stale, no approved baseline, a material unsourced, a rewritten baseline', async () => {
  const doc = await approved(await assembly()), b = await writeBundle(doc, evaluate);
  const without = (path: string) => { const m = new Map(b.files); m.delete(path); return m; };
  const edited = (path: string, edit: (t: string) => string) => { const m = new Map(b.files); m.set(path, new TextEncoder().encode(edit(new TextDecoder().decode(m.get(path))))); return m; };
  // (A file deleted.)
  const del = await verifyBundle(reader(without(BUNDLE_FILES.results)), evaluate);
  assert.deepEqual([del.complete, del.missing], [false, ['results.json: missing']]); assert.equal(del.manifestSaidComplete, true, 'the manifest said complete: the read-back does not take its word');
  // (A file edited: a material's density.)
  const ed = await verifyBundle(reader(edited(BUNDLE_FILES.materials, t => t.replace('"densityGPerCm3": 2.7', '"densityGPerCm3": 7.85'))), evaluate);
  assert.deepEqual([ed.complete, ed.intact, ed.changed], [false, false, ['materials.json: its digest is not the manifest\'s']]);
  // (The document swapped for another with the manifest's file digest rewritten: its revision is not the pinned one.)
  const other = encodeStudioFile({ ...doc, parameters: { ...doc.parameters, w: 99 } }), sw = new Map(b.files); sw.set(BUNDLE_FILES.document, other);
  const man = JSON.parse(new TextDecoder().decode(sw.get(BUNDLE_FILES.manifest))) as Manifest; man.files[0] = { ...man.files[0], sha256: sha256Hex(other), bytes: other.length };
  sw.set(BUNDLE_FILES.manifest, new TextEncoder().encode(JSON.stringify(man)));
  assert.deepEqual((await verifyBundle(reader(sw), evaluate)).changed, ['document.bcad: its revision is not the manifest\'s']);
  // (The baseline record rewritten consistently — content, pins and digest — and its file digest too: the manifest's anchor catches it.)
  const rb = new Map(b.files), chain = JSON.parse(new TextDecoder().decode(rb.get(BUNDLE_FILES.baseline)));
  const top = chain.baselines[0]; top.content.bom.lines[0].qty = 1; top.content.bom.totalMassG += 1; top.pins.bom = digestOf(top.content.bom); { const { digest: _d, ...rest } = top; void _d; top.digest = digestOf(rest); }
  const cb = new TextEncoder().encode(JSON.stringify(chain)); rb.set(BUNDLE_FILES.baseline, cb);
  const m2 = JSON.parse(new TextDecoder().decode(rb.get(BUNDLE_FILES.manifest))) as Manifest; m2.files[1] = { ...m2.files[1], sha256: sha256Hex(cb), bytes: cb.length }; rb.set(BUNDLE_FILES.manifest, new TextEncoder().encode(JSON.stringify(m2)));
  assert.deepEqual((await verifyBundle(reader(rb), evaluate)).changed, ['baseline BL1: its digest is not the manifest\'s']);
  // (A result made stale: p1's mass taken before its material was set, carried into a bundle of the document after.)
  const before = await assembly(false), early = await massResult(before, evaluate, 'R0', 'p1');
  const st = await writeBundle(doc, evaluate, { results: [early] });
  assert.equal(st.manifest.complete, false); assert.deepEqual(st.manifest.stale, ['result mass:p1/p1@R0: stale (material changed)']);
  assert.deepEqual((await verifyBundle(reader(st.files), evaluate)).stale, ['result mass:p1/p1@R0: stale (material changed)']);
  // (No approved baseline; a body with no material: both missing.)
  const none = await writeBundle(await assembly(false), evaluate);
  assert.equal(none.manifest.complete, false);
  assert.deepEqual(none.manifest.missing, ['an approved BOM baseline: none', 'material source: p1/b3 (none set: the default, assumed)', 'material source: p2/b3 (none set: the default, assumed)']);
  const nv = await verifyBundle(reader(none.files), evaluate);
  assert.deepEqual([nv.complete, nv.missing], [false, none.manifest.missing]);
  // (The same through the spawned CLI: exit 1, the gaps printed.)
  const tmp = mkdtempSync(join(tmpdir(), 'bundle-'));
  try {
    const dir = out(join(tmp, 'x'), b.files); unlinkSync(join(dir, BUNDLE_FILES.ecrs));
    const v = await cli(['bundle', 'verify', dir]);
    assert.equal(v.code, 1); assert.deepEqual(JSON.parse(v.out).missing, ['ecrs.json: missing']); assert.equal(JSON.parse(v.out).complete, false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
