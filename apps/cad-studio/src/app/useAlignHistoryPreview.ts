import { useCallback, useRef, useState } from 'react';
import { dropStaleMade, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult, EvalResult } from '@barocss/cad-model/engine/evaluate';
import { failedFeatureText, type FeatureFailure } from './failedFeature';

type Scope = { doc: StudioDoc; index: number | null; enabled: boolean; workerSession: number };
type Preview = { kind: 'pending' } | { kind: 'ready'; bodies: BodyResult[] } | { kind: 'error'; error: FeatureFailure };

export function useAlignHistoryPreview({ doc, index, enabled, workerSession }: Scope,
  evaluate: (candidate: StudioDoc) => Promise<EvalResult>) {
  const scope = useRef({ doc, index, enabled, workerSession });
  if (scope.current.doc !== doc || scope.current.index !== index
    || scope.current.enabled !== enabled || scope.current.workerSession !== workerSession) {
    scope.current = { doc, index, enabled, workerSession };
  }
  const [state, setState] = useState<{ scope: Scope; result: Preview } | null>(null);
  const read = useCallback((nodes: ModelNode[]) => {
    const owner = scope.current;
    if (!enabled || index === null || nodes[index]?.kind !== 'align'
      || owner.doc !== doc || owner.index !== index || owner.workerSession !== workerSession) return;
    let current = true;
    setState({ scope: owner, result: { kind: 'pending' } });
    const timer = window.setTimeout(() => {
      const candidate = { ...doc, nodes: dropStaleMade(doc.nodes, nodes) };
      const refuse = (error: FeatureFailure) => {
        if (current && scope.current === owner) {
          setState({ scope: owner, result: { kind: 'error', error } });
        }
      };
      void evaluate(candidate).then(reply => {
        if (!current || scope.current !== owner) return;
        if (reply.ok) {
          setState({ scope: owner, result: { kind: 'ready', bodies: reply.bodies } });
        } else {
          const failedFeature = failedFeatureText(reply.error.feature, candidate.nodes, doc.nodes);
          const error = reply.error.title === 'The kernel could not build this'
            ? { ...reply.error, hint: 'Change the Align settings or reset this edit.' } : reply.error;
          refuse({ ...error, failedFeature });
        }
      }, () => refuse({ title: 'Align preview could not finish', hint: 'Change the Align settings or reset this edit.', detail: '' }));
    }, 150);
    return () => {
      current = false;
      window.clearTimeout(timer);
      setState(previous => previous?.scope === owner ? null : previous);
    };
  }, [doc, index, enabled, evaluate, workerSession]);
  return { read, result: state?.scope === scope.current ? state.result : null };
}
