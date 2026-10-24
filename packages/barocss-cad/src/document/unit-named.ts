// R7.7b (D281): a field named with its unit (`angleDegrees`, `boreMM`, `loadN` …) is a document from before the rename;
// it is refused by name, never read as a missing field. (A T-slot row's `sizeMM` keeps its suffix: `size` is the row's name.)
export const UNIT_NAMED = /^([A-Za-z][A-Za-z0-9]*?)(MM3|MM2|MM|Deg|Degrees|Rad|Radians|KG|Kg|MPa|NPerMM|Nmm)$|^(force|load|initialTension)N$/;
const UNIT_NAMED_SPECIAL: Readonly<Record<string, string>> = { torsionalRateNmmPerDeg: 'torsionalRate', weldMM: 'weldDistance' };
export function unitNamedField(value: unknown): { path: string; field: string } | null {
  const stack: [unknown, string][] = [[value, '']];
  while (stack.length) {
    const [v, at] = stack.pop()!;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (typeof v[i] === 'object' && v[i] !== null) stack.push([v[i], `${at}[${i}]`]); continue; }
    if (typeof v !== 'object' || v === null || ArrayBuffer.isView(v)) continue;
    for (const [k, x] of Object.entries(v)) {
      const path = at ? `${at}.${k}` : k;
      if (k !== 'sizeMM' && (UNIT_NAMED_SPECIAL[k] !== undefined || UNIT_NAMED.test(k))) { const m = UNIT_NAMED.exec(k); return { path, field: UNIT_NAMED_SPECIAL[k] ?? (m![1] ?? m![3]) }; }
      if (typeof x === 'object' && x !== null) stack.push([x, path]);
    }
  }
  return null;
}
