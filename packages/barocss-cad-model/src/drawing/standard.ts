// 11 ③a: the drawing standard. One record per standard holds every number and choice the sheet takes from it, so a
// drawing without a standard (`undefined`) keeps exactly the output it always had and a new standard is a new row.
// Sources: ISO 129-1:2018 and ISO 3098 (lettering, arrowheads, text above the line), ISO 5456-2 (projection symbol),
// ISO 5459 (datum targets; the datum feature's triangle is filled under both standards, so it is not a setting), ISO 1101 (GD&T); ASME Y14.2-2014 (line conventions, arrowheads, 3:1), ASME Y14.5-2018
// (§1.6.1 zeros, unidirectional text, datum targets, concentricity and symmetry removed), ASME Y14.3 (projection).

export type DrawingStandard = 'iso' | 'asme';
export const DRAWING_STANDARDS: readonly DrawingStandard[] = ['iso', 'asme'];

export interface StandardPreset {
  /** Lettering height, sheet mm. */
  text: number;
  /** A filled arrowhead's length and half width, sheet mm. */
  arrowLength: number; arrowHalf: number;
  /** Dimension text: along the dimension line and above it, or always horizontal in a break of the line. */
  dimensionText: 'aligned' | 'unidirectional';
  /** Numbers: keep the leading zero (0.5) or drop it (.5); trim trailing zeros or keep them to the precision. Inch rows plug in here (11 ③b). */
  number: { leadingZero: boolean; trailingZeros: 'trim' | 'keep' };
  /** The title block's projection symbol is drawn to the standard's proportions (0: the sheet's own, smaller symbol). */
  projectionSymbol: boolean;
  /** A datum line target: the ASME phantom line, or two crosses joined by a thin continuous line (ISO 5459). */
  lineTarget: 'phantom' | 'crosses';
  /** Characteristics the standard no longer has: a drawing check warning, never a refusal. */
  withoutCharacteristic: readonly string[];
}

/** No standard: the sheet as it was before the setting existed. */
export const PLAIN: StandardPreset = { text: 3.5, arrowLength: 3, arrowHalf: 0.6, dimensionText: 'aligned', number: { leadingZero: true, trailingZeros: 'trim' }, projectionSymbol: false, lineTarget: 'phantom', withoutCharacteristic: [] };
export const STANDARDS: Record<DrawingStandard, StandardPreset> = {
  // Arrowhead 15° (ISO 129-1): half width = 3 tan 7.5° = 0.395, rounded to 0.4.
  iso: { ...PLAIN, text: 3.5, arrowHalf: 0.4, projectionSymbol: true, lineTarget: 'crosses' },
  // Arrowhead length : width = 3 : 1 (ASME Y14.2), half width 0.5. Text 0.12 in = 3 mm. Y14.5-2018 has no concentricity or symmetry.
  asme: { ...PLAIN, text: 3, arrowHalf: 0.5, dimensionText: 'unidirectional', projectionSymbol: true, withoutCharacteristic: ['concentricity', 'symmetry'] },
};

/** The preset of a drawing's standard; absent: the plain one. Every builder takes the preset it draws with as a parameter. */
export const presetOf = (standard: DrawingStandard | undefined): StandardPreset => standard ? STANDARDS[standard] : PLAIN;

/** A value to the sheet's 0.01 mm: zeros as the preset's number rule says (default: 0.5, 12, 1.25). */
export function formatNumber(v: number, rule: StandardPreset['number'] = PLAIN.number): string {
  const r = Math.round(v * 100) / 100;
  let s: string;
  if (rule.trailingZeros === 'keep') s = r.toFixed(2);
  else s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (!rule.leadingZero) s = s.replace(/^(-?)0\./, '$1.');
  return s;
}
