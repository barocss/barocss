import { useEffect, useRef, useState } from 'react';
import { sameTaskRunCheckpoint, type SavedTaskRunPlan, type TaskRunCheckpointPin, type TaskRunCheckpointRequest, type TaskRunStatus } from '../chat/taskRunOffer';
import type { RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { hasWorkingRepairFailure, type WorkingApprovalChecks } from '../files/workingApprovalChecks';
import type { CheckpointReview } from '../files/taskCheckpoint';
import { CheckpointApprovalChecks } from '../storage/ApprovedRequirementChecks';

type ApprovalView = { pin: TaskRunCheckpointPin; review?: CheckpointReview; error?: string };

interface WorkingReviewProps {
  workingVersion: object;
  checkWorking(review: CheckpointReview, current: () => boolean): Promise<WorkingApprovalChecks | undefined>;
  prepareRepair?(review: CheckpointReview, report: RequirementEvidence, version: object, current: () => boolean): Promise<SavedTaskRunPlan | undefined>;
  repairBlocked: boolean;
  onPrepared(plan: SavedTaskRunPlan, version: object): void;
}

function ApprovalChecks({ review, workingVersion, checkWorking, prepareRepair, repairBlocked, onPrepared }: WorkingReviewProps & { review: CheckpointReview }) {
  const [check, setCheck] = useState<{ version: object; result?: WorkingApprovalChecks }>();
  const pending = useRef<AbortController | undefined>(undefined);
  const preparation = useRef<AbortController | undefined>(undefined);
  const [repair, setRepair] = useState<{ version: object; busy: boolean; error?: string }>();
  useEffect(() => () => {
    pending.current?.abort();
    preparation.current?.abort();
  }, [workingVersion]);

  async function inspectWorking() {
    pending.current?.abort();
    preparation.current?.abort();
    setRepair(undefined);
    const controller = new AbortController();
    pending.current = controller;
    const current = () => !controller.signal.aborted;
    setCheck({ version: workingVersion });
    try {
      const result = await checkWorking(review, current);
      if (current()) setCheck({ version: workingVersion, result: result ?? { error: 'Check the working model again.' } });
    } catch {
      if (current()) setCheck({ version: workingVersion, result: { error: 'Could not check the working model.' } });
    }
  }

  const selected = check?.version === workingVersion ? check : undefined;
  const result = selected?.result;
  const evidence = result && !('error' in result) ? result : undefined;
  const canPrepare = prepareRepair && evidence && hasWorkingRepairFailure(review, evidence);
  const repairStatus = repair?.version === workingVersion ? repair : undefined;

  async function prepare() {
    if (!prepareRepair || !evidence || !canPrepare || repairBlocked || repairStatus?.busy) return;
    preparation.current?.abort();
    const controller = new AbortController();
    preparation.current = controller;
    const current = () => !controller.signal.aborted;
    setRepair({ version: workingVersion, busy: true });
    try {
      const plan = await prepareRepair(review, evidence, workingVersion, current);
      if (!current()) return;
      if (plan) onPrepared(plan, workingVersion);
      setRepair({ version: workingVersion, busy: false, error: plan ? undefined : 'Check the saved working model again.' });
    } catch (error) {
      if (current()) setRepair({ version: workingVersion, busy: false,
        error: error instanceof Error ? error.message : 'Could not prepare the repair.' });
    }
  }

  return <>
    <CheckpointApprovalChecks review={review} historical working={evidence} />
    <button className="ghost" type="button" disabled={!!selected && !result} onClick={() => void inspectWorking()}>
      Check working model
    </button>
    {canPrepare && <button className="ghost" type="button" disabled={repairBlocked || repairStatus?.busy} onClick={() => void prepare()}>
      {repairStatus?.busy ? 'Preparing repair…' : 'Prepare repair'}
    </button>}
    {repairStatus?.error && <div role="status">{repairStatus.error}</div>}
    {check && <div role="status">{!selected ? 'Working model changed. Check again.'
      : !result ? 'Checking working model…' : 'error' in result ? result.error : null}</div>}
  </>;
}

export function TaskRunApprovalHistory({ run, read, ...working }: WorkingReviewProps & {
  run: TaskRunStatus;
  read(request: TaskRunCheckpointRequest, current: () => boolean): Promise<CheckpointReview | undefined>;
}) {
  const [view, setView] = useState<ApprovalView>();
  const pending = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => pending.current?.abort(), []);

  async function inspect(pin: TaskRunCheckpointPin) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setView({ pin });
    const current = () => !controller.signal.aborted;
    try {
      const review = await read({ runId: run.runId, runKey: run.runKey, ...pin }, current);
      if (current()) setView({ pin, review, error: review ? undefined : 'Could not verify the approved task.' });
    } catch (error) {
      if (current()) setView({ pin, error: error instanceof Error ? error.message : 'Could not verify the approved task.' });
    }
  }

  const shown = view && run.approvals?.some(pin => sameTaskRunCheckpoint(pin, view.pin)) ? view : undefined;
  return <details>
    <summary>Approval history</summary>
    <ol aria-label="Approved tasks">
      {run.approvals?.map(pin => <li key={pin.operationId}>
        <button className="ghost" type="button" aria-label={'Inspect approval ' + pin.taskId}
          aria-pressed={!!shown && sameTaskRunCheckpoint(pin, shown.pin)} onClick={() => void inspect(pin)}>
          {pin.taskId}
        </button>
      </li>)}
    </ol>
    {shown?.review ? <ApprovalChecks key={shown.pin.operationId} review={shown.review} {...working} />
      : shown && <div role="status">{shown.error ?? 'Checking approved task…'}</div>}
  </details>;
}
