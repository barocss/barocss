// 11 ③a: the drawing standard. One record per standard holds every number and choice the sheet takes from it, so a
// drawing without a standard (`undefined`) keeps exactly the output it always had and a new standard is a new row.
// Sources: ISO 129-1:2018 and ISO 3098 (lettering, arrowheads, text above the line), ISO 5456-2 (projection symbol),
// ISO 5459 (datum targets; the datum feature's triangle is filled under both standards, so it is not a setting), ISO 1101 (GD&T); ASME Y14.2-2014 (line conventions, arrowheads, 3:1), ASME Y14.5-2018
// (§1.6.1 zeros, unidirectional text, datum targets, concentricity and symmetry removed), ASME Y14.3 (projection).

export type DrawingStandard = 'iso' | 'asme';
/** The unit lengths are printed in (11 ③b). The model stays in mm; this is display only. */
export type DrawingUnits = 'mm' | 'inch';
export const DRAWING_UNITS: readonly DrawingUnits[] = ['mm', 'inch'];
/** Decimal places per unit: an absent unit keeps its default (mm: as before, trimmed; inch: 3). */
export interface UnitPrecision { mm?: number; inch?: number }
export const MAX_PRECISION = 6;
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
  /** Length units (11 ③b), from the drawing: the primary unit, whether the other is shown after it in square brackets, and decimal places per unit. */
  units: DrawingUnits; dual: boolean; precision: UnitPrecision;
  /** Set only by `withDigits` on plain mm: explicit decimals with their trailing zeros trimmed (a nominal printed to its tolerance's decimals). */
  trimZeros?: boolean;
  /** The title block's projection symbol is drawn to the standard's proportions (0: the sheet's own, smaller symbol). */
  projectionSymbol: boolean;
  /** A datum line target: the ASME phantom line, or two crosses joined by a thin continuous line (ISO 5459). */
  lineTarget: 'phantom' | 'crosses';
  /** Characteristics the standard no longer has: a drawing check warning, never a refusal. */
  withoutCharacteristic: readonly string[];
}

/** No standard: the sheet as it was before the setting existed. */
export const PLAIN: StandardPreset = { text: 3.5, arrowLength: 3, arrowHalf: 0.6, dimensionText: 'aligned', number: { leadingZero: true, trailingZeros: 'trim' }, projectionSymbol: false, lineTarget: 'phantom', withoutCharacteristic: [], units: 'mm', dual: false, precision: {} };
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

// ——— Length units (11 ③b)
/** The inch rule of ASME Y14.5 §1.6.2 and Y14.2: no leading zero (.500), trailing zeros kept to the precision. ISO has no inch rule of its own; the sheet uses this one for both. */
const INCH_NUMBER: StandardPreset['number'] = { leadingZero: false, trailingZeros: 'keep' };
export const INCH_DECIMALS = 3;
const MM_PER_INCH = 25.4;

/** The settings a preset takes its units from. */
export interface UnitSettings { standard?: DrawingStandard; units?: DrawingUnits; dual?: boolean; precision?: UnitPrecision }
/** The preset a drawing draws with: its standard's, with its units. With no units setting this is the standard's own preset, unchanged. */
export function presetFor(s: UnitSettings): StandardPreset {
  const base = presetOf(s.standard);
  if (s.units === undefined && !s.dual && !s.precision) return base;
  return { ...base, units: s.units ?? 'mm', dual: s.dual === true, precision: s.precision ?? {} };
}

/**
 * A length (model mm) in one unit: `places` is how many decimals the sheet printed before units existed (2 for a dimension, 3
 * for a callout, 4 for a tolerance), trailing zeros trimmed; an explicit precision, or inch, prints exactly its decimals
 * (inch: mm / 25.4, no leading zero, zeros kept: 25.4 → 1.000, 12.7 → .500). `pairs` prints a tolerance's deviations in this
 * unit by `deviationSet`, `at(digits)` is this format at that many decimals; `unit` says which unit this format prints.
 */
