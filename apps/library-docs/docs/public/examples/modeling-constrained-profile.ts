import { cad, type CadModelSnapshot } from '@barocss/cad';

/** Dimension-driven exact fixed/H/V profile; lockY stays internal to this preset. */
export function makeConstrainedPlate(): CadModelSnapshot {
  const model = cad.model(), width = model.parameter('width', 32), height = model.parameter('height', 24), lockY = model.parameter('lockY', 0);
  const sketch = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([width, lockY]), c = s.point([width, height]), d = s.point([1, height]);
    s.fixed(a); s.fixed(c);
    s.horizontal(a, b); s.vertical(b, c); s.horizontal(c, d); s.vertical(d, a); s.fixed(b);
    return [a, b, c, d];
  });
  const part = sketch.extrude(8);
  return model.build({ part });
}

/** Return a new snapshot; failed edits leave the caller's accepted snapshot usable. */
export function resizeConstrainedPlate(accepted: CadModelSnapshot, width: number, height: number): CadModelSnapshot {
  return accepted.withParameters({ width, height });
}

// Width/height are the preset controls; lockY remains an internal fixed value of 0.
// Genuine provider volumes: baseline6144, width40→7680, height16 recovery4096 mm³.
// Only the baseline preview is retained. Consumer edited-state display tests use mocks.
