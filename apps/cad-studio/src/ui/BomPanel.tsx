// The BOM panel (O147, B1): the part's or assembly's bill of materials — its placed parts' lines and the bought
// elements' lines (S1: merged by kind, size and row over copies), the made elements below them — with each element
// line's bought/made choice (the `bought` override on every node the line merges, one undoable change) and the purchase
// list as CSV (the bought lines; with made parts on a tick). Its evaluations go through the engine worker.
import { useEffect, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { bomPanelData, purchaseCsv, setBought, type BomPanelData } from '@barocss/cad-model/team/bom';
import { downloadBytes } from './files';
import { Icon } from './atoms';

type Choice = 'bought' | 'made' | 'default';
const valueOf = (c: Choice) => c === 'bought' ? true : c === 'made' ? false : null;
const fmt = (x: number) => `${+x.toFixed(1)}`;

export function BomPanel({ doc, name, evaluate, onCommit, onError, onClose }: {
  doc: StudioDoc; name: string; evaluate(doc: StudioDoc): Promise<EvalResult | null>;
  onCommit(next: StudioDoc): void; onError(title: string, message: string): void; onClose(): void;
}) {
  const [data, setData] = useState<BomPanelData | null>(null);
  const [withMade, setWithMade] = useState(false);
  // (Worked out again when the model changes; a later answer replaces an earlier one only if it is the latest.)
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { bomPanelData(doc, evaluate, name).then(d => { if (live) setData(d); }, e => { if (live) onError('Could not work out the BOM', e instanceof Error ? e.message : String(e)); }); }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [doc.nodes, doc.instances, name]);
  const why = (parts: readonly string[]) => (data?.view.elements ?? []).filter(e => parts.includes(`${e.part}:${e.item}`)).flatMap(e => e.why).filter((w, i, a) => a.indexOf(w) === i).join('; ');
  const choose = (parts: readonly string[], c: Choice) => onCommit(setBought(doc, parts, valueOf(c)));
  const copies = (n: number) => n > 1 ? ` — applies to all ${n} copies` : '';
  const toggle = (parts: readonly string[], current: Choice, label: string) => (
    <select className="kv-input" aria-label={`Bought or made: ${label}`} value={current} title={`Bought or made${copies(parts.length)}; Default: by its kind`} onChange={e => choose(parts, e.currentTarget.value as Choice)}>
      <option value="bought">bought</option><option value="made">made</option><option value="default">default</option></select>);
  const csv = () => { if (data) downloadBytes(new TextEncoder().encode(purchaseCsv(data, withMade)), `${name} purchase list.csv`, 'text/csv'); };
  return <aside className="card props bom-panel" aria-label="BOM panel">
    <div className="card-title">BILL OF MATERIALS <button className="tool tiny" aria-label="Close BOM" onClick={onClose}><Icon name="close" small /></button></div>
    {!data && <div className="empty">Working out the BOM…</div>}
    {data && <>
      <table className="bom-table" aria-label="BOM lines">
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Row</th><th>Source</th><th /></tr></thead>
        <tbody>{data.bom.lines.map((l, k) => {
          // (A plate — a gusset, an end cap — may be set bought too: a laser-cut plate ordered in, FRk1.)
          const element = l.kind !== undefined || !!l.plate, w = l.kind !== undefined ? why(l.parts) : '';
          return <tr key={k} aria-label={`BOM line ${k + 1}`}>
            <td className="mono">{k + 1}</td>
            <td title={l.size ?? ''}>{l.item}</td>
            <td className="mono">{l.qty}</td>
            <td>{[l.row, l.catalogue].filter(Boolean).join(' · ') || '—'}</td>
            <td title={w}>{l.source}{l.source && l.estimate ? ' · ' : ''}{l.estimate ? <span className="warn">estimate</span> : (!l.source ? '—' : null)}</td>
            <td>{element ? toggle(l.parts, l.override ? 'bought' : 'default', l.item) : <span className="muted small">{l.source ? 'catalogue part' : 'made'}</span>}</td>
          </tr>;
        })}</tbody>
      </table>
      {!!data.made.length && <>
        <div className="card-title" style={{ marginTop: 8 }}>MADE ELEMENTS</div>
        <table className="bom-table" aria-label="Made elements">
          <tbody>{data.made.map((m, k) => <tr key={k} aria-label={`Made element ${m.item}`}>
            <td>{m.item}</td><td className="mono">{m.qty}</td><td>{m.row ?? '—'}</td>
            <td>{toggle(m.parts, m.override ? 'made' : 'default', m.item)}</td></tr>)}</tbody>
        </table>
      </>}
      <div className="muted small" aria-label="BOM totals">{data.bom.totalQty} part{data.bom.totalQty === 1 ? '' : 's'} · {data.bom.elementQty ?? 0} bought element{data.bom.elementQty === 1 ? '' : 's'} · {fmt(data.bom.totalMassG)} g (the parts')</div>
      <div className="row-actions">
        <label className="field"><span>With made parts</span><input type="checkbox" className="check" aria-label="Purchase list with made parts" checked={withMade} onChange={e => setWithMade(e.currentTarget.checked)} /></label>
        <button className="ghost small" aria-label="Export purchase list" onClick={csv}>Export purchase list</button>
      </div>
    </>}
  </aside>;
}
