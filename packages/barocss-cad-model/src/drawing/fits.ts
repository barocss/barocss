// D155 on the drawing (the kernel lane's request, D139 with the outer lane): a diameter dimension on a face that carries
// a tolerance class (doc.fits) reads its class and its limits from the user's tables — `Ø50 H7 (+0.025/0)`, or for a
// declared hole–shaft pair `Ø50 H7/k6 (+0.025/0, +0.018/+0.002)` — each limit as its table's row gives it (the kernel's
// lookupFit / fitLimits at the dimension's own size), `(est.)` after it when a row is an estimate. No limit is built in:
// a class with no row for that size keeps its class alone and is a typed issue (FIT_ROW_MISSING) saying what to load.
import { fitLimits, isHoleClass, lookupFit, FitError } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { LengthFormat } from './standard';

/** A length as the sheet's units print it (11 ③b; absent: mm, as before). */
const plainMM: LengthFormat = (mm, places = 2) => String(+mm.toFixed(places));
/**
 * The deviations of a fit's tolerances `upper/lower` in a format's unit, at common decimals, with the nominal at the same
 * decimals (standard.ts `deviationSet`: the nominal rounds to nearest, the deviations inward from the true limits, so the
 * printed limits never lie outside the zone). Without a unit format (mm, as before) they are as the table gives them.
 */
function limitsOf(list: readonly (readonly [number, number])[], diameter: number, f: LengthFormat): { texts: string[]; digits?: number } {
  if (!f.pairs) return { texts: list.map(([u, l]) => `${deviation(u)}/${deviation(l)}`) };
  const set = f.pairs(list, diameter);
  return { texts: set.items.map(d => `${d.upper}/${d.lower}`), digits: set.digits };
}

/** A deviation (mm) as drawings write it: +0.025, 0, -0.009 (ASCII, as the PDF's fonts show). */
export const deviation = (mm: number, f: LengthFormat = plainMM) => mm === 0 ? '0' : `${mm > 0 ? '+' : '-'}${f(Math.abs(mm), 4)}`;

/** The class an edge's face carries: a face of the edge's name (`face|face`) by its name, or the name without `#k`. */
function classedFace(doc: StudioDoc, edge: string): { face: string; class: string } | null {
  const faces = doc.fits?.faces ?? [];
  for (const name of edge.split('|')) {
    const base = name.replace(/#\d+$/, ''), hit = faces.find(f => f.face === name || f.face === base);
    if (hit) return hit;
  }
  return null;
}

/**
 * The fit a diameter dimension on `edge` at `diameter` shows, after its size: its class and limits (a pair's both),
 * or the class alone with why its limits are missing; null when no face of the edge carries a class.
 */
export function fitCallout(doc: StudioDoc, edge: string, diameter: number, f: LengthFormat = plainMM): { text: string; miss?: string; /** The decimals its deviations print at: the size reads at them too. */ digits?: number } | null {
  const own = classedFace(doc, edge); if (!own) return null;
  const tables = doc.fits?.tables ?? [], pairs = doc.fits?.pairs ?? [];
  const pair = pairs.find(p => p.hole === own.face || p.shaft === own.face), other = pair ? doc.fits?.faces?.find(f => f.face === (pair.hole === own.face ? pair.shaft : pair.hole)) : undefined;
  try {
    if (pair && other) {
      const [hc, sc] = isHoleClass(own.class) ? [own.class, other.class] : [other.class, own.class];
      const l = fitLimits(tables, hc, sc, diameter);
      const d = limitsOf([[l.hole.upper, l.hole.lower], [l.shaft.upper, l.shaft.lower]], diameter, f);
      return { text: `${hc}/${sc} (${d.texts[0]}, ${d.texts[1]})${l.estimate ? ' (est.)' : ''}`, ...(d.digits !== undefined ? { digits: d.digits } : {}) };
    }
    const l = lookupFit(tables, own.class, diameter);
    const d = limitsOf([[l.upper, l.lower]], diameter, f);
    return { text: `${own.class} (${d.texts[0]})${l.estimate ? ' (est.)' : ''}`, ...(d.digits !== undefined ? { digits: d.digits } : {}) };
  } catch (e) {
    if (!(e instanceof FitError)) throw e;
    const cls = pair && other ? (isHoleClass(own.class) ? `${own.class}/${other.class}` : `${other.class}/${own.class}`) : own.class;
    return { text: cls, miss: e.message };
  }
}

/** A diameter dimension's callout with its fit: the hole's callout (or Ø and the size), then the fit, when the edge's face carries a class. */
export function withFit(doc: StudioDoc, hole: (edge: string, f?: LengthFormat) => string | null): (edge: string, diameter?: number, f?: LengthFormat) => string | null {
  return (edge, diameter, f = plainMM) => {
    if (diameter === undefined) return hole(edge, f);
    // (The size prints at the decimals of its fit's deviations.)
    const fit = fitCallout(doc, edge, diameter, f), g = fit?.digits !== undefined && f.at ? f.at(fit.digits) : f, base = hole(edge, g);
    return fit ? `${base ?? `Ø${g(diameter, 3)}`} ${fit.text}` : base;
  };
}
/** Why a diameter dimension's fit has no limits (the class has no row for that size), or null. */
export function fitMiss(doc: StudioDoc): (edge: string, diameter: number) => string | null {
  return (edge, diameter) => fitCallout(doc, edge, diameter)?.miss ?? null;
}
