import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editBearingRows } from '../src/engine/bearings';
import { editFitTables } from '../src/engine/fits';
import { drawingInputs } from '../src/chat/drawing';
const readSettings = (doc: StudioDoc) => readDrawing(doc.drawing);
import { drawingIssues, fixAll, fixRound, fixRoundsStart, fixScore, issueContext } from '../src/drawing/issues';
import { readDrawing, sectionsOf } from '../src/drawing/types';

// O170 (A9's F8): one Fix leaves a sheet it can fix fixed. On the default shaft with its key and bearing, Fix adds the
// keyseat's section B (O148 X3) and places the dimensions again; the new section is a new view, and the overlap it brings
// (a dimension over the key's note) was invisible to that same pass, so a second Fix was needed. Fix now builds the sheet
// again and fixes what it shows until a round applies none.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const ROW = { id: '6204', designation: '6204', bore: 20, outsideMM: 47, width: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, DaMaxMM: 42, raMaxMM: 1, source: 'test' };
const FITS = { id: 'f', rows: [{ class: 'k5', over: 18, upTo: 30, upperUM: 11, lowerUM: 2, estimate: true }] };
test('O170: one Fix on the shaft leaves no TEXT_OVERLAP — a second applies nothing', async () => {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  await call('features', { action: 'command', command: 'shaft', values: {} });
  s = { ...s, doc: (editFitTables((editBearingRows(s.doc, [ROW]) as { doc: StudioDoc }).doc, [FITS]) as { doc: StudioDoc }).doc };
  await call('features', { action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] });
  await call('features', { action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  await call('drawing', { action: 'auto' });
  const fixed = await call('drawing', { action: 'fix' }) as { applied: string[]; issues: { code: string; severity: string }[] };
  assert.ok(fixed.applied.includes('add-section'), JSON.stringify(fixed.applied));
  // (Its answer reports the sheet as built after the fixes, the same as asking again.)
  const asked = await call('drawing', { action: 'issues' }) as { issues: { code: string; severity: string }[] };
  assert.deepEqual(fixed.issues.map(x => x.code), asked.issues.map(x => x.code));
  assert.deepEqual(asked.issues.filter(x => x.severity === 'error').map(x => x.code), []);
  assert.deepEqual((await call('drawing', { action: 'fix' }) as { applied: string[] }).applied, [], 'nothing left for a second Fix');
  const i = drawingInputs(s.doc); if (typeof i === 'string') throw Error(i);
  assert.deepEqual(drawingIssues(issueContext(i)).filter(x => x.code === 'TEXT_OVERLAP'), []);
});

// O175: the studio's Fix all runs the same rounds, fixRound, a round per sheet: a round that adds a section hands back the
// settings to cut it from, and the next round runs on the sheet with its view. Driven so, round by round, it reaches the
// chat's fix_drawing; one pass alone (the studio's Fix all before) stops at the section, its overlap not yet seen.
test('O175: Fix all round by round, as the studio runs it — the chat\'s result; a single pass leaves what the next round clears', async () => {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; return JSON.parse(r.content); };
  await call('features', { action: 'command', command: 'shaft', values: {} });
  s = { ...s, doc: (editFitTables((editBearingRows(s.doc, [ROW]) as { doc: StudioDoc }).doc, [FITS]) as { doc: StudioDoc }).doc };
  await call('features', { action: 'command', command: 'key', values: { h: 6 }, bodies: ['b0'] });
  await call('features', { action: 'command', command: 'bearing', values: { sc: 'k5', step: 3, against: 'start' }, bodies: ['b0'] });
  await call('drawing', { action: 'auto' });
  const start = drawingInputs(s.doc); if (typeof start === 'string') throw Error(start);
  const build = (settings: typeof start.settings) => { const i = drawingInputs({ ...s.doc, drawing: settings }, settings); if (typeof i === 'string') throw Error(i); return i; };
  // (One pass: the studio's Fix all before O175.)
  const once = fixAll(start, 40);
  assert.ok(sectionsOf(once.settings).length > sectionsOf(start.settings).length, 'the pass adds a section');
  const afterOnce = fixScore(drawingIssues(issueContext(build(once.settings))));
  // (Round by round: each `next` built, its sections cut, as the studio's worker does, then the next round.)
  let step = fixRound(fixRoundsStart(start), start), rounds = 1;
  assert.ok(step.next && sectionsOf(step.next).length > sectionsOf(start.settings).length, 'the first round hands back a section to cut');
  while (step.next) { step = fixRound(step.state, build(step.next)); rounds++; }
  const outcome = fixScore(drawingIssues(issueContext(build(step.settings))));
  assert.equal(outcome[0], 0, 'no error');
  assert.ok(outcome[0] < afterOnce[0] || (outcome[0] === afterOnce[0] && outcome[1] < afterOnce[1]), `better than one pass: ${outcome} against ${afterOnce}`);
  assert.ok(rounds > 1);
  // (The chat's fix_drawing, the same rounds in one call: the same settings.)
  await call('drawing', { action: 'fix' });
  assert.deepEqual(readSettings(s.doc), step.settings);
});
