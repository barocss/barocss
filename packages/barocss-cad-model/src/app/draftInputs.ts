import type { Field, Values } from './commands';
import { partBreps } from '../engine/evaluate';
import type { StudioDoc } from '../engine/doc';
import { refusal } from '../engine/refusal';

const pulls = ['z', '-z', 'x', '-x', 'y', '-y'] as const;
export type DraftPull = typeof pulls[number];
export const draftLabel = (pull: DraftPull): string =>
  (pull.startsWith('-') ? '−' : '+') + pull.slice(-1).toUpperCase();
export const isDraftPull = (value: unknown): value is DraftPull => pulls.some(pull => pull === value);
export const readDraftPull = (value: unknown): DraftPull => isDraftPull(value) ? value : 'z';
export const draftPulls = pulls;

export const draftInputs = (): Field[] => [
  { key: 'deg', label: 'Angle', kind: 'deg', min: -44, max: 44, step: 1 },
  { key: 'pull', label: 'Pull', kind: 'choice', options: pulls.map(pull => ({ value: pull, label: draftLabel(pull) })) },
  { key: 'neutralMode', label: 'Neutral plane', kind: 'choice', options: [
    { value: 'auto', label: 'Body end' }, { value: 'fixed', label: 'Fixed coordinate' },
  ] },
  { key: 'neutral', label: 'Neutral coordinate', kind: 'mm', min: -10000, max: 10000, when: values => values.neutralMode === 'fixed' },
];

export function draftNeutral(values: Values): number | undefined {
  const value = values.neutral;
  if (values.neutralMode === 'auto' || values.neutralMode === undefined && value === undefined) return undefined;
  const neutral = Number(value);
  if (value === '' || !Number.isFinite(neutral) || Math.abs(neutral) > 10000)
    throw refusal('VALUE', 'Draft neutral must be a finite coordinate within ±10000 mm.');
  return neutral;
}

export function draftNeutralStep(values: Values, automatic: (pull: DraftPull) => number | undefined) {
  const pull = readDraftPull(values.pull), axis = pull.slice(-1).toUpperCase();
  let neutral: number | undefined;
  try { neutral = draftNeutral(values); } catch { /* The input is still being edited. */ }
  const fromBody = values.neutralMode !== 'fixed';
  if (fromBody) neutral = automatic(pull);
  return { label: 'Neutral', text: neutral === undefined ? axis + (fromBody
    ? (pull.startsWith('-') ? ' maximum of original body' : ' minimum of original body')
    : ' world coordinate') : `${axis} = ${neutral} mm`, done: neutral !== undefined || fromBody };
}

export function draftNeutralDefault(values: Values, changed: readonly string[], automatic: (pull: DraftPull) => number | undefined): Values {
  if (values.neutralMode !== 'fixed' || !changed.includes('neutralMode')) return values;
  return { ...values, neutral: automatic(readDraftPull(values.pull)) ?? '' };
}

/** Exact body-end coordinate for straight-edged Draft stock. */
export function draftBodyEnd(doc: StudioDoc, key: string, pull: DraftPull): number | undefined {
  try {
    const target = partBreps(doc).find(output => output.key === key)?.brep;
    if (!target || target.faces.some(face => face.surface.kind === 'facets')
      || target.edges.some(edge => edge.curve.degree !== 1 || edge.curve.controlPoints.length !== 2)) return undefined;
    const axis = 'xyz'.indexOf(pull.slice(-1)), max = pull.startsWith('-');
    let coordinate = max ? -Infinity : Infinity;
    const include = (point: readonly number[]) => {
      coordinate = max ? Math.max(coordinate, point[axis]) : Math.min(coordinate, point[axis]);
    };
    for (const vertex of target.vertices) include(vertex.point);
    for (const edge of target.edges) for (const point of edge.curve.controlPoints) include(point);
    return Number.isFinite(coordinate) ? coordinate : undefined;
  } catch { return undefined; }
}
