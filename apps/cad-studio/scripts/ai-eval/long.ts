// The long, descriptive briefs (the owner, 2026-10-24: "AI 실험할 때, 아래 처럼 긴 prompt 가 어디까지 되는지, 어디가 되고
// 어디가 안되는지 잘 좀 봐줘"): the owner's Cologne Cathedral prompt verbatim, and three of this evaluation's own in
// other domains (a mechanical product, a machine, an interior). Each prompt is broken into its elements before any run;
// each element is scored per run as done, approximated (how), missing or refused. An element an oracle can read from
// the document — scale, counts, a base slab, separate parts, joints, colours and materials — is scripted here; the rest
// (a shape's character: openwork, pointed arches, treads) is judged from the run's stills by a reviewer (review.json),
// and the score says which. There is no pass or fail beyond "the part evaluates": the elements are the result.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Brief } from './briefs';
import { allNodes, check, solids, type Element, type ElementVerdict, type Judged } from './oracle';

interface Box { key: string; lo: number[]; hi: number[]; size: number[] }
/** Every solid's world box: the assembly as placed, else the base part's bodies where they are. */
function boxesOf(j: Judged): Box[] {
  if (j.placed.length) return j.placed.map(b => {
    const P = b.mesh.positions, m = b.pose.m, t = b.pose.t, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const w = m[3 * k] * P[i] + m[3 * k + 1] * P[i + 1] + m[3 * k + 2] * P[i + 2] + t[k]; lo[k] = Math.min(lo[k], w); hi[k] = Math.max(hi[k], w); }
    return { key: b.key, lo, hi, size: hi.map((h, k) => h - lo[k]) };
  }).filter(b => b.size.every(v => v > 0));
  return solids(j.base).map(b => ({ key: b.key, lo: [...b.mesh.bounds.min], hi: [...b.mesh.bounds.max], size: [0, 1, 2].map(k => b.mesh.bounds.max[k] - b.mesh.bounds.min[k]) }));
}
const union = (bs: Box[]) => bs.length ? { lo: [0, 1, 2].map(k => Math.min(...bs.map(b => b.lo[k]))), hi: [0, 1, 2].map(k => Math.max(...bs.map(b => b.hi[k]))) } : null;
const r0 = (v: number) => Math.round(v);
/** The colours set on bodies (their looks) and the materials named, over the base part and the placed ones. */
function appearance(doc: StudioDoc): { colours: string[]; materials: string[] } {
  const docs = [doc, ...(doc.instances ?? []).map(i => i.doc)];
  const looks = docs.flatMap(d => Object.values(d.bodies ?? {}));
  return { colours: [...new Set(looks.map(l => l.color).filter((c): c is string => !!c).map(c => c.toLowerCase()))], materials: [...new Set([...looks.map(l => l.material), ...docs.map(d => (d.brief as { material?: { value?: string } } | undefined)?.material?.value)].filter((m): m is string => !!m))] };
}
/** The colour groups an element asks for: done with that many colours set, approximated by distinct materials, else missing (refused when a colour call was refused). */
function colourGroups(n: number, words: string): Element {
  return {
    id: 'colours', what: `${n} colour groups (${words})`,
    oracle(j, calls) {
      const a = appearance(j.doc), refused = calls.filter(c => !c.ok && /colou?r|appearance|look/i.test(JSON.stringify(c.args))).map(c => c.error?.slice(0, 200));
      if (a.colours.length >= n) return { status: 'done', evidence: a };
      if (refused.length) return { status: 'refused', how: refused[0], evidence: a };
      if (a.materials.length >= n) return { status: 'approximated', how: `${a.materials.length} materials stand in for the colours (no tool sets a colour)`, evidence: a };
      if (a.colours.length + a.materials.length > 0) return { status: 'approximated', how: `only ${a.colours.length} colours and ${a.materials.length} materials`, evidence: a };
      return { status: 'missing', how: 'no colour or material set (no agent tool sets a body\'s colour)', evidence: a };
    },
  };
}
/** The feature kinds used, counted: evidence beside a reviewed element. */
const kinds = (doc: StudioDoc) => { const c: Record<string, number> = {}; for (const n of allNodes(doc)) c[n.kind] = (c[n.kind] ?? 0) + 1; return c; };
const review = (id: string, what: string): Element => ({ id, what });
const evaluatesCheck = async (j: Judged) => [check('builds', 'the model evaluates to solids', solids(j.base).length + j.placed.length > 0, solids(j.base).length + j.placed.length), check('kinds', 'feature kinds used', true, kinds(j.doc), undefined, false)];

