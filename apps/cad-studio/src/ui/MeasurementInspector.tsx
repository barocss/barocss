import type { Dispatch, SetStateAction } from 'react';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Selection } from '@barocss/cad-model/app/commands';
import { measureItem, type measureBetween, type MeasurePick } from '@barocss/cad-model/app/measure';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon, Kbd } from './atoms';
import { measureQuantityText } from './quantityText';
import type { InterferenceReport } from '../app/checkInterference';
interface MeasurementInspectorProps { bodies: BodyResult[]; measure: MeasurePick[]; measured: ReturnType<typeof measureBetween> | null; setMeasure: Dispatch<SetStateAction<MeasurePick[] | null>> }
export function MeasurementInspector({ bodies, measure, measured, setMeasure }: MeasurementInspectorProps) {
  return <aside className="card props" aria-label="Measurement">
        <div className="card-title">MEASURE <ToolIconButton size="tiny" aria-label="Done measuring" onClick={() => setMeasure(null)}><Icon name="close" small /></ToolIconButton></div>
        {measure.map((m, k) => { const b = bodies[m.body]; if (!b) return null; const it = measureItem(b.mesh, m); return <div key={k} className="measure-item">
          <div className="kv">{k ? 'To' : 'From'} <b>{it.label}</b></div>
          {it.length !== undefined && <div className="kv">Length <b>{measureQuantityText(it.length, 2)} mm</b></div>}
          {it.area !== undefined && <div className="kv">Area <b>{measureQuantityText(it.area, 2)} mm²{it.areaBasis === 'display mesh' ? ' (mesh)' : ''}</b></div>}
          {it.radius !== undefined && <div className="kv">Radius <b>{measureQuantityText(it.radius, 3)} mm</b></div>}
        </div>; })}
        {measured && <>
          <div className="card-title" style={{ marginTop: 10 }}>BETWEEN</div>
          <div className="kv">Distance <b>{measureQuantityText(measured.distance, 3)} mm</b></div>
          {measured.normalDistance !== undefined && <div className="kv">Normal distance <b>{measureQuantityText(measured.normalDistance, 3)} mm</b></div>}
          {measured.angle !== undefined && <div className="kv">Angle <b>{measureQuantityText(measured.angle, 2)}°</b></div>}
          {measured.axes && <div className="kv" aria-label="Axes">Axes <b>{measured.axes.coaxial ? 'coaxial' : `${measureQuantityText(measured.axes.angle, 3)}° apart, ${measureQuantityText(measured.axes.offset, 3)} mm off`}</b></div>}
          <div className="kv">ΔX ΔY ΔZ <b>{measured.b.map((v, k) => measureQuantityText(v - measured.a[k], 2)).join(', ')}</b></div>
        </>}
        <div className="empty">{measure.length < 2 ? `Click a face or an edge to measure ${measure.length ? 'to' : 'from'}.` : 'Click again to start over.'} <Kbd>Esc</Kbd> done</div>
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
