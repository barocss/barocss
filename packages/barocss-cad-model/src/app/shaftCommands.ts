// Shafts (R12c.3a, D156): steps along an axis with shoulder fillets and end chamfers, a keyseat on one step and a ring
// groove on another. Every size is the user's: the prefills (a 6 × 3.5 seat on Ø20, a Ø19 × 1.3 groove on Ø20) are
// estimates for a first try, said so in their labels — key and ring sizes come from the user's own rows (none built in).
import { withNode } from '../engine/doc';
import type { Command, Field, Values } from './commands';

const ok = { ok: true as const };
const MAX = 5;
const n = (v: Values, k: string) => Number(v[k]);
const count = (v: Values | undefined) => Math.max(1, Math.min(MAX, Math.round(Number(v?.n ?? 3)) || 3));

const shaftCommand: Command = {
  id: 'shaft', label: 'Shaft', icon: 'cad-shaft', group: 'create', keywords: 'shaft stepped axle spindle shoulder fillet chamfer keyseat keyway key groove retaining ring circlip turned',
  hint: 'A stepped shaft along Z, revolved exactly: steps of your diameters and lengths, shoulder fillets, end chamfers, a keyseat on one step and a ring groove on another (cut by exact Booleans). The prefilled key and ring sizes are estimates: your own rows give them. Not validated for manufacturing',
  available: () => ok,
  fields: () => {
    // (Five steps' fields, each shown while the count reaches it.)
    const steps: Field[] = [];
    for (let i = 1; i <= MAX; i++) { const when = (v: Values) => count(v) >= i; steps.push({ key: `d${i}`, label: `Step ${i} Ø`, kind: 'mm', min: 0.5, when }, { key: `l${i}`, label: `Step ${i} length`, kind: 'mm', min: 0.5, when }); }
    const on = (key: string) => (v: Values) => Number(v[key]) > 0;
    return [{ key: 'n', label: 'Steps', kind: 'count', min: 1, max: MAX }, ...steps,
      { key: 'r', label: 'Shoulder fillets (0: none)', kind: 'mm', min: 0 }, { key: 'c', label: 'End chamfers (0: none)', kind: 'mm', min: 0 },
      { key: 'ks', label: 'Keyseat on step (0: none)', kind: 'count', min: 0, max: MAX },
      { key: 'kb', label: 'Keyseat width (estimate)', kind: 'mm', min: 0.1, when: on('ks') }, { key: 'kt', label: 'Keyseat depth t1 (estimate)', kind: 'mm', min: 0.1, when: on('ks') },
      { key: 'kl', label: 'Keyseat length', kind: 'mm', min: 0.1, when: on('ks') }, { key: 'ko', label: 'Keyseat from the step\'s start', kind: 'mm', min: 0, when: on('ks') },
      { key: 'ke', label: 'Keyseat ends', kind: 'choice', options: [{ value: 'end-mill', label: 'End-milled (rounded)' }, { value: 'square', label: 'Square' }, { value: 'disc', label: 'Disc cutter run-out' }], when: on('ks') },
      { key: 'kr', label: 'Disc cutter radius', kind: 'mm', min: 0.1, when: v => on('ks')(v) && v.ke === 'disc' },
      { key: 'gs', label: 'Ring groove on step (0: none)', kind: 'count', min: 0, max: MAX },
      { key: 'gd', label: 'Groove Ø (estimate)', kind: 'mm', min: 0.1, when: on('gs') }, { key: 'gw', label: 'Groove width (estimate)', kind: 'mm', min: 0.1, when: on('gs') }, { key: 'ga', label: 'Groove from the step\'s start', kind: 'mm', min: 0, when: on('gs') },
      { key: 'x', label: 'Axis X', kind: 'mm' }, { key: 'y', label: 'Axis Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' }];
  },
  // (An output shaft: a keyed Ø20 seat for a hub, a Ø25 bearing journal shouldered both ways, a Ø20 end with a ring groove.)
  defaults: () => ({ n: 3, d1: 20, l1: 30, d2: 25, l2: 40, d3: 20, l3: 25, d4: 20, l4: 20, d5: 20, l5: 20, r: 0.5, c: 0.5, ks: 1, kb: 6, kt: 3.5, kl: 18, ko: 6, ke: 'end-mill', kr: 8, gs: 3, gd: 19, gw: 1.3, ga: 18, x: 0, y: 0, z: 0 }),
  build: (ctx, v) => {
    const k = count(v), r = n(v, 'r'), c = n(v, 'c'), ks = Math.round(n(v, 'ks')), gs = Math.round(n(v, 'gs'));
    const steps = Array.from({ length: k }, (_, i) => {
      const s: { diameter: number; length: number; fillet?: number; grooves?: { diameter: number; width: number; at: number }[]; keyseats?: { width: number; depth: number; length: number; offset: number; ends: 'square' | 'end-mill' | 'disc'; cutterRadius?: number }[] } = { diameter: n(v, `d${i + 1}`), length: n(v, `l${i + 1}`) };
      if (r > 0 && i < k - 1) s.fillet = r;
      if (ks === i + 1) { const ends = v.ke === 'square' || v.ke === 'disc' ? v.ke : 'end-mill'; s.keyseats = [{ width: n(v, 'kb'), depth: n(v, 'kt'), length: n(v, 'kl'), offset: n(v, 'ko'), ends, ...(ends === 'disc' ? { cutterRadius: n(v, 'kr') } : {}) }]; }
      if (gs === i + 1) s.grooves = [{ diameter: n(v, 'gd'), width: n(v, 'gw'), at: n(v, 'ga') }];
      return s;
    });
    return withNode(ctx.doc, { kind: 'shaft', steps, ...(c > 0 ? { chamfers: [c, c] as [number, number] } : {}), center: [n(v, 'x'), n(v, 'y')], ...(n(v, 'z') ? { from: n(v, 'z') } : {}), generator: 'shaft@0' });
  },
};

export const shaftCommands: Command[] = [shaftCommand];
