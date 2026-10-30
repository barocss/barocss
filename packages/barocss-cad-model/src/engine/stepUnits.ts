// The length unit a STEP file declares (its LENGTH_UNIT: an SI unit with a prefix, or a conversion-based
// one such as INCH), so a file in other units opens at its true size in millimetres. The kernel reads the
// numbers as they are; the studio scales them.
import { MM_PER_FOOT, MM_PER_INCH } from '../util/units';
import { refusal } from './refusal';
export interface StepUnit { name: string; to: number; declared: boolean }

const SI: Record<string, number> = { '': 1000, MILLI: 1, CENTI: 10, DECI: 100, KILO: 1e6, MICRO: 1e-3 };
const NAMED: Record<string, number> = { INCH: MM_PER_INCH, FOOT: MM_PER_FOOT, MM: 1, MILLIMETRE: 1, CM: 10, METRE: 1000 };
const LABEL: Record<string, string> = { '': 'metres', MILLI: 'millimetres', CENTI: 'centimetres', DECI: 'decimetres', KILO: 'kilometres', MICRO: 'micrometres' };

export function stepLengthUnit(text: string): StepUnit {
  // Check every declared SI length before selecting a supported unit. A supported declaration must not hide
  // an unsupported one elsewhere in the file. This keeps the existing file-level unit policy, not context mapping.
  const lengths = [...text.matchAll(/LENGTH_UNIT\s*\(\s*\)[^;]*?SI_UNIT\s*\(\s*(\$|\.(\w+)\.)\s*,\s*\.METRE\.\s*\)|SI_UNIT\s*\(\s*(\$|\.(\w+)\.)\s*,\s*\.METRE\.\s*\)[^;]*?LENGTH_UNIT/gi)];
  for (const m of lengths) {
    const prefix = (m[2] ?? m[4] ?? '').toUpperCase();
    if (!Object.hasOwn(SI, prefix)) throw refusal('NOT_READ', `STEP declares an unsupported SI length prefix ${prefix}. The file is not read as millimetres.`);
  }
  // A conversion-based length unit (named, e.g. 'INCH').
  for (const st of text.split(';')) {
    const conv = /CONVERSION_BASED_UNIT\s*\(\s*'([^']+)'/i.exec(st);
    if (!conv || !/LENGTH_UNIT/i.test(st)) continue;
    const k = conv[1].toUpperCase().trim(); if (NAMED[k]) return { name: k === 'INCH' ? 'inches' : k === 'FOOT' ? 'feet' : k.toLowerCase(), to: NAMED[k], declared: true };
  }
  // An SI length: SI_UNIT(.MILLI.,.METRE.) or SI_UNIT($,.METRE.), within a LENGTH_UNIT.
  for (const m of lengths) {
    const prefix = (m[2] ?? m[4] ?? '').toUpperCase();
    if (prefix in SI) return { name: LABEL[prefix], to: SI[prefix], declared: true };
  }
  return { name: 'millimetres', to: 1, declared: false };
}
