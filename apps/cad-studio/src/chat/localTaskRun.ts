import { sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { MAX_TASK_CHECKPOINT_BYTES } from '../files/taskCheckpoint';
import { isLocalTaskRunHost, type TaskRunBaselineRequest, type TaskRunCheckpointRequest } from './taskRunOffer';

async function postLocalTaskRun(action: string, body: Blob | string, progress = false) {
  if (!isLocalTaskRunHost(window.location.hostname)) throw new Error('Open Studio on this computer to use a local task run.');
  const res = await fetch('/api/chat/task-runs/' + action, {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': typeof body === 'string' ? 'application/json' : 'application/octet-stream', 'x-barocss-task-run': action,
      ...(progress ? { 'x-barocss-task-run-progress': '1' } : {}) },
    body,
  });
  if (!res.ok) {
    const value: unknown = await res.json().catch(() => null);
    throw new Error(isObj(value) && typeof value.error === 'string' ? value.error : 'The local task run service did not respond.');
  }
  return res;
}

export async function localTaskRunJSON(action: 'start' | 'reopen' | 'rebuild' | 'review' | 'status', body: Blob | string,
  onAdmitted?: (value: unknown) => void) {
  const progress = action === 'start' && onAdmitted !== undefined;
  const res = await postLocalTaskRun(action, body, progress);
  const admission = progress ? res.headers.get('x-barocss-task-run-admitted') : null;
  if (admission !== null && onAdmitted) {
    try {
      let value: unknown;
      try { value = JSON.parse(decodeURIComponent(admission)); }
      catch { throw new Error('The local task run service returned an invalid admission.'); }
      onAdmitted(value);
    } catch (error) {
      void res.body?.cancel().catch(() => undefined);
      throw error;
    }
  }
  const value: unknown = await res.json().catch(() => null);
  if (!isObj(value)) throw new Error('The local task run service returned an invalid result.');
  if (action === 'start' && typeof value.error === 'string') throw new Error(value.error);
  return value;
}

export async function localTaskCheckpointBytes(request: TaskRunCheckpointRequest, current: () => boolean, action: 'checkpoint' | 'history' = 'checkpoint') {
  const res = await postLocalTaskRun(action, JSON.stringify(request));
  return readLocalTaskBytes(res, current);
}

export async function localTaskBaselineBytes(request: TaskRunBaselineRequest, current: () => boolean) {
  const res = await postLocalTaskRun('baseline', JSON.stringify(request));
  const bytes = await readLocalTaskBytes(res, current);
  if (!bytes || !current()) return;
  const sha256 = res.headers.get('x-barocss-native-sha256');
  if (sha256Hex(bytes) !== sha256) throw new Error('The local baseline response does not match its native checksum.');
  return bytes;
}

async function readLocalTaskBytes(res: Response, current: () => boolean) {
  const header = res.headers.get('content-length'), size = Number(header);
  if (res.headers.get('content-type') !== 'application/octet-stream' || !header || !/^\d+$/.test(header)
    || !Number.isSafeInteger(size) || size <= 0 || size > MAX_TASK_CHECKPOINT_BYTES || !res.body) {
    await res.body?.cancel();
    throw new Error('The local task file response has an invalid size or type.');
  }
  const reader = res.body.getReader(), bytes = new Uint8Array(size);
  let offset = 0, complete = false;
  try {
    while (current()) {
      const chunk = await reader.read();
      if (!current()) return;
      if (chunk.done) {
        if (offset !== size) throw new Error('The local task file response is incomplete.');
        complete = true;
        return bytes;
      }
      if (offset + chunk.value.length > size) throw new Error('The local task file response exceeds its stated size.');
      bytes.set(chunk.value, offset);
      offset += chunk.value.length;
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
