// R8.2 (D81): a SubD cage drawn over the viewport while it is edited — faces picked (n-gons tinted), edges (picked,
// creased, open, non-manifold), vertices (picked, poles ringed), and the mirrored half faint. Drawn over the body
// (the cage is the thing edited; nothing hides it), projected every frame — each kind as one SVG path, so a cage of
// thousands of edges stays a handful of elements.
import type { CageOverlay } from './Viewport';

type P = (p: readonly number[]) => [number, number, number];
const ek = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;

export function CageMarks({ overlay, project }: { overlay: CageOverlay; project: P }) {
  const { cage, sel, mode, validation: v } = overlay, n = cage.positions.length / 3;
  const X = new Float64Array(n), Y = new Float64Array(n);
  for (let i = 0; i < n; i++) { const q = project([cage.positions[3 * i], cage.positions[3 * i + 1], cage.positions[3 * i + 2]]); X[i] = q[0]; Y[i] = q[1]; }
  const xy = (i: number) => `${X[i].toFixed(1)},${Y[i].toFixed(1)}`;
  const selFaces = new Set(sel.faces), selEdges = new Set(sel.edges.map(([a, b]) => ek(a, b))), selVerts = new Set(sel.vertices);
  const creased = new Set((cage.creases ?? []).map(([a, b]) => ek(a, b))), ngons = new Set(v.ngons);
  const open = new Set(v.boundaryEdges.map(([a, b]) => ek(a, b))), bad = new Set(v.nonManifoldEdges.map(([a, b]) => ek(a, b)));
  const poles = new Set(v.poles.map(p => p.vertex)), badVerts = new Set(v.nonManifoldVertices);
  // Edges by kind, each kind one path.
  const paths: Record<'plain' | 'picked' | 'crease' | 'open' | 'bad', string[]> = { plain: [], picked: [], crease: [], open: [], bad: [] }, seen = new Set<string>();
  for (const f of cage.faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length], key = ek(a, b);
    if (seen.has(key)) continue; seen.add(key);
    const kind = selEdges.has(key) ? 'picked' : bad.has(key) ? 'bad' : open.has(key) ? 'open' : creased.has(key) ? 'crease' : 'plain';
    paths[kind].push(`M${xy(a)}L${xy(b)}`);
  }
  const dot = (i: number, r: number) => `M${(X[i] - r).toFixed(1)},${Y[i].toFixed(1)}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;
  const verts: Record<'plain' | 'picked' | 'pole' | 'bad', string[]> = { plain: [], picked: [], pole: [], bad: [] };
  for (let i = 0; i < n; i++) {
    if (selVerts.has(i)) verts.picked.push(dot(i, 4.5)); else if (badVerts.has(i)) verts.bad.push(dot(i, 4)); else if (poles.has(i)) verts.pole.push(dot(i, 4)); else if (mode === 'vertex') verts.plain.push(dot(i, 2.5));
  }
  const faces = (set: (k: number) => boolean) => cage.faces.flatMap((f, k) => set(k) ? ['M' + f.map(xy).join('L') + 'Z'] : []).join('');
  const m = overlay.mirrored;
  const mirrorPath = m ? (() => { const M = Array.from({ length: m.positions.length / 3 }, (_, i) => project([m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]])); return m.faces.map(f => 'M' + f.map(i => `${M[i][0].toFixed(1)},${M[i][1].toFixed(1)}`).join('L') + 'Z').join(''); })() : '';
  return <g className="cage" aria-label="SubD cage" data-edges={seen.size} data-picked-edges={paths.picked.length}>
    {mirrorPath && <path d={mirrorPath} className="cage-mirror" />}
    {ngons.size > 0 && <path d={faces(k => ngons.has(k) && !selFaces.has(k))} className="cage-face ngon" />}
    {selFaces.size > 0 && <path d={faces(k => selFaces.has(k))} className="cage-face picked" data-picked-faces={selFaces.size} />}
    {(['plain', 'crease', 'open', 'bad', 'picked'] as const).map(k => paths[k].length > 0 && <path key={k} d={paths[k].join('')} className={`cage-edge${k === 'plain' ? '' : ' ' + k}`} />)}
    {(['plain', 'pole', 'bad', 'picked'] as const).map(k => verts[k].length > 0 && <path key={'v' + k} d={verts[k].join('')} className={`cage-vertex${k === 'plain' ? '' : ' ' + k}`} />)}
  </g>;
}
