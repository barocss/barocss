import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

// The commutativity check's findings (scripts/rb/commute.mjs, D271): union nodes of the L4 fuzz's trees whose bodies
// failed the strict check, built both ways round (A ∪ B and B ∪ A).
const swapped = n => ({ ...n, a: n.b, b: n.a });
/** Mesh edges (by position) not used exactly twice within one body. */
function openEdges(o) {
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, shellOf = new Map(o.brep.faces.map(f => [f.id, f.shell])), bodyOf = new Map(o.brep.shells.map(s => [s.id, s.body])), uses = new Map();
  for (const f of mesh.faces) for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = `${bodyOf.get(shellOf.get(f.faceId))}:${ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  return [...uses.values()].filter(n => n !== 2).length;
}
function builds(name, node) {
  const q = oracle(node, 256, 6);
  for (const [order, n] of [['A ∪ B', node], ['B ∪ A', swapped(node)]]) {
    const { document, root } = documentOf(n), o = evaluateCadPart(document).outputs.find(x => x.id === root), report = o.validate(), m = o.massProperties(1);
    assert.equal(report.valid, true, `${name}, ${order}: ${report.issues[0]}`);
    assert.equal(openEdges(o), 0, `${name}, ${order}: watertight`);
    assert.ok(Math.abs(m.volumeMM3 - q.volumeMM3) <= 3 * q.e + 1e-4 * q.volumeMM3, `${name}, ${order}: ${m.volumeMM3} vs the oracle ${q.volumeMM3} ± ${q.e}`);
  }
}
function refuses(name, node, words) {
  for (const [order, n] of [['A ∪ B', node], ['B ∪ A', swapped(node)]]) {
    const { document, root } = documentOf(n);
    assert.throws(() => evaluateCadPart(document).outputs.find(x => x.id === root).brep, e => e.code === 'GEOMETRY' && words.test(e.message), `${name}, ${order}`);
  }
}

test('analytic Boolean: a ruling along another face\'s edge leaves no slit up a cylinder\'s wall (commutativity 20261024 #96, D273)', () => {
  // (A cylinder whose wall touches a box's edge along a ruling: two lumps touching along a line, each a body (D204); the
  // wall was cut along the ruling, which divides nothing, and its loop ran up the slit and back.)
  builds('a cylinder touching a box\'s edge along a ruling', {"op":"union","a":{"leaf":{"kind":"cyl","r":3,"h":7,"rot":[],"move":[-2,-1,-1]}},"b":{"leaf":{"kind":"box","w":2,"d":5,"h":4,"rot":[{"axis":"y","deg":180},{"axis":"y","deg":270}],"move":[-2,2,0]}}});
  // (With the slit gone, the root of 24#165 builds both ways too: A ∪ B was refused, B ∪ A failed the strict check.)
  builds('24#165', {"op":"union","a":{"op":"union","a":{"op":"union","a":{"leaf":{"kind":"rbox","w":7,"d":7,"h":6,"r":1,"rot":[],"move":[-2,-3,-1]}},"b":{"leaf":{"kind":"sphere","r":3,"rot":[{"axis":"y","deg":270}],"move":[1,2,2]}}},"b":{"op":"union","a":{"leaf":{"kind":"cyl","r":3,"h":4,"rot":[],"move":[-1,1,1]}},"b":{"leaf":{"kind":"hbox","w":3,"d":4,"h":6,"t":0.5,"open":true,"rot":[{"axis":"y","deg":180}],"move":[-1,-2,-1]}}}},"b":{"op":"difference","a":{"op":"union","a":{"leaf":{"kind":"cyl","r":3,"h":6,"rot":[{"axis":"x","deg":270}],"move":[2,-2,-2]}},"b":{"leaf":{"kind":"cyl","r":2,"h":4,"rot":[{"axis":"x","deg":180},{"axis":"x","deg":180}],"move":[2,-1,-1]}}},"b":{"leaf":{"kind":"cone","r1":2,"r2":1,"h":5,"rot":[{"axis":"y","deg":180}],"move":[0,-2,0]}}}});
});

test('strict check: a face\'s cusp, two curves tangent inside each other at a vertex, is its shape, not a touch (commutativity 20261024 #165, 20261023 #170, D274)', () => {
  // (A wall tangent inside a rounded box's corner fillet: the cap between them closes to a zero-angle point. The flatter
  // curve's chords cut the other a third of a chord from the vertex at every sampling.)
  builds('a cylinder tangent inside a rounded box\'s corner', {"op":"union","a":{"op":"union","a":{"leaf":{"kind":"rbox","w":7,"d":7,"h":6,"r":1,"rot":[],"move":[-2,-3,-1]}},"b":{"leaf":{"kind":"sphere","r":3,"rot":[{"axis":"y","deg":270}],"move":[1,2,2]}}},"b":{"op":"union","a":{"leaf":{"kind":"cyl","r":3,"h":4,"rot":[],"move":[-1,1,1]}},"b":{"leaf":{"kind":"hbox","w":3,"d":4,"h":6,"t":0.5,"open":true,"rot":[{"axis":"y","deg":180}],"move":[-1,-2,-1]}}}});
  builds('a cone\'s base tangent inside a rounded box\'s corner', {"op":"union","a":{"leaf":{"kind":"rbox","w":7,"d":5,"h":6,"r":1,"rot":[],"move":[-1,-2,2]}},"b":{"leaf":{"kind":"cone","r1":3,"r2":0,"h":3,"rot":[{"axis":"z","deg":180}],"move":[0,1,3]}}});
});

test('a union whose parts touch along a line from outside each other is refused, typed (commutativity 20261023 #114, 20261024 #51, D275)', () => {
  // (Two of the parts tangent from outside along a line, joined elsewhere: the body touches itself along it. The analytic
  // Boolean, and the prismatic solids where both sides of the line are solid — not the crescent, D195.)
  refuses('two cones tangent from outside, joined through a third part', {"op":"union","a":{"pattern":{"kind":"linear","axis":"y","spacing":8,"count":4},"child":{"leaf":{"kind":"cone","r1":4,"r2":2,"h":2,"rot":[{"axis":"z","deg":90},{"axis":"z","deg":180}],"move":[1,-2,0]}}},"b":{"op":"intersect","a":{"leaf":{"kind":"sphere","r":3,"rot":[],"move":[0,1,0]}},"b":{"leaf":{"kind":"hbox","w":3,"d":4,"h":4,"t":0.5,"open":false,"rot":[],"move":[2,0,0]}}}}, /touches itself at/);
  refuses('two upright cylinders tangent from outside, joined through a third', {"op":"union","a":{"op":"union","a":{"leaf":{"kind":"cyl","r":3,"h":7,"rot":[],"move":[-2,-3,0]}},"b":{"leaf":{"kind":"cyl","r":2,"h":5,"rot":[],"move":[2,-1,0]}}},"b":{"op":"difference","a":{"leaf":{"kind":"cyl","r":3,"h":4,"rot":[],"move":[-2,2,0]}},"b":{"leaf":{"kind":"hbox","w":4,"d":4,"h":4,"t":0.5,"open":true,"rot":[{"axis":"y","deg":180}],"move":[-3,0,2]}}}}, /touches itself along the vertical line/);
});