// ——— The owner's prompt, verbatim
const CATHEDRAL: Brief = {
  id: 'long-cathedral', ladder: 'long prompt', title: 'Cologne Cathedral (the owner\'s prompt, verbatim)',
  prompt: 'Build a model of Cologne Cathedral.\nThe model recreates the Gothic cathedral at true architectural scale: two openwork carved spires at the front facade, dark pitched roofs covering the nave and transept, and a polygonal apse on the east end. The facades are filled with pointed-arch lancet windows and circular rose windows, the exterior walls are supported by rows of flying buttresses, and the entrances feature deeply recessed pointed-arch portals. The whole structure sits on a light-colored rectangular base, with the building composed of pale limestone walls, dark gray roofs, and a few warm-toned accent elements.',
  caps: { maxCalls: 250, maxTurns: 6, wallMin: 75 },
  elements: [
    {
      id: 'scale', what: 'true architectural scale (the cathedral: about 145 m long, 86 m across the transept, spires 157 m)',
      oracle(j) {
        const u = union(boxesOf(j)); if (!u) return { status: 'missing', how: 'nothing built' };
        const L = Math.max(u.hi[0] - u.lo[0], u.hi[1] - u.lo[1]), H = u.hi[2] - u.lo[2], ev = { lengthM: +(L / 1000).toFixed(2), heightM: +(H / 1000).toFixed(2) };
        if (L >= 0.75 * 144500 && L <= 1.25 * 144500 && H >= 0.75 * 157000 && H <= 1.25 * 157000) return { status: 'done', evidence: ev };
        return { status: 'approximated', how: L < 0.75 * 144500 ? `scaled down: ${ev.lengthM} m long, ${ev.heightM} m high` : `off scale: ${ev.lengthM} m long, ${ev.heightM} m high`, evidence: ev };
      },
    },
    {
      id: 'spires', what: 'two spires at the front facade',
      oracle(j) {
        const bs = boxesOf(j), u = union(bs); if (!u) return { status: 'missing' };
        const H = u.hi[2], L = Math.max(u.hi[0] - u.lo[0], u.hi[1] - u.lo[1]);
        // (Tall and slender: reaching the top quarter, narrow against the building; grouped by where they stand.)
        const tall = bs.filter(b => b.hi[2] >= u.lo[2] + 0.75 * (H - u.lo[2]) && Math.max(b.size[0], b.size[1]) <= 0.3 * L);
        const groups: { x: number; y: number; r: number }[] = [];
        for (const b of tall) { const x = (b.lo[0] + b.hi[0]) / 2, y = (b.lo[1] + b.hi[1]) / 2, r = Math.max(b.size[0], b.size[1]) / 2; if (!groups.some(g => Math.hypot(g.x - x, g.y - y) <= g.r + r)) groups.push({ x, y, r }); }
        const ev = { towers: groups.length, at: groups.map(g => [r0(g.x), r0(g.y)]) };
        return groups.length === 2 ? { status: 'done', evidence: ev } : groups.length ? { status: 'approximated', how: `${groups.length} tall slender groups`, evidence: ev } : { status: 'missing', evidence: ev };
      },
    },
    review('openwork', 'the spires openwork and carved (pierced, tracery)'),
    review('roofs', 'dark pitched roofs over the nave and the transept (a cross plan)'),
    review('apse', 'a polygonal apse on the east end'),
    review('lancets', 'pointed-arch lancet windows filling the facades'),
    review('roses', 'circular rose windows'),
    review('buttresses', 'rows of flying buttresses along the walls'),
    review('portals', 'deeply recessed pointed-arch portals at the entrances'),
    {
      id: 'base', what: 'a light rectangular base the whole structure sits on',
      oracle(j) {
        const bs = boxesOf(j), u = union(bs); if (!u) return { status: 'missing' };
        const H = u.hi[2] - u.lo[2], others = (b: Box) => union(bs.filter(x => x !== b));
        const base = bs.find(b => Math.abs(b.lo[2] - u.lo[2]) < 1e-3 * H + 1 && b.size[2] <= 0.1 * H && (() => { const o = others(b); return !!o && b.size[0] >= 0.95 * (o.hi[0] - o.lo[0]) && b.size[1] >= 0.95 * (o.hi[1] - o.lo[1]); })());
        return base ? { status: 'done', evidence: { size: base.size.map(r0) } } : { status: 'missing', evidence: { bodies: bs.length } };
      },
    },
    colourGroups(3, 'pale limestone walls, dark grey roofs, warm accents'),
  ],
  async oracle(j) { return evaluatesCheck(j); },
};

