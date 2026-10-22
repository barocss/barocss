/**
 * A display-only drawing in world (or bed) coordinates for the preview overlays (G23 print layers, G23 CNC): no native
 * face or edge identity, no picking, no bounds or shadows. Triangles when `topology` says so or there are indices;
 * otherwise line segments, two points a segment.
 */
export interface OverlayDrawing {
  name: string;
  positions: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
  topology?: 'triangles' | 'lines';
  color: [number, number, number];
  opacity: number;
  width?: number;
  visible?: boolean;
  /** Shaded by its normals (a solid the eye should read), else flat colour. */
  lit?: boolean;
}

export const overlayTriangles = (d: OverlayDrawing): boolean => d.topology ? d.topology === 'triangles' : !!d.indices;
/** Triangle elements (indices, else vertices) or line segments; nothing to draw at 0. */
export const overlayCount = (d: OverlayDrawing): number => overlayTriangles(d) ? d.indices?.length ?? d.positions.length / 3 : d.positions.length / 6;
