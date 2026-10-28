import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, starterDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { fontTemplateProblem, removeTemplate, savedTemplates, saveTemplate } from '../src/app/templates';

// This storage fixture covers only local JSON-template policy, not font-file persistence or browser behavior.
class MemoryStorage {
  readonly data = new Map<string, string>();
  writes = 0;
  refuse = false;
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.refuse) throw new Error('QuotaExceededError');
    this.data.set(key, value); this.writes++;
  }
  reset(): void { this.data.clear(); this.writes = 0; this.refuse = false; }
}
const KEY = 'studio.templates', storage = new MemoryStorage();
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
before(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage }); });
beforeEach(() => { storage.reset(); });
after(() => { if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
const FONT = { blob: '1'.repeat(64), filename: 'original.ttf' };
type Proposal = NonNullable<StudioDoc['proposals']>[number];
function textDocument(): StudioDoc {
  return withNode(emptyDoc(), { kind: 'text', text: 'A', font: { ...FONT }, size: 10, height: 2, tolerance: 0.01 });
}
function proposal(status: Proposal['status']): Proposal {
  return { id: 'P1', title: 'Text', status, by: { agent: 'test' }, at: '2026-10-28', base: 'fixture', summary: '',
    ops: [{ tool: 'run_command', args: { command: 'text', values: { text: 'A', font: JSON.stringify(FONT), size: 10, height: 2, tolerance: 0.01, tracking: 0 } } }],
    risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] } };
}
function proposalDocument(status: Proposal['status'] = 'open'): StudioDoc { return { ...emptyDoc(), proposals: [proposal(status)] }; }
function pendingDocument(): StudioDoc { return { ...emptyDoc(), pendingParts: { p: { name: 'Pending', rev: 'A', doc: textDocument() } } }; }
function instanceDocument(): StudioDoc {
  return { ...emptyDoc(), instances: [{ id: 'i0', name: 'Placed', doc: pendingDocument(), position: [0, 0, 0], rotation: [0, 0, 0] }] };
}
function seed(): string {
  const raw = JSON.stringify({ Existing: starterDoc() }); storage.setItem(KEY, raw); return raw;
}
function assertRefused(doc: StudioDoc): void {
  const raw = seed(), writes = storage.writes, before = structuredClone(doc), problem = fontTemplateProblem(doc);
  assert.ok(problem && /font/i.test(problem) && /\.bcad/.test(problem), 'the refusal directs original font bytes to .bcad');
  assert.equal(saveTemplate('Existing', doc), false);
  assert.equal(storage.getItem(KEY), raw); assert.equal(storage.writes, writes); assert.deepEqual(doc, before);
}

test('a root text recipe is refused without changing existing template data or the document', () => { assertRefused(textDocument()); });
test('a proposal-only prepared text command is refused before its font becomes an authored node', () => { assertRefused(proposalDocument()); });
test('pending parts and nested instance font references are refused even when the root has no text', () => {
  assertRefused(pendingDocument()); storage.reset(); assertRefused(instanceDocument());
});
test('closed proposals do not require font bytes and retain normal template behavior', () => {
  for (const status of ['accepted', 'rejected'] as const) {
    const doc = proposalDocument(status), before = structuredClone(doc);
    assert.equal(fontTemplateProblem(doc), null); assert.equal(saveTemplate(status, doc), true); assert.deepEqual(doc, before);
  }
  assert.deepEqual(savedTemplates().map(entry => entry.name).sort(), ['accepted', 'rejected']);
});
test('incomplete font templates are hidden from the list without changing stored entries', () => {
  const raw = JSON.stringify({ Good: starterDoc(), Root: textDocument(), Proposal: proposalDocument(), Pending: pendingDocument(), Nested: instanceDocument() });
  storage.setItem(KEY, raw); const writes = storage.writes;
  assert.deepEqual(savedTemplates().map(entry => entry.name), ['Good']);
  assert.equal(storage.getItem(KEY), raw); assert.equal(storage.writes, writes);
});
test('unrelated save and removal preserve hidden font entries in storage', () => {
  const hidden = { Root: textDocument(), Proposal: proposalDocument() };
  storage.setItem(KEY, JSON.stringify({ ...hidden, Existing: starterDoc() }));
  assert.equal(saveTemplate('New', emptyDoc()), true);
  let raw = JSON.parse(storage.getItem(KEY)!) as Record<string, unknown>;
  assert.deepEqual(raw.Root, hidden.Root); assert.deepEqual(raw.Proposal, hidden.Proposal);
  assert.equal(removeTemplate('Existing'), true); raw = JSON.parse(storage.getItem(KEY)!);
  assert.deepEqual(raw.Root, hidden.Root); assert.deepEqual(raw.Proposal, hidden.Proposal); assert.ok(!('Existing' in raw));
  assert.deepEqual(savedTemplates().map(entry => entry.name), ['New']);
});
test('normal current templates still save, replace, list, and remove without mutating their input', () => {
  const doc = starterDoc(), before = structuredClone(doc);
  assert.equal(fontTemplateProblem(doc), null); assert.equal(saveTemplate('Plate', doc), true);
  assert.deepEqual(savedTemplates()[0].doc.nodes, doc.nodes); assert.deepEqual(doc, before);
  assert.equal(saveTemplate('Plate', emptyDoc()), true); assert.equal(savedTemplates().length, 1); assert.deepEqual(savedTemplates()[0].doc.nodes, []);
  assert.equal(removeTemplate('Plate'), true); assert.deepEqual(savedTemplates(), []);
});
test('storage refusal and unavailable mesh blobs leave the existing saved data intact', () => {
  const raw = seed(), doc = starterDoc(), before = structuredClone(doc);
  storage.refuse = true; assert.equal(saveTemplate('New', doc), false); assert.equal(storage.getItem(KEY), raw); assert.deepEqual(doc, before);
  storage.refuse = false;
  const mesh: ModelNode = { kind: 'mesh', name: 'Unloaded', unit: 'mm', blob: { positions: '2'.repeat(64), indices: '3'.repeat(64) } };
  const missing = withNode(emptyDoc(), mesh), snapshot = structuredClone(missing), writes = storage.writes;
  assert.equal(saveTemplate('Missing', missing), false); assert.equal(storage.getItem(KEY), raw); assert.equal(storage.writes, writes); assert.deepEqual(missing, snapshot);
});
