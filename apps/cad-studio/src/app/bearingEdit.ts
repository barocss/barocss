import { dropStaleMade, type ModelNode, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { resolveShopTree, restoreAuthoredShopRows } from '@barocss/cad-model/engine/shopRows';

export interface BearingEditAddress { readonly owner: string; readonly index: number }
export interface BearingEditSession extends BearingEditAddress {
  readonly root: StudioDoc;
  readonly instance: PartInstance;
  /** Unplaced evaluation input only. Never store this derived view in the document. */
  readonly view: StudioDoc;
}
function fail(reason: string): never { throw new Error(`[BEARING_EDIT_SCOPE] ${reason}`); }
function occurrence(root: StudioDoc, owner: string): PartInstance {
  if (!owner || owner === 'base') fail('Select one explicit immediate instance occurrence.');
  const found = (root.instances ?? []).filter(i => i.id === owner);
  if (found.length !== 1) fail(`Expected one immediate occurrence ${owner}; found ${found.length}.`);
  return found[0];
}
function bearingAt(nodes: readonly ModelNode[], index: number): void {
  if (!Number.isSafeInteger(index) || index < 0 || nodes[index]?.kind !== 'bearing') fail('The selected local index must name an existing bearing feature.');
}

/** Mate-face reads use the same unplaced occurrence context as native bearing evaluation. */
export function bearingFaceInput(root: StudioDoc, owner: string, input: StudioDoc): StudioDoc {
  if (owner === 'base') return resolveShopTree({ ...input, instances: root.instances });
  if (occurrence(root, owner).doc !== input) fail('The face input is not the current authored occurrence.');
  return resolveShopTree(input, root, owner);
}

/** Owner comes only from the host's exact selected occurrence ID, never shared node/document identity. */
export function captureBearingEditSession(root: StudioDoc, owner: string, index: number): BearingEditSession {
  const instance = occurrence(root, owner); bearingAt(instance.doc.nodes, index);
  return { root, owner, index, instance, view: resolveShopTree(instance.doc, root, owner) };
}

/** Async validation cannot authorize a write after the source or the explicit editing address changed. */
export function bearingEditCurrent(session: BearingEditSession, currentRoot: StudioDoc, currentSelection: readonly string[], currentEdit: BearingEditAddress | null): boolean {
  if (currentRoot !== session.root || currentSelection.length !== 1 || currentSelection[0] !== session.owner || currentEdit?.owner !== session.owner || currentEdit.index !== session.index) return false;
  const found = (currentRoot.instances ?? []).filter(i => i.id === session.owner);
  return found.length === 1 && found[0] === session.instance && found[0].doc.nodes[session.index]?.kind === 'bearing';
}

/** Prepare only. The caller must validate `view`, recheck freshness, then use its existing root undo/commit path. */
export function prepareBearingEdit(session: BearingEditSession, nodes: ModelNode[]): { root: StudioDoc; view: StudioDoc } {
  if (occurrence(session.root, session.owner) !== session.instance) fail('The captured occurrence was replaced.');
  bearingAt(nodes, session.index);
  const edited = { ...session.view, nodes: dropStaleMade(session.view.nodes, nodes) };
  const restored = restoreAuthoredShopRows(edited, session.view);
  if ('error' in restored) fail(restored.error);
  const root: StudioDoc = { ...session.root, instances: session.root.instances!.map(i => i.id === session.owner ? { ...i, doc: restored.doc } : i) };
  return { root, view: resolveShopTree(restored.doc, root, session.owner) };
}
