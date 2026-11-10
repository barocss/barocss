import { runLocalTaskHandoff } from './localService';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const reply = await runLocalTaskHandoff(process.argv[2], Buffer.concat(chunks));
process.stdout.write(JSON.stringify(reply));
