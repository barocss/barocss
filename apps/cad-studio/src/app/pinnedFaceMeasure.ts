import { lookOf } from '@barocss/cad-model/app/bodies';
import type { MeasurePick, MeasureResult } from '@barocss/cad-model/app/measure';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';

type Cap = 'top' | 'bottom';
export interface PinnedFacePair { body: string; extrude: string; sketch: string; caps: readonly [Cap, Cap] }

const pickOwners = new WeakMap<MeasurePick, { doc: StudioDoc; mesh: DisplayMesh; id: string; name: string }>();

export function bindMeasureFacePick(pick: MeasurePick, doc: StudioDoc, body: BodyResult | undefined) {
  if (pick.face === undefined || !body) return;
  const face = body.mesh.faces[pick.face];
  if (face?.nativePlaneName) pickOwners.set(pick, { doc, mesh: body.mesh, id: face.id, name: face.nativePlaneName });
}

function owner(doc: StudioDoc, body: BodyResult) {
  const ref = body.ref, output = doc.outputs[body.key];
  if (!ref || ref.side !== 'solid' || output?.side !== 'solid' || output.node !== ref.node
    || bodyKeyFor(doc.nodes, ref.node) !== body.key || lookOf(doc, body).hidden) return null;
  const extrude = doc.nodes[ref.node];
  if (extrude?.kind !== 'extrude' || !extrude.id || extrude.suppressed || extrude.held || extrude.made
    || (extrude.from !== undefined && extrude.from !== 0) || (extrude.draft !== undefined && extrude.draft !== 0)
    || typeof extrude.height !== 'number' || !Number.isFinite(extrude.height) || extrude.height <= 0) return null;
  const sketch = doc.nodes[extrude.sketch];
  if (extrude.sketch >= ref.node || sketch?.kind !== 'sketch' || !sketch.id || sketch.suppressed || sketch.held
    || sketch.profile !== 'rectangle' || sketch.association || sketch.on || sketch.outline
    || sketch.holes?.length || sketch.regions?.length || (sketch.plane && !isDefaultPlane(sketch.plane))) return null;
  if (doc.nodes.filter(node => node.id === extrude.id).length !== 1 || doc.nodes.filter(node => node.id === sketch.id).length !== 1) return null;
  const [x0, y0, x1, y1] = [...sketch.min, ...sketch.max];
  if (typeof x0 !== 'number' || typeof x1 !== 'number' || typeof y0 !== 'number' || typeof y1 !== 'number'
    || ![x0, y0, x1, y1].every(Number.isFinite) || !(x1 > x0 && y1 > y0)) return null;
  const min = [x0, y0, 0], max = [x1, y1, extrude.height];
  if (body.mesh.bounds.min.some((value, axis) => value !== min[axis])
    || body.mesh.bounds.max.some((value, axis) => value !== max[axis])) return null;
  return { extrude: extrude.id, sketch: sketch.id, height: extrude.height,
    centre: [x0 / 2 + x1 / 2, y0 / 2 + y1 / 2] as const };
}

function hasCap(mesh: DisplayMesh, feature: string, cap: Cap, height: number): boolean {
  const name = feature + '.' + cap;
  const faces = mesh.faces.filter(face => face.name === name || face.nativePlaneName === name);
  if (faces.length !== 1) return false;
  const [face] = faces, plane = face.exact;
  const top = cap === 'top';
  return mesh.faces[face.index] === face && face.kind === 'plane' && !face.facet && face.nativePlaneName === name
    && plane?.kind === 'plane' && plane.n[0] === 0 && plane.n[1] === 0 && plane.n[2] === (top ? 1 : -1)
    && plane.o.every(Number.isFinite) && plane.o[2] === (top ? height : 0);
}

export function readPinnedFacePair(doc: StudioDoc, bodies: readonly BodyResult[], pin: PinnedFacePair): MeasureResult | null {
  if (doc.instances?.length || pin.caps[0] === pin.caps[1]) return null;
  const matches = bodies.filter(body => body.key === pin.body);
  if (matches.length !== 1) return null;
  const [body] = matches, source = owner(doc, body);
  if (!source || source.extrude !== pin.extrude || source.sketch !== pin.sketch) return null;
  if (!pin.caps.every(cap => hasCap(body.mesh, pin.extrude, cap, source.height))) return null;
  const capCentre = (cap: Cap): Vec3 => [...source.centre, cap === 'top' ? source.height : 0];
  return { distance: source.height, normalDistance: source.height, angle: 0, a: capCentre(pin.caps[0]), b: capCentre(pin.caps[1]) };
}

export function capturePinnedFacePair(doc: StudioDoc, bodies: readonly BodyResult[], picks: readonly MeasurePick[]): PinnedFacePair | null {
  if (picks.length !== 2) return null;
  const [a, b] = picks, body = bodies[a.body];
  if (!body || a.body !== b.body || a.face === undefined || b.face === undefined) return null;
  const source = owner(doc, body);
  if (!source) return null;
  const pickedCap = (pick: MeasurePick): Cap | null => {
    const binding = pickOwners.get(pick), face = body.mesh.faces[pick.face!];
    if (!binding || binding.doc !== doc || binding.mesh !== body.mesh || binding.id !== face?.id
      || binding.name !== face.nativePlaneName) return null;
    if (binding.name === source.extrude + '.top') return 'top';
    return binding.name === source.extrude + '.bottom' ? 'bottom' : null;
  };
  const first = pickedCap(a), second = pickedCap(b);
  if (!first || !second || first === second) return null;
  const pin = { body: body.key, extrude: source.extrude, sketch: source.sketch, caps: [first, second] as const };
  return readPinnedFacePair(doc, bodies, pin) ? pin : null;
}
