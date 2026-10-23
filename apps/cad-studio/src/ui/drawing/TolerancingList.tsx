// The drawing's TOLERANCING suggestions (R14.4; O16, split from DrawingWorkspace): offered with their basis, applied when accepted.
import { applySuggestion, type ToleranceSuggestion } from '@barocss/cad-model/drawing/tolerance';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import type { useDrawingSheet } from '../useDrawingSheet';
import { Icon } from '../atoms';
import { FIELD, CONTROL } from './sheetShared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

type Sheet = ReturnType<typeof useDrawingSheet>;
export function TolerancingList({ suggestions, settings, views, onChange, acceptEvery }: {
  suggestions: readonly ToleranceSuggestion[]; settings: DrawingSettings; views: Sheet['views']; onChange(next: DrawingSettings): void; acceptEvery(): void;
}) {
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>TOLERANCING <span className="muted" aria-label="Suggestion count">{suggestions.length}</span>
          {suggestions.length > 0 && <Button variant="ghost" onClick={acceptEvery} aria-label="Accept all suggestions" data-tip="Accept all" data-tip-desc="Every suggestion, datums before the frames that name them; then what overlaps is moved clear">Accept all</Button>}</div>
        <label className={FIELD}><span>Mode</span><NativeSelect className={CONTROL} aria-label="Tolerancing" value={settings.tolerancing ?? 'plus-minus'} onChange={e => { const next = { ...settings }; delete next.tolerancing; onChange(e.target.value === 'geometric' ? { ...next, tolerancing: 'geometric' } : next); }}>
          <option value="plus-minus">± dimensions</option><option value="geometric">Geometric (datums, position)</option></NativeSelect></label>
        <div className="dw-issues" aria-label="Tolerance suggestions">
          {suggestions.map(x => <div key={x.id} className="dw-issue" title={x.basis}>
            <Icon name={x.estimate ? 'help' : 'lightbulb'} small /><span className="min-w-0">{x.message}
              {/* (O16: the basis — often long — behind Details; an estimate says so in its summary.) */}
              <details className="muted"><summary className="cursor-pointer select-none">{x.estimate ? 'Estimate' : 'Basis'}</summary>{x.basis}</details></span>
            <Button variant="ghost" size="xs" aria-label={`Accept: ${x.message}`} onClick={() => onChange(applySuggestion(settings, x))}>Accept</Button>
          </div>)}
          {!suggestions.length && views && <div className="empty">Nothing to suggest: {settings.tolerancing === 'geometric' ? 'datums, positions and the general note are there' : 'the general note and hole positions are toleranced'}.</div>}
        </div>
  </>;
}
