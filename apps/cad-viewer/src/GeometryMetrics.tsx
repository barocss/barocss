import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { ViewerIcon } from './components/ViewerIcon';

export type GeometryOptions = { absoluteTolerance: number; relativeTolerance: number };
export type GeometryMetricResult = {
  kind: 'curve' | 'surface';
  reference: unknown;
  value: number;
  errorEstimate: number;
  unit: 'mm' | 'mm2';
  domain: { parameter: [number, number] } | { u: [number, number]; v: [number, number] };
  absoluteTolerance: number;
  relativeTolerance: number;
  criterionSatisfied: true;
  certification: 'not-certified';
};
export type GeometryInspection = {
  bodyId: string;
  label: string;
  kind: 'curve' | 'surface';
  options: GeometryOptions;
  result: GeometryMetricResult | null;
  error: string;
  busy: boolean;
};

function numberText(value: number) {
  if (!Number.isFinite(value)) return '—';
  return Object.is(value, -0) ? '-0' : String(value);
}

function resultText(value: number) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toPrecision(10)));
}

function rangeText(range: [number, number]) {
  return `[${numberText(range[0])}, ${numberText(range[1])}]`;
}

export function GeometryMetrics({ inspection, onCalculate }: {
  inspection: GeometryInspection;
  onCalculate: (options: GeometryOptions) => void;
}) {
  const { bodyId, kind, result, busy } = inspection;
  const { absoluteTolerance, relativeTolerance } = inspection.options;
  const [draft, setDraft] = useState(() => [numberText(absoluteTolerance), numberText(relativeTolerance)]);
  const [draftError, setDraftError] = useState('');
  useEffect(() => {
    setDraft([numberText(absoluteTolerance), numberText(relativeTolerance)]);
    setDraftError('');
  }, [bodyId, kind, absoluteTolerance, relativeTolerance]);

  const action = kind === 'curve' ? 'Calculate curve length' : 'Calculate surface area';
  const unit = kind === 'curve' ? 'mm' : 'mm²';
  const error = draftError || inspection.error;
  const resultUnit = result?.unit === 'mm2' ? 'mm²' : 'mm';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const values = draft.map(value => Number(value));
    if (draft.some(value => value.trim() === '') || values.some(value => !Number.isFinite(value))) {
      setDraftError('Enter finite tolerances.'); return;
    }
    if (values[0] <= 0 || values[1] < 0) {
      setDraftError('Absolute tolerance must be greater than 0. Relative tolerance must be 0 or greater.'); return;
    }
    setDraftError('');
    onCalculate({ absoluteTolerance: values[0], relativeTolerance: values[1] });
  }

  return <div className="geometry-metrics" aria-busy={busy}>
    <form onSubmit={submit} noValidate>
      <div className="geometry-metric-heading">
        <h4>{kind === 'curve' ? 'Curve length' : 'Surface area'} <span>{unit}</span></h4>
        <Button id="calculate-geometry" type="submit" variant="outline" size="sm"
          className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]"
          aria-label={action} title={busy ? 'Calculating…' : action}
          disabled={busy} aria-busy={busy}>
          <ViewerIcon name="ruler" />
        </Button>
      </div>
      <div className="geometry-metric-options">
        {['absolute', 'relative'].map((name, index) => <label key={name} htmlFor={`geometry-${name}-tolerance`}>
          <span>{index === 0 ? 'Absolute' : 'Relative'} <small>{index === 0 ? unit : 'ratio'}</small></span>
          <Input id={`geometry-${name}-tolerance`} type="number" step="any" min="0"
            value={draft[index]} disabled={busy}
            aria-label={`${index === 0 ? 'Absolute' : 'Relative'} tolerance${index === 0 ? ` in ${unit}` : ''}`}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'geometry-metric-error' : undefined}
            onChange={event => {
              const value = event.target.value;
              setDraft(previous => previous.map((old, fieldIndex) => fieldIndex === index ? value : old));
              setDraftError('');
            }} />
        </label>)}
      </div>
    </form>
    {error && <p id="geometry-metric-error" className="geometry-metric-error" role="alert">{error}</p>}
    {result && <div id="geometry-metric-result" className="geometry-metric-result" aria-live="polite" aria-atomic="true">
      <p className="geometry-metric-value">≈ {resultText(result.value)} <span>{resultUnit}</span></p>
      <dl className="geometry-metric-details">
        <div><dt title="Heuristic estimate; not a certified error bound.">Estimated error</dt>
          <dd>{resultText(result.errorEstimate)} {resultUnit}</dd></div>
      </dl>
      <p className="geometry-metric-targets" title="Tolerance targets used for this result.">
        Abs {numberText(result.absoluteTolerance)} {resultUnit} · Rel {numberText(result.relativeTolerance)}
      </p>
      <div className="geometry-metric-domain" aria-label="Evaluated original native parameter ranges">
        {'parameter' in result.domain ? <p>t: {rangeText(result.domain.parameter)}</p> : <>
          <p>u: {rangeText(result.domain.u)}</p><p>v: {rangeText(result.domain.v)}</p>
        </>}
      </div>
      <div className="geometry-metric-status">
        <span title="The heuristic error estimate satisfies the requested tolerance criterion.">Targets met</span>
        <span title="This numerical result is not certified.">Not certified</span>
      </div>
    </div>}
  </div>;
}
