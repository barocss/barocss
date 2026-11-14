import { faceGeometry, type CadPartOutput } from '@barocss/cad';
import { isSolidNode, type SketchNode, type StudioDoc } from '../engine/doc';
import { bodyKeyFor, featureId, featureIdsOf } from '../engine/ids';
import { partSnapshot, resolveAssociativeSketch } from '../engine/part';
import { isRefusal, refusal } from '../engine/refusal';

export interface AssociativeInsetFacePick { bodyKey: string; faceId: string; faceName: string }

const refused = (message: string) => refusal('BAD_REFERENCE', `Replace inset source: ${message}`);

function uniqueId(doc: StudioDoc, index: number): string | null {
  const id = doc.nodes[index]?.id;
  return id && doc.nodes.filter((_, i) => featureId(doc.nodes, i) === id).length === 1 ? id : null;
}

function singleSolid(outputs: readonly CadPartOutput[], id: string) {
  const matches = outputs.filter(output => output.feature === id);
  const [output] = matches;
  return matches.length === 1 && output.id === id && output.representation !== 'faceted'
    && output.brep.bodies.length === 1 && output.brep.bodies[0].kind === 'solid' ? output.brep : null;
}

function hasNamedReferences(doc: StudioDoc, sketchId: string, extrusionId: string, outputKey: string): boolean {
  const look = doc.bodies?.[outputKey];
  if ([look?.faces, look?.faceSigs, look?.facesWas].some(faces => faces && Object.keys(faces).length)) return true;
  const names = [
    ...Object.keys(doc.mould?.sides ?? {}), ...(doc.casting?.machined ?? []),
    ...(doc.fits?.faces ?? []).map(ref => ref.face),
    ...(doc.fits?.pairs ?? []).flatMap(ref => [ref.hole, ref.shaft]),
  ];
  return names.some(name => featureIdsOf(name).some(id => id === sketchId || id === extrusionId));
}

/** Check the authored graph without evaluating the part or choosing a candidate face. */
export function insetRelinkReadiness(doc: StudioDoc, sketchIndex: number) {
  if (doc.instances?.length || doc.mates?.length || doc.assemblyCuts?.length || doc.drawing !== undefined) {
    return { problem: 'Open the part on its own, with no drawing attached.' } as const;
  }
  const sketch = doc.nodes[sketchIndex], sketchId = uniqueId(doc, sketchIndex);
  if (!Number.isInteger(sketchIndex) || sketch?.kind !== 'sketch' || !sketchId || sketch.suppressed || sketch.held
    || sketch.profile === 'band' || sketch.association?.kind !== 'planar-face-outline-inset' || sketch.association.version !== 1) {
    return { problem: 'Select one active linked face inset.' } as const;
  }
  const association = sketch.association;
  const on = sketch.on, target = on && doc.nodes[on.node];
  if (!on || !Number.isInteger(on.node) || on.node < 0 || on.node >= sketchIndex || on.side !== 'solid'
    || !target || !isSolidNode(target) || target.suppressed || !uniqueId(doc, on.node)) {
    return { problem: 'The linked sketch needs an explicit earlier solid as its application target.' } as const;
  }

  // A terminal extrusion keeps downstream topology references outside this operation.
  const extrusionIndex = sketchIndex + 1;
  const extrusion = doc.nodes[extrusionIndex], extrusionId = uniqueId(doc, extrusionIndex);
  if (!extrusion) return { problem: 'Make a straight Extrude as a new body before replacing the source.' } as const;
  if (extrusionIndex !== doc.nodes.length - 1 || extrusion?.kind !== 'extrude' || !extrusionId || extrusion.sketch !== sketchIndex
    || extrusion.suppressed || extrusion.held || extrusion.made || typeof extrusion.height !== 'number'
    || !Number.isFinite(extrusion.height) || extrusion.height <= 0 || (extrusion.from ?? 0) !== 0 || (extrusion.draft ?? 0) !== 0) {
    return { problem: 'The linked sketch must feed one final straight extrusion made as a new body.' } as const;
  }
  const outputKey = bodyKeyFor(doc.nodes, extrusionIndex);
  const output = Object.hasOwn(doc.outputs, outputKey) ? doc.outputs[outputKey] : undefined;
  if (output?.node !== extrusionIndex || output.side !== 'solid' || hasNamedReferences(doc, sketchId, extrusionId, outputKey)) {
    return { problem: 'The extrusion must remain a separate solid without saved face or edge references.' } as const;
  }
  return { sketch, association, extrusionId, outputKey };
}

/** Prepare a v1 source replacement for one linked sketch and its terminal, independent extrusion. */
export function relinkAssociativeInset(doc: StudioDoc, sketchIndex: number, pick: AssociativeInsetFacePick): {
  doc: StudioDoc; outputKey: string; resolved: SketchNode;
} {
  const readiness = insetRelinkReadiness(doc, sketchIndex);
  if (readiness.problem !== undefined) throw refused(readiness.problem);
  const { sketch, association, extrusionId, outputKey } = readiness;

  const key = pick?.bodyKey;
  const source = key && Object.hasOwn(doc.outputs, key) ? doc.outputs[key] : undefined;
  const sourceId = source && uniqueId(doc, source.node);
  if (!source || !Number.isInteger(source.node) || source.node < 0 || source.node >= sketchIndex || source.side !== 'solid'
    || !sourceId || doc.nodes[source.node].suppressed || bodyKeyFor(doc.nodes, source.node) !== key
    || typeof pick.faceId !== 'string' || !pick.faceId || typeof pick.faceName !== 'string' || !pick.faceName || pick.faceName.includes('+')) {
    throw refused('Pick one original planar face of an earlier current solid.');
  }
  // The current snapshot rebuilds the existing association, which must be healthy before replacement.
  let snapshot: ReturnType<typeof partSnapshot>;
  try { snapshot = partSnapshot(doc); }
  catch (cause) {
    if (isRefusal(cause, 'BAD_REFERENCE')) throw cause;
    throw refused('The current linked sketch and extrusion could not be rebuilt.');
  }
  if (!singleSolid(snapshot.outputs, extrusionId)) throw refused('The current extrusion must be one native solid.');
  const brep = singleSolid(snapshot.outputs, sourceId);
  if (!brep) throw refused('The picked body must be one current native solid.');
  const faces = brep.faces.filter(face => face.id === pick.faceId || face.name === pick.faceName);
  const [face] = faces;
  if (faces.length !== 1 || face.id !== pick.faceId || face.name !== pick.faceName || faceGeometry(face).kind !== 'plane') {
    throw refused('The picked native planar face is missing or ambiguous.');
  }
  if (source.node === association.source.node && sourceId === association.sourceFeature && pick.faceName === association.face) {
    throw refusal('NO_CHANGE', 'This is already the linked face. Pick a different face.');
  }

  const nodes = [...doc.nodes];
  nodes[sketchIndex] = {
    ...sketch,
    association: { ...association, source: { node: source.node, side: 'solid' }, sourceFeature: sourceId, face: pick.faceName },
  };
  const candidate = { ...doc, nodes };
  const resolved = resolveAssociativeSketch(candidate, sketchIndex);
  return { doc: candidate, outputKey, resolved };
}
