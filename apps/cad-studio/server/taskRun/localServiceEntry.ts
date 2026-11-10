import { runLocalTaskHandoff } from './localService';

const action = process.argv[3];
if (action !== 'start' && action !== 'reopen') throw new Error('Expected a local task handoff action.');
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const reply = await runLocalTaskHandoff(process.argv[2], Buffer.concat(chunks), action);
process.stdout.write(JSON.stringify(reply));
