import { bodyKey, type StudioDoc } from '@barocss/cad-model/engine/doc';

/** A Move transfers the source appearance to its new output and leaves the original available in rollback. */
export function moveRenderAppearance(current: StudioDoc, candidate: StudioDoc): StudioDoc {
  const index = candidate.nodes.length - 1;
  const feature = candidate.nodes[index];
  if (feature?.kind !== 'translate' || !current.render) return candidate;

  const from = bodyKey(feature.parent, candidate.nodes);
  const to = bodyKey({ node: index, side: 'solid' }, candidate.nodes);
  const appearance = current.render.appearances[from];
  if (!appearance || !Object.hasOwn(candidate.outputs, to)) return candidate;
  return {
    ...candidate,
    render: { ...current.render, appearances: { ...current.render.appearances, [to]: appearance } },
  };
}