const GRINDER: Brief = {
  id: 'long-grinder', ladder: 'long prompt', title: 'hand-crank burr coffee grinder (a mechanical product)',
  prompt: 'Design a manual burr coffee grinder for the kitchen counter. It has a cylindrical brushed-steel body about 55 mm across and 180 mm tall, with a knurled grip band around its middle. On top sits a domed lid with a central drive shaft, and a long folding crank arm reaches out from the shaft to a turned wooden knob standing upright at its end. Inside the body a conical burr sits under the bean hopper, and below it a threaded adjustment nut with numbered click marks sets the grind size. The ground coffee falls into a removable catch cup that screws onto the bottom of the body. The steel parts are silver, the knob and a ring round the lid are walnut brown, and the adjustment nut is black.',
  caps: { maxCalls: 250, maxTurns: 6, wallMin: 75 },
  elements: [
    {
      id: 'size', what: 'about Ø55 × 180 mm overall (the body; the crank may stand out)',
      oracle(j) {
        const u = union(boxesOf(j)); if (!u) return { status: 'missing' };
        const s = [0, 1, 2].map(k => u.hi[k] - u.lo[k]), h = Math.max(...s), ev = { size: s.map(r0) };
        return h >= 150 && h <= 260 ? { status: 'done', evidence: ev } : { status: 'approximated', how: `${s.map(r0).join(' × ')} mm`, evidence: ev };
      },
    },
    review('body', 'a cylindrical body'),
    review('knurl', 'a knurled grip band round its middle'),
    review('lid', 'a domed lid on top with a central drive shaft'),
    review('crank', 'a long crank arm from the shaft (folding)'),
    review('knob', 'a turned knob standing upright at the arm\'s end'),
    {
      id: 'burr', what: 'a conical burr inside the body, under the hopper',
      oracle(j) { const c = allNodes(j.doc).filter(n => /cone|loft|revolve/.test(n.kind)).length; return c ? { status: 'approximated', how: 'a cone, loft or revolve exists: its place and shape reviewed', evidence: kinds(j.doc) } : { status: 'missing', evidence: kinds(j.doc) }; },
    },
    review('hopper', 'a bean hopper over the burr'),
    review('nut', 'a threaded adjustment nut with numbered click marks'),
    {
      id: 'cup', what: 'a removable catch cup on the bottom (its own part)',
      oracle(j) {
        const inst = (j.doc.instances ?? []).find(i => /cup|catch/i.test(i.name ?? ''));
        if (inst) return { status: 'done', how: `part ${inst.id} "${inst.name}"`, evidence: { instances: (j.doc.instances ?? []).map(i => i.name) } };
        return { status: 'approximated', how: 'no separate part named as the cup: reviewed in the stills', evidence: { instances: (j.doc.instances ?? []).map(i => i.name), bodies: solids(j.base).length } };
      },
    },
    colourGroups(3, 'silver steel, walnut brown knob and ring, black nut'),
  ],
  async oracle(j) { return evaluatesCheck(j); },
};

const TRACTOR: Brief = {
  id: 'long-tractor', ladder: 'long prompt', title: 'compact farm tractor (a vehicle)',
  prompt: 'Build a model of a compact farm tractor. It has two large rear wheels with deep chevron-tread tyres and two much smaller front wheels on a steerable front axle. A long engine hood runs forward from the cab, with a slatted radiator grille at its nose and a tall vertical exhaust stack rising beside it. The driver sits in an open cab framed by four corner posts under a flat roof, with a steering wheel and a seat, reached by a step on the left side. At the rear there is a three-point hitch with two lower arms and a top link. The body and hood are bright red, the tyres black, the wheel rims yellow, and the exhaust and hitch dark grey.',
  caps: { maxCalls: 250, maxTurns: 6, wallMin: 75 },
  elements: [
    {
      id: 'wheels', what: 'two large rear wheels and two much smaller front wheels',
      oracle(j) {
        // (A wheel: two equal sides and a thinner third, the axle horizontal.)
        const ws = boxesOf(j).filter(b => { const [x, y, z] = b.size; return (Math.abs(x - z) <= 0.05 * Math.max(x, z) && y < 0.7 * x) || (Math.abs(y - z) <= 0.05 * Math.max(y, z) && x < 0.7 * y); }).map(b => b.size[2]);
        const big = Math.max(0, ...ws), nb = ws.filter(d => d >= 0.9 * big).length, small = ws.filter(d => d <= big / 1.4);
        const ev = { diameters: ws.map(r0).sort((a, b) => b - a) };
        return nb >= 2 && small.length >= 2 ? { status: 'done', evidence: ev } : ws.length >= 4 ? { status: 'approximated', how: 'four or more wheels, not two clearly larger', evidence: ev } : { status: 'missing', evidence: ev };
      },
    },
    review('treads', 'deep chevron treads on the rear tyres'),
    {
      id: 'steering', what: 'a steerable front axle (a joint that turns)',
      async oracle(j) {
        const r = await j.read('assembly', { action: 'joints' }), turns = (r.joints ?? []).filter((x: { type: string }) => x.type === 'revolute' || x.type === 'continuous');
        return r.error ? { status: 'missing', how: String(r.error).slice(0, 200) } : turns.length ? { status: 'approximated', how: `${turns.length} turning joints: whether one steers is reviewed`, evidence: turns.map((x: { key: string; axis: number[] }) => [x.key, x.axis]) } : { status: 'missing', how: 'no turning joint', evidence: (r.joints ?? []).length };
      },
    },
    review('hood', 'a long engine hood forward of the cab'),
    review('grille', 'a slatted radiator grille at its nose'),
    review('exhaust', 'a tall vertical exhaust stack beside the hood'),
    review('cab', 'an open cab of four corner posts under a flat roof'),
    review('controls', 'a steering wheel and a seat'),
    review('step', 'a step on the left side'),
    review('hitch', 'a three-point hitch at the rear: two lower arms and a top link'),
    colourGroups(4, 'red body and hood, black tyres, yellow rims, dark grey exhaust and hitch'),
  ],
  async oracle(j) { return evaluatesCheck(j); },
};

