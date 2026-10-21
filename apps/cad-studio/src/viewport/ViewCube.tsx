// The view cube, as CAD tools have it: a small cube turned with the camera, its faces named (Top, Front,
// Right …). A click on a face looks straight at it; on a corner, from that corner (isometric); on an edge,
// from between its two faces. Dragging it orbits. Hovered parts light up.
import { memo, useRef, useState } from 'react';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

const FACES: { n: Vec3; label: string }[] = [
  { n: [0, 0, 1], label: 'TOP' }, { n: [0, 0, -1], label: 'BOTTOM' }, { n: [0, -1, 0], label: 'FRONT' },
  { n: [0, 1, 0], label: 'BACK' }, { n: [1, 0, 0], label: 'RIGHT' }, { n: [-1, 0, 0], label: 'LEFT' },
];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SIZE = 96, HALF = 26, CUT = 0.28;

/**
 * `basis`: the camera's right, up and forward (world). `onLook(dir)`: look along −dir (from dir, a unit
 * vector from the target to the eye). `onOrbit(dx, dy)`: a drag on the cube, in pixels.
 */
type ViewCubeProps = { right: Vec3; up: Vec3; forward: Vec3; onLook(from: Vec3): void; onOrbit(dx: number, dy: number): void };
const sameVec = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/**
 * (G13: drawn again only when the camera turns — the overlay renders on every frame and on every App update; the
 * callbacks are the viewport's, which read its refs, so the ones from an earlier render do the same.)
 */
export const ViewCube = memo(ViewCubeView, (a: ViewCubeProps, b: ViewCubeProps) => sameVec(a.right, b.right) && sameVec(a.up, b.up) && sameVec(a.forward, b.forward));
function ViewCubeView({ right, up, forward, onLook, onOrbit }: ViewCubeProps) {
  const [hot, setHot] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const c = SIZE / 2, P = (p: Vec3): [number, number] => [c + dot(p, right) * HALF, c - dot(p, up) * HALF];
  const toward = (n: Vec3) => -dot(n, forward);
  // Each face as its middle square, with eight bevel pieces round it (edges and corners) to click.
  type Part = { id: string; key: string; from: Vec3; pts: [number, number][]; depth: number; face?: string };
  const parts: Part[] = [];
  for (const f of FACES) {
    if (toward(f.n) <= 0.02) continue;
    const k = f.n.findIndex(x => x !== 0), [i, j] = [0, 1, 2].filter(a => a !== k), s = f.n[k];
    const at = (u: number, v: number): Vec3 => { const p: Vec3 = [0, 0, 0]; p[k] = s; p[i] = u; p[j] = v; return p; };
    const cells = [-1, -1 + CUT, 1 - CUT, 1];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const [u0, u1, v0, v1] = [cells[a], cells[a + 1], cells[b], cells[b + 1]];
      const from: Vec3 = [...f.n] as Vec3;
      if (a !== 1) from[i] = a === 0 ? -1 : 1;
      if (b !== 1) from[j] = b === 0 ? -1 : 1;
      const id = from.map(x => x > 0 ? '+' : x < 0 ? '-' : '0').join('');
      const pts = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)].map(P);
      parts.push({ id, key: `${f.label}${a}${b}`, from, pts, depth: toward(f.n), ...(a === 1 && b === 1 ? { face: f.label } : {}) });
    }
  }
  parts.sort((p, q) => p.depth - q.depth);
  const unit = (v: Vec3): Vec3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  return (
    <svg className="view-cube" width={SIZE} height={SIZE} role="group" aria-label="View cube"
      onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, moved: false }; }}
      onPointerMove={e => { const d = drag.current; if (!d || !(e.buttons & 1)) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.hypot(dx, dy) < 3) return; d.moved = true; d.x = e.clientX; d.y = e.clientY; onOrbit(dx, dy); }}
      onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
      onPointerLeave={() => setHot(null)}>
      {parts.map(p => {
        const on = hot === p.id, face = !!p.face;
        // (Keyed by its face and cell: a turn updates its points rather than making it again.)
        return <polygon key={p.key} points={p.pts.map(q => q.map(x => x.toFixed(1)).join(',')).join(' ')} data-view={p.id}
          className={'vc-part' + (face ? ' face' : '') + (on ? ' hot' : '')} style={{ ['--shade' as string]: String(0.55 + 0.45 * p.depth) }}
          onPointerEnter={() => setHot(p.id)} onClick={() => { if (!drag.current?.moved) onLook(unit(p.from)); }} />;
      })}
      {parts.filter(p => p.face).map(p => {
        const m = p.pts.reduce((s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4], [0, 0]);
        return <text key={'l' + p.face} x={m[0]} y={m[1] + 3} textAnchor="middle" className="vc-label" style={{ opacity: Math.min(1, p.depth * 1.6) }}>{p.face}</text>;
      })}
    </svg>
  );
}
