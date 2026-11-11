import { useEffect, useRef, useState } from 'react';
import { readSavedFaceRepairAttachment } from '../storage/checkSavedFaceRepair';
import type { ApprovalAttachmentPayload } from '../storage/faceRepairEvidence';
import { readSavedApprovalArtifact, readSavedFollowUpArtifact, type SavedApprovalSource } from '../storage/savedApprovalEvidence';

export type ApprovalEvidenceAttachment = {
  payload: ApprovalAttachmentPayload; part: string; kind: 'approval' | 'follow-up' | 'face repair'; versionIds: readonly string[]; snapshots: readonly string[];
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
    const isCurrent = () => current() && generation.current === ticket;
    if ('kind' in source) {
      const read = await readSavedFaceRepairAttachment(source);
      if (!read || !isCurrent()) return false;
      setPending({ payload: read.payload, part: read.part, kind: 'face repair',
        versionIds: read.pins.map(pin => pin.id), snapshots: read.pins.map(pin => pin.snapshot), documentIsCurrent: current, isCurrent });
      return true;
    }
    const followUp = 'review' in source;
    const read = followUp ? await readSavedFollowUpArtifact(source) : await readSavedApprovalArtifact(source);
    if (!read || 'error' in read || !isCurrent()) return false;
    const { from, to, part } = (followUp ? source.review : source).context;
    const pins = followUp ? [from, to, source.version] : [from, to];
    setPending({ payload: read.file, part, kind: followUp ? 'follow-up' : 'approval',
      versionIds: pins.map(pin => pin.id), snapshots: pins.map(pin => pin.snapshot), documentIsCurrent: current,
      isCurrent });
    return true;
  }

  function clear(attachment: ApprovalEvidenceAttachment) {
    if (pending !== attachment || !attachment.isCurrent()) return;
    generation.current++;
    setPending(undefined);
  }

  return { attach, selected: pending?.isCurrent() ? pending : undefined, clear };
}
