// CAD command icons as small line drawings (24 × 24, the current colour), drawn the way CAD tools show
// them: the shape the command makes, with the changed part in a second weight. `Icon` uses one of these
// when its name starts with `cad-`.
import type { ReactNode } from 'react';

const P = (d: string, extra: Record<string, string | number> = {}) => <path d={d} {...extra} />;
const accent = { strokeWidth: 2.1 };
const dash = { strokeDasharray: '2 1.6' };
const fill = { fill: 'currentColor', fillOpacity: 0.22, stroke: 'none' };

export const CAD_ICONS: Record<string, ReactNode> = {
  // A pencil over a profile.
  'cad-sketch': <>{P('M4 18h9M4 18V9', dash)}{P('M14.5 5.5l4 4L10 18H6v-4z')}{P('M12.5 7.5l4 4')}</>,
  // A profile pulled up into a block, the arrow showing the pull.
  'cad-extrude': <>{P('M4 17l6 3 10-5-6-3z', fill)}{P('M4 17l6 3 10-5-6-3z')}{P('M4 17V11M10 20v-6M20 15V9', dash)}{P('M4 11l6 3 10-5', dash)}{P('M12 12V3M9.5 5.5L12 3l2.5 2.5', accent)}</>,
  // A half profile turned about an axis.
  'cad-revolve': <>{P('M12 3v18', dash)}{P('M12 6h4v8h-4', fill)}{P('M12 6h4v8h-4')}{P('M6.5 16.5a7 3 0 0 0 11 0', accent)}{P('M16.6 14.6l.9 1.9-2 .5', accent)}</>,
  // A round section carried along a bent path.
  'cad-sweep': <>{P('M4 20c0-8 4-12 12-12h4', dash)}{P('M4 20c0-8 4-12 12-12', accent)}<ellipse cx="18" cy="8" rx="2" ry="3.2" /><ellipse cx="4" cy="20" rx="2.6" ry="1.4" /></>,
  // Two sections joined: a square below, a circle above.
  'cad-loft': <><ellipse cx="12" cy="6" rx="4.5" ry="1.8" />{P('M4 17l8 3 8-3-8-3z', fill)}{P('M4 17l8 3 8-3-8-3z')}{P('M7.5 6.3L4 17M16.5 6.3L20 17', accent)}</>,
  // A block with a round opening going down into it.
  'cad-hole': <>{P('M3 9l9-4 9 4-9 4z')}{P('M3 9v8l9 4 9-4V9M12 13v8')}<ellipse cx="12" cy="9" rx="3.4" ry="1.5" {...accent} />{P('M8.6 9v5M15.4 9v5', dash)}</>,
  // A corner rounded.
  'cad-fillet': <>{P('M4 20V9a5 5 0 0 1 5-5h11', accent)}{P('M4 20h16V4', dash)}</>,
  // A corner cut off at 45°.
  'cad-chamfer': <>{P('M4 20V10l6-6h10', accent)}{P('M4 20h16V4', dash)}{P('M4 10h6V4', { ...dash, strokeOpacity: 0.6 })}</>,
  // A box hollowed with its top open.
  'cad-shell': <>{P('M3 9l9-4 9 4v8l-9 4-9-4z')}{P('M6 9.4l6-2.6 6 2.6-6 2.6z', fill)}{P('M6 9.4l6-2.6 6 2.6-6 2.6z', accent)}{P('M12 12v9')}</>,
  // A wall leaning away from its pull direction.
  'cad-draft': <>{P('M6 20L9 5h6l3 15z', fill)}{P('M6 20L9 5h6l3 15z')}{P('M12 21V3', dash)}{P('M9 5L7.4 13', accent)}</>,
  // Arrows in four directions.
  'cad-move': <>{P('M12 3v18M3 12h18')}{P('M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5', accent)}</>,
  // A turn about a centre.
  'cad-rotate': <>{P('M19 12a7 7 0 1 1-2.05-4.95', accent)}{P('M17.5 3.5v4h-4', accent)}<circle cx="12" cy="12" r="1.4" {...fill} fillOpacity={1} /></>,
  // A small square grown into a large one from a corner.
  'cad-scale': <>{P('M4 20V9h11v11z', dash)}{P('M4 20v-5h5v5z', fill)}{P('M4 20v-5h5v5z')}{P('M10 14l9-9M14 5h5v5', accent)}</>,
  // A shape and its reflection across a dashed plane.
  'cad-mirror': <>{P('M12 3v18', dash)}{P('M9 7L4 17h5z', fill)}{P('M9 7L4 17h5z')}{P('M15 7l5 10h-5z', accent)}</>,
  // Three copies in a row.
  'cad-pattern-linear': <>{P('M3 9h5v6H3z', fill)}{P('M3 9h5v6H3z')}{P('M10 9h5v6h-5zM17 9h4v6h-4', accent)}{P('M3 19h18M18.5 17.5L21 19l-2.5 1.5')}</>,
  // Copies round an axis.
  'cad-pattern-circular': <><circle cx="12" cy="12" r="7" {...dash} /><circle cx="12" cy="5" r="2" {...fill} fillOpacity={0.6} /><circle cx="12" cy="5" r="2" /><circle cx="18.1" cy="15.5" r="2" {...accent} /><circle cx="5.9" cy="15.5" r="2" {...accent} /></>,
  // A block cut in two by a plane.
  'cad-split': <>{P('M3 9l9-4 9 4v8l-9 4-9-4z')}{P('M12 3v19', accent)}{P('M7.5 7v12M16.5 7v12', dash)}</>,
  // A ruler.
  'cad-measure': <>{P('M3 15l12-12 6 6-12 12z')}{P('M7 11l2 2M10 8l1.5 1.5M13 5l2 2M5.5 12.5l1 1M8.5 9.5l1 1', accent)}</>,
  // A block.
  'cad-box': <>{P('M3 8l9-4 9 4v9l-9 4-9-4z')}{P('M3 8l9 4 9-4M12 12v9')}{P('M3 8l9-4 9 4-9 4z', fill)}</>,
  // A cylinder.
  'cad-cylinder': <><ellipse cx="12" cy="6" rx="7" ry="2.6" />{P('M5 6v12a7 2.6 0 0 0 14 0V6')}<ellipse cx="12" cy="6" rx="7" ry="2.6" {...fill} /></>,
  // Booleans: two overlapping rings with the kept region shaded.
  'cad-union': <>{P('M9 5a7 7 0 1 0 0 14 7 7 0 0 0 6-3.4A7 7 0 1 0 15 8.4 7 7 0 0 0 9 5z', fill)}<circle cx="9" cy="12" r="7" /><circle cx="15" cy="12" r="7" /></>,
  'cad-subtract': <>{P('M9 5a7 7 0 1 0 0 14 7 7 0 0 0 3-.68A7 7 0 0 1 12 5.68 7 7 0 0 0 9 5z', fill)}<circle cx="9" cy="12" r="7" /><circle cx="15" cy="12" r="7" {...dash} /></>,
  'cad-intersect': <>{P('M12 5.68a7 7 0 0 1 0 12.64 7 7 0 0 1 0-12.64z', { ...fill, fillOpacity: 0.55 })}<circle cx="9" cy="12" r="7" {...dash} /><circle cx="15" cy="12" r="7" {...dash} /></>,
};

export function CadIcon({ name, small }: { name: string; small?: boolean }) {
  const s = small ? 16 : 20;
  return <svg className="cad-icon" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CAD_ICONS[name]}</svg>;
}
