import { useRef, useState } from 'react';
import type { Resolved } from '@barocss/cad-model/drawing/dimensions';
import { dimensionLine } from '@barocss/cad-model/drawing/sheet';
import { presetFor } from '@barocss/cad-model/drawing/standard';
import { calculateToleranceStack, linearMeasurementKey } from '@barocss/cad-model/drawing/toleranceStack';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Icon } from '../atoms';

interface Term {
  key: number;
  id: string;
  measurement?: string;
  sign: 1 | -1;
}

function StackTerms({ dimensions, settings }: { dimensions: readonly Resolved[] | null; settings: DrawingSettings }) {
  const [terms, setTerms] = useState<Term[]>([{ key: 0, id: '', sign: 1 }, { key: 1, id: '', sign: -1 }]);
  const nextKey = useRef(2);
  const preset = presetFor(settings);
  const choices = (dimensions ?? []).flatMap(r => r.dim.kind !== 'linear' ? [] : [{
    id: r.dim.id,
    measurement: linearMeasurementKey(r.dim),
    label: `${r.dim.id} · ${r.ok ? dimensionLine(r, preset) : 'Lost reference'} · ${r.dim.view}`,
  }]);
  const byId = new Map(choices.map(choice => [choice.id, choice]));
  const changed = (term: Term) => byId.has(term.id) && byId.get(term.id)?.measurement !== term.measurement;
  const replaced = terms.find(changed);
  const result = dimensions && terms.every(term => term.id)
    ? replaced ? { ok: false as const, reason: `Dimension ${replaced.id} changed. Select it again.` }
      : calculateToleranceStack('mm', terms, dimensions)
    : null;
  const edit = (key: number, update: Partial<Omit<Term, 'key'>>) => {
    setTerms(current => current.map(term => term.key === key ? { ...term, ...update } : term));
  };

  return <div className="space-y-1 py-1 text-[11px]">
    <div className="text-muted-foreground">Independent dimensions on one view axis · Model mm</div>
    {terms.map((term, index) => {
      const { key, id, sign } = term;
      return <div key={key} className="flex items-center gap-1">
        <NativeSelect className="w-10 shrink-0" aria-label={`Stack sign ${index + 1}`} value={sign}
          onChange={e => edit(key, { sign: e.target.value === '1' ? 1 : -1 })}>
          <option value="1">+</option><option value="-1">−</option>
        </NativeSelect>
        <NativeSelect className="flex-1" aria-label={`Stack dimension ${index + 1}`} value={changed(term) ? '' : id} disabled={!dimensions}
          onChange={e => edit(key, { id: e.target.value, measurement: byId.get(e.target.value)?.measurement })}>
          <option value="">Select dimension</option>
          {id && !byId.has(id) && <option value={id}>{id} · Unavailable</option>}
          {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
        </NativeSelect>
        {terms.length > 2 && <Button size="xs" variant="ghost" aria-label={`Remove stack term ${index + 1}`}
          onClick={() => setTerms(current => current.filter(term => term.key !== key))}><Icon name="close" small /></Button>}
      </div>;
    })}
    <Button size="xs" variant="ghost" disabled={!dimensions || terms.length >= choices.length}
      onClick={() => { const key = nextKey.current++; setTerms(current => [...current, { key, id: '', sign: -1 }]); }}>Add term</Button>
    <div role="status" aria-label="Tolerance stack result">
      {!dimensions ? <div className="text-muted-foreground">Current drawing dimensions are unavailable.</div>
        : result?.ok ? <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
          <dt>Nominal</dt><dd className="break-all font-mono" data-stack-value="nominal">{result.nominal} mm</dd>
          <dt>Worst-case min</dt><dd className="break-all font-mono" data-stack-value="minimum">{result.minimum} mm</dd>
          <dt>Worst-case max</dt><dd className="break-all font-mono" data-stack-value="maximum">{result.maximum} mm</dd>
        </dl> : result ? <div className="text-[var(--warn)]">{result.reason}</div> : null}
    </div>
  </div>;
}

export function ToleranceStack({ dimensions, settings }: { dimensions: readonly Resolved[] | null; settings: DrawingSettings }) {
  const [started, setStarted] = useState(false);
  return <details aria-label="Tolerance stack" className="my-2" onToggle={e => { if (e.currentTarget.open) setStarted(true); }}>
    <summary className="cursor-pointer">Tolerance stack</summary>
    {started && <StackTerms dimensions={dimensions} settings={settings} />}
  </details>;
}
