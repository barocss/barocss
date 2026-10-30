// The sketch's state types (PKG-b, B1): the shapes a sketch is drawn with, the tool, the anchor and the state — the
// model's (sketch/*), not the viewport's. viewport/Viewport.tsx re-exports them for the UI.
import type { PlanarFaceOutlineInsetAssociation } from '../engine/doc';
import type { PlaneKind, SketchPlane } from './plane';
import type { SketchRule } from './terms';
import type { SketchPick } from './rules';
import type { SplineDef } from './spline';

/** `select` picks outline points and edges for constraints; `dimension` adds and edits dimensions. */
export type SketchTool = 'rectangle' | 'circle' | 'polygon' | 'arc' | 'carc' | 'slot' | 'spline' | 'trim' | 'extend' | 'split' | 'select' | 'dimension';
/** Polygon segment i runs from point i to i+1; bulges[i] ≠ 0 makes it an arc. `pending`: the newest arc follows the cursor. */
/** `construction`: a reference drawn in the sketch (dashed): snapped to, but not part of the profile. */
export type SketchShape = (
  | { kind: 'rectangle'; a: [number, number]; b: [number, number] }
  | { kind: 'circle'; c: [number, number]; r: number }
  | { kind: 'polygon'; points: [number, number][]; closed: boolean; bulges?: number[]; pending?: boolean;
      /** Locked edge lengths and arc radii by segment index; tangent joints by point index. */
      lengths?: Record<number, number>; radii?: Record<number, number>; tangents?: number[];
      /** Arc pairs [lower, higher segment index] with the same radius / the same centre. */
      equalRadii?: [number, number][]; concentric?: [number, number][];
      /** Horizontal / vertical edges (kept from closing on), explicit constraints and point distances (sketch/rules.ts). */
      hv?: { h: number[]; v: number[] }; rules?: SketchRule[];
      /** Drawn with the Rectangle tool: saved as a rectangle again while it still is one (see sketch/loops.ts). */
      fromRectangle?: true;
      /** Drawn with the Spline tool: closing infers only tangency at its joints, never equal radii or shared centres between its arcs. */
      fromSpline?: true;
      /** A Spline-tool outline's fit points and handle directions (sketch/spline.ts): kept while the points still are what it makes; any other edit drops it. */
      spline?: SplineDef;
      /** Circles attached to the outline: dimensioned from its points and solved with it (holes or bosses of the profile). */
      circles?: { c: [number, number]; r: number }[];
      /** The attached circles' side ids (R10a, D86), one a circle. */
      circleIds?: string[] }
  | { kind: 'slot'; a: [number, number]; b: [number, number]; r: number }
) & {
  construction?: true;
  /**
   * Its sides' ids (R10a, D86; sketch/entityIds.ts): a rectangle's four and a slot's four in the order its sketch
   * node's loop runs them, a circle's one, a polygon's one a point (point i's is segment i's).
   */
  ids?: string[];
};

/** What a sketch plane is placed from: the face it was started on or a coordinate plane, moved by `offset` along its normal. */
export interface SketchAnchor { kind: 'face' | PlaneKind; offset: number; /** Degrees tipped about the plane's X axis (before the offset). */ angle?: number; face?: { plane: SketchPlane; base: { node: number; side: string } | null; /** The face's own outline and holes as sketch shapes (to use, or to snap to). */ outline?: SketchShape[]; /** Validated on explicit linked use; no mesh index is persisted. */ linkSource?: Omit<PlanarFaceOutlineInsetAssociation, 'insetMM'> } }
export interface SketchState { plane: SketchPlane; anchor?: SketchAnchor; /** Closed shapes drawn before the current one. */ done?: SketchShape[]; tool: SketchTool; shape: SketchShape | null; base?: { node: number; side: string } | null; /** What the finished profile makes by default. */ make?: Make;
  /** Outline points and edges picked with the Select tool; the dimension open in the viewport editor (len<i>, rad<i>, dist<a>_<b>). */
  picked?: SketchPick[]; editDim?: string | null;
  /** Set when a finished sketch is reopened: Finish replaces this node instead of adding a feature. */
  editNode?: number;
  /** Explicit linked profile; manual geometry or plane edits detach it. */
  association?: PlanarFaceOutlineInsetAssociation;
  associationDetached?: boolean;
  /**
   * A reopened sketch from before R10a (no side ids): its walls' positional names to the ids its shapes took in that
   * order (`side2` → `side[e3]`), so Finish names the later features' references by them (D86).
   */
  positional?: Record<string, string>;
  /** New shapes are drawn as construction (references) while this is on (X). */
  construct?: boolean;
  /** Construction shapes hidden (not drawn, not snapped to); they stay with the sketch. */
  hideConstruction?: boolean }
export type Make = 'extrude' | 'revolve-y' | 'revolve-x' | 'pipe' | 'loft';
