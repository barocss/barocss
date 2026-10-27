// R7 (cad's facade): the kernel's backend for the one part implementation — a spec written as CadPartDocument features,
// and the kernel's results through ./core. Feature ids go by kind and number (sketch1, extrude1, hole1 …). A body is an
// output, by its id.
import type { CadPartDocument, CadPartFeature, CadPartOutput } from '../part/part-model.js';
import { massOf, meshOf, outputsOf, selectionOf, stepOf, stlOf } from './core.js';
import { Part, type PartBackend } from './part.js';
import type { FeatureSpec } from './spec.js';
import { refuse } from './refusal.js';

const emptyDocument = (): CadPartDocument => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [] });

function nextId(doc: CadPartDocument, kind: string): string {
  const taken = new Set(doc.features.map(f => f.id));
  let n = 1;
  while (taken.has(`${kind}${n}`)) n++;
  return `${kind}${n}`;
}

const outputs = (doc: CadPartDocument): readonly CadPartOutput[] => doc.features.length ? outputsOf(doc) : [];

function output(doc: CadPartDocument, body: string): CadPartOutput {
  const all = outputs(doc), found = all.find(o => o.id === body);
  if (!found) throw refuse('BODY_UNKNOWN', `no body ${body} in the part; its bodies are ${all.map(o => o.id).join(', ') || 'none'}`);
  return found;
}

const AXES = ['x', 'y', 'z'] as const;
// (The studio's circular-pattern step, to a millionth of a degree: an even share of a full turn, or the span over the gaps.)
const step = (span: number, count: number) => Math.round((span >= 360 ? 360 / count : span / (count - 1)) * 1e6) / 1e6;

