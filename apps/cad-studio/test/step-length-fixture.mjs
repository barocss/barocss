import assert from 'node:assert/strict';
import { sha256 } from './flow-helper.mjs';

export function withLengthConversion(text, name, factor = 25.4) {
  const mm = /^(#\d+)=\(LENGTH_UNIT\(\)NAMED_UNIT\(\*\)SI_UNIT\(\.MILLI\.,\.METRE\.\)\);$/m.exec(text)[1];
  const next = Math.max(...[...text.matchAll(/^#(\d+)=/gm)].map(match => Number(match[1]))) + 1;
  const [dimensions, measure, unit] = [next, next + 1, next + 2].map(id => '#' + id);
  const context = 'GLOBAL_UNIT_ASSIGNED_CONTEXT((';
  assert.ok(text.includes(context + mm + ','));
  const conversion = [
    `${dimensions}=DIMENSIONAL_EXPONENTS(1.,0.,0.,0.,0.,0.,0.);`,
    `${measure}=LENGTH_MEASURE_WITH_UNIT(LENGTH_MEASURE(${factor}),${mm});`,
    `${unit}=(CONVERSION_BASED_UNIT('${name}',${measure}) LENGTH_UNIT() NAMED_UNIT(${dimensions}));`,
  ].join('\n');
  const source = text.replace(context + mm + ',', context + unit + ',').replace(/\nENDSEC;\s*END-ISO-10303-21;/, `\n${conversion}\nENDSEC;\nEND-ISO-10303-21;`);
  assert.ok(source.includes(context + unit + ',') && source.includes(conversion));
  return { source, mm, unit, measure, sha256: sha256(source) };
}
