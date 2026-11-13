// A new part cannot take an occurrence id still named by an assembly or drawing reference.
import type { StudioDoc } from '../engine/doc';
import { hostOf } from '../engine/occurrences';
import { nextFreeId } from '../util/ids';

type Naming = Pick<StudioDoc, 'instances' | 'assemblySteps' | 'assemblyCuts' | 'mates' | 'instancePatterns' | 'drawing'>;

/** Reserve the occurrence prefix in a drawing reference. Local edge names have no occurrence prefix. */
function reserveDrawingIds(taken: Set<string>, drawing: NonNullable<Naming['drawing']>): void {
  const reserve = (name: unknown) => {
    if (typeof name === 'string' && name.includes('/')) taken.add(hostOf(name));
  };
  if (drawing.scope?.kind === 'part' && drawing.scope.part) taken.add(drawing.scope.part);
  for (const dim of drawing.dimensions ?? []) {
    if (dim.kind === 'linear' || dim.kind === 'angle') {
      reserve(dim.a?.edge);
      reserve(dim.b?.edge);
      if (dim.kind === 'linear') {
        for (const member of dim.a?.ring ?? []) reserve(member.edge);
        for (const member of dim.b?.ring ?? []) reserve(member.edge);
      }
    } else if (dim.kind === 'pcd') {
      for (const member of dim.ring ?? []) reserve(member.edge);
    } else {
      reserve(dim.edge);
    }
  }
  for (const datum of drawing.datums ?? []) {
    reserve(datum.edge?.edge);
    reserve(datum.face?.face);
  }
  for (const target of drawing.datumTargets ?? []) reserve(target.point?.edge);
}

/** The ids placed parts hold, plus the ones still named by saved references. */
export function takenInstanceIds(doc: Naming): Set<string> {
  const taken = new Set<string>((doc.instances ?? []).map(i => i.id));
  for (const s of doc.assemblySteps ?? []) for (const id of s.add) taken.add(hostOf(id));
  for (const c of doc.assemblyCuts ?? []) for (const id of c.targets) taken.add(hostOf(id));
  for (const m of doc.mates ?? []) { taken.add(hostOf(m.a.part)); taken.add(hostOf(m.b.part)); }
  for (const p of doc.instancePatterns ?? []) taken.add(p.seed);
  if (doc.drawing) reserveDrawingIds(taken, doc.drawing);
  return taken;
}
/** The first `<prefix><n>` no part holds and nothing in the document names. */
export const nextInstanceId = (doc: Naming, prefix: string): string => nextFreeId(prefix, takenInstanceIds(doc));
