// B1: the Band tool's logic without JSX or the viewport — picking sources, making and editing a band (sketch/band.ts holds the geometry).
import type { SketchBand } from '@barocss/cad-model/engine/doc';
import { makeBand } from '@barocss/cad-model/sketch/band';
import type { SketchState } from '@barocss/cad-model/sketch/types';

/** Make band: the picked shapes become construction sources of one band (refused with the reason; the sketch stays). */
export function bandMake(s: SketchState, offset: number, width?: number): { state: SketchState } | { error: string } {
  if (s.association || s.associationDetached) return { error: 'A band is not made in a linked sketch: draw it in a sketch of its own.' };
  if ((s.bandPicks?.length ?? 0) < 2) return { error: 'Pick at least two closed shapes first.' };
  const r = makeBand(s, offset, width);
  return r;
}

/** A band with `patch` applied (a `width` of `undefined` makes it filled again; an `offset` of `undefined` is 0). */
export const bandEdit = (s: SketchState, patch: { offset?: number; width?: number | null }): SketchState => {
  if (!s.band) return s;
  const band: SketchBand = { ...s.band }, offset = 'offset' in patch ? patch.offset : s.band.offset, width = 'width' in patch ? patch.width ?? undefined : s.band.width;
  delete band.offset; delete band.width;
  if (offset) band.offset = offset;
  if (width !== undefined) band.width = width;
  return { ...s, band };
};

/** Remove band: the sources stay in the sketch as construction. */
export const bandRemove = (s: SketchState): SketchState => { const next = { ...s }; delete next.band; return next; };
