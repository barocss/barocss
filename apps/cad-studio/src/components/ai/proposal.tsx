import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// A proposal the agent made, linked from its `propose` call in the chat (O17): the document's proposal itself — its title,
// its risk as a chip and its status now — with Reject and Accept while it is open, as in the Proposals list. The
// document stays the authority: deciding here is deciding there. A stale one is made again from the list (Rebase).
function ProposalLink({ proposal: p, stale, busy, onAccept, onReject }: { proposal: Proposal; stale: boolean; busy: boolean; onAccept(): void; onReject(): void }) {
  return <div data-slot="proposal-link" className={cn('chat-proposal', 'flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1')} aria-label={`Proposal ${p.id} from the chat`}>
    <span className="mono">{p.id}</span><span className="min-w-0 flex-1 truncate" title={p.title}>{p.title}</span>
    <Badge variant={p.risk.level === 'high' ? 'destructive' : p.risk.level === 'medium' ? 'secondary' : 'outline'}>{p.risk.level} risk</Badge>
    {p.status !== 'open' ? <Badge variant="outline">{p.status}</Badge>
      : stale ? <span className="muted">changed since: rebase it in Proposals</span>
      : <><button className="ghost small" disabled={busy} onClick={onReject}>Reject</button><button className="primary small" disabled={busy} onClick={onAccept}>Accept</button></>}
  </div>;
}

export { ProposalLink };
