import type { Dispatch, SetStateAction } from 'react';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Selection } from '@barocss/cad-model/app/commands';
import { measureItem, type measureBetween, type MeasurePick } from '@barocss/cad-model/app/measure';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { Button } from '@/components/ui/button';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon, Kbd } from './atoms';
import { measureQuantityText } from './quantityText';
import { measureAxesBasis } from '../app/measureProvenance';
import type { MeasureTarget } from '../app/measureTargets';
import type { InterferenceReport } from '../app/checkInterference';
interface MeasurementInspectorProps { targets: MeasureTarget[]; items: ({ pick: MeasurePick; mesh: DisplayMesh } | null)[]; measured: ReturnType<typeof measureBetween> | null; approximateDistance?: boolean; onClose(): void; onPin?(): void }
export function MeasurementInspector({ targets, items, measured, approximateDistance, onClose, onPin }: MeasurementInspectorProps) {
  return <aside className="card props" aria-label="Measurement">
        <div className="card-title">MEASURE <ToolIconButton size="tiny" aria-label="Done measuring" onClick={onClose}><Icon name="close" small /></ToolIconButton></div>
        {targets.map((target, k) => {
          const item = items[k], slot = k ? 'To' : 'From';
          if (!item) return <div key={k} className="measure-item empty" role="status">{slot} · {target.label} ({target.occurrence ? target.occurrence.id + '/' : ''}{target.body}) is unavailable. Select a new {slot} target.</div>;
          const it = measureItem(item.mesh, item.pick);
          return <div key={k} className="measure-item">
          <div className="kv">{slot} <b>{it.label}</b></div>
          <div className="kv">Body <b>{target.label} ({target.occurrence ? target.occurrence.id + '/' : ''}{target.body})</b></div>
          {it.length !== undefined && <div className="kv">Length <b>{measureQuantityText(it.length, 2)} mm</b></div>}
          {it.area !== undefined && <div className="kv">Area <b>{measureQuantityText(it.area, 2)} mm²{it.areaBasis === 'display mesh' ? ' (mesh)' : ''}</b></div>}
          {it.radius !== undefined && <div className="kv">Radius <b>{measureQuantityText(it.radius, 3)} mm</b></div>}
        </div>; })}
        {measured && <>
          <div className="card-title" style={{ marginTop: 10 }}>BETWEEN</div>
          <div className="kv">Distance <b>{measureQuantityText(measured.distance, 3)} mm{approximateDistance ? ' (mesh approximation)' : ''}</b></div>
          {measured.normalDistance !== undefined && <div className="kv">Normal distance <b>{measureQuantityText(measured.normalDistance, 3)} mm</b></div>}
          {measured.angle !== undefined && <div className="kv">Angle <b>{measureQuantityText(measured.angle, 2)}°</b></div>}
          {measured.axes && <div className="kv" aria-label="Axes">Axes <b>{measured.axes.coaxial ? 'coaxial' : `${measureQuantityText(measured.axes.angle, 3)}° apart, ${measureQuantityText(measured.axes.offset, 3)} mm off`} <span className="muted">({measureAxesBasis})</span></b></div>}
          <div className="kv">ΔX ΔY ΔZ <b>{measured.b.map((v, k) => measureQuantityText(v - measured.a[k], 2)).join(', ')}</b></div>
        </>}
        {onPin && <Button size="sm" variant="ghost" onClick={onPin}>Pin measurement</Button>}
        <div className="empty">{items.some(item => !item) ? null : targets.length < 2 ? `Click a face, edge, or vertex to measure ${targets.length ? 'to' : 'from'}.` : 'Click again to start over.'} <Kbd>Esc</Kbd> done</div>
      </aside>;
}

export function PinnedMeasurement({ distance, onClear }: { distance: number | null; onClear(): void }) {
  return <aside className="card props" aria-label="Pinned measurement">
    <div className="card-title">PINNED MEASUREMENT <ToolIconButton size="tiny" aria-label="Clear pinned measurement" onClick={onClear}><Icon name="close" small /></ToolIconButton></div>
    {distance === null ? <div className="empty" role="status">Measurement unavailable.</div>
      : <div className="kv">Normal distance <b>{measureQuantityText(distance, 3)} mm</b></div>}
  </aside>;
}

export type InterferenceResult = InterferenceReport | 'busy';
interface InterferenceInspectorProps { doc: StudioDoc; bodies: BodyResult[]; clashes: InterferenceResult; setClashes(value: null): void; setSelection: Dispatch<SetStateAction<Selection>> }
export function InterferenceInspector({ doc, bodies, clashes, setClashes, setSelection }: InterferenceInspectorProps) {
  const names = bodies.map(body => bodyName(doc, body));
  const label = (index: number, key: string) => {
    const name = names[index];
    return name === undefined ? key : names.indexOf(name) === names.lastIndexOf(name) ? name : `${name} (${key})`;
  };
  const pair = ({ a, b, volume }: { a: string; b: string; volume?: number }) => {
    const ia = bodies.findIndex(body => body.key === a), ib = bodies.findIndex(body => body.key === b);
    return <button type="button" key={a + ':' + b} className="ol clash" disabled={ia < 0 || ib < 0}
      onClick={() => setSelection({ faces: [], edges: [], bodies: [ia, ib] })}>
      <Icon name="warning" small />{label(ia, a)}{volume === undefined ? ' and ' : ' ∩ '}{label(ib, b)}
      {volume !== undefined && <span className="muted"> · {fmt(Math.round(volume * 10) / 10)} mm³</span>}
    </button>;
  };
  return <aside className="card props" aria-label="Interference">
        <div className="card-title">INTERFERENCE <ToolIconButton size="tiny" aria-label="Close interference" onClick={() => setClashes(null)}><Icon name="close" small /></ToolIconButton></div>
        {clashes === 'busy' ? <div className="empty">Checking…</div> : <>
          {!clashes.failures.length && !clashes.clashes.length && <div className="empty">No bodies overlap.</div>}
          {!!clashes.failures.length && <div className="empty">
            {clashes.failures.length === clashes.pairs ? 'Interference check failed.' : 'Interference check incomplete.'}
            {' '}{clashes.failures.length} {clashes.failures.length === 1 ? 'pair' : 'pairs'} could not be checked.
          </div>}
          {clashes.clashes.map(pair)}
          {clashes.failures.map(failure => <div key={failure.a + ':' + failure.b}>
            {pair(failure)}
            <div className="empty">{failure.error.detail || failure.error.hint || failure.error.title}</div>
          </div>)}
        </>}
      </aside>;
}
