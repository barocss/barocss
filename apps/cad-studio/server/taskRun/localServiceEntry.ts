import { runLocalTaskHandoff, runLocalTaskRebuild } from './localService';

const action = process.argv[3];
if (action !== 'start' && action !== 'reopen' && action !== 'rebuild') throw new Error('Expected a local task handoff action.');
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const body = Buffer.concat(chunks);
function parseJSON(bytes: Buffer): unknown {
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}
const writeFrame = (frame: unknown) => process.stdout.write(JSON.stringify(frame) + '\n');
const reply = action === 'rebuild' ? await runLocalTaskRebuild(process.argv[2], parseJSON(body))
  : await runLocalTaskHandoff(process.argv[2], body, action, action === 'start' ? admitted => writeFrame({ admitted }) : undefined);
writeFrame(reply);