export interface LengthFormat {
  (mm: number, places?: 2 | 3 | 4): string;
  unit?: DrawingUnits;
  pairs?(list: readonly (readonly [number, number])[], nominal: number): DeviationSet;
  at?(digits: number): LengthFormat;
}
function fixedNumber(v: number, digits: number, leadingZero: boolean, trim = false): string {
  let s = v.toFixed(digits);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return leadingZero ? s : s.replace(/^(-?)0\./, '$1.');
}
export function formatLength(mm: number, p: StandardPreset, unit: DrawingUnits = p.units, places: 2 | 3 | 4 = 2): string {
  if (unit === 'inch') return fixedNumber(mm / MM_PER_INCH, p.precision.inch ?? INCH_DECIMALS, INCH_NUMBER.leadingZero);
  if (p.precision.mm !== undefined) return fixedNumber(mm, p.precision.mm, p.number.leadingZero, p.trimZeros === true);
  return places === 2 ? formatNumber(mm, p.number) : String(+mm.toFixed(places));
}

/** One tolerance's deviations as printed (`+.0005`, `-.0002`, `0`). */
export interface Deviations { upper: string; lower: string; /** Both limits are the same distance from the printed nominal: a symmetric tolerance prints ±. */ equal: boolean }
/** The deviations of one or more tolerances on one nominal, at common `digits` decimals; `nominal` is the nominal printed at them; `tight`: even the most decimals could not keep the zone. */
export interface DeviationSet { items: Deviations[]; digits: number; nominal: string; tight: boolean }
/** A single tolerance's (`deviationSet` of one). */
export type DeviationPair = Deviations & { digits: number; nominal: string; tight: boolean };
const MAX_DIGITS: Record<DrawingUnits, number> = { mm: 4, inch: 5 };
const KEEP = 0.8;
const EPS = 1e-9;
/** The decimals a value was entered with (up to 4). */
const decimalsOf = (v: number): number => { for (let d = 0; d < 4; d++) if (Math.abs(Math.round(Math.abs(v) * 10 ** d) - Math.abs(v) * 10 ** d) < EPS) return d; return 4; };
/**
 * Tolerances on one nominal in a unit (ASME Y14.5 §1.6.2: decimals are equalised by adding zeros to the dimension, never by
 * dropping a tolerance's digits). The nominal is rounded to nearest at `digits` decimals (N_r); each upper deviation is then
 * rounded down and each lower one up from the limits `N + u` and `N + l`, so the printed limits `N_r + U'` and `N_r + L'` never
 * lie outside the true zone. `digits` start at the drawing's precision for the unit (plain mm: 2, or the decimals the
 * tolerances were entered with, if more; its zeros are trimmed) and rise (inch to 5, mm to 4) until no nonzero deviation prints
 * as zero and every zone keeps 80% of its width.
 */
export function deviationSet(list: readonly (readonly [number, number])[], p: StandardPreset, unit: DrawingUnits, nominal = 0): DeviationSet {
  const plain = unit === 'mm' && p.precision.mm === undefined, conv = (v: number) => unit === 'inch' ? v / MM_PER_INCH : v;
  const zones = list.map(([upper, lower]) => [conv(upper), conv(lower)] as const), n = conv(nominal);
  const base = plain ? Math.max(2, ...list.flat().map(decimalsOf)) : unit === 'inch' ? p.precision.inch ?? INCH_DECIMALS : p.precision.mm!, max = Math.max(MAX_DIGITS[unit], base);
  const lead = unit === 'mm' ? p.number.leadingZero : INCH_NUMBER.leadingZero;
  const at = (d: number) => { const q = 10 ** d, nr = Number(n.toFixed(d)), s = n - nr; return { nr, items: zones.map(([u, l]) => ({ U: Math.floor((u + s) * q + EPS) / q, L: Math.ceil((l + s) * q - EPS) / q })) }; };
  let digits = base, tight = true;
  for (let d = base; d <= max; d++) {
    const { items } = at(d); digits = d;
    if (items.every(({ U, L }, k) => { const [u, l] = zones[k]; return (u === 0 || U !== 0) && (l === 0 || L !== 0) && U - L >= KEEP * (u - l) - 1e-12; })) { tight = false; break; }
  }
  const { nr, items } = at(digits);
  const num = (v: number) => fixedNumber(Math.abs(v), digits, lead, plain);
  const text = (rounded: number, truth: number) => rounded === 0 ? (truth === 0 ? '0' : `${truth > 0 ? '+' : '-'}${num(0)}`) : `${rounded > 0 ? '+' : '-'}${num(rounded)}`;
  return { digits, tight, nominal: fixedNumber(nr, digits, lead, plain), items: items.map(({ U, L }, k) => ({ upper: text(U, zones[k][0]), lower: text(L, zones[k][1]), equal: Math.abs(U + L) < 1e-12 })) };
}
export function deviationPair(upper: number, lower: number, p: StandardPreset, unit: DrawingUnits, nominal = 0): DeviationPair {
  const set = deviationSet([[upper, lower]], p, unit, nominal);
  return { ...set.items[0], digits: set.digits, nominal: set.nominal, tight: set.tight };
}
/**
 * A geometric tolerance's value (frames are not dimensions: the drawing's precision never applies). mm: as entered, up to 4
 * places. Inch, at 3 to 5 places by `mode`: `down` (a zone's width: never wider) and `up` (a projected zone's height: never
 * less strict) keep at least 80% of the value, `nearest` (an unequal amount, which moves the zone) is within 5% of it; `tight`
 * when 5 places cannot.
 */
