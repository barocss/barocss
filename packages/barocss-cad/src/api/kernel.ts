// R7 (cad's facade): the kernel's backend for the one part implementation — a spec written as CadPartDocument features,
// and the kernel's results through ./core. Feature ids go by kind and number (sketch1, extrude1, hole1 …).
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

// (The output a feature acts on: the part's one output. Several bodies need a body chooser, which comes later.)
function single(doc: CadPartDocument): CadPartOutput {
  const outputs = doc.features.length ? outputsOf(doc) : [];
  if (outputs.length === 0) throw refuse('NO_BODY', 'the part has no body yet: start it with box()');
  if (outputs.length > 1) throw refuse('BODY_AMBIGUOUS', `the part has ${outputs.length} bodies; acting on one needs the body chooser, which comes later`);
  return outputs[0];
}

const AXES = ['x', 'y', 'z'] as const;

function featuresOf(doc: CadPartDocument, spec: FeatureSpec): CadPartFeature[] {
  switch (spec.command) {
    case 'box': {
      const { w, d, h, x, y, z } = spec.values, sketch = nextId(doc, 'sketch'), extrude = nextId(doc, 'extrude');
      return [{ id: sketch, kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] }, { id: extrude, kind: 'extrude', sketch, height: h, ...(z ? { from: z } : {}) }];
    }
    case 'hole': {
      // (As the studio's hole command writes it: the axis and side from the face's normal — Z and the far side left
      // out — and the face it goes into by name, D148.)
      const target = single(doc), face = selectionOf(target).faces().list().find(f => f.name === spec.face);
      if (!face) throw refuse('FACE_NOT_FLAT', `no flat face ${spec.face} on the body`);
      const k = [0, 1, 2].find(i => Math.abs(Math.abs(face.normal[i]) - 1) < 1e-6);
      if (k === undefined) throw refuse('FACE_NOT_FLAT', `a hole goes into a face facing ±X, ±Y or ±Z; ${face.name} does not`);
      const axis = AXES[k], side = face.normal[k] > 0 ? 'max' : 'min', { d, x, y, depth } = spec.values;
      return [{ id: nextId(doc, 'hole'), kind: 'hole', target: target.id, center: [x, y], radius: d / 2, ...(axis === 'z' ? {} : { axis }), ...(side === 'min' ? { side } : {}), face: face.name, ...(depth !== undefined ? { depth } : {}) }];
    }
    case 'fillet':
      return [{ id: nextId(doc, 'fillet'), kind: 'fillet', target: single(doc).id, edges: [...spec.edges], radius: spec.values.radius }];
  }
}

export const kernelBackend: PartBackend<CadPartDocument> = {
  empty: emptyDocument,
  copy: doc => structuredClone(doc),
  apply(doc, spec) {
    let next = doc;
    for (const feature of featuresOf(doc, spec)) next = { ...next, features: [...next.features, feature] };
    return next;
  },
  select: doc => selectionOf(single(doc)),
  mass: (doc, density) => massOf(single(doc), density),
  step: (doc, name) => stepOf(single(doc), name),
  meshes: doc => outputsOf(doc).map(meshOf),
};

/** A kernel part: the one part over a CadPartDocument, with the kernel's STL besides. */
export class KernelPart extends Part<CadPartDocument> {
  /** The part as binary STL (its display tessellation). */
  stl(): Uint8Array { return stlOf(single(this.document)); }
}

/** A new, empty kernel part. */
export function part(name = 'part'): KernelPart { return new KernelPart(kernelBackend, name, emptyDocument()); }
