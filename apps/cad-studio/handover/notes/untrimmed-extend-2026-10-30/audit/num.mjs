// Q5: the old and new curveSource num() side by side (copied verbatim from the diff).
const oldNum = (v) => { const r = Math.round(v * 1e9) / 1e9; return Object.is(r, -0) ? '0' : String(r); };
const num = (v) => { const r = Math.round(v * 1e9) / 1e9; if (r === 0) return '0'; const s = String(r); return s.includes('e') ? r.toFixed(9).replace(/0+$/, '') : s; };
let changedNonExp = 0, roundTripBad = 0;
for (let k = 0; k < 2e6; k++) { const v = (Math.random() - 0.5) * 10 ** (Math.random() * 30 - 10); const a = oldNum(v), b = num(v); if (!a.includes('e') && a !== b) changedNonExp++; if (Number(b) !== Math.round(v * 1e9) / 1e9 && Math.abs(v) < 1e21) roundTripBad++; }
console.log('random 2e6: changed where old had no exponent =', changedNonExp, '; new value != rounded value =', roundTripBad);
for (const v of [1e-7, -3e-7, 1.5e-7, 5e-10, -5e-10, 4.9e-10, 1e-6, 9.999999999e-7, 1e20, 1e21, -1.5e21, 1e300, NaN, Infinity, -0, 2 ** 53 + 2, 9007199.254740993]) console.log(String(v).padEnd(22), 'old', oldNum(v).padEnd(26), 'new', num(v));
