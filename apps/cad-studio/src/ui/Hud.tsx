import { shownFields } from '@barocss/cad-model/app/commands';
import { useEffect, useRef } from 'react';
import { useStoreValue, type ValueStore } from '../state/valueStore';
import type { Command, Ctx, Values } from '@barocss/cad-model/app/commands';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Icon, Kbd } from './atoms';

/** The HUD's field box: 26 px, the studio's mono type, the accent ring when focused. */
const FIELD = 'h-[26px]! w-full px-1.5! text-xs! font-medium [font-family:var(--mono)] bg-[var(--bg)] focus-visible:ring-1 focus-visible:ring-primary';

interface Active { cmd: Command; values: Values; preview: 'busy' | 'ok' | 'error'; error?: FriendlyError; ctx: Ctx; placing?: boolean }
interface Props {
  /** The running command (R1d): the HUD subscribes to it — its values, preview state and error — not the App. */
  store: ValueStore<Active | null>;
  onChange(key: string, value: number | string): void; onApply(): void; onCancel(): void;
}

/** The floating command HUD: few fields, keyboard-first, with the kernel’s answer inline. (G12f: its fields, choices and
 * actions shadcn's Input, NativeSelect and Button, at the HUD's 26 px in the studio's mono type.) */
export function Hud({ store, onChange, onApply, onCancel }: Props) {
  const active = useStoreValue(store);
  const first = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  useEffect(() => { first.current?.focus(); if (first.current instanceof HTMLInputElement) first.current.select(); }, [active?.cmd.id]);
  // (Ended before the App unmounts it.)
  if (!active) return null;
  const fields = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values);
  return (
    <div className="card hud" role="dialog" aria-label={active.cmd.label}>
      <div className="hud-title"><Icon name={active.cmd.icon} small className="accent" />{active.cmd.label}
        <span className="grow" /><span className={'status ' + active.preview}>{active.preview === 'busy' ? 'evaluating…' : active.preview === 'ok' ? 'preview' : 'refused'}</span></div>
      {active.cmd.place && <div className="hud-steps"><div className={'hud-step' + (active.placing ? '' : ' done')}>
        <Icon name={active.placing ? 'radio_button_unchecked' : 'check_circle'} small /><b>Place</b><span>{active.placing ? 'click where it goes (on the ground or a top face)' : 'placed — drag its arrows to size it'}</span></div></div>}
      {active.cmd.steps && <div className="hud-steps">
        {active.cmd.steps(active.ctx, active.values).map(s => <div key={s.label} className={'hud-step' + (s.done ? ' done' : '')}>
          <Icon name={s.done ? 'check_circle' : 'radio_button_unchecked'} small /><b>{s.label}</b><span>{s.text}</span></div>)}
      </div>}
      <div className="hud-fields">
        {fields.map((f, i) => (
          <label key={f.key} className="field"><span>{f.label}</span>
            {f.kind === 'choice'
              ? <NativeSelect className={FIELD} ref={i === 0 ? el => { first.current = el; } : undefined} value={String(active.values[f.key])} onChange={e => onChange(f.key, e.target.value)}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
              : <span className="num"><Input className={FIELD + ' pr-7!'} ref={i === 0 ? el => { first.current = el; } : undefined} type="number" step={f.kind === 'count' ? 1 : 'any'} min={f.min} max={f.max}
                value={String(active.values[f.key] ?? '')} onChange={e => onChange(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
                {f.kind === 'mm' && <em>mm</em>}{f.kind === 'deg' && <em>°</em>}{f.kind === 'ratio' && <em>×</em>}</span>}
          </label>))}
      </div>
      {active.preview === 'error' && active.error && <div className="hud-error" role="status">
        <div className="hud-error-title">{active.error.title}</div><div>{active.error.hint}</div>
        {active.error.detail && <details><summary>Kernel detail</summary><code>{active.error.detail}</code></details>}
      </div>}
      <div className="hud-actions">
        <span className="muted"><Kbd>Tab</Kbd> next <Kbd>Enter</Kbd> apply <Kbd>⇧Enter</Kbd> again <Kbd>Esc</Kbd> cancel</span>
        <span className="grow" />
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="default" disabled={active.preview !== 'ok'} onClick={onApply}>Apply</Button>
      </div>
    </div>
  );
}
