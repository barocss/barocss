import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import type { LayerLoop, PrintLayer } from '@barocss/cad-model/print/layers';
import type { PrintDisplay, PrintSummary } from './printDisplay';
import { axisSection, clipMeshSection } from './sectionView';
import type { OverlayDrawing } from './overlayDrawing';

/** Bed-space drawing only. No native face/edge authority, picking or authored Model state. */
export type PrintDrawing = OverlayDrawing;

/** Model loops are closed, including holes; their supplied winding is retained. */
export function printLoopSegments(loops: readonly LayerLoop[], z: number): Float32Array {
  if (!Number.isFinite(z)) throw new Error('Print overlay: invalid layer height');
  const lines: number[] = [];
  for (const { points } of loops) {
    if (points.length % 2 || !points.every(Number.isFinite)) throw new Error('Print overlay: invalid layer loop');
    let count = points.length / 2;
    if (count > 1 && points[0] === points[(count - 1) * 2] && points[1] === points[(count - 1) * 2 + 1]) count--;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count, ax = points[i * 2], ay = points[i * 2 + 1], bx = points[j * 2], by = points[j * 2 + 1];
      if (ax !== bx || ay !== by) lines.push(ax, ay, z, bx, by, z);
    }
  }
  return Float32Array.from(lines);
}

/** Clip and cap the supplied full extrusion with G19; all resulting faces remain display-only. */
export function clipPrintSupport(mesh: DisplayMesh, top?: number): Pick<DisplayMesh, 'positions' | 'normals' | 'indices'> {
  if (top === undefined) return mesh;
  if (!Number.isFinite(top)) throw new Error('Print overlay: invalid printed height');
  return clipMeshSection(mesh, axisSection({ axis: 'z', at: top, keep: 'negative' }), 'print-support-cap')
    ?? { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array() };
}

/** A stable bed origin/grid reference. Its extent is display-only, never a printer specification. */
function bedReference(summary: PrintSummary): PrintDrawing {
  let extent = Math.max(20, summary.height);
  for (const column of summary.supportColumns) for (const coordinate of column.footprint) extent = Math.max(extent, Math.abs(coordinate));
  extent = Math.ceil(extent / 10) * 10;
  const p: number[] = [];
  for (let i = -5; i <= 5; i++) {
    const at = extent * i / 5;
    p.push(-extent, at, 0, extent, at, 0, at, -extent, 0, at, extent, 0);
  }
  return { name: 'bed', positions: Float32Array.from(p), color: [0.36, 0.58, 0.66], opacity: 0.35, width: 1 };
}

/** Keep drawing identities stable so each backend replaces only changed resources. */
export class PrintOverlayGeometry {
  private summary?: PrintSummary;
  private bed?: PrintDrawing;
  private layer?: PrintLayer;
  private lines: PrintDrawing[] = [];
  private supportMesh?: DisplayMesh;
  private supportTop?: number;
  private support?: PrintDrawing;

  update(display: PrintDisplay | null): PrintDrawing[] {
    if (!display) {
      this.summary = undefined; this.bed = undefined; this.layer = undefined; this.lines = [];
      this.supportMesh = undefined; this.supportTop = undefined; this.support = undefined;
      return [];
    }
    if (this.summary !== display.summary) {
      this.summary = display.summary; this.bed = bedReference(display.summary);
    }
    if (this.layer !== display.layer) {
      const { layer } = display;
      this.lines = [
        { name: 'contours', positions: printLoopSegments(layer.contours, layer.z), color: [0.08, 0.72, 0.94], opacity: 1, width: 2 },
        { name: 'overhang', positions: printLoopSegments(layer.overhang, layer.z), color: [1, 0.27, 0.08], opacity: 1, width: 2.5 },
        { name: 'support-loops', positions: printLoopSegments(layer.support, layer.z), color: [0.36, 0.88, 0.46], opacity: 1, width: 2 },
      ];
      this.layer = layer;
    }
    const top = display.printed ? display.top : undefined;
    if (this.supportMesh !== display.supportMesh || this.supportTop !== top) {
      const mesh = clipPrintSupport(display.supportMesh, top);
      this.support = { name: 'supports', positions: mesh.positions, normals: mesh.normals, indices: mesh.indices, color: [0.34, 0.8, 0.43], opacity: 0.3 };
      this.supportMesh = display.supportMesh; this.supportTop = top;
    }
    if (this.support) this.support.visible = display.supports;
    for (const line of this.lines) line.visible = display.supports || line.name !== 'support-loops';
    return [this.bed!, ...(this.support ? [this.support] : []), ...this.lines].filter(draw => draw.indices ? draw.indices.length > 0 : draw.positions.length > 0);
  }
}
