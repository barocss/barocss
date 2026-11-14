import { useState } from 'react';
import type { Values } from '@barocss/cad-model/app/commands';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { canUseHolePresets, HOLE_PRESET_NAME_LIMIT, holePresetName, holePresetOptions,
  readHolePresets, sameHolePresetName, writeHolePresets, type HoleOptions, type HolePreset } from '../app/holePresets';
import { browserStore } from './browserStore';

const read = () => readHolePresets(browserStore());
const FIELD = 'h-[26px]! min-w-0 w-full px-1.5! text-xs!';

interface Props {
  values: Values;
  onUse(options: HoleOptions): boolean;
  onReset(): boolean;
}

export function HolePresets({ values, onUse, onReset }: Props) {
  const [stored, setStored] = useState(read);
  const [name, setName] = useState('');
  const [selection, setSelection] = useState('');
  const [message, setMessage] = useState('');
  const presets = stored.ok ? stored.presets : [];
  const selected = presets.find(preset => preset.name === selection);
  const allowed = canUseHolePresets(values);

  const save = (next: HolePreset[], nextSelection: string) => {
    const result = writeHolePresets(browserStore(), presets, next);
    if (!result.ok) {
      setStored(read());
      setMessage(result.message);
      return;
    }
    setStored(result);
    setSelection(nextSelection);
    setName(nextSelection);
    setMessage('');
  };
  const currentOptions = () => {
    const options = holePresetOptions(values);
    if (!options) setMessage('Enter valid hole dimensions before saving.');
    return options;
  };
  const changeName = (rename: boolean) => {
    const nextName = holePresetName(name);
    if (!nextName) { setMessage('Enter a valid preset name.'); return; }
    if (presets.some(preset => (!rename || preset !== selected) && sameHolePresetName(preset.name, nextName))) {
      setMessage('A hole preset already uses this name.');
      return;
    }
    if (rename && selected) {
      save(presets.map(preset => preset === selected ? { ...preset, name: nextName } : preset), nextName);
    } else if (!rename) {
      const options = currentOptions();
      if (options) save([...presets, { name: nextName, options }], nextName);
    }
  };
  const useSelected = () => {
    const latest = read();
    setStored(latest);
    if (!latest.ok || !selected) return;
    const current = latest.presets.find(preset => preset.name === selected.name);
    if (!current || JSON.stringify(current) !== JSON.stringify(selected)) {
      setMessage('The selected preset changed. Review it before use.');
      return;
    }
    setMessage(onUse(current.options) ? '' : 'Start Hole again on the current face.');
  };
  const selectPreset = (value: string) => {
    setSelection(value);
    setName(value);
    setMessage('');
  };

  return <details className="m-0! text-xs text-[var(--text-2)]"
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>
    <summary className="cursor-pointer">Hole presets</summary>
    <fieldset className="m-0 mt-2 grid min-w-0 gap-1.5 border-0 p-0" aria-label="Manage hole presets" disabled={!allowed || !stored.ok}>
      <div className="flex items-center gap-1.5">
        <NativeSelect aria-label="Hole preset" className={FIELD} value={selected?.name ?? ''}
          onChange={event => selectPreset(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'
              || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            const list = event.currentTarget;
            const index = Math.max(0, Math.min(list.options.length - 1, list.selectedIndex + (event.key === 'ArrowUp' ? -1 : 1)));
            selectPreset(list.options[index].value);
          }}>
          <option value="">Choose a preset</option>
          {presets.map(preset => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={useSelected}>Use preset</Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Input aria-label="Preset name" placeholder="Preset name" className={FIELD} maxLength={HOLE_PRESET_NAME_LIMIT}
          value={name} onChange={event => { setName(event.currentTarget.value); setMessage(''); }} />
        <Button type="button" variant="outline" size="sm" disabled={!name.trim()} onClick={() => changeName(false)}>Save preset</Button>
      </div>
      {selected ? <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="ghost" size="sm" disabled={!name.trim() || name.trim() === selected.name}
          onClick={() => changeName(true)}>Rename preset</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => {
          const options = currentOptions();
          if (options) save(presets.map(preset => preset === selected ? { ...preset, options } : preset), selected.name);
        }}>Update preset</Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => save(presets.filter(preset => preset !== selected), '')}>Delete preset</Button>
      </div> : null}
    </fieldset>
    <Button type="button" variant="ghost" size="sm" disabled={!allowed}
      onClick={() => setMessage(onReset() ? '' : 'Start Hole again on the current face.')}>Reset hole options</Button>
    {!allowed ? <p role="status">Presets require one through, blind, counterbored or countersunk hole.</p>
      : !stored.ok || message ? <p className="hud-error" role="status">{stored.ok ? message : stored.message}</p> : null}
  </details>;
}
