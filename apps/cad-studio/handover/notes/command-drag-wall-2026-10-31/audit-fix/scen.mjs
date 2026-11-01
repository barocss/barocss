import { run } from './drive2.mjs';
const ramp = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n);
const rep = (x, n) => Array(n).fill(x);
const le = L => v => Number(v.radius) <= L;
const which = process.argv[2];
const S = {
  A150: () => run({ name: 'A 150ms hold 3s', latency: 150, valid: le(6.5), path: ramp(0, 7, 10), hold: 3000 }),
  A1000: () => run({ name: 'A 1000ms hold 9s', latency: 1000, valid: le(6.5), path: ramp(0, 7, 10), hold: 9000 }),
  osc60: () => run({ name: 'fast oscillation r6<->r7.5 each frame 60ms, release at r6', latency: 60, valid: le(6.5), path: [...ramp(0, 3, 4), ...Array.from({ length: 30 }, (_, i) => i % 2 ? 3 : 4.5), 3] }),
  osc5: () => run({ name: 'fast oscillation 5ms', latency: 5, valid: le(6.5), path: [...ramp(0, 3, 4), ...Array.from({ length: 30 }, (_, i) => i % 2 ? 3 : 4.5), 3] }),
  jitter60: () => run({ name: 'held past bound, pointer jitters 4.0..5.0mm (r7..8) 60ms', latency: 60, valid: le(6.5), path: [...ramp(0, 4.5, 6), ...Array.from({ length: 40 }, (_, i) => 4 + (i % 5) * 0.25)] }),
  jitter5: () => run({ name: 'held past bound jitter 5ms', latency: 5, valid: le(6.5), path: [...ramp(0, 4.5, 6), ...Array.from({ length: 40 }, (_, i) => 4 + (i % 5) * 0.25)] }),
  jitter150: () => run({ name: 'held past bound jitter 150ms', latency: 150, valid: le(6.5), path: [...ramp(0, 4.5, 6), ...Array.from({ length: 60 }, (_, i) => 4 + (i % 5) * 0.25)], hold: 3000 }),
  still60: () => run({ name: 'past bound, pointer still (same pos, pointermove events) 60ms', latency: 60, valid: le(6.5), path: [...ramp(0, 4.5, 6), ...rep(4.5, 40)] }),
  minside: () => run({ name: 'min side: valid 1<=r<=6.5, drag 3 -> 0.1 then back to r5', latency: 60, valid: v => v.radius >= 1 && v.radius <= 6.5, path: [...ramp(0, -3, 6), ...rep(-3, 10), ...ramp(-3, 2, 6), ...rep(2, 4)] }),
  bothsides: () => run({ name: 'both sides: valid 1..6.5, down past 1, up past 6.5, back to 5', latency: 60, valid: v => v.radius >= 1 && v.radius <= 6.5, path: [...ramp(0, -3, 5), ...rep(-3, 8), ...ramp(-3, 5, 8), ...rep(5, 10), ...ramp(5, 2, 4), ...rep(2, 4)] }),
  bothsidesHold: () => run({ name: 'both sides, release past the max', latency: 60, valid: v => v.radius >= 1 && v.radius <= 6.5, path: [...ramp(0, -3, 5), ...rep(-3, 8), ...ramp(-3, 5, 8), ...rep(5, 10)] }),
  nonmono: () => run({ name: 'non-monotone: valid r<=5 or 7<=r<=8; start 7.5 drag down to r4', latency: 60, start: { radius: 7.5 }, valid: v => v.radius <= 5 || (v.radius >= 7 && v.radius <= 8), path: [...ramp(0, -3.5, 7), ...rep(-3.5, 10)] }),
  nonmono2: () => run({ name: 'non-monotone up: valid r<=5 or 7<=r<=8; start 3 to r 7.5', latency: 60, valid: v => v.radius <= 5 || (v.radius >= 7 && v.radius <= 8), path: [...ramp(0, 4.5, 7), ...rep(4.5, 10)] }),
  nonmono3: () => run({ name: 'non-monotone, 5ms: success r7 then refusal r6 (pointer in from 9 down)', latency: 5, start: { radius: 9.5 }, valid: v => v.radius <= 5 || (v.radius >= 7 && v.radius <= 10), path: [...ramp(0, -2.5, 5), ...ramp(-2.5, -3.5, 4), ...rep(-3.5, 6), ...ramp(-3.5, -1, 4), ...rep(-1, 4)] }),
  geomchange: () => run({ name: 'limit drops 6.5 -> 4 at t=300ms (geometry change), pointer at r6 still', latency: 60, valid: (v, t) => v.radius <= (t < 300 ? 6.5 : 4), path: [...ramp(0, 3, 4), ...rep(3, 30), ...ramp(3, 0.5, 4), ...rep(0.5, 5)] }),
  geomup: () => run({ name: 'limit rises 6.5 -> 9 at t=400ms, pointer held at r8', latency: 60, valid: (v, t) => v.radius <= (t < 400 ? 6.5 : 9), path: [...ramp(0, 5, 5), ...rep(5, 50)] }),
  maxh: () => run({ name: 'handle max 8 step 0.5, limit 6.5, pointer far beyond max', latency: 60, valid: le(6.5), handles: (c, v) => [{ key: 'radius', at: [0, 0, 0], dir: [1, 0, 0], min: 0.1, max: 8, step: 0.5 }], path: [...ramp(0, 20, 6), ...rep(20, 10)] }),
  maxAtLimit: () => run({ name: 'handle max 6.5 == limit (no refusal) ', latency: 60, valid: le(6.5), handles: (c, v) => [{ key: 'radius', at: [0, 0, 0], dir: [1, 0, 0], min: 0.1, max: 6.5, step: 0.5 }], path: [...ramp(0, 20, 6), ...rep(20, 10)] }),
  offgrid: () => run({ name: 'start off-grid r=3.3, step 0.5', latency: 60, start: { radius: 3.3 }, valid: le(6.5), path: [...ramp(0, 7, 6), ...rep(7, 10)] }),
  count: () => run({ name: 'count handle (unit "", step 1, scale 0.2) limit 7', key: 'count', latency: 60, start: { count: 3 }, fields: () => [{ key: 'count', label: 'n', kind: 'int', min: 1 }], valid: v => v.count <= 7, handles: (c, v) => [{ key: 'count', at: [0, 0, 0], dir: [1, 0, 0], min: 1, step: 1, unit: '', scale: 0.2 }], path: [...ramp(0, 40, 8), ...rep(40, 10)] }),
  slow1s: () => run({ name: 'kernel 1s: out past, back to valid r5, release', latency: 1000, valid: le(6.5), path: [...ramp(0, 7, 6), ...rep(7, 30), ...ramp(7, 2, 6), ...rep(2, 4)], hold: 5000 }),
  escape: () => run({ name: 'release past limit then Escape at once (active=null) 150ms', latency: 150, valid: le(6.5), path: ramp(0, 7, 10), hold: 1500, after: async ({ store, p }) => { await new Promise(r => setTimeout(r, 200)); store.set(null); p.handleDrag.current = null; } }),
  unmount: () => run({ name: 'release past limit then unmount (stop watch) at once 150ms', latency: 150, valid: le(6.5), path: ramp(0, 7, 10), hold: 1500, after: async ({ stop }) => { await new Promise(r => setTimeout(r, 200)); stop(); } }),
  newcmd: () => run({ name: 'release then a new command replaces it (other cmd object, same values) 150ms', latency: 150, valid: le(6.5), path: ramp(0, 7, 10), hold: 1500, after: async ({ store, p }) => { await new Promise(r => setTimeout(r, 200)); const a = store.get(); store.set({ ...a, cmd: { ...a.cmd, id: 'other' }, values: { radius: 2 } }); p.handleDrag.current = null; } }),
  typedAfter: () => run({ name: 'release past, then person types 20 into HUD (App nulls hd) 60ms', latency: 60, valid: le(6.5), path: ramp(0, 7, 10), hold: 1500, after: async ({ store, p }) => { await new Promise(r => setTimeout(r, 100)); p.handleDrag.current = null; store.set(a => ({ ...a, values: { ...a.values, radius: 20 }, preview: 'busy' })); } }),
};
const names = which ? which.split(',') : Object.keys(S);
for (const n of names) await S[n]();
