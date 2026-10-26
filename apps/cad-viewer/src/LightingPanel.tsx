import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

export type LightingValues = {
  ambientStrength: number;
  directionalStrength: number;
  direction: readonly number[];
};

type LightingPanelProps = {
  lighting: LightingValues;
  disabled: boolean;
  error: string;
  reason: string | null;
  onApply: (input: LightingValues) => void;
  onReset: () => void;
};

type LightingDraft = {
  ambientStrength: string;
  directionalStrength: string;
  x: string;
  y: string;
  z: string;
};

function makeDraft(ambientStrength: number, directionalStrength: number, x: number, y: number, z: number): LightingDraft {
  return {
    ambientStrength: String(ambientStrength),
    directionalStrength: String(directionalStrength),
    x: String(x),
    y: String(y),
    z: String(z),
  };
}

export function LightingPanel({ lighting, disabled, error, reason, onApply, onReset }: LightingPanelProps) {
  const { ambientStrength, directionalStrength } = lighting;
  const [x, y, z] = lighting.direction;
  const [draft, setDraft] = useState(() => makeDraft(ambientStrength, directionalStrength, x, y, z));
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setDraft(makeDraft(ambientStrength, directionalStrength, x, y, z));
    setValidationError('');
  }, [ambientStrength, directionalStrength, x, y, z]);

  function updateDraft(field: keyof LightingDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setValidationError('');
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const values = [draft.ambientStrength, draft.directionalStrength, draft.x, draft.y, draft.z];
    if (values.some(value => value.trim() === '' || !Number.isFinite(Number(value)))) {
      setValidationError('Enter a finite number in every lighting field.');
      return;
    }
    const [ambient, directional, directionX, directionY, directionZ] = values.map(Number);
    if (ambient < 0 || ambient > 1 || directional < 0 || directional > 1 || ambient + directional > 1) {
      setValidationError('Use strengths from 0 to 1. Their sum must be 1 or less.');
      return;
    }
    if ([directionX, directionY, directionZ].some(value => Math.abs(value) > 1000)) {
      setValidationError('Use direction components from -1000 to 1000.');
      return;
    }
    if (directionX === 0 && directionY === 0 && directionZ === 0) {
      setValidationError('Enter a direction with at least one nonzero component.');
      return;
    }
    setValidationError('');
    onApply({ ambientStrength: ambient, directionalStrength: directional, direction: [directionX, directionY, directionZ] });
  }

  function reset() {
    setDraft(makeDraft(ambientStrength, directionalStrength, x, y, z));
    setValidationError('');
    onReset();
  }

  const visibleError = validationError || error;

  return <section className="inspector-section lighting-section" aria-labelledby="lighting-heading" title={reason ?? undefined}>
    <div className="section-heading lighting-heading">
      <h3 id="lighting-heading">Lighting</h3>
      <span className="lighting-mode">Mesh</span>
    </div>
    <form className="lighting-form" onSubmit={apply} noValidate>
      <fieldset className="lighting-fields" disabled={disabled}>
        <legend className="sr-only">Mesh lighting settings</legend>
        <div className="lighting-strengths">
          <label htmlFor="lighting-ambient">Ambient strength</label>
          <Input id="lighting-ambient" type="number" min="0" max="1" step="any" value={draft.ambientStrength}
            onChange={event => updateDraft('ambientStrength', event.target.value)} />
          <label htmlFor="lighting-directional">Directional strength</label>
          <Input id="lighting-directional" type="number" min="0" max="1" step="any" value={draft.directionalStrength}
            onChange={event => updateDraft('directionalStrength', event.target.value)} />
        </div>
        <fieldset className="lighting-direction">
          <legend>Direction</legend>
          <div className="lighting-axes">
            {(['x', 'y', 'z'] as const).map(axis => <label key={axis} htmlFor={`lighting-${axis}`}>
              <span>{axis.toUpperCase()}</span>
              <Input id={`lighting-${axis}`} type="number" min="-1000" max="1000" step="any" value={draft[axis]}
                aria-label={`Lighting direction ${axis.toUpperCase()}`}
                onChange={event => updateDraft(axis, event.target.value)} />
            </label>)}
          </div>
        </fieldset>
        <div className="lighting-actions">
          <Button id="lighting-apply" type="submit" variant="outline" size="sm">Apply</Button>
          <Button id="lighting-reset" type="button" variant="ghost" size="sm" onClick={reset}>Reset</Button>
        </div>
      </fieldset>
    </form>
    {visibleError && <p id="lighting-error" className="lighting-error" role="alert">{visibleError}</p>}
  </section>;
}
