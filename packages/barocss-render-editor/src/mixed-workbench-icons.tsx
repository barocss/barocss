import { prepareCamera } from '@barocss/gpu';
import type { MeshCamera } from '@barocss/gpu';

export function WorkbenchIcon({ kind }: { kind: 'sphere' | 'box' | 'cylinder' | 'capsule' | 'rounded-box' | 'torus' | 'surface' | 'curve' | 'source' | 'problems' | 'projects' | 'camera' }) {
  const paths = {
    sphere: <><circle cx="10" cy="10" r="7" /><ellipse cx="10" cy="10" rx="3" ry="7" /><path d="M3 10h14" /></>,
    box: <><path d="m3 6 7-4 7 4v8l-7 4-7-4zM3 6l7 4 7-4M10 10v8" /></>,
    cylinder: <><ellipse cx="10" cy="4" rx="6" ry="2" /><path d="M4 4v12c0 3 12 3 12 0V4M4 16c0-3 12-3 12 0" /></>,
    capsule: <><rect x="6" y="2" width="8" height="16" rx="4" /><path d="M6 6h8M6 14h8" /></>,
    'rounded-box': <><rect x="3" y="3" width="14" height="14" rx="4" /><path d="m6 5 7 3 2 7M13 8l-5 6-3-2" /></>,
    torus: <><ellipse cx="10" cy="10" rx="8" ry="6" /><ellipse cx="10" cy="10" rx="4" ry="2.5" /></>,
    surface: <><path d="m3 6 9-3 5 11-9 3z" /><path d="m6 5 5 11M9 4l5 11M4 10l10-3M6 14l10-3" /></>,
    curve: <><path d="M3 15C5 2 15 18 17 5" /><circle cx="3" cy="15" r="1" /><circle cx="17" cy="5" r="1" /></>,
    source: <><path d="m7 5-5 5 5 5m6-10 5 5-5 5m-2-12-2 14" /></>,
    problems: <><path d="m10 2 8 15H2zM10 7v4" /><path d="M10 14h.01" /></>,
    projects: <><path d="M2 6V4h6l2 2h8v11H2z" /></>,
    camera: <><path d="M2 6h11v10H2zM13 9l5-3v10l-5-3" /></>,
  };
  return <svg className="re-workbench-icon" viewBox="0 0 20 20" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

/** Read-only world-axis directions from the public GPU camera view basis. */
export function ViewOrientation({ camera }: { camera: MeshCamera }) {
  let view: Float32Array;
  try { view = prepareCamera(camera, 1).view; } catch { return null; }
  const axes = [
    { label: 'X', color: '#dc7773', x: view[0], y: view[1], depth: view[2] },
    { label: 'Y', color: '#83b48d', x: view[4], y: view[5], depth: view[6] },
    { label: 'Z', color: '#829fda', x: view[8], y: view[9], depth: view[10] },
  ].sort((a, b) => a.depth - b.depth);
  return <svg className="re-workbench-orientation" viewBox="0 0 76 76" role="img" aria-label="View orientation" data-testid="view-orientation">
    <circle cx="38" cy="38" r="2" fill="#83909a" />
    {axes.map((axis) => {
      const x = 38 + axis.x * 24, y = 38 - axis.y * 24;
      return <g key={axis.label} data-axis={axis.label}><line x1="38" y1="38" x2={x} y2={y} stroke={axis.color} strokeWidth="1.5" />
        <circle cx={x} cy={y} r="3" fill={axis.color} />
        <text x={x + 5} y={y + 4} fill={axis.color} fontSize="10" fontWeight="600">{axis.label}</text></g>;
    })}
  </svg>;
}
