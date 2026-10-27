import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Viewer } from '@barocss/viewer';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { ViewerIcon } from './components/ViewerIcon';

export type AssemblyPointQuery = { kind: 'curve'; parameter: number } | { kind: 'surface'; u: number; v: number };
export type AssemblyInspection = { instanceId: string; query: AssemblyPointQuery;
  result: ReturnType<Viewer['queryAssemblyInstancePoint']> | null; error: string };
export type AssemblyPoint = Pick<ReturnType<Viewer['queryAssemblyInstancePoint']>,
  'instanceId' | 'assemblyId' | 'assemblyRevision' | 'reference' | 'worldMatrix' | 'query'
  | 'originalLocalPointMM' | 'assemblyPointMM'>;

export function AssemblyInspector({ inspection, onInspect, onSetPoint }: {
  inspection: AssemblyInspection; onInspect: (query: AssemblyPointQuery) => void;
  onSetPoint: (endpoint: 'a' | 'b') => void;
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
      <div className="native-point-accepted-row">
        <p className="scope-note">Evaluated {query.kind === 'curve' ? `t = ${query.parameter}` : `u = ${query.u}, v = ${query.v}`}</p>
        <div className="native-point-distance-actions" role="group" aria-label="Assembly point endpoints">
          {(['a', 'b'] as const).map(endpoint => <Button key={endpoint} id={`assembly-point-as-${endpoint}`} type="button"
            variant="outline" size="sm" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]"
            aria-label={`Set assembly point ${endpoint.toUpperCase()}`} title={`Set point ${endpoint.toUpperCase()}`}
            disabled={Boolean(error || inspection.error)} onClick={() => onSetPoint(endpoint)}>
            <ViewerIcon name={endpoint === 'a' ? 'pointA' : 'pointB'} /></Button>)}
        </div>
      </div>
      {([['Part local XYZ', result.originalLocalPointMM], ['Assembly XYZ', result.assemblyPointMM]] as const).map(([label, coordinates]) =>
        <div key={label}><h4>{label} <span>mm</span></h4><dl className="assembly-coordinates">
          {['X', 'Y', 'Z'].map((axis, index) => <div key={axis}><dt>{axis}</dt><dd>{String(coordinates[index])}</dd></div>)}
        </dl></div>)}
    </div>}
  </section>;
}

export function AssemblyPoints({ points, distance, error, onClear }: {
  points: (AssemblyPoint | null)[]; distance: number | null; error: string; onClear: () => void;
}) {
  if (!points.some(Boolean)) return null;
  return <section className="inspector-section distance-section" aria-labelledby="assembly-points-heading">
    <div className="section-heading"><h3 id="assembly-points-heading">Points</h3>
      <Button id="assembly-points-clear" type="button" variant="ghost" size="sm"
        className="inspector-icon h-[28px] w-[28px] p-0 [&_svg]:size-[16px]"
        aria-label="Clear assembly points" title="Clear assembly points" onClick={onClear}><ViewerIcon name="trash" /></Button>
    </div>
    <div className="distance-points" aria-live="polite">
      {points.map((point, index) => point && <div className="distance-point" key={index}>
        <span className="distance-point-marker" aria-hidden="true">{index === 0 ? 'A' : 'B'}</span>
        <div className="distance-point-details"><div className="distance-point-label">{point.instanceId}</div>
          {([['Part local XYZ', point.originalLocalPointMM], ['Assembly XYZ', point.assemblyPointMM]] as const).map(([label, coordinates]) =>
            <div key={label}><p className="distance-point-parameter">{label} · mm</p>
              <dl className="distance-coordinates" aria-label={`Point ${index === 0 ? 'A' : 'B'} ${label} in millimetres`}>
                {['X', 'Y', 'Z'].map((axis, axisIndex) => <div key={axis}><dt>{axis}</dt><dd>{String(coordinates[axisIndex])}</dd></div>)}
              </dl></div>)}
        </div>
      </div>)}
    </div>
    <div className="distance-result" aria-live="polite" aria-atomic="true">
      <span className="distance-result-label">Straight-line distance</span>
      <div><output id="assembly-measure-distance" aria-label="Assembly straight-line distance in millimetres"
        className="assembly-measure-distance">{distance === null || !Number.isFinite(distance) ? '—' : String(Number(distance.toPrecision(10)))}</output>
        {distance !== null && Number.isFinite(distance) && <span className="distance-unit">mm</span>}</div>
    </div>
    {error && <p className="distance-error" role="alert">{error}</p>}
  </section>;
}
