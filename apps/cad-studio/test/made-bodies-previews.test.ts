import test from 'node:test';
import assert from 'node:assert/strict';
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { printSourceMeshes } from '../src/viewport/printSettings';
import { camPartMeshes } from '../src/viewport/camHeightfield';

// O160 (F1) in the GPU lane's previews (G-R6, roadmap G4): print layers slice and the CNC preview's overcut judges only
// the bodies the part's own process makes. A bought element — an O-ring in a printed cover, a bearing on a turned shaft —
// is left out by the BOM's rule (its kind's default, or the person's override); hidden bodies stay out of the print too.

const mesh = (tag: number) => ({ positions: new Float32Array([tag, 0, 0, 1, 0, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2]) });
const body = (key: string, node: number, tag: number) => ({ key, ref: { node, side: 'solid' }, mesh: mesh(tag) }) as unknown as BodyResult;
const nodes = [{ kind: 'extrude', sketch: 0, height: 8 }, { kind: 'oring', id: 'n1' }, { kind: 'bearing', id: 'n2' }] as unknown as ModelNode[];
const doc = (patch: Partial<StudioDoc> = {}): StudioDoc => ({ ...emptyDoc(), nodes, ...patch });
const tags = (meshes: { positions: ArrayLike<number> }[]) => meshes.map(m => m.positions[0]);

test('print layers and the CNC overcut take the made bodies only: an O-ring and a bearing left out, unless the person says they are made', () => {
  const bodies = [body('cover', 0, 1), body('ring', 1, 2), body('bearing', 2, 3)];
  assert.deepEqual(tags(printSourceMeshes(doc(), bodies)), [1], 'the cover only');
  assert.deepEqual(tags(camPartMeshes(doc(), bodies)), [1]);
  // (The person's override: the O-ring made here, so it is printed and the program must keep out of it.)
  const made = nodes.map((n, i) => i === 1 ? { ...n, bought: false } : n) as ModelNode[];
  assert.deepEqual(tags(printSourceMeshes(doc({ nodes: made }), bodies)), [1, 2]);
  assert.deepEqual(tags(camPartMeshes(doc({ nodes: made }), bodies)), [1, 2]);
  // (A body without a node reference is the part's own.)
  assert.deepEqual(tags(camPartMeshes(doc(), [{ key: 'x', mesh: mesh(9) } as unknown as BodyResult])), [9]);
});

test('a hidden made body is not printed', () => {
  const bodies = [body('cover', 0, 1), body('lid', 0, 4)];
  const shown = printSourceMeshes(doc({ bodies: { lid: { hidden: true } } } as Partial<StudioDoc>), bodies);
  assert.deepEqual(tags(shown), [1]);
});
