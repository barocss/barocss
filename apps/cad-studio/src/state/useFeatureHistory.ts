import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { featureLabel, parentsOf, prefixDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureId, nodeIndexOf } from '@barocss/cad-model/engine/ids';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { refOf, type Selection } from '@barocss/cad-model/app/commands';
import { featureOfPick } from '@barocss/cad-model/app/editCommand';
import { bodyNodes, deleteFeature, deleteFeatures, featureDependents, moveFeature } from '@barocss/cad-model/chat/features';
import { failedFeatureText } from '../app/failedFeature';
import { emptySel } from '../app/studioConstants';
import type { EngineClient } from '../engine/client';
interface FeatureHistoryOptions {
  model: { doc: StudioDoc; marker: number | null; bodies: BodyResult[]; selection: Selection };
  worker: { engine: EngineClient; nextRevision(): number };
  suppression: { evaluate(doc: StudioDoc): ReturnType<EngineClient['part']>; owner(): () => boolean; commit(doc: StudioDoc): boolean };
  changes: { canChangeDocument(): boolean; commit(next: StudioDoc): boolean; setSelection: Dispatch<SetStateAction<Selection>> };
  onNotice(notice: FriendlyError, options?: { acceptedDocument: true }): void;
}
/** Feature history operations retain their original validation and central acceptance callbacks. */
export function useFeatureHistory({ model, worker, suppression, changes, onNotice: setToast }: FeatureHistoryOptions) {
  const { doc, marker, bodies, selection } = model;
  const { engine, nextRevision } = worker;
  const { canChangeDocument, commit, setSelection } = changes;
  // Deleting a feature (with the sketches only it used): later features, mates and drawing dimensions follow.
  const deleteNode = (index: number, opener: HTMLElement | null = null) => {
    if (!canChangeDocument()) return;
    if (marker !== null) { setToast({ title: 'Roll forward to delete', hint: 'Features are deleted from the whole history: roll forward to the end first.', detail: '' }); return; }
    const label = featureLabel(doc.nodes[index], index, doc.nodes), r = deleteFeature(doc, index);
    if ('error' in r) {
      // Others build on it: offer to delete them with it, after listing them.
      const deps = featureDependents(doc, index);
      if (deps.length && 'doc' in deleteFeatures(doc, [index, ...deps])) { setCascade({ owner: doc, opener, label, deps: deps.map(k => featureLabel(doc.nodes[k], k, doc.nodes)), all: [index, ...deps] }); return; }
      setToast({ title: `Cannot delete ${label}`, hint: r.error, detail: '' }); return;
    }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), nextRevision()).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${label}: ${e.error.title}` }); return; }
      if (!commit(r.doc)) return;
      if (r.droppedDimensions) setToast({ title: `Removed ${r.droppedDimensions} drawing dimension${r.droppedDimensions > 1 ? 's' : ''}`, hint: `They measured ${label}. Undo restores them.`, detail: '' }, { acceptedDocument: true });
    });
  };
  /** A body in several pieces made one body per piece (a Separate step), checked by evaluating first. */
  const separate = (b: BodyResult) => {
    if (!canChangeDocument()) return;
    if (marker !== null) { setToast({ title: 'Roll forward first', hint: 'New steps go at the end of the history.', detail: '' }); return; }
    const next = withNode(doc, { kind: 'separate', parent: refOf(b) });
    engine.evaluate(prefixDoc(next, next.nodes.length), nextRevision()).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot separate it: ${e.error.title}` }); return; }
      if (!commit(next)) return; setSelection(emptySel);
    });
  };
  /** Moves a history step one earlier or later (refused before what it is built on), checked by evaluating first. */
  const reorder = (i: number, dir: -1 | 1) => {
    if (!canChangeDocument()) return;
    if (marker !== null) { setToast({ title: 'Roll forward to reorder', hint: 'Steps are moved in the whole history: roll forward to the end first.', detail: '' }); return; }
    const label = featureLabel(doc.nodes[i], i, doc.nodes), r = moveFeature(doc, i, dir);
    if ('error' in r) { setToast({ title: `Cannot move ${label}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), nextRevision()).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot move ${label} there: ${e.error.title}` }); return; }
      commit(r.doc);
    });
  };
  const suppressionRequest = useRef<object | null>(null);
  /** A suppression returns to the end of History, so check all active steps before committing. */
  const toggleSuppress = async (i: number) => {
    if (!canChangeDocument()) return;
    const n = doc.nodes[i]; if (!n || n.kind === 'sketch' || n.kind === 'driven-sketch') return;
    const next = { ...doc, nodes: doc.nodes.map((x, k) => k !== i ? x : x.suppressed ? (({ suppressed: _s, ...rest }) => rest as ModelNode)(x) : { ...x, suppressed: true as const }) };
    const request = {}, owns = suppression.owner();
    suppressionRequest.current = request;
    const label = featureLabel(n, i, doc.nodes);
    const title = `Cannot ${n.suppressed ? 'unsuppress' : 'suppress'} ${label}`;
    try {
      const result = await suppression.evaluate(next);
      if (suppressionRequest.current !== request || !owns()) return;
      if (!result.ok) {
        const failed = failedFeatureText(result.error.feature, next.nodes, doc.nodes);
        const failedIndex = result.error.feature ? nodeIndexOf(next.nodes, result.error.feature) : -1;
        const failedNode = next.nodes[failedIndex];
        const dependent = !n.suppressed && failed && failedIndex > i;
        let hint = dependent ? `The edit would break ${failed}. Update or suppress that feature first.` : result.error.hint;
        const isPattern = (node: ModelNode | undefined) => node?.kind === 'linear-pattern' || node?.kind === 'linear-span-pattern';
        if (dependent && isPattern(n) && failedNode?.kind === 'hole' && failedNode.parent.node === i && /@\d+$/.test(failedNode.face ?? '')) {
          hint = `Suppress ${failed} before suppressing ${label} (${featureId(doc.nodes, i)}).`;
        } else if (n.suppressed && failedIndex === i && n.kind === 'hole' && /@\d+$/.test(n.face ?? '')) {
          const parent = doc.nodes[n.parent.node];
          if (parent?.suppressed && isPattern(parent)) {
            const source = featureLabel(parent, n.parent.node, doc.nodes);
            hint = `Unsuppress ${source} (${featureId(doc.nodes, n.parent.node)}) before unsuppressing ${label} (${featureId(doc.nodes, i)}).`;
          }
        }
        setToast({
          ...result.error, title: `${title}: ${result.error.title}`, hint,
        }, { acceptedDocument: true });
        return;
      }
      suppression.commit(next);
    } catch (error) {
      if (suppressionRequest.current === request && owns()) setToast({ title, hint: 'The feature history is unchanged.', detail: String(error) }, { acceptedDocument: true });
    }
  };
  /** A delete waiting on its review: the feature, and the ones built on it that would go with it. */
  const [deleteRequest, setCascade] = useState<{ owner: StudioDoc; opener: HTMLElement | null; label: string; deps: string[]; all: number[] } | null>(null);
  const cascade = deleteRequest?.owner === doc ? deleteRequest : null;
  useEffect(() => {
    if (deleteRequest && !cascade) setCascade(null);
  }, [deleteRequest, cascade]);
  const deleteCascade = () => {
    if (!canChangeDocument()) return;
    if (!cascade) return;
    const r = deleteFeatures(doc, cascade.all), label = cascade.label; setCascade(null);
    if ('error' in r) { setToast({ title: `Cannot delete ${label}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), nextRevision()).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${label}: ${e.error.title}` }); return; }
      commit(r.doc);
    });
  };
  /**
   * Delete (the key): picked sketches; a picked face or edge of a feature added to a body (a hole, a
   * fillet …) takes that feature; picked bodies, or a face of what a body was first made as, take the body
   * with all it was built from.
   */
  const deleteSelection = () => {
    if (!canChangeDocument()) return;
    if (marker !== null) { setToast({ title: 'Roll forward to delete', hint: 'Features are deleted from the whole history: roll forward to the end first.', detail: '' }); return; }
    const nodes = doc.nodes, body = (k: number) => bodies[k] ? bodyNodes(nodes, refOf(bodies[k]).node) : [];
    let indices: number[] = [], what = '';
    if (selection.sketches?.length) { indices = selection.sketches; what = indices.length === 1 ? `Sketch ${indices[0] + 1}` : `${indices.length} sketches`; }
    else if (selection.bodies.length) { indices = [...new Set(selection.bodies.flatMap(body))]; what = selection.bodies.length === 1 ? 'the body' : `${selection.bodies.length} bodies`; }
    else if (selection.faces.length || selection.edges.length) {
      const owner = featureOfPick(selection, bodies, nodes), k = (selection.faces[0] ?? selection.edges[0]).body;
      const base = owner !== null && parentsOf(nodes[owner]).every(p => nodes[p]?.kind === 'sketch' || nodes[p]?.kind === 'driven-sketch');
      if (owner === null || base) { indices = body(k); what = 'the body'; } else { indices = [owner]; what = featureLabel(nodes[owner], owner, nodes); }
    }
    if (!indices.length) return;
    const r = deleteFeatures(doc, indices);
    if ('error' in r) { setToast({ title: `Cannot delete ${what}`, hint: r.error, detail: '' }); return; }
    engine.evaluate(prefixDoc(r.doc, r.doc.nodes.length), nextRevision()).then(e => {
      if (!e) return;
      if (!e.ok) { setToast({ ...e.error, title: `Cannot delete ${what}: ${e.error.title}` }); return; }
      if (!commit(r.doc)) return; setSelection(emptySel);
      if (r.droppedDimensions) setToast({ title: `Removed ${r.droppedDimensions} drawing dimension${r.droppedDimensions > 1 ? 's' : ''}`, hint: `They measured ${what}. Undo restores them.`, detail: '' }, { acceptedDocument: true });
    });
  };
  return { deleteNode, separate, reorder, toggleSuppress, cascade, setCascade, deleteCascade, deleteSelection };
}
