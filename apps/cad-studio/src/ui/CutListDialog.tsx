// A part's cut list (FR4a, D127): a row a group of identical members — quantity, section, material, axis length, long
// point, each end's cut, mass — the totals, and its CSV. The densities are the materials library's estimates. FRb
// (O116): with the shop's stock lengths loaded, the pieces nested into them — the bars, the waste, the kerf and its CSV.
// O16: its table and actions on shadcn's Table and Button; the dialog's box is the studio's (G12f's shell).
import { cutListCsv, type CutEnd } from '@barocss/cad';
import type { PartCutList } from '@barocss/cad-model/app/cutList';
import { nestingCsv, type NestResult } from '@barocss/cad-model/frames/nesting';
import { downloadBytes } from './files';
import { Icon } from './atoms';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const f3 = (v: number) => String(Math.round(v * 1000) / 1000);
/** An end's cut in words: square, a mitre and bevel, or what finishes it where it is no plane. */
export function cutText(e: CutEnd): string {
  const cut = e.kind === 'square' || e.kind === 'through' ? 'square' : e.mitre === null ? e.kind : `${e.kind} ${f3(e.mitre)}°${e.bevel ? `, bevel ${f3(e.bevel)}°` : ''}`;
  const gap = e.gap ? ` · gap ${f3(e.gap) === '0' ? String(e.gap) : f3(e.gap)} mm` : '';
  const notch = e.notch ? e.notch.kind === 'holesaw' ? ` · hole saw Ø${f3(e.notch.diameter)} mm, offset ${f3(e.notch.offset)} mm` : ` · V depth ${f3(e.notch.depth)} mm, angle ${f3(e.notch.angle)}°` : '';
  return cut + gap + notch;
}

export function CutListDialog({ list, nesting, name, onClose }: { list: PartCutList; nesting?: NestResult; name: string; onClose: () => void }) {
  // (The CSV names each row's pieces by their bodies' names.)
  const exportCsv = () => downloadBytes(new TextEncoder().encode(cutListCsv({ ...list, rows: list.rows.map(r => ({ ...r, pieces: r.pieces.map(k => list.names[k] ?? k) })) })), `${name}-cut-list.csv`, 'text/csv');
  const n = nesting?.ok ? nesting.nesting : null;
  const exportNesting = () => { if (n) downloadBytes(new TextEncoder().encode(nestingCsv(n)), `${name}-nesting.csv`, 'text/csv'); };
  return <div className="toast card recovery cut-list" role="dialog" aria-label="Cut list">
    <Icon name="list" className="accent" />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="toast-title">Cut list · {name}</div>
      <div className="toast-hint">{list.totals.quantity} piece{list.totals.quantity === 1 ? '' : 's'} in {list.rows.length} row{list.rows.length === 1 ? '' : 's'} · {f3(list.totals.axisLength)} mm · {f3(list.totals.mass)} g</div>
      {/* (O16: shadcn's Table at its content's width — a dialog, not the dock: nothing truncated.) */}
      <Table className="cut-list-table my-2 table-auto text-xs tabular-nums" aria-label="Cut list rows">
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Qty</TableHead><TableHead>Section</TableHead><TableHead>Material</TableHead><TableHead>Length</TableHead><TableHead>Long point</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Mass each</TableHead></TableRow></TableHeader>
        <TableBody>{list.rows.map(r => <TableRow key={r.item}>
          <TableCell>{r.item}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{r.section}{r.mirrored ? ' (mirrored)' : ''}</TableCell><TableCell>{r.material ?? list.material}</TableCell>
          <TableCell>{f3(r.axisLength)}{r.fromVolume ? ' (by volume)' : ''}</TableCell><TableCell>{f3(r.longPoint)}</TableCell><TableCell>{cutText(r.ends[0])}</TableCell><TableCell>{cutText(r.ends[1])}</TableCell><TableCell>{f3(r.mass)} g</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <div className="hint warn"><Icon name="warning" small /> Masses use the materials library's densities, estimates — not your stock's.</div>
      {n ? <div className="toast-hint" aria-label="Nesting">
        Nested: {n.totals.bars} bar{n.totals.bars === 1 ? '' : 's'} · {f3(n.totals.stock)} mm of stock · waste {f3(n.totals.waste)} mm · kerf {f3(n.kerf.value)} mm{n.kerf.basis === 'estimate' ? ' (an estimate)' : ''}
        {n.sections.map(x => <div key={x.section}>{x.section}: {x.method === 'exact' ? 'exact' : 'first-fit-decreasing'}{x.optimal ? ', optimal' : `, at most ${f3(x.stock - x.lowerBound)} mm over the bound`}</div>)}
        {n.unplaced.length ? <div className="hint warn">Not placed: {n.unplaced.map(p => `${p.name} (${p.code === 'NEST_TOO_LONG' ? 'longer than every stock length' : 'stock counts spent'})`).join(', ')}</div> : null}
      </div> : nesting && !nesting.ok && nesting.code === 'NEST_NO_STOCK' ? <div className="toast-hint" aria-label="Nesting">No stock lengths loaded — none is built in: the agent's features.frame_stock, or cad-cli nest --list.</div> : null}
      <div className="flex flex-wrap gap-1">
        <Button variant="default" aria-label="Export cut list CSV" onClick={exportCsv} title="A row a group: quantity, section, material, lengths in mm, each end's cut, mass in kg">CSV</Button>
        {n ? <Button variant="ghost" aria-label="Export nesting CSV" onClick={exportNesting} title="A line a bar: its stock, the pieces, the kerf and the offcut; then the totals">Nesting CSV</Button> : null}
        <Button variant="ghost" aria-label="Close the cut list" onClick={onClose}>Close</Button>
      </div>
    </div>
  </div>;
}
