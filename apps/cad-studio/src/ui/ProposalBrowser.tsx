import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { ToolIconButton } from '@/components/ui/tool-button';
import type { useProposalPreview } from '../state/useProposalPreview';
import { Icon } from './atoms';
interface ProposalBrowserProps {
  controller: ReturnType<typeof useProposalPreview>;
  doc: import('@barocss/cad-model/engine/doc').StudioDoc;
  bodies: BodyResult[];
  fresh: boolean;
  massReady: boolean;
  decidedShown: boolean;
  setDecidedShown: Dispatch<SetStateAction<boolean>>;
}
const volumeOf = (list: readonly BodyResult[]) => list.reduce((s, b) => s + (b.volume ?? 0), 0);
export function ProposalBrowser({ controller, doc, bodies, fresh, massReady, decidedShown, setDecidedShown }: ProposalBrowserProps) {
  const { ghost, proposalBusy, hashNow, showProposal, rebaseIt, tickPart, flipGhost, acceptIt, rejectIt } = controller;
  return <>{!!doc.proposals?.length && <div className="chat-proposals" role="list" aria-label="Proposals"><div className="ol-head req-head">Proposals <span className="muted">{doc.proposals.filter(p => p.status === 'open').length} open</span>
          <ToolIconButton size="tiny" state={decidedShown ? 'on' : 'idle'} aria-label="Show decided proposals" data-tip={decidedShown ? 'Open only' : 'Show accepted and rejected'} onClick={() => setDecidedShown(f => !f)}><Icon name="history" small /></ToolIconButton></div>
        {doc.proposals.filter(p => decidedShown || p.status === 'open').map(p => {
          const shown = ghost?.id === p.id, stale = p.status === 'open' && p.base !== hashNow, dv = shown ? volumeOf(ghost.bodies) - volumeOf(bodies) : 0, base = volumeOf(bodies);
          return <div key={p.id} className={'proposal ' + p.status + ' risk-' + p.risk.level} role="listitem" aria-label={`Proposal ${p.id}`}>
            <div className="proposal-title"><b>{p.id}</b> {p.title} <span className={'risk-badge ' + p.risk.level} title={`${p.risk.features_touched} features touched · ${p.risk.references_broken} references broken${p.risk.hard_requirements_changed.length ? ` · hard requirements ${p.risk.hard_requirements_changed.join(', ')}` : ''}${p.risk.approval.length ? ` · always needs approval: ${p.risk.approval.join(', ')}` : ''}`}>{p.risk.level} risk</span></div>
            <div className="muted">{stale ? <b className="stale">stale · </b> : p.rebased ? 'rebased · ' : ''}{p.summary}{p.risk.references_broken ? ` · ${p.risk.references_broken} reference${p.risk.references_broken > 1 ? 's' : ''} broken` : ''}{p.risk.hard_requirements_changed.length ? ` · hard ${p.risk.hard_requirements_changed.join(', ')}` : ''}{p.risk.approval.length ? ` · needs you (${p.risk.approval.join(', ')})` : ''} · {p.by.agent}{p.by.model ? ` (${p.by.model})` : ''}</div>
            {p.plan && <div className="proposal-plan">{p.plan}</div>}
            {shown && fresh && !massReady && <div className="mono proposal-dv">{ghost.after ? 'after' : 'before'} · volume <span aria-label="Volume change">…</span></div>}
            {shown && fresh && massReady && <div className="mono proposal-dv">{ghost.after ? 'after' : 'before'} · volume <span aria-label="Volume change">{dv >= 0 ? '+' : '−'}{fmt(Math.abs(dv))} mm³{base ? ` (${dv >= 0 ? '+' : '−'}${fmt(Math.abs(dv) / base * 100)}%)` : ''}</span></div>}
            {shown && ghost.parts.length > 1 && <div className="proposal-parts" role="group" aria-label={`${p.id} features`}>{ghost.parts.map(q => <label key={q.id} className={'proposal-part ' + q.kind}>
              <input type="checkbox" aria-label={`Keep ${q.id}`} disabled={q.kind === 'deleted' || proposalBusy} checked={!ghost.leaveOut.includes(q.id)} onChange={e => void tickPart(q.id, e.currentTarget.checked)} />
              <span className="mono">{q.id}</span> {q.kind === 'added' ? '+' : q.kind === 'changed' ? '~' : '−'} {q.label}</label>)}</div>}
            {p.status === 'open' ? <div className="proposal-actions">
              <button className={'ghost small' + (shown ? ' on' : '')} disabled={proposalBusy || stale} onClick={() => void showProposal(p)}>{shown ? 'Hide' : 'Preview'}</button>
              {shown && <button className="ghost small" aria-label="Before or after" onClick={flipGhost}>{ghost.after ? 'After' : 'Before'}</button>}
              <span className="grow" />
              <button className="ghost small" disabled={proposalBusy} onClick={() => rejectIt(p)}>Reject</button>
              {stale ? <button className="primary small" disabled={proposalBusy} title="The part changed since this was proposed: make it again on the part as it is, and look before accepting" onClick={() => void rebaseIt(p)}>Rebase &amp; preview</button>
                : <button className="primary small" disabled={proposalBusy} onClick={() => void acceptIt(p)}>{shown && ghost.leaveOut.length ? `Accept ${ghost.parts.length - ghost.leaveOut.length} of ${ghost.parts.length}` : 'Accept'}</button>}
            </div> : <div className="muted">{p.status} by {p.decided?.by}{p.decided?.note ? ` · ${p.decided.note}` : ''}</div>}
          </div>;
        })}</div>}</>;
}
