// The drawing's DIMENSIONS (O16, split from DrawingWorkspace): each with its value, kind and view; Auto-dimension.
import { toleranceText } from '@barocss/cad-model/drawing/sheet';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import type { useDrawingSheet } from '../useDrawingSheet';
import { Icon, Kbd } from '../atoms';

type Sheet = ReturnType<typeof useDrawingSheet>;
export function DimensionsList({ sheet, views, layout, scope, settings, selected, onSelect, remove, autoDimension }: {
  sheet: Sheet['sheet']; views: Sheet['views']; layout: Sheet['layout']; scope: Sheet['scope']; settings: DrawingSettings; selected: string | null;
  onSelect(id: string): void; remove(id: string): void; autoDimension(): Promise<void>;
}) {
  const lost = sheet?.dimensions.filter(r => !r.ok) ?? [];
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>DIMENSIONS <span className="muted">{settings.dimensions.length}</span>
          <button className="ghost small" disabled={!views || !layout || scope.kind === 'assembly'} onClick={() => void autoDimension()} aria-label="Auto-dimension" data-tip="Auto-dimension" data-tip-desc="Views laid out with room, a scale and sheet that read cleanly, then overall sizes, steps, hole positions and callouts: replaces its own earlier ones, keeps yours">Auto</button></div>
        <div className="dw-dims">
          {sheet?.dimensions.map(r => <div key={r.dim.id} role="button" tabIndex={0} className={'dw-dim' + (selected === r.dim.id ? ' sel' : '') + (r.ok ? '' : ' lost')} title={r.ok ? undefined : r.reason}
            onClick={() => onSelect(r.dim.id)}>
            <b>{r.ok ? r.text : 'lost'}{r.dim.tol ? ` ${toleranceText(r.dim.tol, r.dim.kind === 'angle' ? '°' : '')}` : ''}</b><span>{r.dim.kind === 'linear' ? r.dim.orient : r.dim.kind} · {r.dim.view}</span>
            <span className="muted" />
            <button className="tool tiny" aria-label={`Remove dimension ${r.ok ? r.text : r.dim.id}`} onClick={e => { e.stopPropagation(); remove(r.dim.id); }}><Icon name="close" small /></button>
          </div>)}
          {!settings.dimensions.length && <div className="empty">Pick a dimension tool (<Kbd>D</Kbd> linear, <Kbd>O</Kbd> diameter, <Kbd>R</Kbd> radius, <Kbd>A</Kbd> angle) and click in a view. Values come from the model in mm and follow it as it changes.</div>}
          {lost.length > 0 && <div className="empty" style={{ color: 'var(--warn)' }}>{lost.length} dimension{lost.length > 1 ? 's' : ''} lost {lost.length > 1 ? 'their' : 'its'} reference (the part changed).</div>}
        </div>
  </>;
}
