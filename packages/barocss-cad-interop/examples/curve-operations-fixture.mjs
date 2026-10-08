import {
  extractCurveInterval,
  joinCurves,
  refineCurveWide,
  reverseCurve,
  validateExtractedCurveInterval,
  validateReversedCurveResult,
  validateWideCurveRefinement,
} from '@barocss/cad';

export const displayOptions = {
  sourceVersion: 0,
  countU: 8,
  countV: 8,
  unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
};

const curve = (id, degree, knots, controlPoints, weights) => ({
  kind: 'curve', id, degree, knots, controlPoints, weights,
});

export function createCurveOperationCases() {
  const weighted = curve('weighted_C0', 2, [-3, -3, -3, 1, 1, 7, 7, 7],
    [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]],
    [1, 2, 0.75, 1.5, 1]);
  const reversed = reverseCurve(weighted, { curveId: 'weighted_reversed' });
  const interval = extractCurveInterval(weighted, {
    curveId: 'weighted_interval', interval: [-1, 4], resultIdPrefix: 'weighted_interval',
  });

  // This is the exact 31 -> 64 pole producer from the public CAD #686 demo.
  const knots = [-0, -0, -0, -0, ...Array.from({ length: 12 }, (_, i) => i + 1), 13, 13, 13, 13];
  const left = curve('joined_left', 3, knots,
    Array.from({ length: 16 }, (_, i) => [i === 0 ? -0 : i, i === 0 ? -0 : (i % 3) * 0.25, i === 0 ? -0 : i * 0.125]),
    Array(16).fill(1));
  const right = curve('joined_right', 3, knots,
    Array.from({ length: 16 }, (_, i) => [15 + i, i === 0 ? left.controlPoints.at(-1)[1] : (i % 3) * 0.25,
      left.controlPoints.at(-1)[2] + i * 0.125]),
    Array(16).fill(1));
  const joined = joinCurves(left, right, { curveId: 'joined_31' });
  const refined = refineCurveWide(joined.curve, {
    curveId: 'joined_refined_64',
    insertions: Array.from({ length: 11 }, (_, i) => ({ parameter: i + 0.5, count: 3 })),
    resultIdPrefix: 'joined_refined',
  });

  const cases = [
    { key: 'reversed', result: reversed, validate: validateReversedCurveResult, color: 0x00ffff, offsetZ: 0.018 },
    { key: 'interval', result: interval, validate: validateExtractedCurveInterval, color: 0xff00ff, offsetZ: 0.010 },
    { key: 'refined', result: refined, validate: validateWideCurveRefinement, color: 0xffff00, offsetZ: 0.003 },
  ];
  for (const item of cases) item.validate(item.result);
  return cases;
}
