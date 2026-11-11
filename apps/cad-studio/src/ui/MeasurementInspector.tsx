import type { Dispatch, SetStateAction } from 'react';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Selection } from '@barocss/cad-model/app/commands';
import { measureItem, type measureBetween, type MeasurePick } from '@barocss/cad-model/app/measure';
import { bodyName } from '@barocss/cad-model/app/bodies';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon, Kbd } from './atoms';
import { measureQuantityText } from './quantityText';
interface MeasurementInspectorProps { bodies: BodyResult[]; measure: MeasurePick[]; measured: ReturnType<typeof measureBetween> | null; setMeasure: Dispatch<SetStateAction<MeasurePick[] | null>> }
export function MeasurementInspector({ bodies, measure, measured, setMeasure }: MeasurementInspectorProps) {
  return <aside className="card props" aria-label="Measurement">
        <div className="card-title">MEASURE <ToolIconButton size="tiny" aria-label="Done measuring" onClick={() => setMeasure(null)}><Icon name="close" small /></ToolIconButton></div>
        {measure.map((m, k) => { const b = bodies[m.body]; if (!b) return null; const it = measureItem(b.mesh, m); return <div key={k} className="measure-item">
          <div className="kv">{k ? 'To' : 'From'} <b>{it.label}</b></div>
          {it.length !== undefined && <div className="kv">Length <b>{measureQuantityText(it.length, 2)} mm</b></div>}
          {it.area !== undefined && <div className="kv">Area <b>{measureQuantityText(it.area, 2)} mm²</b></div>}
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

export type InterferenceResult = { a: string; b: string; volume: number }[] | 'busy';
interface InterferenceInspectorProps { doc: StudioDoc; bodies: BodyResult[]; clashes: InterferenceResult; setClashes(value: null): void; setSelection: Dispatch<SetStateAction<Selection>> }
export function InterferenceInspector({ doc, bodies, clashes, setClashes, setSelection }: InterferenceInspectorProps) {
  return <aside className="card props" aria-label="Interference">
        <div className="card-title">INTERFERENCE <ToolIconButton size="tiny" aria-label="Close interference" onClick={() => setClashes(null)}><Icon name="close" small /></ToolIconButton></div>
        {clashes === 'busy' ? <div className="empty">Checking…</div> : !clashes.length ? <div className="empty">No bodies overlap.</div>
          : clashes.map(c => { const ia = bodies.findIndex(b => b.key === c.a), ib = bodies.findIndex(b => b.key === c.b); return (
            <button key={c.a + c.b} className="ol clash" onClick={() => { if (ia >= 0 && ib >= 0) setSelection({ faces: [], edges: [], bodies: [ia, ib] }); }}>
              <Icon name="warning" small />{ia >= 0 ? bodyName(doc, bodies[ia]) : c.a} ∩ {ib >= 0 ? bodyName(doc, bodies[ib]) : c.b}<span className="muted"> · {fmt(Math.round(c.volume * 10) / 10)} mm³</span></button>); })}
      </aside>;
}
