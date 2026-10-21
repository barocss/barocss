import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync, crc32 as zlibCrc32 } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { crc32 } from '@barocss/cad-model/io/zip';
import { write3mf, type ThreeMfModel } from '@barocss/cad-model/print/threemf';
import { rotationToUp, threeMfModelOf } from '@barocss/cad-model/print/export3mf';

// AM5 (D76): 3MF written by our own code, read back by an independent reader — Node's zlib (inflate, CRC-32) and this
// file's own ZIP and XML scanning, not the writer's — and by Python's zipfile and ElementTree when Python is there.
const bodiesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.hint); return r.ok ? r.bodies : []; };
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;
const DATE = new Date(2026, 9, 18, 12, 0, 0);

/** The archive's entries by its central directory, each checked against its CRC by zlib's. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22; while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'no end of central directory');
  const n = dv.getUint16(end + 10, true), out = new Map<string, Uint8Array>();
  let at = dv.getUint32(end + 16, true);
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(at, true), 0x02014b50);
    const method = dv.getUint16(at + 10, true), crc = dv.getUint32(at + 16, true), csize = dv.getUint32(at + 20, true), usize = dv.getUint32(at + 24, true);
    const nlen = dv.getUint16(at + 28, true), xlen = dv.getUint16(at + 30, true), clen = dv.getUint16(at + 32, true), local = dv.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nlen));
    assert.equal(dv.getUint32(local, true), 0x04034b50);
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), body = bytes.subarray(start, start + csize);
    const data = method === 8 ? new Uint8Array(inflateRawSync(body)) : method === 0 ? body : assert.fail(`method ${method}`);
    assert.equal(data.length, usize, name); assert.equal(zlibCrc32(data) >>> 0, crc, `${name} CRC`);
    out.set(name, data);
    at += 46 + nlen + xlen + clen;
  }
  return out;
}
interface Read { xml: string; objects: { id: number; name: string; pid: string | null; pindex: string | null; v: number[]; t: number[]; tp: (string | null)[] }[]; items: { objectid: number; transform: number[] | null; uuid: string }[]; bases: { name: string; color: string }[] }
const attr = (tag: string, a: string) => { const m = new RegExp(`\\s${a}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
/** The model's objects, items and base materials, read by scanning its XML. */
function readModel(entries: Map<string, Uint8Array>): Read {
  const xml = new TextDecoder().decode(entries.get('3D/3dmodel.model')!);
  const objects: Read['objects'] = [];
  for (const m of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const v: number[] = [], t: number[] = [], tp: (string | null)[] = [];
    for (const x of m[2].matchAll(/<vertex\b[^>]*\/>/g)) v.push(+attr(x[0], 'x')!, +attr(x[0], 'y')!, +attr(x[0], 'z')!);
    for (const x of m[2].matchAll(/<triangle\b[^>]*\/>/g)) { t.push(+attr(x[0], 'v1')!, +attr(x[0], 'v2')!, +attr(x[0], 'v3')!); tp.push(attr(x[0], 'p1')); }
    objects.push({ id: +attr(m[1], 'id')!, name: attr(m[1], 'name')!, pid: attr(m[1], 'pid'), pindex: attr(m[1], 'pindex'), v, t, tp });
  }
  const items = [...xml.matchAll(/<item\b[^>]*\/>/g)].map(x => ({ objectid: +attr(x[0], 'objectid')!, transform: attr(x[0], 'transform')?.split(' ').map(Number) ?? null, uuid: attr(x[0], 'p:UUID')! }));
  const bases = [...xml.matchAll(/<base\b[^>]*\/>/g)].map(x => ({ name: attr(x[0], 'name')!, color: attr(x[0], 'displaycolor')! }));
  return { xml, objects, items, bases };
}
/** A closed mesh's volume (divergence theorem), its points first moved by a 3MF transform. */
function volumeOf(v: number[], t: number[], m: number[] | null): number {
  const p = (i: number) => m ? [0, 1, 2].map(c => v[3 * i] * m[c] + v[3 * i + 1] * m[3 + c] + v[3 * i + 2] * m[6 + c] + m[9 + c]) : [v[3 * i], v[3 * i + 1], v[3 * i + 2]];
  let s = 0;
  for (let k = 0; k < t.length; k += 3) { const a = p(t[k]), b = p(t[k + 1]), c = p(t[k + 2]); s += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); }
  return s / 6;
}
const pointsOf = (v: number[], m: number[] | null) => { const out: number[][] = []; for (let i = 0; i < v.length / 3; i++) out.push(m ? [0, 1, 2].map(c => v[3 * i] * m[c] + v[3 * i + 1] * m[3 + c] + v[3 * i + 2] * m[6 + c] + m[9 + c]) : [v[3 * i], v[3 * i + 1], v[3 * i + 2]]); return out; };

