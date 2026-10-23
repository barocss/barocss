// The BOM panel (O147, B1): the part's or assembly's bill of materials — its placed parts' lines and the bought
// elements' lines (S1: merged by kind, size and row over copies), the made elements below them — with each element
// line's bought/made choice (the `bought` override on every node the line merges, one undoable change) and the purchase
// list as CSV (the bought lines; with made parts on a tick). Its evaluations go through the engine worker. O16: its
// contents on shadcn's Table, Button and NativeSelect, the columns fixed at the dock's width and no item name wrapped —
// each cut short with its whole text as the title.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import { bomPanelData, purchaseCsv, setBought, type BomPanelData } from '@barocss/cad-model/bom/bom';
import { downloadBytes } from './files';
import { Icon } from './atoms';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Choice = 'bought' | 'made' | 'default';
const valueOf = (c: Choice) => c === 'bought' ? true : c === 'made' ? false : null;
const fmt = (x: number) => `${+x.toFixed(1)}`;

/** Match Model's active linked-housing scope without reading/repairing a possibly refused reference. */
export function bomHasLinkedHousing(doc: StudioDoc): boolean {
  return doc.nodes.some(node => node.kind === 'bearing' && !node.suppressed && node.housingRef !== undefined)
    || !!doc.instances?.some(instance => bomHasLinkedHousing(instance.doc));
}

