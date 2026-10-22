// A part's cut list (FR4a, D127): a row a group of identical members — quantity, section, material, axis length, long
// point, each end's cut, mass — the totals, and its CSV. The densities are the materials library's estimates. FRb
// (O116): with the shop's stock lengths loaded, the pieces nested into them — the bars, the waste, the kerf and its CSV.
import { cutListCsv, type CutEnd } from '@barocss/cad';
import type { PartCutList } from '@barocss/cad-model/app/cutList';
import { nestingCsv, type NestResult } from '@barocss/cad-model/frames/nesting';
import { downloadBytes } from './files';
import { Icon } from './atoms';

const f3 = (v: number) => String(Math.round(v * 1000) / 1000);
/** An end's cut in words: square, a mitre and bevel, or what finishes it where it is no plane. */
export function cutText(e: CutEnd): string {
  const cut = e.kind === 'square' || e.kind === 'through' ? 'square' : e.mitreDegrees === null ? e.kind : `${e.kind} ${f3(e.mitreDegrees)}°${e.bevelDegrees ? `, bevel ${f3(e.bevelDegrees)}°` : ''}`;
  const gap = e.gapMM ? ` · gap ${f3(e.gapMM) === '0' ? String(e.gapMM) : f3(e.gapMM)} mm` : '';
  const notch = e.notch ? e.notch.kind === 'holesaw' ? ` · hole saw Ø${f3(e.notch.diameterMM)} mm, offset ${f3(e.notch.offsetMM)} mm` : ` · V depth ${f3(e.notch.depthMM)} mm, angle ${f3(e.notch.angleDegrees)}°` : '';
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
      <div className="toast-hint">{list.totals.quantity} piece{list.totals.quantity === 1 ? '' : 's'} in {list.rows.length} row{list.rows.length === 1 ? '' : 's'} · {f3(list.totals.axisLengthMM)} mm · {f3(list.totals.massKG)} kg</div>
      <table className="cut-list-table" aria-label="Cut list rows">
        <thead><tr><th>#</th><th>Qty</th><th>Section</th><th>Material</th><th>Length</th><th>Long point</th><th>Start</th><th>End</th><th>Mass each</th></tr></thead>
        <tbody>{list.rows.map(r => <tr key={r.item}>
          <td>{r.item}</td><td>{r.quantity}</td><td>{r.section}{r.mirrored ? ' (mirrored)' : ''}</td><td>{r.material ?? list.material}</td>
          <td>{f3(r.axisLengthMM)}{r.fromVolume ? ' (by volume)' : ''}</td><td>{f3(r.longPointMM)}</td><td>{cutText(r.ends[0])}</td><td>{cutText(r.ends[1])}</td><td>{f3(r.massKG)} kg</td>
        </tr>)}</tbody>
      </table>
      <div className="hint warn"><Icon name="warning" small /> Masses use the materials library's densities, estimates — not your stock's.</div>
      {n ? <div className="toast-hint" aria-label="Nesting">
        Nested: {n.totals.bars} bar{n.totals.bars === 1 ? '' : 's'} · {f3(n.totals.stockMM)} mm of stock · waste {f3(n.totals.wasteMM)} mm · kerf {f3(n.kerf.mm)} mm{n.kerf.basis === 'estimate' ? ' (an estimate)' : ''}
        {n.sections.map(x => <div key={x.section}>{x.section}: {x.method === 'exact' ? 'exact' : 'first-fit-decreasing'}{x.optimal ? ', optimal' : `, at most ${f3(x.stockMM - x.lowerBoundMM)} mm over the bound`}</div>)}
        {n.unplaced.length ? <div className="hint warn">Not placed: {n.unplaced.map(p => `${p.name} (${p.code === 'NEST_TOO_LONG' ? 'longer than every stock length' : 'stock counts spent'})`).join(', ')}</div> : null}
      </div> : nesting && !nesting.ok && nesting.code === 'NEST_NO_STOCK' ? <div className="toast-hint" aria-label="Nesting">No stock lengths loaded — none is built in: the agent's features.frame_stock, or cad-cli nest --list.</div> : null}
      <div className="row-actions">
        <button className="primary" aria-label="Export cut list CSV" onClick={exportCsv} title="A row a group: quantity, section, material, lengths in mm, each end's cut, mass in kg">CSV</button>
        {n ? <button className="ghost" aria-label="Export nesting CSV" onClick={exportNesting} title="A line a bar: its stock, the pieces, the kerf and the offcut; then the totals">Nesting CSV</button> : null}
        <button className="ghost" aria-label="Close the cut list" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}