test('AM5 a box as 3MF: the package\'s parts (content types, relationships, model), CRCs equal to zlib\'s, the display mesh welded to 8 vertices and 12 triangles, closed (no open or repeated edge), the volume 1000 mm³ read back, ABS as its base material, Production UUIDs on the object, build and item', async () => {
  const doc = withLook(rectanglePart(20, 10, 5), bodiesOf(rectanglePart(20, 10, 5))[0], { material: 'abs', color: '#c33' });
  const model = threeMfModelOf(doc, [{ doc, bodies: bodiesOf(doc) }], 'box');
  assert.ok(typeof model !== 'string');
  const r = await write3mf({ ...model, uuid, date: DATE });
  assert.ok('bytes' in r, 'error' in r ? r.error : '');
  assert.deepEqual([r.stats.vertices, r.stats.triangles, r.stats.openEdges, r.stats.repeatedEdges, r.stats.droppedTriangles], [8, 12, 0, 0, 0]);
  assert.ok(r.stats.verticesIn > 8);
  const z = readZip(r.bytes);
  assert.deepEqual([...z.keys()], ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
  assert.match(new TextDecoder().decode(z.get('[Content_Types].xml')!), /Extension="model" ContentType="application\/vnd\.ms-package\.3dmanufacturing-3dmodel\+xml"/);
  assert.match(new TextDecoder().decode(z.get('_rels/.rels')!), /Target="\/3D\/3dmodel\.model"[^>]*Type="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/2013\/01\/3dmodel"/);
  const m = readModel(z);
  assert.match(m.xml, /<model unit="millimeter" xml:lang="en-US" xmlns="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/core\/2015\/02" xmlns:p="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/production\/2015\/06">/);
  assert.match(m.xml, /<metadata name="CreationDate">2026-10-18<\/metadata>/); assert.doesNotMatch(m.xml, /requiredextensions/);
  assert.deepEqual(m.bases, [{ name: 'ABS', color: '#CC3333' }]);
  assert.equal(m.objects.length, 1); assert.deepEqual([m.objects[0].pid, m.objects[0].pindex], ['1', '0']);
  assert.ok(Math.abs(volumeOf(m.objects[0].v, m.objects[0].t, null) - 1000) < 1e-9, String(volumeOf(m.objects[0].v, m.objects[0].t, null)));
  assert.equal(m.items.length, 1); assert.equal(m.items[0].transform, null); assert.equal(m.items[0].objectid, m.objects[0].id);
  assert.equal((m.xml.match(/p:UUID="[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"/g) ?? []).length, 3);
  // Our CRC-32 against zlib's on the model.
  assert.equal(crc32(z.get('3D/3dmodel.model')!), zlibCrc32(z.get('3D/3dmodel.model')!) >>> 0);
  // The same model, the same uuids and date: the same bytes.
  seq = 0; const a = await write3mf({ ...model, uuid, date: DATE }); seq = 0; const b = await write3mf({ ...model, uuid, date: DATE });
  assert.ok('bytes' in a && 'bytes' in b); assert.deepEqual(a.bytes, b.bytes);
  // Python's zipfile (CRC test) and ElementTree, another reader, when Python is there.
  let py = ''; try { py = execFileSync('python3', ['-c', 'print(1)'], { encoding: 'utf8' }); } catch { /* no Python: skipped */ }
  if (py.trim() === '1') {
    const dir = mkdtempSync(join(tmpdir(), 'am5-')), file = join(dir, 'box.3mf'); writeFileSync(file, r.bytes);
    const out = execFileSync('python3', ['-I', '-c', [
      'import sys, zipfile, xml.etree.ElementTree as ET',
      'z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None',
      'ns = {"c": "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"}',
      'root = ET.fromstring(z.read("3D/3dmodel.model"))',
      'print(len(root.findall(".//c:vertex", ns)), len(root.findall(".//c:triangle", ns)), root.get("unit"))',
    ].join('\n'), file], { encoding: 'utf8' });
    assert.equal(out.trim(), '8 12 millimeter');
  }
});

test('AM5 face colours and placed items: a coloured top face as a further base material (core, every reader) or a colour group (the Materials extension, then required); one object built twice by transforms; refusals for nothing to write and a bad item', async () => {
  const doc0 = rectanglePart(20, 10, 5), b = bodiesOf(doc0)[0], top = b.mesh.faces.find(f => f.kind === 'plane' && f.normal[2] > 0.99)!;
  const doc = withLook(doc0, b, { faces: { [top.name]: '#00ff00' } });
  const model = threeMfModelOf(doc, [{ doc, bodies: bodiesOf(doc) }], 'coloured');
  assert.ok(typeof model !== 'string');
  const base = await write3mf({ ...model, uuid, date: DATE }); assert.ok('bytes' in base);
  const mb = readModel(readZip(base.bytes));
  assert.deepEqual(mb.bases, [{ name: 'Default', color: '#B4B8BE' }, { name: 'Default (#00FF00)', color: '#00FF00' }]);
  assert.equal(mb.objects[0].tp.filter(p => p === '1').length, 2); assert.equal(mb.objects[0].tp.filter(p => p === null).length, 10);
  const group = await write3mf({ ...model, faceColors: 'colorgroup', uuid, date: DATE }); assert.ok('bytes' in group);
  const mg = readModel(readZip(group.bytes));
  assert.match(mg.xml, /xmlns:m="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/material\/2015\/02" requiredextensions="m"/);
  assert.match(mg.xml, /<m:colorgroup id="2"><m:color color="#00FF00"\/><\/m:colorgroup>/); assert.equal(mg.bases.length, 1);
  assert.equal((mg.xml.match(/pid="2" p1="0"/g) ?? []).length, 2);
  // One object, two items (a shared mesh), the second turned a quarter about Z and moved 50 along X.
  const obj = model.objects[0], two: ThreeMfModel = { title: 'two', objects: [obj], items: [{ object: 0 }, { object: 0, transform: [0, 1, 0, -1, 0, 0, 0, 0, 1, 50, 0, 0] }], uuid, date: DATE };
  const w = await write3mf(two); assert.ok('bytes' in w);
  const m2 = readModel(readZip(w.bytes));
  assert.equal(m2.objects.length, 1); assert.deepEqual(m2.items.map(i => i.objectid), [3, 3]); assert.deepEqual(m2.items[1].transform, [0, 1, 0, -1, 0, 0, 0, 0, 1, 50, 0, 0]);
  assert.ok(Math.abs(volumeOf(m2.objects[0].v, m2.objects[0].t, m2.items[1].transform) - 1000) < 1e-9);
  const moved = pointsOf(m2.objects[0].v, m2.items[1].transform), xs = moved.map(p => p[0]), ys = moved.map(p => p[1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [40, 50, 0, 20]);
  assert.deepEqual(await write3mf({ ...two, objects: [] }), { error: 'there is no body to write' });
  assert.deepEqual(await write3mf({ ...two, items: [{ object: 3 }] }), { error: 'a build item names object 3, which is not there' });
  assert.deepEqual(await write3mf({ ...two, items: [{ object: 0, transform: [1, 2] }] }), { error: 'a build item\'s transform is not 12 finite numbers' });
});

test('AM5 printed the way AM4 chose: the item turned so the print direction is up, its lowest point on the bed (z 0), centred on the printer\'s bed; the shortest turn onto +Z for any direction', async () => {
  for (const d of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [0, -1, 0], [0.3, -0.5, 0.81], [-0.6, 0.1, -0.79]]) {
    const R = rotationToUp(d), l = Math.hypot(d[0], d[1], d[2]), up = [0, 1, 2].map(a => (R[3 * a] * d[0] + R[3 * a + 1] * d[1] + R[3 * a + 2] * d[2]) / l);
    assert.ok(Math.abs(up[0]) < 1e-12 && Math.abs(up[1]) < 1e-12 && Math.abs(up[2] - 1) < 1e-12, `${d}: ${up}`);
    const RRt = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => R[3 * i] * R[3 * j] + R[3 * i + 1] * R[3 * j + 1] + R[3 * i + 2] * R[3 * j + 2]));
    assert.ok(RRt.every((v, k) => Math.abs(v - (k % 4 === 0 ? 1 : 0)) < 1e-12), `${d} orthonormal`);
  }
  // A 20 × 10 × 5 block printed standing on its 10 × 5 end (+X up), on the 256 mm FDM bed.
  const doc: StudioDoc = { ...rectanglePart(20, 10, 5), process: 'fdm', printer: 'fdm-256', print: { direction: [1, 0, 0] } };
  const model = threeMfModelOf(doc, [{ doc, bodies: bodiesOf(doc) }], 'standing');
  assert.ok(typeof model !== 'string');
  const r = await write3mf({ ...model, uuid, date: DATE }); assert.ok('bytes' in r);
  const m = readModel(readZip(r.bytes)), pts = pointsOf(m.objects[0].v, m.items[0].transform);
  const ext = [0, 1, 2].map(a => [Math.min(...pts.map(p => p[a])), Math.max(...pts.map(p => p[a]))]);
  assert.ok(Math.abs(ext[2][0]) < 1e-9 && Math.abs(ext[2][1] - 20) < 1e-9, JSON.stringify(ext));
  assert.ok(Math.abs((ext[0][0] + ext[0][1]) / 2 - 128) < 1e-9 && Math.abs((ext[1][0] + ext[1][1]) / 2 - 128) < 1e-9, JSON.stringify(ext));
  assert.ok(Math.abs(volumeOf(m.objects[0].v, m.objects[0].t, m.items[0].transform) - 1000) < 1e-9);
  // With nothing to write: said.
  assert.equal(threeMfModelOf(emptyDoc(), [{ doc: emptyDoc(), bodies: [] }], 'none'), 'there is no visible body to write');
});

