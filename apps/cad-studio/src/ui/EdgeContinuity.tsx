import { useLayoutEffect, useRef, useState } from 'react';
import type { ContinuityEdge, ContinuityReply, ContinuityRequest } from '@barocss/cad-model/engine/edgeContinuity';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

type Result = Extract<ContinuityReply, { measurement: unknown }>['measurement'];

function EdgeContinuityRead({ picked, read }: {
  picked: Extract<ContinuityRequest, { kind: 'list' }>['picked'];
  read(input: ContinuityRequest): Promise<ContinuityReply>;
}) {
  const [edges, setEdges] = useState<ContinuityEdge[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const live = useRef(false);
  useLayoutEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function measure(edgeId: string) {
    const reply = await read({ kind: 'measure', edgeId });
    if (!live.current) return;
    if ('measurement' in reply) setResult(reply.measurement);
    else setError('error' in reply ? reply.error : 'The edge could not be measured.');
  }
  async function inspect() {
    setPending(true);
    setResult(null);
    setError('');
    try {
      if (edges) {
        if (chosen) await measure(chosen);
        return;
      }
      const reply = await read({ kind: 'list', picked });
      if (!live.current) return;
      if (!('edges' in reply)) {
        setError('error' in reply ? reply.error : 'The native edges are unavailable.');
        return;
      }
      setEdges(reply.edges);
      if (!reply.edges.length) {
        setError('No native edges join two supported faces.');
        return;
      }
      if (reply.selected) {
        setChosen(reply.selected);
        await measure(reply.selected);
      } else if (picked) setError('The selected edge is unavailable. Select a native edge to measure.');
    } catch (cause) {
      if (live.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (live.current) setPending(false);
    }
  }
  return <section aria-label="Edge continuity" className="mt-2 space-y-1">
    {edges && edges.length > 0 && <NativeSelect aria-label="Native shared edge" value={chosen} disabled={pending}
      onChange={event => { setChosen(event.target.value); setResult(null); setError(''); }}>
      <option value="">Select native edge</option>
      {edges.map(edge => <option key={edge.id} value={edge.id}>{edge.faces.join(' / ')} · {edge.name}</option>)}
    </NativeSelect>}
    <Button size="xs" variant="outline" disabled={pending || !!edges && !chosen} onClick={() => void inspect()}>
      {pending ? 'Measuring…' : edges ? 'Measure continuity' : picked ? 'Inspect edge continuity' : 'Inspect native joints'}
    </Button>
    <div role="status" aria-label="Edge continuity result">
      {error && <div className="empty">{error}</div>}
      {result?.status === 'unsupported' && <div className="empty">Cannot measure this joint. {refusalLabel[result.reason]}</div>}
      {result?.status === 'measured' && <>
        <div className="kv"><span>Sampled face-normal angle</span><b data-continuity-angle>{angle(result.minimumAngleDegrees)} – {angle(result.maximumAngleDegrees)}°</b></div>
        <div className="kv"><span>Native samples</span><b>{result.sampleCount}</b></div>
      </>}
    </div>
  </section>;
}

const angle = (value: number): string => String(Number(value.toPrecision(7)));

const refusalLabel: Record<Extract<Result, { status: 'unsupported' }>['reason'], string> = {
  'edge-not-found': 'The native edge is unavailable.',
  'invalid-incidence': 'The edge needs two valid face uses.',
  'same-face-seam': 'The edge joins one face to itself.',
  'faceted-geometry': 'The edge needs two native surfaces.',
  'missing-pcurve': 'A face has no native parameter curve.',
  'binding-mismatch': 'A parameter curve does not match the native edge.',
  'derivative-unavailable': 'A surface normal is unavailable at a sample.',
};

export function EdgeContinuity({ source, ...props }: Parameters<typeof EdgeContinuityRead>[0] & { source: object }) {
  const [owner, setOwner] = useState({ source, version: 0 });
  if (owner.source !== source) setOwner({ source, version: owner.version + 1 });
  return <EdgeContinuityRead key={owner.version} {...props} />;
}
