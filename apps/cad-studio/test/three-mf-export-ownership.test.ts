import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync, crc32 } from 'node:zlib';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc, type PartInstance } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { EngineClient } from '../src/engine/client';
import { useModelExports, type ModelExportContext, type ModelExportController } from '../src/files/useModelExports';

function hold() {
  let enter!: () => void, release!: () => void, reject!: (error: Error) => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const released = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
  return { entered, release, reject, async wait() { enter(); await released; } };
}
/** A controlled already-placed display mesh, not an evaluator/physical geometry qualification. */
function tetra(x = 0, y = 0, rotated = false): BodyResult {
  const vertices = rotated ? [x, y, 0, x, y + 1, 0, x - 2, y, 0, x, y, 3] : [x, y, 0, x + 1, y, 0, x, y + 2, 0, x, y, 3];
  return { key: 'fixture', family: 'faceted', volume: 1, mass: 1, mesh: {
    positions: Float32Array.from(vertices), normals: new Float32Array(12), faceOfVertex: new Float32Array(4),
    indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]), faces: [],
    edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [],
    bounds: { min: [x - (rotated ? 2 : 0), y, 0], max: [x + (rotated ? 0 : 1), y + (rotated ? 1 : 2), 3] },
  } };
}
function fixture() {
  const part: StudioDoc = { ...emptyDoc(), bodies: { fixture: { material: 'abs', color: '#c33' } } };
  const instances: PartInstance[] = [
    { id: 'left', name: 'Left occurrence', doc: part, position: [10, 0, 0], rotation: [0, 0, 0] },
    { id: 'right', name: 'Right occurrence', doc: part, position: [20, 5, 0], rotation: [0, 0, 90] },
  ];
  const doc: StudioDoc = { ...emptyDoc(), instances, bodies: { fixture: { material: 'pla', color: '#0a0' } } };
  const model: ModelExportContext = { doc, evaluated: doc, shown: doc, bodies: [tetra()], fresh: true, busy: false,
    massReady: true, instancesFresh: true, instanceBodies: new Map([['left', { bodies: [tetra(10)] }], ['right', { bodies: [tetra(20, 5, true)] }]]) };
  const current = { doc: { current: doc }, evaluated: { current: doc }, shown: { current: doc }, name: { current: 'assembly' } };
  return { model, current };
}
/** Actual hook, writer and ZIP. Only the browser download sink and compression timing are controlled. */
async function exportsOf(run: (s: ReturnType<typeof fixture> & { api: ModelExportController; downloads: { name: string; blob: Blob }[]; notices: { title: string; hint: string }[]; pause(): ReturnType<typeof hold> }) => Promise<void>, configure?: (s: ReturnType<typeof fixture>) => void) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const compressionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream');
  const originalCreate = URL.createObjectURL, originalCompression = CompressionStream;
  const downloads: { name: string; blob: Blob }[] = [], notices: { title: string; hint: string }[] = [], blobs = new Map<string, Blob>();
  let api!: ModelExportController, pause: ReturnType<typeof hold> | null = null;
  const f = fixture(); configure?.(f);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() {
    return { href: '', download: '', click() { downloads.push({ name: this.download, blob: blobs.get(this.href)! }); } };
  } } });
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); const url = `blob:three-mf-fixture-${blobs.size}`; blobs.set(url, blob); return url; };
  Object.defineProperty(globalThis, 'CompressionStream', { configurable: true, value: class {
    readonly writable: WritableStream<BufferSource>; readonly readable: ReadableStream<Uint8Array>;
    constructor(format: CompressionFormat) {
      const native = new originalCompression(format);
      this.writable = native.writable;
      this.readable = native.readable.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) { const held = pause; pause = null; if (held) await held.wait(); controller.enqueue(chunk); },
      }));
    }
  } });
  function Probe() {
    api = useModelExports({ ...f, fileName: 'assembly', engine: {} as EngineClient, onNotice: notice => notices.push(notice) });
    return null;
  }
  try { renderToString(createElement(Probe)); await run({ ...f, api, downloads, notices, pause() { const held = hold(); pause = held; return held; } }); }
  finally {
    URL.createObjectURL = originalCreate;
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
    if (compressionDescriptor) Object.defineProperty(globalThis, 'CompressionStream', compressionDescriptor);
  }
}
/** Independent ZIP central-directory read, Node inflate and CRC check; no production reader reuse. */
async function xmlOf(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const end = bytes.length - 22; assert.equal(view.getUint32(end, true), 0x06054b50);
  let at = view.getUint32(end + 16, true);
  for (let k = 0; k < view.getUint16(end + 10, true); k++) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const method = view.getUint16(at + 10, true), compressed = view.getUint32(at + 20, true), size = view.getUint32(at + 24, true);
    const length = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + length));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), raw = bytes.subarray(start, start + compressed);
    assert.ok(method === 0 || method === 8);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    assert.equal(data.length, size); assert.equal(crc32(data) >>> 0, view.getUint32(at + 16, true));
    if (name === '3D/3dmodel.model') return new TextDecoder().decode(data);
    at += 46 + length + extra + comment;
  }
  return assert.fail('3MF model XML missing');
}
function objectVertices(xml: string, prefix: string) {
  const object = [...xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)].find(m => m[1].includes(`name="${prefix}`)); assert.ok(object, prefix);
  return [...object[2].matchAll(/<vertex x="([^"]*)" y="([^"]*)" z="([^"]*)"\/>/g)].map(m => m.slice(1).map(Number));
}

