import type { PrintDisplay } from './printDisplay';
import { PrintOverlayGeometry } from './printOverlayGeometry';
import { OverlayGL } from './overlayGL';
import type { OverlayDrawing } from './overlayDrawing';

/** Separate bed-space colour pass, absent from native IDs, bounds, shadows and native cap construction. */
export class PrintOverlayGL {
  private geometry = new PrintOverlayGeometry();
  private overlay: OverlayGL;

  constructor(gl: WebGL2RenderingContext) { this.overlay = new OverlayGL(gl, 'Print'); }

  setDisplay(display: PrintDisplay | null): void {
    try { this.overlay.setDrawings(this.geometry.update(display)); }
    catch (error) { this.overlay.setDrawings([]); this.geometry.update(null); throw error; }
  }

  /** The uploaded drawings (for checks of what the pass owns). */
  get draws(): ReadonlyMap<OverlayDrawing, unknown> { return this.overlay.draws; }
  render(vp: Float32Array, width: number, height: number, dpr: number): void { this.overlay.render(vp, width, height, dpr); }
  dispose(): void { this.overlay.dispose(); this.geometry.update(null); }
}
