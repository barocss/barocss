import { useLayoutEffect, useRef, useState } from 'react';
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult, EvalResult } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import { signaturesOf } from '@barocss/cad-model/engine/rematch';
import { toSig, type Problem } from '@barocss/cad-model/engine/references';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';

type Finish = Extract<ModelNode, { kind: 'fillet' | 'chamfer' }>;
type Hit = { edge: { body: number; edge: number } | null; edgeMesh?: BodyResult['mesh']; instance?: string };
interface Options {
  doc: StudioDoc;
  index: number | null;
  problems: readonly Problem[];
  bodies: readonly BodyResult[];
  enabled: boolean;
  ownsSource(): boolean;
  evaluate(doc: StudioDoc): Promise<EvalResult>;
  accept(doc: StudioDoc, problem: Problem): boolean;
  notice(value: FriendlyError): void;
}

export function useHeldFinishEdge({ doc, index, problems, bodies, enabled, ownsSource, evaluate, accept, notice }: Options) {
  const node = index === null ? undefined : doc.nodes[index];
  const finish: Finish | null = node?.held && (node.kind === 'chamfer' || (node.kind === 'fillet' && !node.radii)) && node.edges.length === 1 ? node : null;
  const problem = finish && problems.find(p => p.node === index && p.name === finish.edges[0]);
  // A terminal held feature exposes its source as a passthrough body.
  const body = finish && index !== null && bodies.find(b => b.key === bodyKeyFor(doc.nodes, index, 'solid'));
  const [draft, setDraft] = useState<{ doc: StudioDoc; index: number; name: string | null; pending?: boolean } | null>(null);
  const ticket = useRef<object | null>(null);
  useLayoutEffect(() => {
    ticket.current = null;
    setDraft(null);
    return () => { ticket.current = null; };
  }, [doc, index, body, enabled]);
  const current = enabled && draft?.doc === doc && draft.index === index && problem && body ? draft : null;
  const cancel = () => { ticket.current = null; setDraft(null); };
  const start = () => { if (enabled && problem && body && index !== null) setDraft({ doc, index, name: null }); };
  const pick = (hit: Hit) => {
    if (!current || !body) return false;
    if (current.pending) return true;
    const names = hit.edgeMesh === body.mesh && hit.edge && !hit.instance ? body.mesh.edges[hit.edge.edge]?.names : undefined;
    if (names?.length === 1 && names[0] && !names[0].includes('+')) {
      setDraft({ ...current, name: names[0] });
    } else {
      notice({ title: 'Edge not selected', hint: 'Select one edge on the body of this feature.', detail: '' });
    }
    return true;
  };
  const apply = async () => {
    if (!current?.name || current.pending || !body || !finish || !problem || !ownsSource()) return;
    const { name } = current;
    const signature = signaturesOf(body).edges.get(name);
    if (!signature || signature.shared) return;
    const { held: _held, suppressed: _suppressed, rematched: _rematched, ...feature } = finish;
    const next = { ...doc, nodes: doc.nodes.map((node, index) => index === current.index
      ? { ...feature, edges: [name], sigs: { [name]: toSig(signature) } } : node) };
    const request = {};
    ticket.current = request;
    setDraft({ ...current, pending: true });
    try {
      const result = await evaluate(next);
      if (ticket.current !== request || !ownsSource()) return;
      if (result.ok) { if (accept(next, problem)) cancel(); }
      else notice({ ...result.error, title: 'Edge replacement not applied' });
    } catch (error) {
      if (ticket.current === request && ownsSource()) notice({ title: 'Edge replacement not applied', hint: 'The feature is unchanged.', detail: String(error) });
    } finally {
      if (ticket.current === request) {
        ticket.current = null;
        setDraft(previous => previous?.doc === doc && previous.index === current.index ? { ...previous, pending: false } : previous);
      }
    }
  };
  return { available: enabled && !!problem && !!body, current, start, cancel, pick, apply };
}
