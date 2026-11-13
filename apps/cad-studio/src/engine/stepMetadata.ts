// Private STEP transport: the ordinary wire document omits STEP report metadata and assembly-level cut inputs.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
export interface StepMetadata {
  bodies: StudioDoc['bodies']; drawing: StudioDoc['drawing']; references: StudioDoc['references'];
  assemblyCuts: StudioDoc['assemblyCuts'];
  instances?: { id: string; metadata: StepMetadata }[];
}
export function stepMetadata(doc: StudioDoc): StepMetadata {
  return { bodies: doc.bodies, drawing: doc.drawing, references: doc.references, assemblyCuts: doc.assemblyCuts,
    ...(doc.instances ? { instances: doc.instances.map(i => ({ id: i.id, metadata: stepMetadata(i.doc) })) } : {}) };
}
/** Restore only onto the worker's received request copy; keep its node/cache context identity. */
export function receiveStepMetadata(doc: StudioDoc, metadata: StepMetadata): StudioDoc {
  doc.bodies = metadata.bodies; doc.drawing = metadata.drawing; doc.references = metadata.references;
  doc.assemblyCuts = metadata.assemblyCuts;
  const children = new Map(metadata.instances?.map(child => [child.id, child.metadata]));
  for (const instance of doc.instances ?? []) {
    const child = children.get(instance.id);
    if (child) receiveStepMetadata(instance.doc, child);
  }
  return doc;
}
