import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Resolved } from '@barocss/cad-model/drawing/dimensions';
import { dimensionEdgeNames } from '@barocss/cad-model/drawing/dimensionReferences';

export interface OccurrenceLoss { id: string; view: string; reason: string }

export function occurrenceLosses(dimensions: readonly Resolved[], instances: StudioDoc['instances']): OccurrenceLoss[] {
  const losses: OccurrenceLoss[] = [];
  for (const result of dimensions) {
    if (result.ok) continue;
    const owners = new Set<string>();
    for (const edge of dimensionEdgeNames(result.dim)) {
      if (typeof edge !== 'string') continue;
      const first = edge.split('|', 1)[0], slash = first.lastIndexOf('/');
      if (slash > 0) owners.add(first.slice(0, slash));
    }
    const reasons = new Set<string>();
    for (const owner of owners) {
      let children = instances;
      const ancestors: string[] = [];
      for (const id of owner.split('/')) {
        ancestors.push(id);
        const path = ancestors.join('/'), part = children?.find(occurrence => occurrence.id === id);
        if (!part) { reasons.add(`Part ${path} is missing.`); break; }
        if (part.hidden) {
          reasons.add(`${part.name} (${path}) is hidden. Show it in Model to restore this reference.`);
          break;
        }
        children = part.doc.instances;
      }
    }
    if (reasons.size) losses.push({ id: result.dim.id, view: result.dim.view, reason: [...reasons].join(' ') });
  }
  return losses;
}

export const occurrenceLossText = ({ id, view, reason }: OccurrenceLoss): string => `${id} · ${view}. ${reason}`;
