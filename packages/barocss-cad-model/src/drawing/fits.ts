// D155 on the drawing (the kernel lane's request, D139 with the outer lane): a diameter dimension on a face that carries
// a tolerance class (doc.fits) reads its class and its limits from the user's tables — `Ø50 H7 (+0.025/0)`, or for a
// declared hole–shaft pair `Ø50 H7/k6 (+0.025/0, +0.018/+0.002)` — each limit as its table's row gives it (the kernel's
// lookupFit / fitLimits at the dimension's own size), `(est.)` after it when a row is an estimate. No limit is built in:
// a class with no row for that size keeps its class alone and is a typed issue (FIT_ROW_MISSING) saying what to load.
import { fitLimits, isHoleClass, lookupFit, FitError } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';

/** A deviation (µm) as drawings write it: +0.025, 0, -0.009 (mm; ASCII, as the PDF's fonts show). */
export const deviation = (um: number) => um === 0 ? '0' : `${um > 0 ? '+' : '-'}${+(Math.abs(um) / 1000).toFixed(4)}`;

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
export function fitCallout(doc: StudioDoc, edge: string, diameter: number): { text: string; miss?: string } | null {
  const own = classedFace(doc, edge); if (!own) return null;
  const tables = doc.fits?.tables ?? [], pairs = doc.fits?.pairs ?? [];
  const pair = pairs.find(p => p.hole === own.face || p.shaft === own.face), other = pair ? doc.fits?.faces?.find(f => f.face === (pair.hole === own.face ? pair.shaft : pair.hole)) : undefined;
  try {
    if (pair && other) {
      const [hc, sc] = isHoleClass(own.class) ? [own.class, other.class] : [other.class, own.class];
      const l = fitLimits(tables, hc, sc, diameter);
      return { text: `${hc}/${sc} (${deviation(l.hole.upperUM)}/${deviation(l.hole.lowerUM)}, ${deviation(l.shaft.upperUM)}/${deviation(l.shaft.lowerUM)})${l.estimate ? ' (est.)' : ''}` };
    }
    const l = lookupFit(tables, own.class, diameter);
    return { text: `${own.class} (${deviation(l.upperUM)}/${deviation(l.lowerUM)})${l.estimate ? ' (est.)' : ''}` };
  } catch (e) {
    if (!(e instanceof FitError)) throw e;
    const cls = pair && other ? (isHoleClass(own.class) ? `${own.class}/${other.class}` : `${other.class}/${own.class}`) : own.class;
    return { text: cls, miss: e.message };
  }
}

/** A diameter dimension's callout with its fit: the hole's callout (or Ø and the size), then the fit, when the edge's face carries a class. */
export function withFit(doc: StudioDoc, hole: (edge: string) => string | null): (edge: string, diameter?: number) => string | null {
  return (edge, diameter) => {
    const base = hole(edge);
    if (diameter === undefined) return base;
    const f = fitCallout(doc, edge, diameter);
    return f ? `${base ?? `Ø${+diameter.toFixed(3)}`} ${f.text}` : base;
  };
}
/** Why a diameter dimension's fit has no limits (the class has no row for that size), or null. */
export function fitMiss(doc: StudioDoc): (edge: string, diameter: number) => string | null {
  return (edge, diameter) => fitCallout(doc, edge, diameter)?.miss ?? null;
}
