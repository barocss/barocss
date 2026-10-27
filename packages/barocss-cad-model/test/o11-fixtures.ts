// O11's fixtures (built from existing files, no new .bcad): masters with inputs and two variants each — used by
// test/o11-variability and by scripts/r4-fingerprint (each variant one document there).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readStudioFile } from '../src/engine/container';
import { cylinderPart, emptyDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { featureId } from '../src/engine/ids';
import { evaluatePart } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { tablesFor } from '../src/assembly/faces';
import { solveAssembly, type Mate } from '../src/assembly/mates';
import type { Input } from '../src/engine/schema/variability';

const read = async (repo: string, f: string): Promise<StudioDoc> => { const r = await readStudioFile(new Uint8Array(readFileSync(resolve(repo, f)))); if (!('doc' in r)) throw new Error(f); return r.doc; };

/** The clearance fixture: a boolean drops the fourth pair, a choice swaps copy i1 for the shipped tslot-20 end cap. */
export async function clearanceMaster(repo: string): Promise<StudioDoc> {
  const base = await read(repo, 'apps/cad-studio/test/fixtures/clearance-states.bcad');
  const box = (i: PartInstance) => featureId(i.doc.nodes, i.doc.nodes.findIndex(n => n.kind === 'extrude'));
  const [i7, i8] = ['i7', 'i8'].map(id => base.instances!.find(i => i.id === id)!);
  const inputs: Input[] = [
    { name: 'fourth pair', type: 'boolean', default: true, bindings: [{ to: 'suppress', part: 'i7', feature: box(i7), when: false }, { to: 'suppress', part: 'i8', feature: box(i8), when: false }] },
    { name: 'copy size', type: 'choice', choices: [{ value: 'box' }, { value: 'end cap' }], default: 'box', bindings: [{ to: 'component', instance: 'i1', options: { box: { like: 'i1' }, 'end cap': { library: 'tslot-20', part: 'end-cap' } } }] },
  ];
  return { ...base, variability: { version: 1, inputs, variants: [{ name: 'three pairs', values: { 'fourth pair': false } }, { name: 'end cap', values: { 'copy size': 'end cap' } }] } };
}

/** The 6R arm with links l2 and l3 re-authored on parameters L (length) and H (far bore), "reach" bound to both. */
export async function armMaster(repo: string): Promise<StudioDoc> {
  const arm = await read(repo, 'packages/barocss-cad/conformance/rm/arm-6r/robot.bcad');
  const bound = (i: PartInstance): PartInstance => ({ ...i, doc: { ...i.doc, parameters: { L: 80, H: 60 }, nodes: i.doc.nodes.map(n => n.kind === 'extrude' ? { ...n, height: { parameter: 'L' } } : n.kind === 'hole' && n.id === 'n5' ? { ...n, center: [10, { parameter: 'H' }] } : n) as StudioDoc['nodes'] } });
  const linked: StudioDoc = { ...arm, instances: arm.instances!.map(i => i.id === 'l2' || i.id === 'l3' ? bound(i) : i) };
  const reach: Input = { name: 'reach', type: 'number', unit: 'mm', min: 20, max: 80, default: 40, bindings: ['l2', 'l3'].flatMap(part => [{ to: 'parameter' as const, part, parameter: 'L', offset: 40 }, { to: 'parameter' as const, part, parameter: 'H', offset: 20 }]) };
  return { ...linked, variability: { version: 1, inputs: [reach], variants: [{ name: 'long', values: { reach: 60 } }, { name: 'short', values: { reach: 30 } }] } };
}

/** A frame on sketch3d-params' skeleton, its sides bound to W and D; "span" sets W. */
export async function frameMaster(): Promise<StudioDoc> {
  const cs = [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } },
    { kind: 'length', segment: 0, value: { parameter: 'W' } }, { kind: 'length', segment: 1, value: { parameter: 'D' } }, { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
  const sk = { kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints: cs };
  const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
  const r = await dispatchTool({ doc: { ...emptyDoc(), parameters: { W: 600, D: 400 } }, bodies: [] }, 'add_features', { features: [sk, frame] }, async d => evaluatePart(d, 1));
  if (r.isError) throw new Error(r.content);
  const span: Input = { name: 'span', type: 'number', unit: 'mm', min: 300, max: 1200, default: 600, bindings: [{ to: 'parameter', part: 'base', parameter: 'W' }] };
  return { ...r.state.doc, variability: { version: 1, inputs: [span], variants: [{ name: '800', values: { span: 800 } }, { name: '1000', values: { span: 1000 } }] } };
}

/** A plate (the root) and a pin standing on it `distance` above its top (the mates solved). */
export function plateAndPin(distance: number): StudioDoc {
  const pin: PartInstance = { id: 'pin', name: 'pin', doc: cylinderPart(3, 20), position: [20, 10, 30], rotation: [0, 0, 0] };
  const mates: Mate[] = [{ id: 'm1', kind: 'distance', distance, a: { part: 'base', face: 'n1.top' }, b: { part: 'pin', face: 'n1.bottom' } }];
  const doc: StudioDoc = { ...rectanglePart(64, 32, 8), instances: [pin], mates };
  return { ...doc, instances: solveAssembly(doc.instances!, mates, tablesFor(doc), doc.instances!).instances };
}
/** The plate and pin with "offset" bound to the pin's distance mate. */
export function plateMaster(): StudioDoc {
  const offset: Input = { name: 'offset', type: 'number', unit: 'mm', min: 0, max: 50, default: 5, bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] };
  return { ...plateAndPin(5), variability: { version: 1, inputs: [offset], variants: [{ name: 'high', values: { offset: 25 } }, { name: 'low', values: { offset: 1 } }] } };
}

/** Every fixture: its name, its master. */
export async function o11Masters(repo: string): Promise<[string, StudioDoc][]> {
  return [['clearance', await clearanceMaster(repo)], ['arm', await armMaster(repo)], ['frame', await frameMaster()], ['plate', plateMaster()]];
}