export function BomPanel({ doc, name, evaluate, onCommit, onError, onClose }: {
  doc: StudioDoc; name: string; evaluate(doc: StudioDoc): Promise<EvalResult | null>;
  onCommit(next: StudioDoc): void; onError(title: string, message: string): void; onClose(): void;
}) {
  const linked = bomHasLinkedHousing(doc);
  const key = useMemo(() => ({}), [doc, name]);
  const current = useRef(key); current.current = key;
  const callbacks = useRef({ evaluate, onError }); callbacks.current = { evaluate, onError };
  const [result, setResult] = useState<{ key: object; linked: boolean; data: BomPanelData | null; error: string | null } | null>(null);
  const [withMade, setWithMade] = useState(false);
  // Rows, parameters, occurrence poses and deleted targets belong to the current authored root too.
  // Keep legacy partial data while unrelated documents load, but never export a previous linked result.
  const blocked = linked || !!result?.linked;
  const data = result && (result.key === key || !blocked) ? result.data : null;
  const error = result?.key === key ? result.error : null;
  useEffect(() => {
    let live = true;
    setResult(previous => ({ key, linked, data: linked || previous?.linked ? null : previous?.data ?? null, error: null }));
    const t = setTimeout(() => {
      bomPanelData(doc, callbacks.current.evaluate, name).then(data => {
        if (live && current.current === key) setResult({ key, linked, data, error: null });
      }, error => {
        if (!live || current.current !== key) return;
        const message = error instanceof Error ? error.message : String(error);
        setResult(previous => ({ key, linked, data: linked || previous?.linked ? null : previous?.data ?? null, error: message }));
        callbacks.current.onError('Could not work out the BOM', message);
      });
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [doc, name, key, linked]);
  const why = (parts: readonly string[]) => (data?.view.elements ?? []).filter(e => parts.includes(`${e.part}:${e.item}`)).flatMap(e => e.why).filter((w, i, a) => a.indexOf(w) === i).join('; ');
  const choose = (parts: readonly string[], c: Choice) => onCommit(setBought(doc, parts, valueOf(c)));
  const copies = (n: number) => n > 1 ? ` — applies to all ${n} copies` : '';
  const toggle = (parts: readonly string[], current: Choice, label: string) => (
    <NativeSelect aria-label={`Bought or made: ${label}`} value={current} title={`Bought or made${copies(parts.length)}; Default: by its kind`} onChange={e => choose(parts, e.currentTarget.value as Choice)}>
      <option value="bought">bought</option><option value="made">made</option><option value="default">default</option></NativeSelect>);
  const csv = () => { if (data && current.current === key) downloadBytes(new TextEncoder().encode(purchaseCsv(data, withMade)), `${name} purchase list.csv`, 'text/csv'); };
  return <aside className="card props bom-panel" aria-label="BOM panel">
    <div className="card-title">BILL OF MATERIALS <button className="tool tiny" aria-label="Close BOM" onClick={onClose}><Icon name="close" small /></button></div>
    {!data && !error && <div className="empty" role="status">Working out the BOM…</div>}
    {error && <div className="empty warn" role="alert">Could not work out the BOM: {error}</div>}
    {!data && blocked && <div className="row-actions"><Button variant="ghost" aria-label="Export purchase list" disabled>Export purchase list</Button></div>}
    {data && <>
      <Table className="bom-table" aria-label="BOM lines">
        <colgroup><col className="w-6" /><col /><col className="w-10" /><col className="w-[11%]" /><col className="w-[22%]" /><col className="w-[5.25rem]" /></colgroup>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Row</TableHead><TableHead>Source</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{data.bom.lines.map((l, k) => {
          // (A plate — a gusset, an end cap — may be set bought too: a laser-cut plate ordered in, FRk1.)
          // (F9: a placed fastener is bought as a part of its own — no element to mark made; its estimate's reason from its part.)
          const fastener = l.kind === 'fastener', element = (l.kind !== undefined && !fastener) || !!l.plate;
          const w = fastener ? (data.view.parts.find(p => p.id === l.parts[0])?.fastener?.why ?? []).join('; ') : l.kind !== undefined ? why(l.parts) : '';
          const row = [l.row, l.catalogue].filter(Boolean).join(' · ') || '—';
          return <TableRow key={k} aria-label={`BOM line ${k + 1}`}>
            <TableCell className="mono">{k + 1}</TableCell>
            <TableCell title={[l.item, l.size].filter(Boolean).join(' — ')}>{l.item}{l.lumps ? <span className="muted small" aria-label="Lumps"> · {l.lumps} lumps</span> : null}</TableCell>
            <TableCell className="mono">{l.qty}</TableCell>
            <TableCell title={row}>{row}</TableCell>
            <TableCell title={[l.source, w].filter(Boolean).join(' — ')}>{l.source}{l.source && l.estimate ? ' · ' : ''}{l.estimate ? <span className="warn">estimate</span> : (!l.source ? '—' : null)}</TableCell>
            <TableCell>{element ? toggle(l.parts, l.override ? 'bought' : 'default', l.item) : <span className="muted small">{fastener ? 'bought part' : l.source ? 'catalogue part' : 'made'}</span>}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      {!!data.made.length && <>
        <div className="card-title" style={{ marginTop: 8 }}>MADE ELEMENTS</div>
        <Table className="bom-table" aria-label="Made elements">
          <colgroup><col /><col className="w-10" /><col className="w-[18%]" /><col className="w-[5.25rem]" /></colgroup>
          <TableBody>{data.made.map((m, k) => <TableRow key={k} aria-label={`Made element ${m.item}`}>
            <TableCell title={m.item}>{m.item}</TableCell><TableCell className="mono">{m.qty}</TableCell><TableCell title={m.row ?? ''}>{m.row ?? '—'}</TableCell>
            <TableCell>{toggle(m.parts, m.override ? 'made' : 'default', m.item)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </>}
      <div className="muted small" aria-label="BOM totals">{data.bom.totalQty} part{data.bom.totalQty === 1 ? '' : 's'} · {data.bom.elementQty ?? 0} bought element{data.bom.elementQty === 1 ? '' : 's'} · {fmt(data.bom.totalMassG)} g (the parts')</div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 whitespace-nowrap"><input type="checkbox" className="size-3.5 accent-[var(--accent)]" aria-label="Purchase list with made parts" checked={withMade} onChange={e => setWithMade(e.currentTarget.checked)} /><span>With made parts</span></label>
        <Button variant="ghost" aria-label="Export purchase list" onClick={csv}>Export purchase list</Button>
      </div>
    </>}
  </aside>;
}
