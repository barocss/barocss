// D708 / #2426. Studio and external stdio MCP use the same disposable local native file.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { lstat, mkdir, readdir, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const file = 'Guarded plate.bcad', folder = 'D708 owned folder';
const root = join(output, 'project'), target = join(root, file);
const pins = ['apps/cad-studio/test/mcp-stale-save-browser.mjs', 'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/server/cadMcp.ts', 'apps/cad-studio/scripts/cad-mcp.mjs', 'apps/cad-studio/src/storage/handleStore.ts',
  'apps/cad-studio/src/storage/useProject.ts', 'packages/barocss-cad-model/src/engine/container.ts'];
const f = await createFlow({
  name: 'mcp-stale-save', envFrozen: 'D708_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins,
  qualification: 'D708 protects a newer Studio save from an external MCP session',
  limits: ['Only the native folder-picker boundary is replaced with a test directory handle. It reads and writes the same local disk file as the real MCP child. The Studio project store, controls, edits and Save/Open are real.'],
  inspectorSource: `
import { rectanglePart } from '@barocss/cad-model/engine/doc';
console.log(JSON.stringify(rectanglePart(80, 40, 8)));
`,
  oracleSource: String.raw`
import hashlib, json, math, sys
from pathlib import Path
d = json.load(sys.stdin)
for name, height, volume in [('initial', 8, 25600), ('newer', 9, 28800), ('fresh', 10, 32000)]:
    witness = d[name]
    raw = Path(witness['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == witness['sha256']
    model = json.loads(raw)
    sketch, extrusion = model['nodes']
    assert sketch['id'] == 'n0' and sketch['kind'] == 'sketch' and sketch['profile'] == 'rectangle'
    assert sketch['min'] == [0, 0] and sketch['max'] == [80, 40]
    assert extrusion['id'] == 'n1' and extrusion['kind'] == 'extrude' and extrusion['height'] == height
    assert model['outputs'] == {'b1': {'node': 1, 'side': 'solid'}}
    assert (sketch['max'][0] - sketch['min'][0]) * (sketch['max'][1] - sketch['min'][1]) * extrusion['height'] == volume
    assert math.isclose(witness['volume'], volume, rel_tol=0, abs_tol=1e-7)
print(json.dumps({'status': 'PASS', 'nativeVolumesMm3': [25600, 28800, 32000]}))
`,
});

// Supply the existing Studio folder adapter with a handle backed by a disposable real directory.
function installPicker(name) {
  async function request(op, path, fields = {}) {
    const response = await fetch('/d708-folder', { method: 'POST', body: JSON.stringify({ op, path, ...fields }) });
    const reply = await response.json();
    if (reply.error) throw new DOMException(reply.error, reply.name);
    return reply;
  }
  function file(path) {
    return {
      kind: 'file', name: path.at(-1),
      async getFile() {
        const { bytes, lastModified } = await request('read', path);
        return new File([new Uint8Array(bytes)], path.at(-1), { lastModified });
      },
      async createWritable() {
        let bytes;
        return {
          async write(data) { bytes = [...data]; },
          async close() { await request('write', path, { bytes }); },
          async abort() { bytes = undefined; },
        };
      },
    };
  }
  function directory(path) {
    return {
      kind: 'directory', name: path.at(-1) ?? name,
      async getDirectoryHandle(name, { create = false } = {}) {
        const child = [...path, name];
        await request('directory', child, { create });
        return directory(child);
      },
      async getFileHandle(name, { create = false } = {}) {
        const child = [...path, name];
        await request('file', child, { create });
        return file(child);
      },
      async removeEntry(name) { await request('remove', [...path, name]); },
      async *entries() {
        for (const { name, kind } of await request('list', path)) {
          const child = [...path, name];
          yield [name, kind === 'directory' ? directory(child) : file(child)];
        }
      },
    };
  }
  window.showDirectoryPicker = async () => directory([]);
}

