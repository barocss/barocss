import { massTranslationSphereStep } from './brep-mass-translation-fixtures.mjs';

// Keep raw Cartesian decimal offsets before the product's Number parser runs.
// In particular, never generate a far tiny pole by adding its displacement to a Number center.
function decimal(token) {
  const m = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(token));
  if (!m) throw new Error(`bad decimal fixture token ${token}`);
  const fraction = m[3] ?? '', exponent = Number(m[4] ?? 0), n = BigInt((m[1] === '-' ? '-' : '') + m[2] + fraction), scale = fraction.length - exponent;
  return scale < 0 ? { n: n * 10n ** BigInt(-scale), scale: 0 } : { n, scale };
}
function decimalText({ n, scale }) {
  if (n === 0n) return '0';
  const sign = n < 0n ? '-' : '', digits = (n < 0n ? -n : n).toString().padStart(scale + 1, '0');
  return sign + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '') : digits);
}
function decimalPole(center, radius, direction, sign) {
  const c = decimal(center), r = decimal(radius), z = decimal(direction), d = { n: BigInt(sign) * r.n * z.n, scale: r.scale + z.scale }, scale = Math.max(c.scale, d.scale);
  return decimalText({ n: c.n * 10n ** BigInt(scale - c.scale) + d.n * 10n ** BigInt(scale - d.scale), scale });
}
export function representabilitySphereStep({ radius = '0.001', center = ['0','0','0'], compound = true, reversed = false, faceSense = true } = {}) {
  const axis = compound ? ['0.48','0.64','0.6'] : ['0','0','1'];
  let text = massTranslationSphereStep({ radius: Number(radius), center: [0,0,0], compound, reversed });
  const minus = center.map((c, k) => decimalPole(c, radius, axis[k], -1)), plus = center.map((c, k) => decimalPole(c, radius, axis[k], 1));
  text = text.replace(/^#1=.*;$/m, `#1=CARTESIAN_POINT('',(${minus.join(',')}));`).replace(/^#3=.*;$/m, `#3=CARTESIAN_POINT('',(${plus.join(',')}));`);
  for (const id of [5, 12]) text = text.replace(new RegExp(`^#${id}=.*;$`, 'm'), `#${id}=CARTESIAN_POINT('',(${center.join(',')}));`);
  text = text.replace(/^#9=.*;$/m, `#9=CIRCLE('',#8,${radius});`).replace(/^#16=.*;$/m, `#16=SPHERICAL_SURFACE('',#15,${radius});`);
  if (!faceSense) text = text.replace(/^#21=.*;$/m, "#21=ADVANCED_FACE('literal-sphere',(#20),#16,.F.);");
  return text;
}
