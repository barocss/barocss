import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainThread, threadId, workerData } from 'node:worker_threads';

const barrier = process.env.CAD_STUDIO_TEST_WORKER_BARRIER;
if (!isMainThread && barrier && workerData?.kind === 'barocss-task-v1') {
  const { runId, task, attempt } = workerData.ticket;
  const release = join(barrier, 'release');
  writeFileSync(join(barrier, 'worker-' + threadId + '.json'), JSON.stringify({
    pid: process.pid, threadId, runId, task: task.id, attempt: attempt.id,
  }), { flag: 'wx' });
  const timer = new Int32Array(new SharedArrayBuffer(4)), deadline = Date.now() + 8000;
  while (!existsSync(release)) {
    if (Date.now() >= deadline) throw new Error('The Studio test did not release the native worker barrier.');
    Atomics.wait(timer, 0, 0, 25);
  }
}
