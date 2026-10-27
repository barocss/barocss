import { placedBase, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluationKey } from '@barocss/cad-model/engine/evalMemo';

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
