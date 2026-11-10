import { isObj } from '@barocss/cad-model/util/guards';
import { MAX_TASK_CHECKPOINT_BYTES } from '../files/taskCheckpoint';
import { isLocalTaskRunHost, type TaskRunCheckpointRequest } from './taskRunOffer';

async function postLocalTaskRun(action: string, body: Blob | string) {
  if (!isLocalTaskRunHost(window.location.hostname)) throw new Error('Open Studio on this computer to use a local task run.');
  const res = await fetch('/api/chat/task-runs/' + action, {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': typeof body === 'string' ? 'application/json' : 'application/octet-stream', 'x-barocss-task-run': action },
    body,
  });
  if (!res.ok) {
    const value: unknown = await res.json().catch(() => null);
    throw new Error(isObj(value) && typeof value.error === 'string' ? value.error : 'The local task run service did not respond.');
  }
  return res;
}

export async function localTaskRunJSON(action: 'start' | 'review' | 'status', body: Blob | string) {
  const res = await postLocalTaskRun(action, body);
  const value: unknown = await res.json().catch(() => null);
  if (!isObj(value)) throw new Error('The local task run service returned an invalid result.');
  return value;
}

export async function localTaskCheckpointBytes(request: TaskRunCheckpointRequest, current: () => boolean) {
  const res = await postLocalTaskRun('checkpoint', JSON.stringify(request));
  const header = res.headers.get('content-length'), size = Number(header);
  if (res.headers.get('content-type') !== 'application/octet-stream' || !header || !/^\d+$/.test(header)
    || !Number.isSafeInteger(size) || size <= 0 || size > MAX_TASK_CHECKPOINT_BYTES || !res.body) {
    await res.body?.cancel();
    throw new Error('The local checkpoint response has an invalid size or type.');
  }
  const reader = res.body.getReader(), bytes = new Uint8Array(size);
  let offset = 0, complete = false;
  try {
    while (current()) {
      const chunk = await reader.read();
      if (!current()) return;
      if (chunk.done) {
        if (offset !== size) throw new Error('The local checkpoint response is incomplete.');
        complete = true;
        return bytes;
      }
      if (offset + chunk.value.length > size) throw new Error('The local checkpoint response exceeds its stated size.');
      bytes.set(chunk.value, offset);
      offset += chunk.value.length;
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
