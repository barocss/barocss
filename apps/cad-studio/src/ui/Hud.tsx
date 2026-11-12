import { FilletTypeFields } from './FilletTypeFields';
import type { FilletType, RadiusMode } from '../app/filletFamily';
import { commandIconName } from './commandIcons';
import { shownFields } from '@barocss/cad-model/app/commands';
import { useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useStoreValue, type ValueStore } from '../state/valueStore';
import type { Field, Values } from '@barocss/cad-model/app/commands';
import { activeKey, type Active } from '../app/commandState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Icon } from './atoms';
import { FillPatternHints } from './FillPatternHints';
import { FeatureFailureNotice } from './FeatureFailureNotice';
import { HolePresets } from './HolePresets';
import { LinearSpanSpacing } from './LinearSpanSpacing';

/** The HUD's field box: 26 px, the studio's mono type, the accent ring when focused. */
const FIELD = 'h-[26px]! w-full px-1.5! text-xs! font-medium [font-family:var(--mono)] bg-[var(--bg)] focus-visible:ring-1 focus-visible:ring-primary';

interface Props {
  /** The running command (R1d): the HUD subscribes to it — its values, preview state and error — not the App. */
  store: ValueStore<Active | null>;
  onChange(key: string, value: number | string): void; onApply(owner: Active): void; onCancel(): void;
  onFilletType?(type: FilletType): void; onRadiusMode?(mode: RadiusMode): void;
  onFile?(key: string, file: File): void;
  onHoleOptions(owner: Active, patch: Values): boolean;
}
function renderOption(option: { value: string; label: string }) { return <option key={option.value} value={option.value}>{option.label}</option>; }

/** The floating command HUD: few fields, keyboard-first, with the kernel’s answer inline. (G12f: its fields, choices and
 * actions shadcn's Input, NativeSelect and Button, at the HUD's 26 px in the studio's mono type.) */
export function Hud({ store, onChange, onApply, onCancel, onFile, onFilletType, onRadiusMode, onHoleOptions }: Props) {
  const active = useStoreValue(store);
  const first = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  useEffect(() => { first.current?.focus(); if (first.current instanceof HTMLInputElement && first.current.type !== 'file') first.current.select(); }, [active?.cmd.id]);
  // (Ended before the App unmounts it.)
  if (!active) return null;
  const fields = shownFields(active.cmd.fields?.(active.ctx, active.values) ?? [], active.values).filter(f => !(active.fillet?.type === 'edge' && active.fillet.radiusMode === 'constant' && f.key === 'endRadius'));
  const captureFirst = (element: HTMLInputElement | HTMLSelectElement | null) => { first.current = element; };
  const changeValue = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const input = event.currentTarget, key = input.dataset.key;
    if (!key) return;
    onChange(key, input.dataset.kind === 'text' || input.dataset.kind === 'choice' ? input.value : input.value === '' ? '' : Number(input.value));
  };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget, key = input.dataset.key, file = input.files?.[0];
    input.value = '';
    if (file && key) onFile?.(key, file);
  };
  const renderField = (field: Field, index: number) => {
    const value = active.values[field.key], ref = index === 0 ? captureFirst : undefined;
    let control: ReactNode;
    if (field.kind === 'choice') control = <NativeSelect className={FIELD} ref={ref} aria-label={field.label} data-key={field.key} data-kind="choice" value={String(value)} onChange={changeValue}>{field.options.map(renderOption)}</NativeSelect>;
    else if (field.kind === 'text') control = <Input className={FIELD} ref={ref} type="text" aria-label={field.label} data-key={field.key} data-kind="text" maxLength={field.maxLength} value={String(value ?? '')} onChange={changeValue} />;
    else if (field.kind === 'file') control = <span className="min-w-0"><Input className={FIELD} ref={ref} type="file" aria-label={field.label} data-key={field.key} accept={field.accept} disabled={!onFile} onChange={chooseFile} /><span className="muted small">{field.filename(value ?? '') ?? 'No file prepared'}</span></span>;
    else control = <span className="num"><Input className={FIELD + ' pr-7!'} ref={ref} type="number" aria-label={field.label} data-key={field.key} data-kind={field.kind} step={field.kind === 'count' ? 1 : 'any'} min={field.min} max={field.max} value={String(value ?? '')} onChange={changeValue} />
      {field.kind === 'mm' && <em>mm</em>}{field.kind === 'deg' && <em>°</em>}{field.kind === 'ratio' && <em>×</em>}</span>;
    return <label key={field.key} className="field"><span>{field.label}</span>{control}</label>;
  };
  return (
    <div className="card hud" role="dialog" aria-label={active.fillet ? 'Fillet' : active.cmd.label}>
      <div className="hud-title"><Icon name={commandIconName(active.cmd.id, active.cmd.icon)} small className="accent" />{active.fillet ? 'Fillet' : active.cmd.label}
        <span className="grow" /><span className={'status ' + active.preview}>{active.preview === 'busy' ? 'evaluating…' : active.preview === 'ok' ? 'preview' : 'refused'}</span></div>
      {active.cmd.place && <div className="hud-steps"><div className={'hud-step' + (active.placing ? '' : ' done')}>
        <Icon name={active.placing ? 'radio_button_unchecked' : 'check_circle'} small /><b>Place</b><span>{active.placing ? 'click where it goes (on the ground or a top face)' : 'placed — drag its arrows to size it'}</span></div></div>}
      {active.cmd.steps && <div className="hud-steps">
        {active.cmd.steps(active.ctx, active.values).map(s => <div key={s.label} className={'hud-step' + (s.done ? ' done' : '')}>
          <Icon name={s.done ? 'check_circle' : 'radio_button_unchecked'} small /><b>{s.label}</b><span>{s.text}</span></div>)}
      </div>}
      <div className="hud-fields">
        {active.fillet && <FilletTypeFields type={active.fillet.type} mode={active.fillet.radiusMode} onType={onFilletType} onMode={onRadiusMode} />}
        {fields.map(renderField)}
        {((active.cmd.id === 'linear-pattern' && active.values.result !== 'separate' && active.values.distanceMode === 'span')
          || (active.cmd.id === 'edit' && fields.some(field => field.key === 'span')))
          && <LinearSpanSpacing span={Number(active.values.span)} count={Number(active.values.count)} />}
      </div>
      {active.cmd.id === 'hole' ? <HolePresets key={activeKey(active, active.values)} values={active.values}
        onUse={options => onHoleOptions(active, options)} onReset={() => {
          const defaults = active.cmd.defaults?.(active.ctx);
          if (!defaults) return false;
          const { type, d, depth, cd, ch, csd } = defaults;
          return onHoleOptions(active, { type, d, depth, cd, ch, csd });
        }} /> : null}
      {active.cmd.id === 'fill-feature-pattern' && <FillPatternHints />}
      {active.preview === 'error' && active.error && <FeatureFailureNotice error={active.error} />}
      <div className="hud-actions">
        <span className="grow" />
        {/* Keep native button activation from also reaching the window's Apply shortcut. */}
        <Button variant="ghost" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }} onClick={onCancel}>Cancel</Button>
        <Button variant="default" disabled={active.preview !== 'ok'} onClick={() => onApply(active)}>Apply</Button>
      </div>
    </div>
  );
}