// (The features a spec writes, `body` the output it acts on — given by the part for every verb that acts on one.)
function featuresOf(doc: CadPartDocument, spec: FeatureSpec, body: string | null): CadPartFeature[] {
  const target = () => output(doc, body!).id;
  switch (spec.command) {
    case 'box': {
      const { w, d, h, x, y, z } = spec.values, sketch = nextId(doc, 'sketch'), extrude = nextId(doc, 'extrude');
      return [{ id: sketch, kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] }, { id: extrude, kind: 'extrude', sketch, height: h, ...(z ? { from: z } : {}) }];
    }
    case 'cylinder': {
      const { r, h, x, y, z } = spec.values, sketch = nextId(doc, 'sketch'), extrude = nextId(doc, 'extrude');
      return [{ id: sketch, kind: 'sketch', profile: 'circle', center: [x, y], radius: r }, { id: extrude, kind: 'extrude', sketch, height: h, ...(z ? { from: z } : {}) }];
    }
    case 'extrude': {
      const sketch = nextId(doc, 'sketch'), { h, draft } = spec.values;
      return [{ id: sketch, kind: 'sketch', ...spec.sketch } as CadPartFeature, { id: nextId(doc, 'extrude'), kind: 'extrude', sketch, height: h, ...(draft ? { draft } : {}) }];
    }
    case 'revolve': {
      const sketch = nextId(doc, 'sketch'), { axis, deg } = spec.values;
      return [{ id: sketch, kind: 'sketch', ...spec.sketch } as CadPartFeature, { id: nextId(doc, 'revolve'), kind: 'revolve', sketch, axis: { origin: [0, 0], direction: axis }, angle: deg }];
    }
    case 'hole': {
      // (As the studio's hole command writes it: the axis and side from the face's normal — Z and the far side left
      // out — and the face it goes into by name, D148.)
      const on = output(doc, body!), face = selectionOf(on).faces().list().find(f => f.name === spec.face);
      if (!face) throw refuse('FACE_NOT_FLAT', `no flat face ${spec.face} on the body`);
      const k = [0, 1, 2].find(i => Math.abs(Math.abs(face.normal[i]) - 1) < 1e-6);
      if (k === undefined) throw refuse('FACE_NOT_FLAT', `a hole goes into a face facing ±X, ±Y or ±Z; ${face.name} does not`);
      const axis = AXES[k], side = face.normal[k] > 0 ? 'max' : 'min', { d, x, y, depth } = spec.values;
      return [{ id: nextId(doc, 'hole'), kind: 'hole', target: on.id, center: [x, y], radius: d / 2, ...(axis === 'z' ? {} : { axis }), ...(side === 'min' ? { side } : {}), face: face.name, ...(depth !== undefined ? { depth } : {}) }];
    }
    case 'fillet':
      return [{ id: nextId(doc, 'fillet'), kind: 'fillet', target: target(), edges: [...spec.edges], radius: spec.values.radius }];
    case 'chamfer':
      return [{ id: nextId(doc, 'chamfer'), kind: 'chamfer', target: target(), edges: [...spec.edges], distance: spec.values.distance }];
    case 'shell':
      return [{ id: nextId(doc, 'shell'), kind: 'shell', target: target(), thickness: spec.values.t, ...(spec.faces.length ? { open: [...spec.faces] } : {}) }];
    case 'union': case 'difference': case 'intersect':
      return [{ id: nextId(doc, spec.command), kind: spec.command, target: target(), tool: output(doc, spec.tool).id }];
    case 'linear-pattern': {
      const { axis, spacing, count } = spec.values;
      return [{ id: nextId(doc, 'linear-pattern'), kind: 'linear-pattern', target: target(), axis, spacing, count }];
    }
    case 'linear-feature-pattern': {
      const { axis, spacing, count } = spec.values;
      return [{ id: nextId(doc, 'linear-feature-pattern'), kind: 'linear-feature-pattern', target: target(), axis, spacing, count }];
    }
    case 'circular-pattern': {
      const { axis, count, span, px, py } = spec.values;
      return [{ id: nextId(doc, 'circular-pattern'), kind: 'circular-pattern', target: target(), axis, angle: axis === 'z' ? step(span, count) : 90, count, ...(axis === 'z' && (px || py) ? { pivot: [px, py, 0] } : {}) }];
    }
    case 'mirror': {
      // (As the studio writes it: the kernel mirrors across planes through the origin, so a plane elsewhere is a move
      // there, the mirror and the move back.)
      const { plane, at } = spec.values;
      if (!at) return [{ id: nextId(doc, 'mirror'), kind: 'mirror', target: target(), plane, keep: true }];
      const k = { yz: 0, xz: 1, xy: 2 }[plane], shift = (v: number): [number, number, number] => { const o: [number, number, number] = [0, 0, 0]; o[k] = v; return o; };
      const there = nextId(doc, 'translate'), mirrored = nextId(doc, 'mirror'), back = `translate${Number(there.slice(9)) + 1}`;
      return [{ id: there, kind: 'translate', target: target(), offset: shift(-at) }, { id: mirrored, kind: 'mirror', target: there, plane, keep: true }, { id: back, kind: 'translate', target: mirrored, offset: shift(at) }];
    }
    case 'scale': {
      const { factor, px, py, pz } = spec.values;
      return [{ id: nextId(doc, 'scale'), kind: 'scale', target: target(), factor, ...(px || py || pz ? { pivot: [px, py, pz] } : {}) }];
    }
    case 'split': {
      const v = spec.values;
      return [{ id: nextId(doc, 'split'), kind: 'split', target: target(), ...(v.axis === 'n' ? { normal: [v.nx, v.ny, v.nz] } : { axis: v.axis }), at: v.at }];
    }
    case 'gear': case 'gear-mesh': case 'spring': case 'fastener':
      throw refuse('UNAVAILABLE', `${spec.command} is a studio command: use @barocss/cad-model/api's part (the kernel's own gear and thread features take a set of their own)`);
    case 'move':
      return [{ id: nextId(doc, 'translate'), kind: 'translate', target: target(), offset: [spec.values.x, spec.values.y, spec.values.z] }];
    case 'rotate': {
      const { axis, angle, px, py, pz } = spec.values;
      return [{ id: nextId(doc, 'rotate'), kind: 'rotate', target: target(), axis, angle: angle, ...(px || py || pz ? { pivot: [px, py, pz] } : {}) }];
    }
  }
}

/**
 * R7.4d: which of a verb's options take a parameter in a CadPartDocument, and where — the feature, counted from the
 * first one the spec writes, and the path to the leaf holding the value as it is. The studio's set (its ƒ editor's),
 * less what the kernel's document holds as a plain number: a revolve's angle, a pattern's count, a scale's factor.
 */
