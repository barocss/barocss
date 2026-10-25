// A flat-pattern DXF conformance case (conformance/r12/flat-dxf/<case>/case.json, R12.2, D117): its part document's last
// output unfolded — by the output's own sheet rules, or with `input.flat.thickness` and `kFactor` given (a body made
// without them) — and written as the flat's DXF document.
import { evaluateCadPart, flatPattern, flatPatternDxf, flatPatternOf } from '../dist/index.js';

export function flatOfCase(c) {
  const o = evaluateCadPart(c.input.partDocument).outputs.at(-1), f = c.input.flat ?? {};
  return f.thickness !== undefined ? flatPattern(o.brep, f) : flatPatternOf(o, f);
}
export const flatDxfOfCase = c => flatPatternDxf(flatOfCase(c));
