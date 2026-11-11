import { useEffect, useRef, useState } from 'react';
import { identifyNestedFaceRepair, type NestedFaceRepair } from '@barocss/cad-model/chat/nestedFaceRepair';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { Button } from '@/components/ui/button';
import { readSavedApprovalArtifact } from './savedApprovalEvidence';

type Review = Parameters<typeof readSavedApprovalArtifact>[0];
export type PrepareFaceRepair = (doc: StudioDoc, repair: NestedFaceRepair) => Promise<boolean>;

export function SavedFaceReferenceRepair({ review, doc, requirement, prepare }: {
  review: Review; doc: StudioDoc; requirement: string; prepare: PrepareFaceRepair;
}) {
  const [state, setState] = useState<{ doc: StudioDoc; candidate: NestedFaceRepair | null }>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ticket = useRef(0);
  useEffect(() => () => { ticket.current++; }, []);
  const current = state?.doc === doc ? state : undefined;
  const check = async () => {
    const request = ++ticket.current;
    setBusy(true);
    setFailed(false);
    try {
      const saved = await readSavedApprovalArtifact(review);
      const after = saved && !('error' in saved) ? saved.evidence.after : undefined;
      const candidate = after && saved && !('error' in saved) ? identifyNestedFaceRepair(review.after, doc, after, requirement, {
        version: review.context.to.id, evidenceRevision: review.context.to.evidenceRevision, sha256: saved.file.sha256,
      }) : null;
      if (request === ticket.current) setState({ doc, candidate });
    } catch {
      if (request === ticket.current) setState({ doc, candidate: null });
    } finally {
      if (request === ticket.current) setBusy(false);
    }
  };
  const select = async (candidate: NestedFaceRepair) => {
    setBusy(true);
    setFailed(false);
    try { setFailed(!await prepare(doc, candidate)); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return <div className="mt-1" aria-label={`Face reference ${requirement}`}>
    {!current && <Button variant="ghost" size="xs" disabled={busy} onClick={() => void check()}>Check current face references</Button>}
    {current && !current.candidate && <div role="status">No verified replacement for the saved face.</div>}
    {current?.candidate && <Button variant="ghost" size="xs" disabled={busy} onClick={() => void select(current.candidate!)}>
      Propose {current.candidate.to}
    </Button>}
    {failed && <div role="status">Could not prepare the face repair. Check the current reference again.</div>}
  </div>;
}