export type FrameRounding = 'down' | 'up' | 'nearest';
export function frameValue(mm: number, p: StandardPreset, mode: FrameRounding = 'down'): { text: string; tight: boolean } {
  if (p.units === 'mm') return { text: String(+mm.toFixed(4)), tight: false };
  const v = mm / MM_PER_INCH, round = (d: number) => { const q = 10 ** d; return mode === 'down' ? Math.floor(v * q + EPS) / q : mode === 'up' ? Math.ceil(v * q - EPS) / q : Math.round(v * q) / q; };
  const good = (r: number) => mode === 'down' ? r > 0 && r >= KEEP * v - 1e-12 : mode === 'up' ? r <= v / KEEP + 1e-12 : Math.abs(r - v) <= 0.05 * v + 1e-12;
  for (let d = INCH_DECIMALS; d <= MAX_DIGITS.inch; d++) if (good(round(d))) return { text: fixedNumber(round(d), d, INCH_NUMBER.leadingZero), tight: false };
  return { text: fixedNumber(round(MAX_DIGITS.inch), MAX_DIGITS.inch, INCH_NUMBER.leadingZero), tight: true };
}
/** The preset with a unit's decimals set (a dimension with a tolerance prints at the tolerance's decimals; plain mm trims the zeros). */
export const withDigits = (p: StandardPreset, unit: DrawingUnits, digits: number): StandardPreset => ({ ...p, precision: { ...p.precision, [unit]: digits }, ...(unit === 'mm' && p.precision.mm === undefined ? { trimZeros: true } : {}) });

/** The primary format, and the other unit's when the drawing is dual. */
export function lengthFormats(p: StandardPreset): { primary: LengthFormat; secondary: LengthFormat | null } {
  const make = (unit: DrawingUnits, preset: StandardPreset): LengthFormat => Object.assign((mm: number, places?: 2 | 3 | 4) => formatLength(mm, preset, unit, places), { unit, pairs: (list: readonly (readonly [number, number])[], nominal: number) => deviationSet(list, p, unit, nominal), at: (digits: number) => make(unit, withDigits(preset, unit, digits)) });
  return { primary: make(p.units, p), secondary: p.dual ? make(p.units === 'mm' ? 'inch' : 'mm', p) : null };
}
/** The title block's UNITS cell: mm, inch, or mm [inch] / inch [mm]. */
export const unitsLabel = (p: StandardPreset): string => p.dual ? (p.units === 'mm' ? 'mm [inch]' : 'inch [mm]') : p.units;
/** Whether the drawing prints anything but plain trimmed mm (units, dual or a precision). */
export const hasUnitSettings = (p: StandardPreset): boolean => p.units !== 'mm' || p.dual || p.precision.mm !== undefined || p.precision.inch !== undefined;
