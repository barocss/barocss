import { runLocalTaskApproval, runLocalTaskHandoff, runLocalTaskRebuild, runLocalTaskStop } from './localService';
import { isObj } from '@barocss/cad-model/util/guards';
import { isTaskRunLocator, type TaskRunLaunch } from '../../src/chat/taskRunOffer';

const action = process.argv[3];
if (action !== 'start' && action !== 'reopen' && action !== 'rebuild' && action !== 'stop' && action !== 'approve')
  throw new Error('Expected a local task run action.');
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const body = Buffer.concat(chunks);
function parseJSON(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}
const writeFrame = (frame: unknown) => process.stdout.write(JSON.stringify(frame) + '\n');
function bindRunControl(admitted: TaskRunLaunch, stop: () => void) {
  const control = (message: unknown) => {
    if (isObj(message) && message.action === 'stop' && isTaskRunLocator(message.run)
      && message.run.runId === admitted.runId && message.run.runKey === admitted.runKey) stop();
  };
  process.on('message', control);
  writeFrame({ admitted });
  return () => { process.off('message', control); };
}
const reply = action === 'approve' ? await runLocalTaskApproval(process.argv[2], parseJSON(body))
  : action === 'stop' ? await runLocalTaskStop(process.argv[2], parseJSON(body))
  : action === 'rebuild' ? await runLocalTaskRebuild(process.argv[2], parseJSON(body))
  : await runLocalTaskHandoff(process.argv[2], body, action, action === 'start' ? bindRunControl : undefined);
writeFrame(reply);
if (process.connected) process.disconnect?.();
