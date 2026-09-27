import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StylePartitionManager } from '../src/style-partition-manager';
import { ruleSortKey, compareKeys } from '../src/rule-order';

const partitions = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'));
const ruleTexts = () => partitions().flatMap(s => Array.from(s.sheet?.cssRules ?? []).map(r => r.cssText));
const expectSorted = () => {
  const keys = ruleTexts().map(t => ruleSortKey(t));
  for (let i = 1; i < keys.length; i++) expect(compareKeys(keys[i - 1], keys[i])).toBeLessThanOrEqual(0);
};

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const cats = ['color', 'padding', 'margin', 'width'];
const bps = ['', '@media (min-width: 40rem) ', '@media (min-width: 64rem) '];
const rule = (cycle: number, i: number) => {
  const bp = bps[i % bps.length];
  const body = `.r${cycle}-${i} { color: red; }`;
  return bp ? `${bp}{ ${body} }` : body;
};

describe('emptied segments are removed (#440)', () => {
  it('<style> count stays bounded over many add/GC cycles and global order holds', () => {
    const mgr = new StylePartitionManager(document.head, 5, 'x-', () => undefined);
    const counts: number[] = [];
    let prev: string[] = [];
    for (let cycle = 0; cycle < 200; cycle++) {
      const now = Array.from({ length: 30 }, (_, i) => rule(cycle, i));
      now.forEach((r, i) => mgr.addCategoryRule(r, cats[(cycle + i) % cats.length]));
      for (const r of prev) expect(mgr.removeRule(r)).toBe(true);
      prev = now;
      expectSorted();
      expect(ruleTexts()).toHaveLength(30);
      for (const s of partitions()) expect(s.sheet!.cssRules.length).toBeLessThanOrEqual(5);
      counts.push(partitions().length);
    }
    // Before #440 every emptied segment stayed behind, so the count grew with the cycles.
    expect(Math.max(...counts)).toBeLessThanOrEqual(30);
    expect(Math.max(...counts.slice(100))).toBeLessThanOrEqual(Math.max(...counts.slice(0, 100)));
    mgr.cleanup();
  });

  it('removing every rule keeps one segment, and rules added afterwards stay ordered', () => {
    const mgr = new StylePartitionManager(document.head, 2, 'x-', () => undefined);
    const rs = Array.from({ length: 9 }, (_, i) => rule(0, i));
    for (const r of rs) mgr.addRule(r);
    expect(partitions().length).toBeGreaterThan(1);
    for (const r of rs) mgr.removeRule(r);
    expect(partitions()).toHaveLength(1);
    for (const r of [...rs].reverse()) mgr.addRule(r);
    expectSorted();
    expect(ruleTexts()).toHaveLength(9);
    mgr.cleanup();
  });

  it('special partitions are untouched by segment removal', () => {
    const mgr = new StylePartitionManager(document.head, 2, 'x-', () => undefined);
    mgr.updateRuleContent('preflight', '*{margin:0}', true);
    mgr.addRootRules([':root{--a:1}']);
    const r = rule(1, 0);
    mgr.addRule(r);
    mgr.removeRule(r);
    expect(document.getElementById('x--preflight')).not.toBeNull();
    expect(document.getElementById('x--root')).not.toBeNull();
    mgr.cleanup();
  });
});
