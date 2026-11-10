import { useEffect, useRef, useState } from 'react';
import { sameTaskRunCheckpoint, type TaskRunCheckpointPin, type TaskRunCheckpointRequest, type TaskRunStatus } from '../chat/taskRunOffer';
import type { CheckpointReview } from '../files/taskCheckpoint';
import { CheckpointApprovalChecks } from '../storage/ApprovedRequirementChecks';

type ApprovalView = { pin: TaskRunCheckpointPin; review?: CheckpointReview; error?: string };

export function TaskRunApprovalHistory({ run, read }: {
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
    {shown?.review ? <CheckpointApprovalChecks review={shown.review} historical />
      : shown && <div role="status">{shown.error ?? 'Checking approved task…'}</div>}
  </details>;
}
