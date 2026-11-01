import { fmt } from '@barocss/cad-model/engine/doc';
import type { NestedCard } from '../assembly/nestedSelection';

/** A part inside a sub-assembly (roadmap 10 ②c), read only: its path, bodies, definition and placement in its sub-assembly. */
export function NestedPartPanel({ card }: { card: NestedCard }) {
  const num = (v: readonly number[]) => v.map(x => fmt(Math.round(x * 1000) / 1000)).join(', ');
  return (
    <aside className="card props" aria-label="Nested part">
      <div className="card-title">PART IN SUB-ASSEMBLY</div>
      <div className="kv">Part <b>{card.title}</b></div>
      <div className="kv">Path <b data-testid="nested-path">{card.path}</b></div>
      <div className="kv">Bodies <b>{card.pending || card.unavailable ? '…' : card.bodies}</b></div>
      {card.unavailable && <div className="kv muted small" role="status">This part cannot be shown yet: its sub-assembly does not fold at the moment.</div>}
      {!card.pending && <div className="kv">Volume <b>{card.volume === null ? '…' : `${fmt(Math.round(card.volume))} mm³`}</b></div>}
      {card.part ? <>
        <div className="kv">Definition <b>{card.part.id} · Rev {card.part.rev}</b></div>
        {card.part.source && <div className="kv muted small">From {card.part.source}</div>}
      </> : <div className="kv">Definition <b>its own</b></div>}
      <div className="card-title" style={{ marginTop: 8 }}>PLACED IN {card.placement.in.toUpperCase()}</div>
      <div className="kv">Position (mm) <b>{num(card.placement.position)}</b></div>
      <div className="kv">Rotation (°) <b>{num(card.placement.rotation)}</b></div>
      <div className="kv muted small">Not edited in place: select {card.host.name} and use Edit part to open the sub-assembly, or New revision… there.</div>
    </aside>
  );
}
