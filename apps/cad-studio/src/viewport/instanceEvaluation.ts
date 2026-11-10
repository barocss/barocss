import { placedBase, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluationKey } from '@barocss/cad-model/engine/evalMemo';
import type { BodyResult, EvalResult } from '@barocss/cad-model/engine/evaluate';

export type InstanceEvaluationSource = { ok: true; key: string; base: StudioDoc } | { ok: false; error: string };
/** Use the Model's parent-row view and evaluation key; keep authored instance identity separate. */
export function instanceEvaluationSources(doc: StudioDoc): Map<string, InstanceEvaluationSource> {
  return new Map<string, InstanceEvaluationSource>((doc.instances ?? []).map((inst): [string, InstanceEvaluationSource] => {
    try {
      const base = placedBase(inst, doc);
      return [inst.id, { ok: true, base, key: evaluationKey(base) }];
    } catch (error) {
      return [inst.id, { ok: false, error: error instanceof Error ? error.message : String(error) }];
    }
  }));
}
/** Both the authored instance and its effective parent-row context must match the displayed evaluation. */
export function instanceEvaluationCurrent(have: { inst: PartInstance; sourceKey: string } | undefined, inst: PartInstance, source: InstanceEvaluationSource | undefined): boolean {
  return !!have && have.inst === inst && !!source?.ok && have.sourceKey === source.key;
}

export type PlacedProposalPreview =
  | { kind: 'ready'; bodies: ReadonlyMap<string, BodyResult[]>; volumeChange: number | null }
  | { kind: 'unavailable'; reason: string };
type PlacedBodies = { inst: PartInstance; sourceKey: string; bodies: BodyResult[] };
type EvaluatePlaced = (inst: PartInstance, base: StudioDoc, parent: StudioDoc) => Promise<EvalResult>;

function measuredVolume(bodies: readonly BodyResult[]): number | null {
  let volume = 0;
  for (const body of bodies) {
    if (typeof body.volume !== 'number' || !Number.isFinite(body.volume)) return null;
    volume += body.volume;
  }
  return volume;
}

/** Review changed geometry at existing placements, keeping the accepted instance store separate. */
export async function placedProposalPreview(before: StudioDoc, after: StudioDoc, accepted: ReadonlyMap<string, PlacedBodies>, evaluate: EvaluatePlaced): Promise<PlacedProposalPreview | null> {
  const oldInstances = before.instances ?? [], newInstances = after.instances ?? [];
  if (!oldInstances.length && !newInstances.length) return null;
  const oldById = new Map(oldInstances.map(i => [i.id, i]));
  const unavailable = (reason: string): PlacedProposalPreview => ({ kind: 'unavailable', reason });
  if (oldInstances.length !== newInstances.length || oldById.size !== oldInstances.length || new Set(newInstances.map(i => i.id)).size !== newInstances.length)
    return unavailable('Placement changes are outside this preview.');
  const oldSources = instanceEvaluationSources(before), newSources = instanceEvaluationSources(after);
  const replacements = new Map<string, BodyResult[]>();
  let volumeChange: number | null = 0;
  for (const next of newInstances) {
    const prev = oldById.get(next.id);
    if (!prev || !!prev.hidden !== !!next.hidden || prev.position.some((v, i) => v !== next.position[i]) || prev.rotation.some((v, i) => v !== next.rotation[i]))
      return unavailable('Placement changes are outside this preview.');
    const a = oldSources.get(next.id), b = newSources.get(next.id);
    if (!a?.ok || !b?.ok) return unavailable(`Could not prepare placed part ${next.name}.`);
    if (a.key === b.key) continue;
    if (next.hidden) return unavailable('A changed placed part is hidden.');
    const old = accepted.get(next.id);
    const previous = old?.inst === prev && old.sourceKey === a.key ? { ok: true as const, bodies: old.bodies } : await evaluate(prev, a.base, before);
    const candidate = await evaluate(next, b.base, after);
    if (!previous.ok || !candidate.ok) return unavailable(`Could not evaluate placed part ${next.name}.`);
    replacements.set(next.id, candidate.bodies);
    const oldVolume = measuredVolume(previous.bodies), newVolume = measuredVolume(candidate.bodies);
    volumeChange = volumeChange === null || oldVolume === null || newVolume === null ? null : volumeChange + newVolume - oldVolume;
  }
  return replacements.size ? { kind: 'ready', bodies: replacements, volumeChange } : null;
}

export function withPlacedProposalBodies<T extends { id: string; bodies: BodyResult[] }>(instances: T[], preview: ReadonlyMap<string, BodyResult[]> | undefined): T[] {
  if (!preview) return instances;
  return instances.map(inst => {
    const bodies = preview.get(inst.id);
    return bodies ? { ...inst, bodies } : inst;
  });
}
