import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

const rules = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .filter(s => !['preflight', 'css-vars', 'root'].includes(s.getAttribute('data-category') ?? ''))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText));
const has = (sel: string) => rules().some(r => r.includes(sel));
const flush = () => new Promise(r => setTimeout(r, 0));
const GRACE = 50;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

const div = (cls: string) => { const d = document.createElement('div'); d.className = cls; return d; };

async function setup(extra: Record<string, unknown> = {}) {
  runtime = new BrowserRuntime({ gcGraceMs: GRACE, ...extra });
  runtime.observe(document.body, { scan: true });
  await flush();
  return runtime;
}

describe('class GC (#269)', () => {
  it('reclaims a class after the grace period once no element uses it', async () => {
    await setup();
    const a = div('m-3');
    document.body.appendChild(a);
    await flush();
    expect(has('.m-3')).toBe(true);
    a.remove();
    await flush();
    expect(has('.m-3')).toBe(true); // still within grace
    await wait(GRACE * 3);
    expect(has('.m-3')).toBe(false);
    expect(runtime!.has('m-3')).toBe(false);
    // re-adding regenerates it
    document.body.appendChild(div('m-3'));
    await flush();
    expect(has('.m-3')).toBe(true);
  });

  it('keeps a class shared by two elements when one is removed', async () => {
    await setup();
    const a = div('p-7'); const b = div('p-7');
    document.body.append(a, b);
    await flush();
    a.remove();
    await wait(GRACE * 3);
    expect(has('.p-7')).toBe(true);
    b.remove();
    await wait(GRACE * 3);
    expect(has('.p-7')).toBe(false);
  });

  it('remove then re-add within the grace period keeps the rule (no flap)', async () => {
    await setup();
    const a = div('mt-5');
    document.body.appendChild(a);
    await flush();
    a.remove();
    await flush();
    document.body.appendChild(a);
    await wait(GRACE * 3);
    expect(has('.mt-5')).toBe(true);
    // same batch remove + re-add
    a.remove(); document.body.appendChild(a);
    await wait(GRACE * 3);
    expect(has('.mt-5')).toBe(true);
  });

  it('tracks class changes on the same element', async () => {
    await setup();
    const a = div('pl-3');
    document.body.appendChild(a);
    await flush();
    a.className = 'pr-3';
    await wait(GRACE * 3);
    expect(has('.pl-3')).toBe(false);
    expect(has('.pr-3')).toBe(true);
    a.className = 'pr-3 pl-3';
    await wait(GRACE * 3);
    expect(has('.pl-3')).toBe(true);
    expect(has('.pr-3')).toBe(true);
  });

  it('keeps the class of a node moved between parents', async () => {
    await setup();
    const p1 = div(''); const p2 = div('');
    const a = div('mb-6');
    p1.appendChild(a);
    document.body.append(p1, p2);
    await flush();
    p2.appendChild(a); // move
    await wait(GRACE * 3);
    expect(has('.mb-6')).toBe(true);
    // moved out while detached-parent removed, then parent removed
    p1.appendChild(a); p1.remove();
    await wait(GRACE * 3);
    expect(has('.mb-6')).toBe(false);
  });

  it('never reclaims classes an existing sheet defines, nor addClass() classes', async () => {
    const s = document.createElement('style'); s.textContent = '.ml-9{margin-left:9px}'; document.head.appendChild(s);
    await setup();
    runtime!.addClass('mr-9');
    const a = div('ml-9 mr-9 mx-9');
    document.body.appendChild(a);
    await flush();
    expect(has('.ml-9')).toBe(true); // skipExisting off: generated, but permanent
    a.remove();
    await wait(GRACE * 3);
    expect(has('.ml-9')).toBe(true);
    expect(has('.mr-9')).toBe(true);
    expect(has('.mx-9')).toBe(false);
  });

  it('keeps skipExisting classes out of the sheet and never reclaims them', async () => {
    const s = document.createElement('style'); s.textContent = '.pt-9{padding-top:9px}'; document.head.appendChild(s);
    await setup({ skipExisting: true });
    const a = div('pt-9');
    document.body.appendChild(a);
    await flush();
    a.remove();
    await wait(GRACE * 3);
    expect(s.sheet!.cssRules.length).toBe(1);
    document.body.appendChild(div('pt-9'));
    await flush();
    expect(has('.pt-9')).toBe(false);
  });

  it('keeps #254 variant order after a deletion (later insert lands correctly)', async () => {
    await setup();
    const a = div('w-3'); const b = div('md:w-4'); const c = div('w-5');
    document.body.append(a, b, c);
    await flush();
    c.remove();
    await wait(GRACE * 3);
    expect(has('.w-5')).toBe(false);
    document.body.appendChild(div('w-6 sm:w-7'));
    await flush();
    const list = rules();
    const idx = (sel: string) => list.findIndex(r => r.includes(sel));
    expect(idx('.w-6')).toBeGreaterThan(-1);
    expect(idx('.w-6')).toBeLessThan(idx('sm\\:w-7'));
    expect(idx('sm\\:w-7')).toBeLessThan(idx('md\\:w-4'));
    expect(idx('.w-3')).toBeLessThan(idx('md\\:w-4'));
    const stats = runtime!.getCacheStats().runtime;
    expect(stats.ruleCount).toBe(list.length);
  });

  it('gc: false never reclaims', async () => {
    await setup({ gc: false });
    const a = div('m-8');
    document.body.appendChild(a);
    await flush();
    a.remove();
    await wait(GRACE * 3);
    expect(has('.m-8')).toBe(true);
  });

  it('counts elements present before observe() even without scan', async () => {
    document.body.appendChild(div('gap-7'));
    runtime = new BrowserRuntime({ gcGraceMs: GRACE });
    runtime.observe(document.body);
    const b = div('gap-7');
    document.body.appendChild(b);
    await flush();
    b.remove();
    await wait(GRACE * 3);
    expect(has('.gap-7')).toBe(true);
  });

  it('maxRules evicts only unused classes, before the grace period', async () => {
    await setup({ gcGraceMs: 60_000, maxRules: 2 });
    const a = div('m-1'); const b = div('m-2');
    document.body.append(a, b);
    await flush();
    a.remove();
    document.body.appendChild(div('m-4'));
    await flush(); await flush();
    expect(has('.m-1')).toBe(false);
    expect(has('.m-2')).toBe(true);
    expect(has('.m-4')).toBe(true);
  });
});
