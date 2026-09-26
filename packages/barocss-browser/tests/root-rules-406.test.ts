import { describe, expect, it } from 'vitest';
import { StylePartitionManager } from '../src/style-partition-manager';

// #406: a blank or browser-rejected root rule must not stop the root rules after it.
describe('#406 root rule insertion is per rule', () => {
  it('skips blank rules and keeps inserting after a rejected rule', () => {
    document.head.innerHTML = '';
    const m = new StylePartitionManager(document.head);
    const res = m.addRootRules(['\n', ':root{--a406:1}', '@@bad {', ':root{--b406:2}']);
    const css = Array.from(document.querySelectorAll('style'))
      .flatMap((s) => Array.from(s.sheet?.cssRules ?? []).map((r) => r.cssText)).join('\n');
    expect(css).toContain('--a406');
    expect(css).toContain('--b406');
    expect(res.success).toBe(2);
    expect(res.failed).toBe(1);
  });
});
