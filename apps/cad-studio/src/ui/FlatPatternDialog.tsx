// A sheet-metal body's flat pattern (R12.2, D117): drawn to scale — its outline, each bend's centre line dashed (up and
// down in two colours) with its note — and exported as DXF (2000 or R12) through the kernel's flat document and writer.
import { useState } from 'react';
import { evaluateCurve, flatPatternDxf, writeDxf, type DxfVersion, type FlatPattern, type FlatSegment } from '@barocss/cad';
import { downloadBytes } from './files';
import { Icon } from './atoms';

const f2 = (v: number) => String(Math.round(v * 1000) / 1000);
/** A loop as SVG path data, y flipped (the flat's y goes up) within a box `h` high. */
function loopPath(segs: readonly FlatSegment[], h: number): string {
  const p = (x: number, y: number) => `${f2(x)} ${f2(h - y)}`;
  let d = '';
  segs.forEach((s, i) => {
    if (s.kind === 'line') { d += (i ? 'L' : 'M') + p(s.a[0], s.a[1]) + 'L' + p(s.b[0], s.b[1]); return; }
    if (s.kind === 'arc') {
      const closed = s.start[0] === s.end[0] && s.start[1] === s.end[1], r = f2(s.radius);
      // (Counter-clockwise in the flat is clockwise on screen, y down: SVG's positive sweep.)
      const sweep = s.ccw ? 1 : 0;
      if (closed) { const o: [number, number] = [2 * s.center[0] - s.start[0], 2 * s.center[1] - s.start[1]]; d += `M${p(s.start[0], s.start[1])}A${r} ${r} 0 0 ${sweep} ${p(o[0], o[1])}A${r} ${r} 0 0 ${sweep} ${p(s.start[0], s.start[1])}`; return; }
      const a0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]), a1 = Math.atan2(s.end[1] - s.center[1], s.end[0] - s.center[0]);
      let sw = a1 - a0; if (s.ccw) { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
      d += (i ? 'L' : 'M') + p(s.start[0], s.start[1]) + `A${r} ${r} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sweep} ${p(s.end[0], s.end[1])}`;
      return;
    }
    const curve = { kind: 'curve' as const, id: 'flat', degree: s.degree, knots: [...s.knots], controlPoints: s.control.map(q => [q[0], q[1], 0] as [number, number, number]), weights: [...s.weights] };
    const lo = s.knots[0], hi = s.knots[s.knots.length - 1];
    for (let k = 0; k <= 64; k++) { const q = evaluateCurve(curve, lo + (hi - lo) * k / 64); d += (i || k ? 'L' : 'M') + p(q[0], q[1]); }
  });
  return d + 'Z';
}

export function FlatPatternDialog({ flat, name, onClose }: { flat: FlatPattern; name: string; onClose: () => void }) {
  const [version, setVersion] = useState<DxfVersion>('AC1015');
  const [w, h] = flat.box.max, m = Math.max(w, h) * 0.06 + 2;
  const exportDxf = () => downloadBytes(writeDxf(flatPatternDxf(flat), { version }).bytes, `${name}-flat.dxf`, 'image/vnd.dxf');
  return <div className="toast card recovery flat-pattern" role="dialog" aria-label="Flat pattern">
    <Icon name="straighten" className="accent" />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="toast-title">Flat pattern · {name}</div>
      <div className="toast-hint">{f2(w)} × {f2(h)} mm · {flat.bends.length} bend{flat.bends.length === 1 ? '' : 's'} · T {f2(flat.thicknessMM)} mm, K {flat.kFactor} · seen from {flat.fixedFace}</div>
      <svg aria-label="Flat pattern drawing" viewBox={`${f2(-m)} ${f2(-m)} ${f2(w + 2 * m)} ${f2(h + 2 * m)}`} style={{ width: '100%', maxHeight: '55vh', margin: '8px 0', background: 'var(--surface-2, transparent)' }}>
        <path d={flat.loops.map(l => loopPath(l.segments, h)).join('')} fillRule="evenodd" fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={Math.max(w, h) / 400} />
        {flat.bends.map((b, k) => {
          const [p, q] = b.centre, up = b.direction === 'up', mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          return <g key={k} aria-label={`Bend ${b.direction}`}>
            <line x1={f2(p[0])} y1={f2(h - p[1])} x2={f2(q[0])} y2={f2(h - q[1])} stroke={up ? '#3fb950' : '#f85149'} strokeWidth={Math.max(w, h) / 400} strokeDasharray={`${f2(Math.max(w, h) / 80)} ${f2(Math.max(w, h) / 160)}`} />
            <text x={f2(mid[0])} y={f2(h - mid[1])} fontSize={f2(Math.max(w, h) / 40)} textAnchor="middle" fill={up ? '#3fb950' : '#f85149'} dy="-0.4em">{`${b.direction.toUpperCase()} ${+b.angleDegrees.toFixed(2)}° R${+b.radiusMM.toFixed(3)}`}</text>
          </g>;
        })}
      </svg>
      <div className="row-actions">
        <button className="primary" aria-label="Export flat DXF" onClick={exportDxf} title="The flat at true size in mm: OUTLINE, BEND_UP, BEND_DOWN (dashed) and BEND_NOTES layers">DXF</button>
        <select aria-label="Flat DXF version" value={version} onChange={e => setVersion(e.target.value as DxfVersion)} title="DXF 2000, or R12 for older programs">
          <option value="AC1015">2000</option><option value="AC1009">R12</option>
        </select>
        <button className="ghost" aria-label="Close the flat pattern" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}