const BINDS: Record<string, Record<string, readonly [feature: number, path: readonly (string | number)[]]>> = {
  box: { w: [0, ['max', 0]], d: [0, ['max', 1]], h: [1, ['height']] },
  cylinder: { x: [0, ['center', 0]], y: [0, ['center', 1]], h: [1, ['height']] },
  extrude: { h: [1, ['height']] },
  hole: { x: [0, ['center', 0]], y: [0, ['center', 1]] },
  fillet: { radius: [0, ['radius']] },
  chamfer: { distance: [0, ['distance']] },
  shell: { t: [0, ['thickness']] },
  'linear-pattern': { spacing: [0, ['spacing']] },
  'linear-feature-pattern': { spacing: [0, ['spacing']] },
  split: { at: [0, ['at']] },
};

// (A leaf of a feature, read and replaced along a path: the feature copied only on the way to it.)
const leaf = (o: unknown, path: readonly (string | number)[]): unknown => path.reduce<unknown>((v, k) => (v as Record<string | number, unknown>)?.[k], o);
function withLeaf<T>(o: T, path: readonly (string | number)[], value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path, copy = (Array.isArray(o) ? [...o] : { ...o }) as Record<string | number, unknown>;
  copy[k] = withLeaf(copy[k], rest, value);
  return copy as T;
}

// (Each option given as a parameter written as the reference in the one leaf that holds its number as it is — a box's
// far corner is x + w, so its w binds only while x is 0 — or refused, naming the options that bind.)
function bound(features: CadPartFeature[], spec: FeatureSpec): CadPartFeature[] {
  const out = [...features], table = BINDS[spec.command] ?? {}, values = spec.values as unknown as Record<string, unknown>;
  for (const { option, parameter } of spec.bound!) {
    const at = table[option];
    if (!at) throw refuse('PARAMETER_UNBINDABLE', `${spec.command}'s ${option} can't take a parameter in a CadPartDocument (its options that do are ${Object.keys(table).join(', ') || 'none'})`);
    const [k, path] = at;
    if (leaf(out[k], path) !== values[option]) throw refuse('PARAMETER_UNBINDABLE', `${spec.command}'s ${option} doesn't land as it is in one place here, so it can't take ${parameter} (a box's w or d only while its x or y is 0)`);
    out[k] = withLeaf(out[k], path, { parameter });
  }
  return out;
}

export const kernelBackend: PartBackend<CadPartDocument> = {
  empty: emptyDocument,
  copy: doc => structuredClone(doc),
  bodies: doc => outputs(doc).map(o => o.id),
  apply(doc, spec, body) {
    let added = featuresOf(doc, spec, body);
    if (spec.bound?.length) added = bound(added, spec);
    let next = doc;
    for (const feature of added) next = { ...next, features: [...next.features, feature] };
    // (Written, then evaluated once: a feature the kernel refuses is refused here, the part unchanged.)
    outputsOf(next);
    return next;
  },
  select: (doc, body) => selectionOf(output(doc, body)),
  mass: (doc, body, density) => massOf(output(doc, body), density),
  step: (doc, name) => stepOf(outputs(doc), name),
  meshes: doc => outputs(doc).map(meshOf),
  parameters: doc => doc.parameters,
  withParameters(doc, parameters) {
    const next = { ...doc, parameters };
    if (next.features.length) outputsOf(next);
    return next;
  },
  features: doc => doc.features.map(f => ({ id: f.id, kind: f.kind, label: f.id })),
  suppress(_doc, id) { throw refuse('UNAVAILABLE', `a kernel part's features can't be suppressed: the CadPartDocument has no suppressed flag yet (${id})`); },
};

/** A kernel part: the one part over a CadPartDocument, with the kernel's STL besides. */
export class KernelPart extends Part<CadPartDocument> {
  /** The body as binary STL (its display tessellation). */
  stl(): Uint8Array { return stlOf(output(this.document, this.target())); }
}

/**
 * A new kernel part, empty — or continuing from a document of your own (a saved one, or another part's `.doc`): it is
 * evaluated once, and the part's verbs add to it.
 */
export function part(name = 'part', doc?: CadPartDocument): KernelPart {
  if (doc === undefined) return new KernelPart(kernelBackend, name, emptyDocument());
  if (doc?.format !== 'barocss-cad-part') throw refuse('VALUE', 'a kernel part continues from a CadPartDocument (format barocss-cad-part)');
  const own = structuredClone(doc);
  if (own.features.length) outputsOf(own);
  return new KernelPart(kernelBackend, name, own);
}
