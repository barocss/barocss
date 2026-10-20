// A part's cut list (FR4a, D127): a row a group of identical members — quantity, section, material, axis length, long
// point, each end's cut, mass — the totals, and its CSV. The densities are the materials library's estimates.
import { cutListCsv, type CutEnd } from '@barocss/cad';
import type { PartCutList } from '../app/cutList';
import { downloadBytes } from './files';
import { Icon } from './atoms';

const f3 = (v: number) => String(Math.round(v * 1000) / 1000);
/** An end's cut in words: square, a mitre and bevel, or what finishes it where it is no plane. */
export function cutText(e: CutEnd): string {
  if (e.kind === 'square' || e.kind === 'through') return 'square';
  if (e.mitreDegrees === null) return e.kind;
  return `${e.kind} ${f3(e.mitreDegrees)}°${e.bevelDegrees ? `, bevel ${f3(e.bevelDegrees)}°` : ''}`;
}

export function CutListDialog({ list, name, onClose }: { list: PartCutList; name: string; onClose: () => void }) {
  // (The CSV names each row's pieces by their bodies' names.)
  const exportCsv = () => downloadBytes(new TextEncoder().encode(cutListCsv({ ...list, rows: list.rows.map(r => ({ ...r, pieces: r.pieces.map(k => list.names[k] ?? k) })) })), `${name}-cut-list.csv`, 'text/csv');
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
      <div className="row-actions">
        <button className="primary" aria-label="Export cut list CSV" onClick={exportCsv} title="A row a group: quantity, section, material, lengths in mm, each end's cut, mass in kg">CSV</button>
        <button className="ghost" aria-label="Close the cut list" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}
