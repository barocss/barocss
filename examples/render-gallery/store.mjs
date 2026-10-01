import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PRESET } from './preset.mjs';
const packageRoot = new URL('../../packages/barocss-render/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
const { validateSpec } = await import(new URL(manifest.exports['.'].import, packageRoot));
export const categories = ['information', 'metrics', 'profile', 'settings', 'review', 'nested'];
export const unsupported = ['Image', 'Icon', 'Chart', 'Table', 'Modal', 'Checkbox', 'Select', 'Date'].map((type) => ({ type, reason: 'Outside the current five-component text-only contract; no renderer preview.' }));
export const canonical = (value) => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  return value;
}
export const digest = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex');
export const slug = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value, max = 300) => typeof value === 'string' && value.length >= 1 && value.length <= max;
const list = (value, max = 12) => Array.isArray(value) && value.length <= max && value.every((item) => text(item));
export function readBinding(state, pointer) {
  let value = state;
  for (const key of pointer.slice(1).split('/')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error('Missing declared synthetic state');
    value = value[key];
  }
  return value;
}
export function validateRecord(record) {
  if (!exact(record, ['version', 'id', 'revision', 'title', 'category', 'tags', 'spec', 'contract', 'initialState', 'source', 'preset', 'limitations'])
    || record.version !== 1 || !slug(record.id) || !Number.isSafeInteger(record.revision) || record.revision < 1 || record.revision > 100_000
    || !text(record.title, 100) || !categories.includes(record.category) || !list(record.tags) || !list(record.limitations)
    || record.preset !== PRESET.id || !exact(record.source, ['kind', 'path', 'sha'])
    || !['authored', 'fake', 'model-derived'].includes(record.source.kind) || !text(record.source.path, 200)
    || !/^[a-zA-Z0-9_./-]+$/.test(record.source.path) || record.source.path.startsWith('/') || record.source.path.split('/').includes('..')
    || !/^[0-9a-f]{40}$/.test(record.source.sha) || Buffer.byteLength(canonical(record)) > 65_536)
    throw new Error('Invalid bounded sample metadata');
  if (!validateSpec(record.spec, record.contract).ok) throw new Error('Invalid renderer specimen');
  if (!record.initialState || typeof record.initialState !== 'object' || Array.isArray(record.initialState)
    || /"(?:__proto__|prototype|constructor)"\s*:/.test(canonical(record.initialState))) throw new Error('Invalid synthetic state');
  for (const pointer of record.contract.textBindings) if (!text(readBinding(record.initialState, pointer), 80)) throw new Error('Invalid declared text state');
  return { ok: true, replayable: record.source.kind !== 'model-derived', sourceLabel: record.source.kind === 'model-derived' ? 'claimed model-derived; unverified' : record.source.kind };
}
function directory(root) {
  if (!path.isAbsolute(root)) throw new Error('Absolute gallery root required');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(root).isDirectory() || (fs.statSync(root).mode & 0o077)) throw new Error('Private regular gallery directory required');
  for (const name of ['samples', 'captures']) {
    const dir = path.join(root, name); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(dir).isDirectory()) throw new Error('Regular gallery child directory required');
  }
}
export function readData(file) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.size > 4_000_000) throw new Error('Bounded regular data file required');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export const recordKey = (record) => `${record.id}-r${record.revision}`;
export function loadIndex(root) {
  directory(root);
  const file = path.join(root, 'index.json');
  if (!fs.existsSync(file)) return { version: 1, samples: [], batches: [] };
  return validateIndex(root, readData(file));
}
function validateIndex(root, index) {
  if (!exact(index, ['version', 'samples', 'batches']) || index.version !== 1 || !Array.isArray(index.samples) || index.samples.length > 1000
    || !Array.isArray(index.batches) || index.batches.length > 1000) throw new Error('Invalid gallery index');
  const keys = new Set(), batches = new Set();
  for (const item of index.samples) {
    if (!exact(item, ['id', 'revision', 'digest']) || !slug(item.id) || !Number.isSafeInteger(item.revision)) throw new Error('Invalid sample association');
    const key = recordKey(item); if (keys.has(key)) throw new Error('Duplicate sample association'); keys.add(key);
    const record = readData(path.join(root, 'samples', key+'.json')); validateRecord(record);
    if (recordKey(record) !== key || digest(record) !== item.digest) throw new Error('Sample digest mismatch');
  }
  for (const item of index.batches) {
    if (!exact(item, ['id', 'digest']) || !slug(item.id) || batches.has(item.id)) throw new Error('Invalid batch association');
    batches.add(item.id); const dir = path.join(root, 'captures', item.id);
    if (!fs.lstatSync(dir).isDirectory()) throw new Error('Regular batch directory required');
    const batch = readData(path.join(dir, 'batch.json'));
    if (digest(batch) !== item.digest || batch.version !== 1 || batch.id !== item.id || !Array.isArray(batch.captures) || batch.captures.length > 2000
      || batch.presetDigest !== digest(PRESET) || batch.preset !== PRESET.id
      || !/^[0-9a-f]{40}$/.test(batch.candidateSha) || !batch.build
      || ['renderer','runtime','registry','preset'].some((key) => !/^[0-9a-f]{64}$/.test(batch.build[key]))
      || batch.build.preset !== digest(PRESET) || typeof batch.browser !== 'string') throw new Error('Capture batch digest mismatch');
    const pairs = new Set();
    for (const capture of batch.captures) {
      const ref = index.samples.find((ref) => ref.id === capture.id && ref.revision === capture.revision);
      if (!ref || capture.sampleDigest !== ref.digest || ![1200, 390].includes(capture.viewport?.width) || capture.viewport.height !== 900
        || !/^[0-9a-f]{64}$/.test(capture.imageDigest) || !slug(capture.id) || capture.validated !== true) throw new Error('Invalid capture pairing');
      const record = readData(path.join(root, 'samples', recordKey(ref)+'.json'));
      if (!validateRecord(record).replayable || capture.sourceKind !== record.source.kind
        || capture.specDigest !== digest(record.spec) || capture.contractDigest !== digest(record.contract)
        || capture.stateDigest !== digest(record.initialState) || capture.presetDigest !== digest(PRESET)
        || !Array.isArray(capture.observed) || capture.observed.length !== Object.keys(record.spec.elements).length
        || ['errors','csp','external'].some((key) => !Array.isArray(capture[key]) || capture[key].length)) throw new Error('Capture provenance mismatch');
      const name = `${recordKey(capture)}-${capture.viewport.width}.png`;
      if (pairs.has(name)) throw new Error('Duplicate capture pair'); pairs.add(name);
      const image = path.join(dir, name); if (!fs.lstatSync(image).isFile() || digest(fs.readFileSync(image)) !== capture.imageDigest) throw new Error('Missing or corrupt capture image');
    }
    for (const capture of batch.captures) if (![1200, 390].every((width) => pairs.has(`${recordKey(capture)}-${width}.png`))) throw new Error('Incomplete capture pair');
  }
  return index;
}
function transaction(root, change) {
  directory(root); const lock = path.join(root, 'append.lock');
  const fd = fs.openSync(lock, 'wx', 0o600);
  try {
    const index = loadIndex(root); const result = change(index);
    const temp = path.join(root, `index-${randomUUID()}.tmp`);
    fs.writeFileSync(temp, canonical(index)+'\n', { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, path.join(root, 'index.json'));
    return result;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
export function appendRecords(root, records) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 100) throw new Error('Append 1–100 bounded records');
  records = structuredClone(records); records.forEach(validateRecord);
  return transaction(root, (index) => {
    const additions = new Map();
    for (const record of records) {
      const key = recordKey(record), checksum = digest(record), existing = index.samples.find((item) => recordKey(item) === key) ?? additions.get(key)?.ref;
      if (existing && existing.digest !== checksum) throw new Error('Conflicting sample ID/revision');
      if (!existing) additions.set(key, { record, ref: { id: record.id, revision: record.revision, digest: checksum } });
    }
    if (index.samples.length + additions.size > 1000) throw new Error('Gallery sample ceiling');
    for (const [key, { record, ref }] of additions) {
      fs.writeFileSync(path.join(root, 'samples', key+'.json'), canonical(record)+'\n', { flag: 'wx', mode: 0o600 }); index.samples.push(ref);
    }
    return { added: additions.size, total: index.samples.length };
  });
}
export function attachBatch(root, batch) {
  return transaction(root, (index) => {
    if (!slug(batch.id) || index.batches.some((item) => item.id === batch.id) || batch.presetDigest !== digest(PRESET)) throw new Error('Conflicting capture batch');
    index.batches.push({ id: batch.id, digest: digest(batch) });
    validateIndex(root, index);
    return { batches: index.batches.length };
  });
}
export function recordsFor(root, index = loadIndex(root)) {
  return index.samples.map((item) => readData(path.join(root, 'samples', recordKey(item)+'.json')));
}
