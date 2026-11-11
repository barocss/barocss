import { useEffect, useRef, useState } from 'react';
import type { ApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { readSavedApprovalArtifact, readSavedFollowUpArtifact, type SavedApprovalSource } from '../storage/savedApprovalEvidence';

export type ApprovalEvidenceAttachment = {
  file: ApprovalEvidenceFile; part: string; kind: 'approval' | 'follow-up'; versionIds: readonly string[]; snapshots: readonly string[];
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

  async function attach(source: SavedApprovalSource) {
    const current = () => scope.current.enabled && !!owner && scope.current.ownerKey() === owner;
    if (!current()) return false;
    const ticket = ++generation.current;
    const followUp = 'review' in source;
    const read = followUp ? await readSavedFollowUpArtifact(source) : await readSavedApprovalArtifact(source);
    if (!read || 'error' in read || !current() || generation.current !== ticket) return false;
    const { from, to, part } = (followUp ? source.review : source).context;
    const pins = followUp ? [from, to, source.version] : [from, to];
    setPending({ file: read.file, part, kind: followUp ? 'follow-up' : 'approval',
      versionIds: pins.map(pin => pin.id), snapshots: pins.map(pin => pin.snapshot), documentIsCurrent: current,
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
