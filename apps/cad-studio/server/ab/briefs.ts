// The A/B briefs (A5.5, O13): ten single-part rungs of the AI scenario ladder (RB9), each with parameter variants (one
// a run), the brief in words, the oracle — hard requirements the kernel checks on the part the agent leaves, hidden
// from the agent — and, for the scripted dry run, what an ideal agent calls: `hybrid` (the v2 tools and model.run).
// The `json` arm (v1 tools without the script) went with v1 (O105, the owner 2026-10-21: "우리는 릴리즈 한게 아니라서
// toolset v1 은 없어도 돼"), and with it the v1/v2 live A/B. The scripted calls follow the system prompt's protocol:
// requirements first, then the build, then the check. Dimensions are the brief's own, not taken from any standard.
import type { Requirement } from '@barocss/cad-model/chat/spec';

export type Arm = 'hybrid';
export interface Call { tool: string; args: Record<string, unknown> }
export interface Brief<P = Record<string, number>> {
  id: string;
  /** The RB9 ladder rung it stands for. */
  rung: string;
  variants: P[];
  prompt(p: P): string;
  oracle(p: P): Requirement[];
  scripted: Record<Arm, (p: P) => Call[]>;
}

const PI = Math.PI, r3 = (v: number) => Math.round(v * 1000) / 1000;
const bbox = (id: string, axis: 'x' | 'y' | 'z', value: number, source: string): Requirement => ({ id, source, hard: true, check: { op: '==', query: { fn: 'bbox', axis }, value, tol: 0.1 } } as Requirement);
const volume = (id: string, min: number, max: number, source: string): Requirement => ({ id, source, hard: true, check: { op: 'between', query: { fn: 'volume' }, min: r3(min), max: r3(max) } } as Requirement);
const near = (id: string, v: number, source: string, rel = 0.005) => volume(id, v * (1 - rel), v * (1 + rel), source);
const solids = (id: string, n: number, source: string): Requirement => ({ id, source, hard: true, check: { op: '==', query: { fn: 'count_solids' }, value: n } } as Requirement);
const box3 = (w: number, d: number, h: number) => [bbox('X', 'x', w, `${w} wide`), bbox('Y', 'y', d, `${d} deep`), bbox('Z', 'z', h, `${h} high`)];

// The calls an ideal agent makes.
/** The hybrid arm: one script with its requirements, then the check (v2 names). */
const hybrid = (reqs: Requirement[], source: string): Call[] => [{ tool: 'model', args: { source: `requirements(${JSON.stringify(reqs)})\n${source}` } }, { tool: 'requirements', args: { action: 'check' } }];

