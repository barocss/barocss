import { useEffect, useRef, useState } from 'react';
import type { ApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { readSavedApprovalArtifact, type bindSavedApproval } from '../storage/savedApprovalEvidence';

export type ApprovalEvidenceAttachment = {
  file: ApprovalEvidenceFile; part: string; versionIds: readonly string[]; snapshots: readonly string[];
  documentIsCurrent(): boolean;
  isCurrent(): boolean;
};

export function useApprovalEvidenceAttachment(enabled: boolean, ownerKey: () => string | undefined) {
  const generation = useRef(0);
  const [pending, setPending] = useState<ApprovalEvidenceAttachment>();
  const scope = useRef({ enabled, ownerKey });
  scope.current = { enabled, ownerKey };
  const owner = enabled ? ownerKey() : undefined;
  useEffect(() => {
    setPending(prior => prior?.isCurrent() ? prior : undefined);
  }, [owner]);

  async function attach(review: ReturnType<typeof bindSavedApproval>) {
    const current = () => scope.current.enabled && !!owner && scope.current.ownerKey() === owner;
    if (!current()) return false;
    const ticket = ++generation.current;
    const read = await readSavedApprovalArtifact(review);
    if (!read || 'error' in read || !current() || generation.current !== ticket) return false;
    const { from, to, part } = review.context;
    setPending({ file: read.file, part, versionIds: [from.id, to.id], snapshots: [from.snapshot, to.snapshot], documentIsCurrent: current,
      isCurrent: () => current() && generation.current === ticket });
    return true;
  }

  function clear(attachment: ApprovalEvidenceAttachment) {
    if (pending !== attachment || !attachment.isCurrent()) return;
    generation.current++;
    setPending(undefined);
  }

  return { attach, selected: pending?.isCurrent() ? pending : undefined, clear };
}
