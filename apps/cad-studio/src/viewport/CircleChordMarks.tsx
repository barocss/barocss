import type { CircleChordDraft } from '../sketch/useCircleFromChord';

export function CircleChordMarks({ draft, project }: { draft: CircleChordDraft; project(u: number, v: number): readonly number[] }) {
  if (!draft.first) return null;
  const [ax, ay] = project(...draft.first);
  const { preview } = draft;
  const second = draft.second && project(...draft.second);
  return <g className="sk-circle-chord" pointerEvents="none">
    {second && <line x1={ax} y1={ay} x2={second[0]} y2={second[1]} className="sk-guide" />}
    <circle cx={ax} cy={ay} r={3.5} className="sk-point sk-circle-chord-end" />
    {second && <circle cx={second[0]} cy={second[1]} r={3.5} className="sk-point sk-circle-chord-end" />}
    {preview && preview.centers.map(([u, v], index) => {
      const r = preview.radius, [x, y] = project(u, v);
      const ring = Array.from({ length: 96 }, (_, step) => {
        const angle = step * Math.PI / 48;
        const [x, y] = project(u + r * Math.cos(angle), v + r * Math.sin(angle));
        return x + ',' + y;
      });
      return <g key={index} className="sk-circle-chord-candidate">
        <polygon points={ring.join(' ')} className="sk-guide" fill="none" />
        <circle cx={x} cy={y} r={3} className="sk-point sk-circle-chord-center" />
        <text x={x + (index === 0 ? -9 : 9)} y={y - 6} textAnchor="middle" className="dim-text">{index + 1}</text>
      </g>;
    })}
  </g>;
}
