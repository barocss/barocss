import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { TaskRunDecision } from '../chat/taskRunOffer';
import type { CandidateReview } from '../files/taskCandidateReview';

export function CandidateReviewSection({ review, shown, available, toggle, decide }: {
  review: CandidateReview; shown: boolean; available: boolean; toggle(): void; decide?(decision: TaskRunDecision): Promise<void>;
}) {
  const [deciding, setDeciding] = useState<TaskRunDecision>();
  const [error, setError] = useState('');
  const canDecide = available && shown && !deciding;
  async function decideCandidate(action: TaskRunDecision) {
    if (!decide || !canDecide) return;
    setDeciding(action);
    setError('');
    try { await decide(action); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not record the candidate decision.'); }
    finally { setDeciding(undefined); }
  }
  const dimension = { height: 'Height', width: 'Width', depth: 'Depth', diameter: 'Diameter' }[review.field];
  const volume = review.preview.volumeChange;
  const delta = volume === null ? null : Math.round(volume * 1000) / 1000;
  return <section className="my-2 text-[11px]" aria-label="Worker candidate review">
    <strong>{shown ? 'Candidate preview' : 'Worker candidate review'}</strong>
    <div>Task {review.taskId} · {review.occurrence}/{review.feature}</div>
    <div>Candidate <code>{review.candidateDigest.slice(0, 12)}</code></div>
    <div>Attempt <code>{review.attemptId}</code></div>
    <div>{review.localRun ? 'Awaiting decision' : 'Awaiting decision at export. Decide in the local run.'}</div>
    <div>{dimension} · {review.beforeMm} mm → {review.candidateMm} mm</div>
    {delta !== null && <div>Volume change · {delta > 0 ? '+' : ''}{delta} mm³</div>}
    <ul className="m-0 list-none p-0" aria-label="Candidate checks">
      {review.checks.map(check => <li key={check.id}>
        <strong>{check.id}</strong> · {check.status === 'pass' ? 'Pass' : check.status === 'fail' ? 'Fail' : 'Unknown'} · {check.expected}
      </li>)}
    </ul>
    <Button type="button" variant="ghost" size="xs" disabled={!available || !!deciding} onClick={toggle}>
      {shown ? 'Show accepted model' : 'Preview candidate'}
    </Button>
    {decide && <>
      <Button type="button" size="xs" disabled={!canDecide} onClick={() => void decideCandidate('approve')}>
        {deciding === 'approve' ? 'Approving…' : 'Approve candidate'}
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={!canDecide} onClick={() => void decideCandidate('reject')}>
        {deciding === 'reject' ? 'Rejecting…' : 'Reject candidate'}
      </Button>
    </>}
    {error && <div role="status">{error}</div>}
  </section>;
}
