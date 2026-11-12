import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { instanceEvaluationCurrent, type InstanceEvaluationSource } from './instanceEvaluation';
import type { InstanceItem } from './renderer';

export interface PlacedSketchSnapSource {
  instance: PartInstance;
  body: BodyResult;
}

export interface PlacedSketchSnapInput {
  sources: readonly PlacedSketchSnapSource[];
  current(): boolean;
}

type AcceptedPlacement = { inst: PartInstance; sourceKey: string; bodies: readonly BodyResult[] };

/** Only the current accepted body of a visible, unchanged render item can supply placed snaps. */
export function acceptedPlacedSketchSnaps(doc: StudioDoc, accepted: ReadonlyMap<string, AcceptedPlacement>,
  sources: ReadonlyMap<string, InstanceEvaluationSource>, rendered: readonly InstanceItem[]): PlacedSketchSnapSource[] {
  const instances = doc.instances ?? [];
  const byId = new Map(instances.map(instance => [instance.id, instance]));
  if (byId.size !== instances.length || new Set(rendered.map(item => item.id)).size !== rendered.length) return [];
  return rendered.flatMap(item => {
    const instance = byId.get(item.id), have = accepted.get(item.id), [body] = item.bodies;
    if (!instance || instance.hidden || !have || !instanceEvaluationCurrent(have, instance, sources.get(item.id))
      || item.bodies !== have.bodies || item.bodies.length !== 1 || !body || item.looks?.get(body.key)?.hidden) return [];
    return [{ instance, body }];
  });
}
