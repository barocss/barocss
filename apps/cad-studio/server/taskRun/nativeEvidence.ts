import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { digestOf } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import type { TaskRunFindingSelection } from '../../src/chat/taskRunOffer';
import { readLocalTaskRunStatus } from './localService';

export const SELECTED_NATIVE_CHECK = 'read_selected_native_check';
export const selectedNativeCheckTool = {
  name: SELECTED_NATIVE_CHECK,
  description: 'Read the host-confirmed native check the person selected for this turn on this exact model revision.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  outputSchema: {
    type: 'object', additionalProperties: false,
    required: ['revision', 'runId', 'runRevision', 'taskId', 'finding'],
    properties: {
      revision: { type: 'string' }, runId: { type: 'string' }, runRevision: { type: 'integer' }, taskId: { type: 'string' },
      finding: {
        type: 'object', additionalProperties: false,
        required: ['attemptId', 'baselineDigest', 'occurrence', 'feature', 'gate', 'verdict', 'code', 'message'],
        properties: {
          attemptId: { type: 'string' }, baselineDigest: { type: 'string' }, occurrence: { type: 'string' }, feature: { type: 'string' },
          gate: { enum: ['lease', 'validity', 'contract', 'assembly'] }, verdict: { enum: ['fail', 'undecided'] },
          code: { type: 'string' }, message: { type: 'string' },
        },
      },
    },
  },
};

export function readSelectedNativeCheck(root: string, selection: TaskRunFindingSelection, doc: StudioDoc, args?: unknown) {
  const revision = digestOf(doc);
  if (args !== undefined && (!isObj(args) || Object.keys(args).length))
    return { revision, error: 'This tool takes no arguments. Select a failed check in Studio.' };
  if (revision !== selection.baselineDigest)
    return { revision, error: 'The selected check belongs to a different model revision. Open its run baseline to inspect it.' };
  const { runKey, runId, taskId } = selection;
  try {
    const status = readLocalTaskRunStatus(root, { runKey, runId });
    const finding = status.tasks.find(task => task.id === taskId)?.nativeFailure;
    if (status.baselineDigest === revision && finding?.attemptId === selection.attemptId)
      return { revision, runId, runRevision: status.revision, taskId, finding };
  } catch { /* A missing or invalid run cannot supply evidence. */ }
  return { revision, error: 'The selected failed attempt is no longer current. Refresh the run and select a current check.' };
}