const ROOM: Brief = {
  id: 'long-living-room', ladder: 'long prompt', title: 'Scandinavian living room (an interior)',
  prompt: 'Model a small Scandinavian living room, about 4 by 5 metres with a 2.6 metre ceiling, shown with two walls and the floor. The floor is light oak planks. One wall has a tall window with a deep sill and the other has a doorway. Against the window wall stands a three-seat sofa with loose seat cushions and thin tapered wooden legs; in front of it is a round coffee table on three legs, on a rectangular wool rug. In one corner a floor lamp with a thin arched stem hangs a dome shade over the sofa, and along the other wall a low bookshelf holds rows of books. A pendant light hangs from the ceiling above the table. The walls are white, the sofa grey, the wood light oak, and the lamp and pendant black.',
  caps: { maxCalls: 250, maxTurns: 6, wallMin: 75 },
  elements: [
    {
      id: 'room', what: 'about 4 × 5 m, walls 2.6 m high',
      oracle(j) {
        const u = union(boxesOf(j)); if (!u) return { status: 'missing' };
        const s = [0, 1, 2].map(k => u.hi[k] - u.lo[k]), f = [s[0], s[1]].sort((a, b) => a - b), ev = { sizeM: s.map(v => +(v / 1000).toFixed(2)) };
        return Math.abs(f[0] - 4000) <= 400 && Math.abs(f[1] - 5000) <= 500 && Math.abs(s[2] - 2600) <= 300 ? { status: 'done', evidence: ev } : { status: 'approximated', how: `${ev.sizeM.join(' × ')} m`, evidence: ev };
      },
    },
    {
      id: 'shell', what: 'two walls and the floor',
      oracle(j) {
        const u = union(boxesOf(j)); if (!u) return { status: 'missing' };
        // (A slab: one side under 5 % of the room's larger sides, the others most of the room.)
        const slabs = boxesOf(j).filter(b => { const s = [...b.size].sort((a, c) => a - c); return s[0] <= 0.05 * s[2] && s[1] >= 0.5 * 2600; });
        const floor = slabs.filter(b => b.size[2] === Math.min(...b.size)).length, walls = slabs.length - floor;
        return floor >= 1 && walls >= 2 ? { status: 'done', evidence: { floor, walls } } : { status: 'approximated', how: `${floor} floor and ${walls} wall slabs`, evidence: { floor, walls } };
      },
    },
    review('planks', 'the floor as planks'),
    review('window', 'a tall window with a deep sill in one wall'),
    review('door', 'a doorway in the other wall'),
    review('sofa', 'a three-seat sofa against the window wall'),
    review('cushions', 'loose seat cushions'),
    review('legs', 'thin tapered sofa legs'),
    review('table', 'a round coffee table on three legs'),
    review('rug', 'a rectangular rug under it'),
    review('lamp', 'a floor lamp in a corner: a thin arched stem and a dome shade over the sofa'),
    review('shelf', 'a low bookshelf with rows of books along the other wall'),
    review('pendant', 'a pendant light from the ceiling above the table'),
    colourGroups(4, 'white walls, grey sofa, light oak wood, black lamp and pendant'),
  ],
  async oracle(j) { return evaluatesCheck(j); },
};

export const LONG_BRIEFS: Brief[] = [CATHEDRAL, GRINDER, TRACTOR, ROOM];
export type { ElementVerdict };
