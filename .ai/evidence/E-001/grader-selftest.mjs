// Grader self-test (run before any agent run): baseline must fail T1-T4; an inline-CSS positive control (no BaroCSS) must pass T1-T4.
// Usage from repo root: PW_MCP_DIR=… E=$PWD/.ai/evidence/E-001 ROOT=$PWD node .ai/evidence/E-001/grader-selftest.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const req = createRequire(process.env.PW_MCP_DIR + '/node_modules/@playwright/mcp/package.json');
const { chromium } = req('playwright-core');
const E = process.env.E;
const src = readFileSync(E + '/grader.js', 'utf8').replace(/^export /gm, '');
const srv = spawn('python3', ['-m', 'http.server', '8799', '--bind', '127.0.0.1', '--directory', process.env.ROOT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); const p = await b.newPage();
const url = 'http://127.0.0.1:8799/.ai/evidence/E-001/index.html';
await p.goto(url); await p.waitForSelector('html[data-baro-ready]'); await new Promise(r => setTimeout(r, 300));
const snapAt = async () => { const o = {}; for (const w of [1024, 375]) { await p.setViewportSize({ width: w, height: 900 }); await new Promise(r => setTimeout(r, 200)); o[w] = await p.evaluate(`(()=>{${src};return snapshot()})()`); } return o; };
const base = await snapAt();
console.log('baseline', JSON.stringify(base[1024]));
const g = (c) => p.evaluate(`(()=>{${src};return grade(${JSON.stringify(base)},${JSON.stringify(c)})})()`);
console.log('base-vs-base', Object.fromEntries(Object.entries(await g(base)).map(([k, v]) => [k, v.pass])));
await p.addStyleTag({ content: `[data-testid=save-button]{background:rgb(239,68,68)!important;color:#fff!important}
[data-testid=pricing-card]{padding:32px!important;border-radius:16px!important}
[data-testid=headline]{font-size:42px!important}
@media (min-width:768px){[data-testid=feature-list]{display:grid!important;grid-template-columns:1fr 1fr}}` });
console.log('positive-control', JSON.stringify(Object.fromEntries(Object.entries(await g(await snapAt())).map(([k, v]) => [k, v.pass]))));
await b.close(); srv.kill();
