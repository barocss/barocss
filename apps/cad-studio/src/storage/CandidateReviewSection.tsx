import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { CandidateReview } from '../files/taskCandidateReview';

export function CandidateReviewSection({ review, shown, available, toggle, approve }: {
  review: CandidateReview; shown: boolean; available: boolean; toggle(): void; approve?(): Promise<void>;
}) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  async function approveCandidate() {
    if (!approve || !shown || !available || approving) return;
    setApproving(true);
    setError('');
    try { await approve(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not approve the worker candidate.'); }
    finally { setApproving(false); }
  }
  const volume = review.preview.volumeChange;
  const delta = volume === null ? null : Math.round(volume * 1000) / 1000;
  return <section className="my-2 text-[11px]" aria-label="Worker candidate review">
    <strong>{shown ? 'Candidate preview' : 'Worker candidate review'}</strong>
    <div>Task {review.taskId} · {review.occurrence}/{review.feature}</div>
    <div>Candidate <code>{review.candidateDigest.slice(0, 12)}</code></div>
    <div>Attempt <code>{review.attemptId}</code></div>
    <div>{review.localRun ? 'Awaiting decision' : 'Awaiting decision at export. Decide in the local run.'}</div>
    <div>{review.field === 'width' ? 'Width' : 'Height'} · {review.beforeMm} mm → {review.candidateMm} mm</div>
    {delta !== null && <div>Volume change · {delta > 0 ? '+' : ''}{delta} mm³</div>}
    <ul className="m-0 list-none p-0" aria-label="Candidate checks">
      {review.checks.map(check => <li key={check.id}>
        <strong>{check.id}</strong> · {check.status === 'pass' ? 'Pass' : check.status === 'fail' ? 'Fail' : 'Unknown'} · {check.expected}
      </li>)}
    </ul>
    <Button type="button" variant="ghost" size="xs" disabled={!available} onClick={toggle}>
      {shown ? 'Show accepted model' : 'Preview candidate'}
    </Button>
    {approve && <Button type="button" size="xs" disabled={!available || !shown || approving} onClick={() => void approveCandidate()}>
      {approving ? 'Approving…' : 'Approve candidate'}
    </Button>}
    {error && <div role="status">{error}</div>}
  </section>;
}
