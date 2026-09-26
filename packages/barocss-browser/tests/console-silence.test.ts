import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setDebug } from '@barocss/kit';
import { BrowserRuntime } from '../src/browser-runtime';

const METHODS = ['log', 'info', 'debug', 'warn', 'error', 'table', 'time'] as const;
const flush = () => new Promise(r => setTimeout(r, 0));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const GRACE = 30;

let runtime: BrowserRuntime | undefined;
let spies: Array<{ mock: { calls: unknown[] } }> = [];
const calls = () => spies.reduce((n, s) => n + s.mock.calls.length, 0);

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  setDebug(false);
  spies = METHODS.map(m => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => { runtime?.destroy(); runtime = undefined; setDebug(false); vi.restoreAllMocks(); });

async function session(debug: boolean) {
  runtime = new BrowserRuntime({ gcGraceMs: GRACE, config: { debug } });
  runtime.observe(document.body, { scan: true });
  await flush();
  const el = document.createElement('div');
  el.className = 'p-4 m-2 text-red-500 hover:bg-blue-500';
  document.body.appendChild(el);
  await flush();
  el.className = 'p-8';
  await flush();
  el.remove();
  await wait(GRACE * 4); // let the GC sweep run
}

describe('runtime console output (#337)', () => {
  it('a normal session with debug off makes zero console calls', async () => {
    await session(false);
    expect(calls()).toBe(0);
  });

  it('debug on still logs', async () => {
    await session(true);
    expect(calls()).toBeGreaterThan(0);
  });
});

// Guard: every console.* call in the browser runtime and kit sources must be gated by the debug
// flag (the same line references isDebug() / debugEnabled) or carry a `// console-ok: <reason>`
// marker on one of the two preceding lines.
describe('no ungated console calls in sources (#337)', () => {
  const roots = [resolve(__dirname, '../src'), resolve(__dirname, '../../barocss/src')];
  const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });

  it('finds none', () => {
    const offenders: string[] = [];
    const re = /console\.(log|info|debug|warn|error|table|time)\b/;
    for (const file of roots.flatMap(files)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*\*/.test(line)) return;
        const code = line.replace(/\/\/.*$/, '');
        if (!re.test(code)) return;
        if (/isDebug\(\)|debugEnabled/.test(code)) return;
        if (lines.slice(Math.max(0, i - 2), i).some(l => l.includes('console-ok:'))) return;
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
