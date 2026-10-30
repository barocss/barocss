// Audit probe for D349 (scratch only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { part } from '@barocss/cad-model/api';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { refOf, type Ctx } from '@barocss/cad-model/app/commands';
import { extrudeCommand } from '@barocss/cad-model/app/profileCommands';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { useSketchActions as fixedHook } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/sketch/useSketchActions';
import { useSketchActions as unfixedHook } from './unfixed-hook';

type Hook = typeof fixedHook;
type SketchState = any;
function actions(hook: Hook, doc: StudioDoc) {
  let sketch: SketchState | null = null, api!: ReturnType<Hook>, revision = 1;
  const accepted: StudioDoc[] = [], evaluated: StudioDoc[] = [], notices: unknown[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<SketchState | null>) => { sketch = typeof value === 'function' ? (value as any)(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, revision: number) => { evaluated.push(input); return { ok: true as const, revision, bodies: [], wallTime: 0 }; } };
  function Probe() {
    api = hook({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null },
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: transport as any, nextRevision: () => revision++ }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: (next: StudioDoc) => { accepted.push(next); docNow.current = next; return true; },
        commitDirect: () => { throw new Error('x'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} },
      onNotice: (notice: unknown) => notices.push(notice) } as any);
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, evaluated, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}
function bodySketch(extras: Record<string, unknown>) {
  const box = part('Body sketch').box({ w: 60, d: 40, h: 10 }).doc;
  const evaluated = evaluateDoc(box, 1); assert.ok(evaluated.ok);
  const on = refOf(evaluated.bodies[0]);
  const profile = profileOf([{ kind: 'polygon', closed: true, points: [[10, 10], [30, 10], [30, 25], [10, 25]], hv: { h: [0, 2], v: [1, 3] } } as any]);
  assert.ok('node' in profile);
  const node = { ...profile.node, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on, ...extras } as ModelNode;
  const doc = withNode(box, node), index = doc.nodes.length - 1;
  return { doc, index, on };
}
function opOffered(doc: StudioDoc, index: number) {
  const r = evaluateDoc(doc, 1); if (!r.ok) return { ok: false, err: JSON.stringify(r).slice(0, 200) };
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [], edges: [], bodies: [], sketches: [index] } } as any;
  return { ok: true, bodies: r.bodies.length, offered: extrudeCommand.fields!(ctx).some(f => f.key === 'op') };
}
async function reopenFinish(hook: Hook, doc: StudioDoc, index: number) {
  const f = actions(hook, doc); f.api.editSketch(index); f.render(); f.api.finishSketch(); await setImmediate();
  return f;
}
const J = JSON.stringify;
test('P1 realistic: only on', async () => {
  const { doc, index } = bodySketch({});
  console.log('P1 stored op:', J(opOffered(doc, index)));
  for (const [name, hook] of [['unfixed', unfixedHook], ['fixed', fixedHook]] as const) {
    const f = await reopenFinish(hook as Hook, doc, index);
    const node = f.accepted[0]?.nodes[index] as any;
    console.log('P1 ' + name + ': accepted=' + f.accepted.length + ' notices=' + f.notices.length + ' on=' + J(node?.on) + ' op=' + J(opOffered(f.accepted[0], index)) + ' sameAsStored=' + (J(node) === J(doc.nodes[index])));
  }
});
test('P2 D349 fixture extras; evaluated vs committed', async () => {
  const { doc, index } = bodySketch({ held: 'pick a face', bought: true, suppressed: true });
  console.log('P2 stored op (no un-suppress):', J(opOffered(doc, index)));
  for (const [name, hook] of [['unfixed', unfixedHook], ['fixed', fixedHook]] as const) {
    const f = await reopenFinish(hook as Hook, doc, index);
    const node = f.accepted[0].nodes[index] as any, ev = f.evaluated[0]?.nodes[index];
    console.log('P2 ' + name + ': keys=' + Object.keys(node).sort().join(',') + ' op=' + J(opOffered(f.accepted[0], index)) + ' evaluated==committed node=' + (J(ev) === J(node)) + ' evalLen=' + f.evaluated[0]?.nodes.length + ' commitLen=' + f.accepted[0].nodes.length);
  }
});
test('P3 sigs/rematched carried; file round trips', async () => {
  const { doc, index } = bodySketch({ sigs: { x: { p: [0, 0, 0] } }, rematched: { a: 'b' }, held: 'pick a face', bought: true, suppressed: true });
  const f = await reopenFinish(fixedHook, doc, index);
  console.log('P3 fixed keys:', Object.keys(f.accepted[0].nodes[index]).sort().join(','));
  const opened = await readStudioFile(encodeStudioFile(f.accepted[0]));
  console.log('P3 open edited:', 'doc' in opened ? 'ok' : J(opened).slice(0, 300));
  const plain = bodySketch({ held: 'pick a face', bought: true, suppressed: true });
  const opened2 = await readStudioFile(encodeStudioFile(plain.doc));
  console.log('P3 open D349 fixture:', 'doc' in opened2 ? 'ok held=' + J((opened2.doc.nodes[plain.index] as any).held) + ' on=' + J((opened2.doc.nodes[plain.index] as any).on) : J(opened2).slice(0, 300));
});
test('P4 synthetic detached state', async () => {
  const { doc, index, on } = bodySketch({});
  for (const base of [{ node: 0, side: 'negative' }, null]) {
    const f = actions(fixedHook, doc); f.api.editSketch(index);
    f.setSketch({ ...f.sketch, associationDetached: true, base });
    f.render(); f.api.finishSketch(); await setImmediate();
    console.log('P4 base=' + J(base) + ': on=' + J((f.accepted[0]?.nodes[index] as any)?.on) + ' stored=' + J(on));
  }
});
test('P5 stale on', async () => {
  const { doc, index } = bodySketch({ on: { node: 99, side: 'solid' } });
  const f = await reopenFinish(fixedHook, doc, index);
  console.log('P5 on=' + J((f.accepted[0].nodes[index] as any).on) + ' op=' + J(opOffered(f.accepted[0], index)) + ' storedOp=' + J(opOffered(doc, index)));
});
test('P6 new sketch on face vs edited', async () => {
  const { doc, index, on } = bodySketch({});
  const f = actions(fixedHook, doc);
  f.setSketch({ plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] }, tool: 'polygon', base: on, shape: { kind: 'polygon', closed: true, points: [[10, 10], [30, 10], [30, 25], [10, 25]], hv: { h: [0, 2], v: [1, 3] } } });
  f.render(); f.api.finishSketch(); await setImmediate();
  const made = f.accepted[0].nodes.at(-1) as any;
  const e = await reopenFinish(fixedHook, doc, index), edited = e.accepted[0].nodes[index] as any;
  console.log('P6 new keys=' + Object.keys(made).sort().join(',') + ' | edited keys=' + Object.keys(edited).sort().join(',') + ' | same on=' + (J(made.on) === J(edited.on)));
});
