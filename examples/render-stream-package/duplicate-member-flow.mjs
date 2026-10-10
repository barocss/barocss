import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompiledResponse } from '@barocss/render-stream/fetch';
import { createJsonlDecoder, encodeRecord } from '@barocss/render-stream/protocol';
import { authoredRecords } from './host.mjs';

const encoder = new TextEncoder();
const identity = { streamId: 'unique-members', revision: 1 };
const record = (seq, type, fields = {}) => ({ version: 1, ...identity, seq, type, ...fields });
const line = (value) => `${JSON.stringify(value)}\n`;
const root = record(1, 'root', { id: 'root' });
const rootLine = line(root);
const duplicateTop = rootLine.replace('"streamId":"unique-members"',
  '"streamId":"other","streamId":"unique-members"');
const escapedTop = rootLine.replace('"streamId":"unique-members"',
  String.raw`"streamId":"other","\u0073treamId":"unique-members"`);

function refuse(raw, kind, expectedIdentity = identity) {
  const seen = [];
  const decoder = createJsonlDecoder({ identity: expectedIdentity, kind, onRecord: (value) => seen.push(value) });
  const bytes = encoder.encode(raw);
  decoder.push(bytes.subarray(0, 13));
  assert.equal(seen.length, 0);
  assert.throws(() => decoder.push(bytes.subarray(13)), /Duplicate JSON member/);
  assert.deepEqual(seen, []);
  assert.throws(() => decoder.finish(), /Decoder stopped/);
}

refuse(duplicateTop, 'input');
refuse(escapedTop, 'input');

const nestedInput = line(record(1, 'node', { id: 'title', node: {
  type: 'Text', props: { id: 'title', text: 'first' }, children: [],
} })).replace('"text":"first"', '"text":"first","text":"second"');
refuse(nestedInput, 'input');
const nestedArray = line(record(1, 'node', { id: 'title', node: {
  type: 'Text', props: { entries: [{ value: 'first' }] }, children: [],
} })).replace('"value":"first"', '"value":"first","value":"second"');
refuse(nestedArray, 'input');

const output = { version: 1, ...identity, seq: 1, type: 'snapshot', sourceSeq: 1,
  phase: 'committed', spec: { root: 'root', elements: {
    root: { type: 'Text', props: { text: 'first' }, children: [] },
  } }, css: '' };
const nestedOutput = line(output).replace('"text":"first"', '"text":"first","text":"second"');
refuse(nestedOutput, 'output');

const siblings = record(1, 'node', { id: 'root', node: {
  type: 'Layout', props: { left: { value: 'quote " and brace }' }, right: { value: 2 },
    entries: [{ label: 'one' }, { label: 'two' }] }, children: [],
} });
const siblingSeen = [];
const siblingDecoder = createJsonlDecoder({ identity, onRecord: (value) => siblingSeen.push(value) });
siblingDecoder.push(encoder.encode(line(siblings) + line(record(2, 'commit'))));
assert.equal(siblingDecoder.finish().records, 2);
assert.equal(siblingSeen.length, 2);

const unicode = record(2, 'node', { id: 'title', node: {
  type: 'Text', props: { id: 'title', text: '민지' }, children: [],
} });
const validBytes = encoder.encode(rootLine + line(unicode) + line(record(3, 'commit')));
const firstUnicodeByte = Buffer.from(validBytes).indexOf(Buffer.from(encoder.encode('민')));
assert.ok(firstUnicodeByte > 0);
const validSeen = [];
const validDecoder = createJsonlDecoder({ identity, onRecord: (value) => validSeen.push(value) });
validDecoder.push(validBytes.subarray(0, firstUnicodeByte + 1));
assert.equal(validSeen.length, 1);
validDecoder.push(validBytes.subarray(firstUnicodeByte + 1));
assert.equal(validDecoder.finish().records, 3);
assert.equal(validSeen[1].node.props.text, '민지');

const contract = { textBindings: ['/name'], actions: ['save'] };
const goodIdentity = { streamId: 'good-fetch', revision: 2 };
let goodAdmissions = 0;
const goodResponse = createCompiledResponse({ identity: goodIdentity, contract,
  source: async function* () { for (const value of authoredRecords(goodIdentity)) yield encodeRecord(value); },
  acceptFinal() { goodAdmissions++; return true; },
});
const snapshots = [];
const outputDecoder = createJsonlDecoder({ identity: goodIdentity, kind: 'output',
  onRecord: (value) => snapshots.push(value) });
for await (const chunk of goodResponse.body) outputDecoder.push(chunk);
const goodResult = outputDecoder.finish();
assert.equal(goodAdmissions, 1);
assert.equal(snapshots.at(-1).phase, 'committed');

const badIdentity = { streamId: 'bad-fetch', revision: 3 };
const badRoot = { version: 1, ...badIdentity, seq: 1, type: 'root', id: 'root' };
const badLine = line(badRoot).replace('"streamId":"bad-fetch"',
  '"streamId":"other","streamId":"bad-fetch"');
let badAdmissions = 0;
const badResponse = createCompiledResponse({ identity: badIdentity, contract,
  source: async function* () { yield encoder.encode(badLine); },
  acceptFinal() { badAdmissions++; return true; },
});
await assert.rejects(badResponse.text(), /Duplicate JSON member/);
assert.equal(badAdmissions, 0);

const result = { status: 'passed', duplicateControls: ['top', 'escaped-top', 'nested-input', 'nested-array', 'nested-output'],
  siblingRecords: siblingSeen.length, utf8SplitRecords: validSeen.length,
  validFetchSnapshots: goodResult.records, validFetchAdmissions: goodAdmissions, invalidFetchAdmissions: badAdmissions,
  modelCalls: 0 };
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'duplicate-member-report.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, report: path.join(out, 'duplicate-member-report.json') }));