export const BRIEFS: Brief[] = [
  {
    id: 'block-hole', rung: 'RB9.1 block with hole',
    variants: [{ w: 60, d: 40, h: 20, dh: 10 }, { w: 50, d: 50, h: 25, dh: 12 }, { w: 80, d: 30, h: 15, dh: 8 }],
    prompt: p => `A ${p.w} × ${p.d} × ${p.h} mm block with a Ø${p.dh} mm hole straight through it, top to bottom, in the middle of the top face.`,
    oracle: p => [...box3(p.w, p.d, p.h), near('V', p.w * p.d * p.h - PI * (p.dh / 2) ** 2 * p.h, 'the hole through'), solids('S', 1, 'one block')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[0].oracle(p), `const b = box({w: ${p.w}, d: ${p.d}, h: ${p.h}, x: 0, y: 0, z: 0})\nhole(b.top, {d: ${p.dh}, x: ${p.w / 2}, y: ${p.d / 2}})`),
    },
  },
  {
    id: 'washer', rung: 'RB9.2 washer',
    variants: [{ D: 16, d: 8.4, t: 1.6 }, { D: 12, d: 6.4, t: 1.6 }, { D: 20, d: 10.5, t: 2 }],
    prompt: p => `A flat washer: Ø${p.D} mm outside, a Ø${p.d} mm bore, ${p.t} mm thick.`,
    oracle: p => [...box3(p.D, p.D, p.t), near('V', PI * (p.D ** 2 - p.d ** 2) / 4 * p.t, 'the bore'), solids('S', 1, 'one washer')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[1].oracle(p), `tube({r: ${p.D / 2}, ri: ${p.d / 2}, h: ${p.t}, x: 0, y: 0, z: 0})`),
    },
  },
  {
    id: 'phone-stand', rung: 'RB9.3 printed phone stand',
    variants: [{ w: 80, D: 70, H: 60 }, { w: 70, D: 60, H: 55 }, { w: 90, D: 80, H: 70 }],
    prompt: p => `A 3D-printed phone stand as one solid: a base plate ${p.w} mm wide, ${p.D} mm deep and 5 mm thick; a back ${p.H} mm high and 5 mm thick standing on the base's rear edge; and a lip 5 mm thick along the front edge, rising 8 mm above the base.`,
    oracle: p => [...box3(p.w, p.D, p.H), near('V', p.w * p.D * 5 + p.w * 5 * (p.H - 5) + p.w * 5 * 8, 'base, back and lip'), solids('S', 1, 'as one solid')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[2].oracle(p), `const base = box({w: ${p.w}, d: ${p.D}, h: 5, x: 0, y: 0, z: 0})\nunion([base, box({w: ${p.w}, d: 5, h: ${p.H}, x: 0, y: ${p.D - 5}, z: 0})])\nunion([base, box({w: ${p.w}, d: 5, h: 13, x: 0, y: 0, z: 0})])`),
    },
  },
  {
    id: 'machined-plate', rung: 'RB9.4 machined plate',
    variants: [{ L: 100, W: 60, T: 8, dh: 6.6, e: 8, pw: 40, pd: 20, pt: 3 }, { L: 120, W: 80, T: 10, dh: 9, e: 10, pw: 50, pd: 30, pt: 4 }, { L: 90, W: 50, T: 6, dh: 5.5, e: 7, pw: 30, pd: 15, pt: 2 }],
    prompt: p => `A machined plate ${p.L} × ${p.W} × ${p.T} mm: four Ø${p.dh} mm through holes at the corners, their centres ${p.e} mm in from both edges, and a ${p.pw} × ${p.pd} mm pocket ${p.pt} mm deep in the middle of the top face.`,
    oracle: p => [...box3(p.L, p.W, p.T), near('V', p.L * p.W * p.T - 4 * PI * (p.dh / 2) ** 2 * p.T - p.pw * p.pd * p.pt, 'holes and pocket'), solids('S', 1, 'one plate')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[3].oracle(p), `const L = ${p.L}, W = ${p.W}, e = ${p.e}\nconst plate = box({w: L, d: W, h: ${p.T}, x: 0, y: 0, z: 0})\nfor (const x of [e, L - e]) { for (const y of [e, W - e]) { hole(plate.top, {d: ${p.dh}, x, y}) } }\nconst tool = box({w: ${p.pw}, d: ${p.pd}, h: ${p.pt + 1}, x: (L - ${p.pw}) / 2, y: (W - ${p.pd}) / 2, z: ${p.T - p.pt}})\ndifference([plate, tool])`),
    },
  },
  {
    id: 'l-bracket', rung: 'RB9.5 L-bracket',
    variants: [{ a: 60, b: 40, t: 5, w: 30, dh: 5.5 }, { a: 80, b: 50, t: 6, w: 40, dh: 6.6 }, { a: 50, b: 35, t: 4, w: 25, dh: 4.5 }],
    prompt: p => `An L-bracket ${p.w} mm wide, ${p.t} mm thick: a base leg ${p.a} mm long and an upright leg ${p.b} mm high at one end, as one solid, with two Ø${p.dh} mm holes through the base leg on its centre line, a quarter and three quarters of the width across, halfway along the leg's free length.`,
    oracle: p => [...box3(p.a, p.w, p.b), near('V', p.a * p.w * p.t + p.t * p.w * (p.b - p.t) - 2 * PI * (p.dh / 2) ** 2 * p.t, 'two legs, two holes'), solids('S', 1, 'as one solid')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[4].oracle(p), `const base = box({w: ${p.a}, d: ${p.w}, h: ${p.t}, x: 0, y: 0, z: 0})\nconst up = box({w: ${p.t}, d: ${p.w}, h: ${p.b}, x: 0, y: 0, z: 0})\nunion([base, up])\nfor (const y of [${p.w} / 4, 3 * ${p.w} / 4]) { hole(base.top, {d: ${p.dh}, x: ${p.t} + (${p.a} - ${p.t}) / 2, y}) }`),
    },
  },
  {
    id: 'flange', rung: 'RB9.4 machined plate (round)',
    variants: [{ D: 80, T: 10, bore: 30, n: 6, pcd: 60, dh: 6.6 }, { D: 100, T: 12, bore: 40, n: 8, pcd: 80, dh: 9 }, { D: 60, T: 8, bore: 20, n: 4, pcd: 45, dh: 5.5 }],
    prompt: p => `A round flange Ø${p.D} mm, ${p.T} mm thick, with a Ø${p.bore} mm centre bore and ${p.n} Ø${p.dh} mm bolt holes evenly spaced on a Ø${p.pcd} mm circle.`,
    oracle: p => [...box3(p.D, p.D, p.T), near('V', PI * ((p.D / 2) ** 2 - (p.bore / 2) ** 2 - p.n * (p.dh / 2) ** 2) * p.T, 'bore and bolt holes'), solids('S', 1, 'one flange')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[5].oracle(p), `const f = cylinder({r: ${p.D / 2}, h: ${p.T}, x: 0, y: 0, z: 0})\nhole(f.top, {d: ${p.bore}, x: 0, y: 0})\nfor (const i of range(${p.n})) { hole(f.top, {d: ${p.dh}, x: ${p.pcd / 2} * cos(360 / ${p.n} * i), y: ${p.pcd / 2} * sin(360 / ${p.n} * i)}) }`),
    },
  },
  {
    id: 'open-box', rung: 'RB9.8 snap-fit box (the box)',
    variants: [{ w: 60, d: 40, h: 30, t: 2 }, { w: 80, d: 60, h: 40, t: 2.5 }, { w: 50, d: 50, h: 25, t: 1.6 }],
    prompt: p => `An open-top box ${p.w} × ${p.d} × ${p.h} mm outside, with ${p.t} mm walls and a ${p.t} mm bottom.`,
    oracle: p => [...box3(p.w, p.d, p.h), near('V', p.w * p.d * p.h - (p.w - 2 * p.t) * (p.d - 2 * p.t) * (p.h - p.t), 'the walls and bottom'), solids('S', 1, 'one box')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[6].oracle(p), `const b = box({w: ${p.w}, d: ${p.d}, h: ${p.h}, x: 0, y: 0, z: 0})\nshell(b.top, {t: ${p.t}})`),
    },
  },
  {
    id: 'pcb-enclosure', rung: 'RB9.9 PCB enclosure',
    variants: [{ w: 100, d: 70, h: 25, t: 2, sd: 6, sh: 5, inset: 8 }, { w: 120, d: 80, h: 30, t: 2.5, sd: 7, sh: 6, inset: 9 }, { w: 90, d: 60, h: 22, t: 2, sd: 6, sh: 4, inset: 7 }],
    prompt: p => `A PCB enclosure as one solid: an open-top box ${p.w} × ${p.d} × ${p.h} mm outside with ${p.t} mm walls and bottom; four Ø${p.sd} mm standoffs ${p.sh} mm tall on the inside floor, their centres ${p.inset} mm in from the outside edges at the corners; and a Ø8 mm cable hole through the front wall (the one facing −Y), centred along it, 12 mm above the bottom.`,
    oracle: p => [...box3(p.w, p.d, p.h), near('V', p.w * p.d * p.h - (p.w - 2 * p.t) * (p.d - 2 * p.t) * (p.h - p.t) + 4 * PI * (p.sd / 2) ** 2 * p.sh - PI * 16 * p.t, 'walls, standoffs, cable hole'), solids('S', 1, 'as one solid')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[7].oracle(p), `const w = ${p.w}, d = ${p.d}, i = ${p.inset}\nconst b = box({w, d, h: ${p.h}, x: 0, y: 0, z: 0})\nshell(b.top, {t: ${p.t}})\nfor (const c of [[i, i], [w - i, i], [i, d - i], [w - i, d - i]]) { union([b, cylinder({r: ${p.sd / 2}, h: ${p.sh}, x: c[0], y: c[1], z: ${p.t}})]) }\nhole(face({normal: [0, -1, 0], pick: "max"}), {type: "blind", d: 8, depth: ${p.t}, x: w / 2, y: 12})`),
    },
  },
  {
    id: 'stepped-shaft', rung: 'RB9.7 bolted joint (the shaft)',
    variants: [{ r1: 10, h1: 40, r2: 7.5, h2: 30, r3: 5, h3: 20 }, { r1: 12, h1: 50, r2: 9, h2: 35, r3: 6, h3: 25 }, { r1: 8, h1: 30, r2: 6, h2: 25, r3: 4, h3: 15 }],
    prompt: p => `A stepped shaft standing on Z, one solid: Ø${2 * p.r1} × ${p.h1} mm at the bottom, then Ø${2 * p.r2} × ${p.h2} mm, then Ø${2 * p.r3} × ${p.h3} mm at the top, all on one axis.`,
    oracle: p => [...box3(2 * p.r1, 2 * p.r1, p.h1 + p.h2 + p.h3), near('V', PI * (p.r1 ** 2 * p.h1 + p.r2 ** 2 * p.h2 + p.r3 ** 2 * p.h3), 'three steps'), solids('S', 1, 'one shaft')],
    scripted: {
      hybrid: p => hybrid(BRIEFS[8].oracle(p), `const a = cylinder({r: ${p.r1}, h: ${p.h1}, x: 0, y: 0, z: 0})\nunion([a, cylinder({r: ${p.r2}, h: ${p.h2}, x: 0, y: 0, z: ${p.h1}})])\nunion([a, cylinder({r: ${p.r3}, h: ${p.h3}, x: 0, y: 0, z: ${p.h1 + p.h2}})])`),
    },
  },
  {
    id: 'knob', rung: 'RB9.13 product from a brief (a knob)',
    variants: [{ R: 15, H: 15, b: 6, depth: 10, fr: 2 }, { R: 20, H: 18, b: 8, depth: 12, fr: 3 }, { R: 12, H: 12, b: 5, depth: 8, fr: 1.5 }],
    prompt: p => `A round knob Ø${2 * p.R} × ${p.H} mm, its top edge rounded with a ${p.fr} mm fillet, and a Ø${p.b} mm blind bore ${p.depth} mm deep up into it from the middle of the bottom.`,
    // (The fillet takes (1 − π/4)·r² of section off a ring between R − r and R: the volume between those bounds.)
    oracle: p => { const v0 = PI * p.R ** 2 * p.H - PI * (p.b / 2) ** 2 * p.depth, a = (1 - PI / 4) * p.fr ** 2; return [...box3(2 * p.R, 2 * p.R, p.H), volume('V', v0 - a * 2 * PI * p.R, v0 - a * 2 * PI * (p.R - p.fr), 'bore and rounded edge'), solids('S', 1, 'one knob')]; },
    scripted: {
      hybrid: p => hybrid(BRIEFS[9].oracle(p), `const k = cylinder({r: ${p.R}, h: ${p.H}, x: 0, y: 0, z: 0})\nhole(k.bottom, {type: "blind", d: ${p.b}, depth: ${p.depth}, x: 0, y: 0})\nfillet([edge(k.top, k.side0)], {radius: ${p.fr}})`),
    },
  },
];
