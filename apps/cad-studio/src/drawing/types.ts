// A 2D drawing of the part: settings kept in the document (doc.drawing), the views projected from the
// part's B-rep by the kernel's hidden-line projection, and dimensions that refer to model edges by
// their persistent names (so they keep measuring the part as it changes).
import type { BrepProjection } from '@barocss/cad';

export type ViewId = 'front' | 'top' | 'right' | 'iso';
export const VIEW_IDS: readonly ViewId[] = ['front', 'top', 'right', 'iso'];
export type Vec3 = [number, number, number];
export type XY = [number, number];

/**
 * A point of a dimension: an end of an edge (the end nearest `near`, the model point it was picked
 * at) or a circle's centre.
 */
export interface DimPoint { edge: string; at: 'end' | 'center'; near: Vec3 }
/** `place`: where the dimension line (or a leader's text) goes, in the view's model coordinates (mm). */
export type DrawingDimension =
  | { id: string; view: ViewId; kind: 'linear'; a: DimPoint; b: DimPoint; orient: 'horizontal' | 'vertical' | 'aligned'; place: XY }
  | { id: string; view: ViewId; kind: 'diameter' | 'radius'; edge: string; near: Vec3; place: XY }
  /** Between two straight edges (each the one of its name nearest `near`), in the sector holding `place`. */
  | { id: string; view: ViewId; kind: 'angle'; a: EdgeRef; b: EdgeRef; place: XY };
/** A straight edge by its persistent name, `near` a model point on it (names can repeat). */
export interface EdgeRef { edge: string; near: Vec3 }

export interface DrawingSettings {
  sheet: 'A4' | 'A3';
  /** Model mm per sheet mm inverted (2 = 2:1, 0.5 = 1:2); none: the largest standard scale that fits. */
  scale?: number;
  /** Third angle (US) or first angle (ISO) arrangement of the orthographic views. */
  projection: 'third' | 'first';
  /** Hidden edges dashed in the orthographic views (the isometric view shows visible edges only). */
  hidden: boolean;
  /** false: no centre marks and centrelines (shown by default). */
  centers?: boolean;
  /** The title block's part name (default: the file name). */
  title?: string;
  dimensions: DrawingDimension[];
}

export const defaultDrawing = (): DrawingSettings => ({ sheet: 'A4', projection: 'third', hidden: true, dimensions: [] });

/** Reads drawing settings from a saved file, keeping what is valid. */
export function readDrawing(raw: unknown): DrawingSettings {
  const d = defaultDrawing(), r = (raw ?? {}) as Partial<DrawingSettings>;
  return {
    sheet: r.sheet === 'A3' ? 'A3' : d.sheet,
    ...(typeof r.scale === 'number' && r.scale > 0 ? { scale: r.scale } : {}),
    projection: r.projection === 'first' ? 'first' : 'third',
    hidden: r.hidden !== false,
    ...(r.centers === false ? { centers: false } : {}),
    ...(typeof r.title === 'string' && r.title ? { title: r.title } : {}),
    dimensions: Array.isArray(r.dimensions) ? r.dimensions.filter(x => x && typeof x.id === 'string' && VIEW_IDS.includes(x.view)) : [],
  };
}

export type DrawingViews = Record<ViewId, BrepProjection>;