test('AM5 size and time: 200 000 triangles written, deflated and zipped; the numbers reported', async () => {
  // A bumpy sphere, 317 × 317 quads with welded poles: 200 344 triangles.
  const n = 317, P: number[] = [], I: number[] = [];
  P.push(0, 0, 20);
  for (let i = 1; i < n; i++) for (let j = 0; j < n; j++) { const th = Math.PI * i / n, ph = 2 * Math.PI * j / n, r = 20 + 2 * Math.sin(5 * th) * Math.cos(3 * ph); P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)); }
  P.push(0, 0, -20);
  const at = (i: number, j: number) => i === 0 ? 0 : i === n ? 1 + (n - 1) * n : 1 + (i - 1) * n + (j % n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); if (i > 0) I.push(a, b, d); if (i < n - 1) I.push(b, c, d); }
  const r = await write3mf({ title: 'bump', objects: [{ name: 'bump', positions: P, indices: I, material: 'PLA', color: '#888' }], items: [{ object: 0 }], uuid, date: DATE });
  assert.ok('bytes' in r);
  assert.ok(r.stats.triangles >= 200_000, String(r.stats.triangles)); assert.equal(r.stats.openEdges, 0); assert.equal(r.stats.repeatedEdges, 0);
  if (process.env.AM_PERF) console.log(`AM5 perf: ${r.stats.triangles} triangles, ${r.stats.vertices} vertices; model XML ${(r.stats.modelXmlBytes / 1e6).toFixed(2)} MB, 3MF ${(r.stats.bytes / 1e6).toFixed(2)} MB (${(100 * r.stats.bytes / r.stats.modelXmlBytes).toFixed(1)}%); ${r.stats.ms.toFixed(0)} ms`);
  assert.ok(r.stats.ms < 5000, `${r.stats.ms} ms`);
  const m = readModel(readZip(r.bytes));
  assert.equal(m.objects[0].t.length / 3, r.stats.triangles);
  // Read back within the 32-bit float the coordinates were written at.
  for (let k = 0; k < 300; k++) { const v = (k * 7919) % (P.length / 3); for (let a = 0; a < 3; a++) assert.equal(Math.fround(m.objects[0].v[3 * v + a]), Math.fround(P[3 * v + a])); }
});

