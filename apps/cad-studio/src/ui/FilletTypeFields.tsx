import { FILLET_TYPES, type FilletType, type RadiusMode } from '../app/filletFamily';
import { NativeSelect } from '@/components/ui/native-select';
export function FilletTypeFields({ type, mode, fixed = false, onType, onMode }: { type: FilletType; mode?: RadiusMode; fixed?: boolean; onType?(type: FilletType): void; onMode?(mode: RadiusMode): void }) {
  return <><label className="field"><span>Type</span><NativeSelect aria-label="Fillet type" value={type} disabled={fixed} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }} onChange={e => onType?.(e.target.value as FilletType)}>{FILLET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect></label>
    {type === 'edge' && mode && <label className="field"><span>Radius mode</span><NativeSelect aria-label="Fillet radius mode" value={mode} disabled={fixed} onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }} onChange={e => onMode?.(e.target.value as RadiusMode)}><option value="constant">Constant</option><option value="varying">Varying</option></NativeSelect></label>}</>;
}
