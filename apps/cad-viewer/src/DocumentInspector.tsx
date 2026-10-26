import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export type NativePointQuery = { kind: 'curve'; parameter: number }
  | { kind: 'surface'; u: number; v: number };
export type NativePointDomain = { kind: 'curve'; parameter: [number, number] }
  | { kind: 'surface'; u: [number, number]; v: [number, number] };
export type DocumentInspection = {
  bodyId: string;
  label: string;
  query: NativePointQuery;
  domain: NativePointDomain;
  result: { pointMM: number[]; query: NativePointQuery } | null;
  error: string;
};

function numberText(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return Object.is(value, -0) ? '-0' : String(value);
}

function queryText(query: NativePointQuery) {
  return query.kind === 'curve' ? `t = ${numberText(query.parameter)}`
    : `u = ${numberText(query.u)}, v = ${numberText(query.v)}`;
}

export function DocumentInspector({ inspection, onInspect }: {
  inspection: DocumentInspection;
  onInspect: (query: NativePointQuery) => void;
}) {
  const { bodyId, label, query, domain, result } = inspection;
  const first = query.kind === 'curve' ? query.parameter : query.u;
  const second = query.kind === 'surface' ? query.v : null;
  const [draft, setDraft] = useState(() => [numberText(first), second === null ? '' : numberText(second)]);
  const [draftError, setDraftError] = useState('');
  useEffect(() => {
    setDraft([numberText(first), second === null ? '' : numberText(second)]);
    setDraftError('');
  }, [bodyId, query.kind, first, second]);

  const error = draftError || inspection.error;
  const fields = query.kind === 'curve'
    ? [{ label: 't', range: domain.kind === 'curve' ? domain.parameter : null }]
    : [{ label: 'u', range: domain.kind === 'surface' ? domain.u : null },
      { label: 'v', range: domain.kind === 'surface' ? domain.v : null }];

  function submit(event: FormEvent) {
    event.preventDefault();
    const values = draft.slice(0, query.kind === 'curve' ? 1 : 2);
    if (values.some(value => value.trim() === '' || !Number.isFinite(Number(value)))) {
      setDraftError('Enter finite native parameters.'); return;
    }
    setDraftError('');
    onInspect(query.kind === 'curve' ? { kind: 'curve', parameter: Number(values[0]) }
      : { kind: 'surface', u: Number(values[0]), v: Number(values[1]) });
  }

  return <section className="inspector-section document-inspection" aria-labelledby="document-point-heading">
    <div className="section-heading"><h3 id="document-point-heading">Native point</h3></div>
    <p className="native-point-source" title={label || bodyId}>{label || bodyId}</p>
    <div className="native-point-domain" aria-label="Original native parameter domains">
      {fields.map(field => <p id={`document-domain-${field.label}`} key={field.label}>
        {field.range ? `${field.label}: [${numberText(field.range[0])}, ${numberText(field.range[1])}]`
          : `${field.label}: original domain unavailable`}
      </p>)}
    </div>
    <form className="native-point-form" onSubmit={submit} noValidate>
      {fields.map((field, index) => <label key={field.label} htmlFor={`document-parameter-${field.label}`}>
        <span>{field.label}</span>
        <Input id={`document-parameter-${field.label}`} type="number" step="any"
          min={field.range?.[0]} max={field.range?.[1]} value={draft[index]}
          aria-label={`Document native parameter ${field.label}`} aria-invalid={Boolean(error)}
          aria-describedby={`document-domain-${field.label}${error ? ' document-point-error' : ''}`}
          onChange={event => {
            const value = event.target.value;
            setDraft(previous => previous.map((old, fieldIndex) => fieldIndex === index ? value : old));
            setDraftError('');
          }} />
      </label>)}
      <Button id="document-inspect-point" type="submit" variant="outline" size="sm">Inspect point</Button>
    </form>
    {error && <p id="document-point-error" className="native-point-error" role="alert">{error}</p>}
    {result && <div id="document-point-result" className="native-point-result" aria-live="polite" aria-atomic="true">
      <p className="native-point-accepted">Evaluated {queryText(result.query)}</p>
      <h4>Original XYZ <span>mm</span></h4>
      <dl className="native-point-coordinates" aria-label="Original authored coordinates in millimetres">
        {['X', 'Y', 'Z'].map((axis, index) => <div key={axis}>
          <dt>{axis}</dt><dd>{numberText(result.pointMM[index])}</dd>
        </div>)}
      </dl>
    </div>}
  </section>;
}