async function folderRequest({ op, path, create, bytes }) {
  assert.ok(Array.isArray(path) && path.every(part => part !== '.' && part !== '..' && /^[\w. -]+$/.test(part)), 'fixture-only relative path');
  const name = join(root, ...path);
  if (op === 'list') return (await readdir(name, { withFileTypes: true }))
    .filter(entry => entry.isFile() || entry.isDirectory())
    .map(entry => ({ name: entry.name, kind: entry.isDirectory() ? 'directory' : 'file' }));
  if (op === 'directory' && create) {
    try { await mkdir(name); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  if (op === 'file' && create) {
    try { await writeFile(name, '', { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const info = await lstat(name);
  if (op === 'directory' || op === 'file') {
    if (op === 'directory' ? !info.isDirectory() : !info.isFile()) return { error: 'Wrong fixture entry type', name: 'TypeMismatchError' };
    return {};
  }
  if (op === 'remove') { await (info.isDirectory() ? rmdir(name) : unlink(name)); return {}; }
  assert.ok(info.isFile());
  if (op === 'read') return { bytes: [...await readFile(name)], lastModified: info.mtimeMs };
  assert.equal(op, 'write');
  assert.ok(Array.isArray(bytes));
  await writeFile(name + '.crswap', Buffer.from(bytes), { flag: 'wx' });
  await rename(name + '.crswap', name);
  return {};
}

async function withMcp(run) {
  const child = spawn(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', target], { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout }), replies = lines[Symbol.asyncIterator]();
  let id = 0;
  async function request(method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n');
    let timer;
    try {
      const reply = await Promise.race([replies.next(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('MCP reply timed out')), 15000);
      })]);
      assert.equal(reply.done, false);
      const data = JSON.parse(reply.value);
      assert.equal(data.id, id);
      assert.equal(data.error, undefined);
      return data.result;
    } finally { clearTimeout(timer); }
  }
  try {
    const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'D708', version: '0' } });
    assert.equal(init.serverInfo.version, 'barocss-cad-tools-v2');
    return await run((name, args) => request('tools/call', { name, arguments: args }));
  } finally {
    child.stdin.end();
    lines.close();
    let timer;
    try {
      const [code] = await Promise.race([closed, new Promise((_, reject) => {
        timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Owned MCP session did not exit')); }, 5000);
      })]);
      assert.equal(code, 0);
    } finally { clearTimeout(timer); }
  }
}
const summary = async call => JSON.parse((await call('query', { action: 'summary' })).content[0].text).facts.volume;

await f.run(async () => {
  await mkdir(root);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(installPicker, folder);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      if (url.origin !== origin) return route.abort();
      if (url.pathname !== '/d708-folder') return route.continue();
      try { return await route.fulfill({ json: await folderRequest(route.request().postDataJSON()) }); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return route.fulfill({ json: { error: 'Fixture entry is absent', name: 'NotFoundError' } });
      }
    });
    return context;
  };
  const initialDoc = await f.inspect('plate', {});
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const versions = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const openFolder = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('button', { name: 'Open folder', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  const save = async label => {
    await button('Save').click();
    await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
    await page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'detached' });
    const bytes = await readFile(target), copy = join(output, label + '.bcad');
    assert.deepEqual(JSON.parse(bytes.toString()), await f.doc());
    await writeFile(copy, bytes, { flag: 'wx' });
    return { bytes, file: copy, sha256: sha256(bytes) };
  };
  const edit = async (height, label) => {
    const previous = await f.doc();
    await f.openFeatureEditor(1, 'extrusion');
    await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill(String(height));
    const state = await f.applyEditor(previous, label);
    assert.equal(state.doc.nodes[1].height, height);
    return state.doc;
  };

  f.phase = 'Save the initial Studio model through the folder project';
  await page.locator('input[aria-label="Model file"]').setInputFiles({
    name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initialDoc)),
  });
  await f.same(initialDoc);
  await openFolder();
  const initial = await save('initial');
  const protocol = {};
  let newer, newerDoc;
  await withMcp(async call => {
    initial.volume = await summary(call);
    assert.equal(initial.volume, 25600);
    newerDoc = await edit(9, 'Studio-edit-9');
    newer = await save('newer');
    assert.notEqual(newer.sha256, initial.sha256);
    f.phase = 'Refuse the stale external MCP edit after Studio has saved';
    const rejected = await call('features', { action: 'edit', index: 1, values: { h: 7 } });
    protocol.rejected = rejected;
    assert.equal(rejected.isError, true, JSON.stringify(rejected));
    assert.match(rejected.content.at(-1).text, /^Not saved: \[STORAGE_CHANGED\]/);
    assert.equal(rejected.structuredContent, undefined);
    protocol.unsaved = await call('query', { action: 'summary' });
    assert.match(protocol.unsaved.content.at(-1).text, /^Unsaved session model:/);
    assert.deepEqual(await readFile(target), newer.bytes);
  });
  newer.volume = await withMcp(summary);
  assert.equal(newer.volume, 28800);
  await writeFile(join(output, 'mcp-replies.json'), JSON.stringify(protocol));
  await f.same(newerDoc);
  await f.snapshot('Studio-newer-file-protected');

  f.phase = 'Reopen the protected file and make a normal Studio edit';
  await versions.getByRole('button', { name: 'Close project', exact: true }).click();
  await page.reload();
  await page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openFolder();
  await versions.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(newerDoc);
  await f.snapshot('Studio-reopens-9');
  await edit(10, 'Studio-edit-10');
  const fresh = await save('fresh');
  fresh.volume = await withMcp(summary);
  assert.equal(fresh.volume, 32000);
  await f.runOracle({ initial, newer, fresh }, 'native-file-and-volume');
  assert.deepEqual(f.report.downloads, []);
  assert.equal((await readdir(root)).some(name => name.endsWith('.tmp') || name.endsWith('.lock') || name.endsWith('.crswap')), false);
});
