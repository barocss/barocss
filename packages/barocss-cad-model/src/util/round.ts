// Rounding to a fixed number of decimals (R4 A1: the copies gathered). Two kinds, kept apart because they differ at −0:
// `r3`/`r6`/`r9` add 0 (a rounded −0 comes out +0, as JSON and Object.is see it); the `…Signed` ones keep the sign
// Math.round leaves. Each caller keeps the kind it had.

/** v to 1e-3, never −0. */
export const r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
/** v to 1e-6, never −0. */
export const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** v to 1e-9, never −0. */
export const r9 = (v: number) => Math.round(v * 1e9) / 1e9 + 0;
/** v to 1e-3, its sign as Math.round leaves it (−0 stays −0). */
export const r3Signed = (v: number) => Math.round(v * 1000) / 1000;
/** v to 1e-6, its sign as Math.round leaves it (−0 stays −0). */
export const r6Signed = (v: number) => Math.round(v * 1e6) / 1e6;
