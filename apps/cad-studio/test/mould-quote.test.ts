import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { materialData } from '@barocss/cad-model/library/materials';
import { quotePackage, QUOTE_FILES } from '@barocss/cad-model/mould/quote';
import { cliMain } from '../server/cadCli';

// IM6 (O82): the quote package — complete only when nothing is open; every file's SHA-256 in its manifest (node:crypto
// the oracle); the request's size, volume and mass the part's (the drafted block's volume by its closed form, ABS's
// density); the tolerance, shrink and press limits from their pages; nothing assumed; the CLI writes the zip.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
// (A block 60 × 40 × 25 drafted 3°: its walls lean in, so the top is 2·25·tan 3° smaller each way.)
const block = (): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }), { kind: 'extrude', sketch: 0, height: 25, draft: 3 });
const moulded = (o: { material?: boolean; quantity?: boolean; finish?: string } = {}): StudioDoc => {
  let d: StudioDoc = { ...block(), process: 'injection', mould: { version: 1, pull: [0, 0, 1], finish: o.finish ?? 'pm-t1' },
    ...(o.quantity === false ? {} : { brief: { version: 1, quantity: { value: 1000, basis: 'stated', source: '1000 of them' } } as StudioDoc['brief'] }) };
  if (o.material !== false) d = withLook(d, bodiesOf(d)[0], { material: 'abs' });
  return d;
};
/** The names in a zip, by its local file headers. */
function zipNames(z: Uint8Array): string[] {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength), out: string[] = [];
  for (let i = 0; i + 30 <= z.length;) {
    if (v.getUint32(i, true) !== 0x04034b50) break;
    const size = v.getUint32(i + 18, true), n = v.getUint16(i + 26, true), extra = v.getUint16(i + 28, true);
    out.push(new TextDecoder().decode(z.subarray(i + 30, i + 30 + n))); i += 30 + n + extra + size;
  }
  return out;
}

test('IM6 a complete package: an ABS block drafted 3°, 1000 of them stated, PM-T1, pulled along +Z — nothing open; five files, each SHA-256 in the manifest; the request the part\'s and the pages\'', async () => {
  const doc = moulded(), q = await quotePackage(doc, bodiesOf(doc), evaluate, { name: 'block' });
  assert.ok(!('error' in q), JSON.stringify(q));
  if ('error' in q) return;
  assert.deepEqual(q.manifest.open, []); assert.equal(q.manifest.complete, true);
  assert.deepEqual(zipNames(q.zip), [QUOTE_FILES.step, QUOTE_FILES.report, QUOTE_FILES.page, QUOTE_FILES.request, QUOTE_FILES.manifest]);
  for (const f of q.manifest.files) { const bytes: Uint8Array = q.files.get(f.path)!; assert.equal(f.sha256, createHash('sha256').update(bytes).digest('hex'), f.path); assert.equal(f.bytes, bytes.length); }
  const r = q.request, d = 25 * Math.tan(3 * Math.PI / 180), volume = 25 * (2400 - 100 * d + 4 * d * d / 3);
  assert.deepEqual([r.material, r.finish, r.pull, r.quantity], [{ id: 'abs', label: 'ABS', basis: 'body' }, { id: 'pm-t1', label: 'Light bead blast (PM-T1)', minDraftDeg: 3 }, [0, 0, 1], 1000]);
  assert.deepEqual(r.part.sizeMM, [60, 40, 25]);
  assert.ok(Math.abs(r.part.volumeMM3 - volume) <= 1e-6 * volume, `${r.part.volumeMM3} vs ${volume}`);
  assert.ok(Math.abs(r.part.massG! - volume * materialData('abs')!.densityGPerCm3 / 1000) <= 2e-3, String(r.part.massG));
  assert.deepEqual([r.tolerance, r.shrink, r.limits], [{ mm: 0.08, perMM: 0.002, source: 'https://www.protolabs.com/services/injection-molding/' }, 0.002, { largestPartMM: [751, 480, 203] }]);
  assert.match(new TextDecoder().decode(q.files.get(QUOTE_FILES.step)!), /^ISO-10303-21;/);
  const md = new TextDecoder().decode(q.files.get(QUOTE_FILES.page)!);
  assert.match(md, /No price: prices are the moulder's\./); assert.match(md, /\| draft \| pass \|/); assert.match(md, /- nothing: the package is complete/);
});

test('IM6 nothing assumed: no material and no quantity stated — both open, not complete; a finish asking more draft than the part has — warned in the report, not open; no process, a bad quantity — refused', async () => {
  const doc = moulded({ material: false, quantity: false }), q = await quotePackage(doc, bodiesOf(doc), evaluate);
  if ('error' in q) { assert.fail(q.error); return; }
  assert.equal(q.manifest.complete, false);
  assert.ok(q.manifest.open.some(o => /the material is not set/.test(o)) && q.manifest.open.some(o => /the quantity is not stated/.test(o)), q.manifest.open.join(' | '));
  assert.equal(q.request.material, null); assert.equal(q.request.part.massG, null);
  // (A finish asking more draft than the part has: a warning in the report, not an open item.)
  const t2 = moulded({ finish: 'pm-t2' }), q2 = await quotePackage(t2, bodiesOf(t2), evaluate);
  if ('error' in q2) { assert.fail(q2.error); return; }
  assert.deepEqual(q2.manifest.open, []);
  assert.match((await quotePackage({ ...block() }, bodiesOf(block()), evaluate) as { error: string }).error, /for injection moulding: the part's process is not chosen/);
  assert.match((await quotePackage(moulded(), bodiesOf(moulded()), evaluate, { quantity: 2.5 }) as { error: string }).error, /whole number/);
});

test('IM6 cad-cli mould-quote writes the zip; exit 0 complete, 1 while anything is open', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quote-')), io = { stdout: { write: () => true } as never, stderr: { write: () => true } as never };
  writeFileSync(join(dir, 'block.bcad'), encodeStudioFile(moulded()));
  assert.equal(await cliMain(['mould-quote', join(dir, 'block.bcad'), '-o', join(dir, 'q.zip')], io), 0);
  assert.deepEqual(zipNames(new Uint8Array(readFileSync(join(dir, 'q.zip')))).length, 5);
  writeFileSync(join(dir, 'bare.bcad'), encodeStudioFile(moulded({ quantity: false })));
  assert.equal(await cliMain(['mould-quote', join(dir, 'bare.bcad'), '-o', join(dir, 'q2.zip')], io), 1);
  assert.equal(await cliMain(['mould-quote', join(dir, 'bare.bcad'), '-o', join(dir, 'q3.zip'), '--quantity', '250'], io), 0);
});
