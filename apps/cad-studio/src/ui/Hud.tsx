import { shownFields } from '../app/commands';
import { useEffect, useRef } from 'react';
import type { Command, Ctx, Values } from '../app/commands';
import type { FriendlyError } from '../engine/errors';
import { Icon, Kbd } from './atoms';

interface Props {
  active: { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx };
  onChange(key: string, value: number | string): void; onApply(): void; onCancel(): void;
}

/** The floating command HUD: few fields, keyboard-first, with the kernel’s answer inline. */
export function Hud({ active, onChange, onApply, onCancel }: Props) {
  const first = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  useEffect(() => { first.current?.focus(); if (first.current instanceof HTMLInputElement) first.current.select(); }, [active.cmd.id]);
  const fields = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values);
  return (
    <div className="card hud" role="dialog" aria-label={active.cmd.label}>
      <div className="hud-title"><Icon name={active.cmd.icon} small className="accent" />{active.cmd.label}
        <span className="grow" /><span className={'status ' + active.preview}>{active.preview === 'busy' ? 'evaluating…' : active.preview === 'ok' ? 'preview' : 'refused'}</span></div>
      {active.cmd.steps && <div className="hud-steps">
        {active.cmd.steps(active.ctx, active.values).map(s => <div key={s.label} className={'hud-step' + (s.done ? ' done' : '')}>
          <Icon name={s.done ? 'check_circle' : 'radio_button_unchecked'} small /><b>{s.label}</b><span>{s.text}</span></div>)}
      </div>}
      <div className="hud-fields">
        {fields.map((f, i) => (
          <label key={f.key} className="field"><span>{f.label}</span>
            {f.kind === 'choice'
              ? <select ref={i === 0 ? el => { first.current = el; } : undefined} value={String(active.values[f.key])} onChange={e => onChange(f.key, e.target.value)}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : <span className="num"><input ref={i === 0 ? el => { first.current = el; } : undefined} type="number" step={f.kind === 'count' ? 1 : 'any'} min={f.min} max={f.max}
                value={String(active.values[f.key] ?? '')} onChange={e => onChange(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
                {f.kind === 'mm' && <em>mm</em>}{f.kind === 'deg' && <em>°</em>}</span>}
          </label>))}
      </div>
      {active.preview === 'error' && active.error && <div className="hud-error" role="status">
        <div className="hud-error-title">{active.error.title}</div><div>{active.error.hint}</div>
        {active.error.detail && <details><summary>Kernel detail</summary><code>{active.error.detail}</code></details>}
      </div>}
      <div className="hud-actions">
        <span className="muted"><Kbd>Tab</Kbd> next <Kbd>Enter</Kbd> apply <Kbd>Esc</Kbd> cancel</span>
        <span className="grow" />
        <button className="ghost" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={active.preview !== 'ok'} onClick={onApply}>Apply</button>
      </div>
    </div>
  );
}
