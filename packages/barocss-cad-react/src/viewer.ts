/** Display-only sink over the existing Viewer facade. No GPU/backend/camera implementation. */
import { createViewer, type Viewer } from '@barocss/viewer';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Owner } from './ports.js';
import type { ExistingViewerSink } from './ports.js';

export class ExistingViewerHost implements ExistingViewerSink {
  private disposed = false;
  private frameOwner: Owner | null = null;
  private mountedOwner: Owner | null = null;
  private pixels: { bytes: number; nonBackgroundPixels: number; sha256: string } | null = null;
  private controls: { dispose(): void }[] = [];
  private constructor(private viewer: Viewer) {
    try {
      this.controls.push(viewer.attachPointerControls());
      this.controls.push(viewer.attachKeyboardControls());
    } catch (error) { this.dispose(); throw error; }
  }
  static async create(canvas: HTMLCanvasElement) {
    return new ExistingViewerHost(await createViewer(canvas, { mmToSceneUnit: 0.01, background: [0.94, 0.95, 0.97] }));
  }
  async show(bodies: readonly BodyResult[], owner: Owner, stillCurrent: () => boolean) {
    if (this.disposed || !stillCurrent()) return;
    // This is the sole new Viewer boundary. No GPU-core imports or camera/render loop here.
    this.viewer.loadDisplayMeshes({ version: 0, sourceFrame: 'right-handed-z-up', sourceUnit: 'mm',
      revision: owner.evaluationRevision, bodies: bodies.map(body => ({ bodyId: body.key,
        positions: body.mesh.positions, normals: body.mesh.normals, indices: body.mesh.indices })) });
    this.mountedOwner = owner;
    const pixels = await this.viewer.readPixels();
    if (this.disposed || !stillCurrent() || this.mountedOwner !== owner) return;
    // A frame completion check, not a physical geometry oracle. Background uses corner RGB.
    let nonBackgroundPixels = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (Math.abs(pixels[i] - pixels[0]) + Math.abs(pixels[i + 1] - pixels[1]) + Math.abs(pixels[i + 2] - pixels[2]) > 8) nonBackgroundPixels++;
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels).buffer);
    if (this.disposed || !stillCurrent() || this.mountedOwner !== owner) return;
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    this.pixels = { bytes: pixels.length, nonBackgroundPixels, sha256 };
    this.frameOwner = owner;
  }
  snapshot() {
    const state = this.viewer.getState();
    return { facade: '@barocss/viewer', status: state.status, camera: state.camera,
      displayMeshes: state.displayMeshes ? { revision: state.displayMeshes.revision,
        authority: state.displayMeshes.authority, bodies: state.displayMeshes.bodies.map(body => ({ bodyId: body.bodyId,
          vertices: body.positions.length / 3, triangles: body.indices.length / 3 })) } : null,
      mountedOwner: this.mountedOwner, frameOwner: this.frameOwner, pixels: this.pixels };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const failures: unknown[]=[];
    for (const control of this.controls.splice(0)) try { control.dispose(); } catch (error) { failures.push(error); }
    try { this.viewer.dispose(); } catch (error) { failures.push(error); }
    this.mountedOwner = null; this.frameOwner = null;
    if (failures.length) throw new AggregateError(failures,'Viewer sink cleanup failed');
  }
}
