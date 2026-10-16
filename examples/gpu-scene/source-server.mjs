import { startServer } from './server.mjs';
const running = await startServer(Number(process.env.PORT ?? 5180)); console.log('GPU scene example: ' + running.url); for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