for (const state of ['pending', 'stale source', 'failed'] as const) {
  test(`${state} visible instance refuses the whole 3MF even with an old map entry`, async () => {
    await exportsOf(async s => {
      await s.api.exportThreeMf();
      assert.equal(s.downloads.length, 0, 'the complete assembly must be current before any download');
      assert.equal(s.notices.length, 1); assert.match(s.notices[0].title, /not written|could not write/i);
    }, s => { s.model.instancesFresh = false; });
  });
}
test('missing visible entry refuses the whole 3MF even if caller freshness says true', async () => {
  await exportsOf(async s => {
    await s.api.exportThreeMf(); assert.equal(s.downloads.length, 0); assert.equal(s.notices.length, 1);
  }, s => { s.model.instanceBodies = new Map([['left', { bodies: [tetra(10)] }]]); });
});
test('hidden missing instances are excluded and do not block settled visible occurrences', async () => {
  await exportsOf(async s => {
    await s.api.exportThreeMf(); assert.equal(s.downloads.length, 1);
    const xml = await xmlOf(s.downloads[0].blob); assert.equal((xml.match(/<object\b/g) ?? []).length, 2);
    assert.match(xml, /Left occurrence/); assert.doesNotMatch(xml, /Right occurrence/);
  }, s => {
    s.model.doc.instances![1].hidden = true;
    s.model.instanceBodies = new Map([['left', { bodies: [tetra(10)] }]]);
  });
});
test('settled assembly writes every occurrence with current placed coordinates, units and materials', async () => {
  await exportsOf(async s => {
    await s.api.exportThreeMf(); assert.equal(s.downloads.length, 1); assert.equal(s.downloads[0].name, 'assembly.3mf');
    const xml = await xmlOf(s.downloads[0].blob);
    assert.equal((xml.match(/<object\b/g) ?? []).length, 3); assert.equal((xml.match(/<item\b/g) ?? []).length, 3);
    assert.match(xml, /unit="millimeter"/); assert.match(xml, /name="ABS" displaycolor="#CC3333"/); assert.match(xml, /name="PLA" displaycolor="#00AA00"/);
    assert.deepEqual(objectVertices(xml, 'Left occurrence'), [[10, 0, 0], [11, 0, 0], [10, 2, 0], [10, 0, 3]]);
    assert.deepEqual(objectVertices(xml, 'Right occurrence'), [[20, 5, 0], [20, 6, 0], [18, 5, 0], [20, 5, 3]]);
    assert.match(s.notices[0].title, /^3MF written/);
  });
});
for (const field of ['doc', 'shown', 'evaluated', 'name'] as const) {
  test(`async ZIP result cannot download or post a notice after synchronous ${field} ownership changes`, async () => {
    await exportsOf(async s => {
      const pause = s.pause(), pending = s.api.exportThreeMf();
      try {
        await Promise.race([pause.entered, pending.then(() => assert.fail('export completed before held compression boundary'))]);
        if (field === 'name') s.current.name.current = 'new-name'; else s.current[field].current = emptyDoc();
      } finally { pause.release(); }
      await pending; assert.equal(s.downloads.length, 0); assert.deepEqual(s.notices, []);
    });
  });
}
test('current shown visibility and decoration own the export instead of the unshown document', async () => {
  await exportsOf(async s => {
    await s.api.exportThreeMf(); assert.equal(s.downloads.length, 1);
    const xml = await xmlOf(s.downloads[0].blob);
    assert.doesNotMatch(xml, /Right occurrence/); assert.match(xml, /displaycolor="#123456"/);
  }, s => {
    const shown: StudioDoc = { ...s.model.doc, instances: s.model.doc.instances!.map(i => i.id === 'right' ? { ...i, hidden: true } : i), bodies: { fixture: { material: 'abs', color: '#123456' } } };
    s.model.shown = shown; s.current.shown.current = shown;
  });
});

for (const state of ['freshness lost', 'entry removed'] as const) {
  test(`ZIP completion refuses when ${state} before delivery`, async () => {
    await exportsOf(async s => {
      const pause = s.pause(), pending = s.api.exportThreeMf();
      try {
        await pause.entered;
        if (state === 'freshness lost') s.model.instancesFresh = false;
        else s.model.instanceBodies = new Map();
      } finally { pause.release(); }
      await pending; assert.equal(s.downloads.length, 0); assert.deepEqual(s.notices, []);
    });
  });
}
for (const state of ['current', 'changed document', 'changed name'] as const) {
  test(`ZIP rejection reports only under ${state} ownership`, async () => {
    await exportsOf(async s => {
      const pause = s.pause(), pending = s.api.exportThreeMf();
      await pause.entered;
      if (state === 'changed document') s.current.doc.current = emptyDoc();
      if (state === 'changed name') s.current.name.current = 'new-name';
      pause.reject(new Error('Controlled ZIP compression failure'));
      await pending; assert.equal(s.downloads.length, 0);
      if (state === 'current') { assert.equal(s.notices.length, 1); assert.match(s.notices[0].hint, /Controlled ZIP compression failure/); }
      else assert.deepEqual(s.notices, []);
    });
  });
}
