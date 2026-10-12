import { splitPathSegment } from '@barocss/canvas2d';
import type { PathCommand } from '@barocss/canvas2d';

// Path-local logical pixels, before any control or anchor drag.
export const original: PathCommand[] = [
  { kind: 'M', x: 0, y: 60 },
  { kind: 'C', c1x: 25, c1y: 0, c2x: 75, c2y: 100, x: 110, y: 60 },
  { kind: 'L', x: 110, y: 120 },
  { kind: 'L', x: 0, y: 120 },
  { kind: 'Z' },
];

// Index 1 addresses the original C command; t is its parameter, not arc length.
export const subdivided = splitPathSegment(original, 1, 0.5);

// Independent literal expectation for this original fixture (no API-derived oracle).
export const expected: PathCommand[] = [
  { kind: 'M', x: 0, y: 60 },
  { kind: 'C', c1x: 12.5, c1y: 30, c2x: 31.25, c2y: 40, x: 51.25, y: 52.5 },
  { kind: 'C', c1x: 71.25, c1y: 65, c2x: 92.5, c2y: 80, x: 110, y: 60 },
  { kind: 'L', x: 110, y: 120 },
  { kind: 'L', x: 0, y: 120 },
  { kind: 'Z' },
];
