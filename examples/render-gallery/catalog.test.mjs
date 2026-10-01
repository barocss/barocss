import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalog } from './samples.mjs';
const manifest = JSON.parse(await readFile(new URL('../../packages/barocss-render/package.json', import.meta.url)));
const { validateSpec, classesFor } = await import(new URL(`../../packages/barocss-render/${manifest.exports['.'].import}`, import.meta.url));
const candidate = '0123456789abcdef0123456789abcdef01234567';
const records = catalog(candidate);
const categories = ['information', 'metrics', 'profile', 'settings', 'review', 'nested'];
const keys = ['version', 'id', 'revision', 'title', 'category', 'tags', 'spec', 'contract', 'initialState', 'source', 'preset', 'limitations'];

test('authored catalog has exact metadata, six categories and independently valid specimens', () => {
  assert.ok(records.length >= 12);
  assert.equal(new Set(records.map((record) => record.id)).size, records.length);
  assert.deepEqual([...new Set(records.map((record) => record.category))].sort(), [...categories].sort());
  for (const category of categories) assert.ok(records.filter((record) => record.category === category).length >= 2);
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), [...keys].sort());
    assert.equal(record.version, 1); assert.equal(record.revision, 1);
    assert.match(record.id, /^[a-z][a-z0-9-]{0,63}$/);
    assert.equal(record.preset, 'gallery-v1');
    assert.deepEqual(record.source, { kind: 'authored', path: 'examples/render-gallery/samples.mjs', sha: candidate });
    assert.ok(record.tags.every((tag) => typeof tag === 'string'));
    assert.ok(record.limitations.length >= 4);
    assert.equal(validateSpec(record.spec, record.contract).ok, true, JSON.stringify({ id: record.id, errors: validateSpec(record.spec, record.contract).errors }));
    assert.deepEqual(JSON.parse(JSON.stringify(record)), record);
    for (const node of Object.values(record.spec.elements)) if (node.type === 'Input') {
      const segments = node.props.value.$bindState.slice(1).split('/');
      const value = segments.reduce((state, segment) => state[segment], record.initialState);
      assert.equal(typeof value, 'string'); assert.ok(value.length >= 1 && value.length <= 80);
    }
  }
});

test('catalog covers all supported style choices, bilingual text and real composition differences', () => {
  const nodes = records.flatMap((record) => Object.values(record.spec.elements));
  for (const [type, prop, expected] of [
    ['Layout', 'columns', ['single', 'responsive']], ['Layout', 'gap', ['fractional', 'wide']],
    ['Card', 'padding', ['fractional', 'spacious']], ['Card', 'tone', ['light', 'dark']],
  ]) assert.deepEqual([...new Set(nodes.filter((node) => node.type === type).map((node) => node.props[prop]))].sort(), expected.sort());
  assert.ok(records.some((record) => !Object.values(record.spec.elements).some((node) => node.type === 'Card')));
  assert.ok(records.some((record) => Object.values(record.spec.elements).some((node) => node.type === 'Card' && node.children.some((child) => record.spec.elements[child].type === 'Card'))));
  assert.ok(records.some((record) => Object.values(record.spec.elements).some((node) => node.type === 'Layout' && node.children.some((child) => record.spec.elements[child].type === 'Layout'))));
  assert.ok(records.some((record) => record.contract.textBindings.length >= 2 && record.contract.actions.length >= 2));
  assert.ok(nodes.some((node) => /[가-힣]/.test(node.props.text ?? node.props.label ?? '')));
  assert.ok(nodes.some((node) => /[A-Za-z]/.test(node.props.text ?? node.props.label ?? '')));
  for (const node of nodes) if (node.type === 'Layout' || node.type === 'Card') assert.ok(classesFor(node).length > 0);
  for (const record of records.filter((record) => record.category === 'metrics')) {
    assert.ok(Object.values(record.spec.elements).every((node) => ['Layout', 'Card', 'Text'].includes(node.type)));
    assert.ok(record.limitations.some((note) => note.includes('not charts')));
  }
});

test('catalog rejects ambiguous provenance and returns independent JSON records', () => {
  for (const invalid of [undefined, '', 'main', candidate.slice(0, 8), candidate.toUpperCase()]) assert.throws(() => catalog(invalid), /exact candidate/);
  const first = catalog(candidate); first[0].spec.elements[first[0].spec.root].props.columns = 'single'; first[0].limitations.push('mutation');
  assert.deepEqual(catalog(candidate), records);
  const unsupported = structuredClone(records[0]); unsupported.spec.elements[unsupported.spec.root].props.className = 'custom';
  assert.equal(validateSpec(unsupported.spec, unsupported.contract).ok, false);
  const undeclared = structuredClone(records.find((record) => record.contract.textBindings.length));
  undeclared.contract.textBindings = [];
  assert.equal(validateSpec(undeclared.spec, undeclared.contract).ok, false);
});
