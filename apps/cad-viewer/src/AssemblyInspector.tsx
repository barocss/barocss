import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Viewer } from '@barocss/viewer';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export type AssemblyPointQuery = { kind: 'curve'; parameter: number } | { kind: 'surface'; u: number; v: number };
export type AssemblyInspection = { instanceId: string; query: AssemblyPointQuery;
  result: ReturnType<Viewer['queryAssemblyInstancePoint']> | null; error: string };

export function AssemblyInspector({ inspection, onInspect }: {
  inspection: AssemblyInspection; onInspect: (query: AssemblyPointQuery) => void;
}) {
  const { query, result } = inspection;
  const first = query.kind === 'curve' ? query.parameter : query.u;
  const second = query.kind === 'surface' ? query.v : null;
  const [draft, setDraft] = useState([String(first), second === null ? '' : String(second)]);
  const [error, setError] = useState('');
  useEffect(() => { setDraft([String(first), second === null ? '' : String(second)]); setError(''); },
    [inspection.instanceId, first, second]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const values = draft.slice(0, query.kind === 'curve' ? 1 : 2);
    if (values.some(value => value.trim() === '' || !Number.isFinite(Number(value)))) {
      setError('Enter finite native parameters.'); return;
    }
    setError('');
    onInspect(query.kind === 'curve' ? { kind: 'curve', parameter: Number(values[0]) }
      : { kind: 'surface', u: Number(values[0]), v: Number(values[1]) });
  }
  return <section className="inspector-section assembly-inspection" aria-labelledby="assembly-point-heading">
    <div className="section-heading"><h3 id="assembly-point-heading">Native point</h3><span className="lighting-mode">Read only</span></div>
    <form onSubmit={submit} className="assembly-point-form" noValidate>
      {(query.kind === 'curve' ? ['t'] : ['u', 'v']).map((label, index) => <label key={label}>
        <span>{label}</span><Input id={`assembly-parameter-${label}`} type="number" step="any" value={draft[index]}
          aria-label={`Assembly native parameter ${label}`} onChange={event => {
            const value = event.target.value; setDraft(previous => previous.map((old, i) => i === index ? value : old)); setError('');
          }} /></label>)}
      <Button id="assembly-inspect-point" type="submit" variant="outline" size="sm">Inspect point</Button>
    </form>
    {(error || inspection.error) && <p id="assembly-point-error" className="lighting-error" role="alert">{error || inspection.error}</p>}
    {result && <div id="assembly-point-result" className="assembly-point-result">
      <p className="scope-note">Evaluated {query.kind === 'curve' ? `t = ${query.parameter}` : `u = ${query.u}, v = ${query.v}`}</p>
      {([['Part local XYZ', result.originalLocalPointMM], ['Assembly XYZ', result.assemblyPointMM]] as const).map(([label, coordinates]) =>
        <div key={label}><h4>{label} <span>mm</span></h4><dl className="assembly-coordinates">
          {['X', 'Y', 'Z'].map((axis, index) => <div key={axis}><dt>{axis}</dt><dd>{String(coordinates[index])}</dd></div>)}
        </dl></div>)}
    </div>}
    <p className="scope-note">Original native parameters. Assembly coordinates include the authored parent placements. This is not a distance measurement.</p>
  </section>;
}
