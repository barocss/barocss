import type { Viewer } from '@barocss/gpu/viewer';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';

export interface ViewportRecoveryNotice extends FriendlyError {
  state: 'restoring' | 'restored' | 'failed';
  /** Rechecked when React applies a queued notice update. */
  isCurrent?(): boolean;
}
type Source = Pick<Viewer, 'ready' | 'computeDevice' | 'recovery' | 'stats' | 'frame' | 'onRecover' | 'onRecoverError'>;
type Device = { lost: PromiseLike<unknown>; queue: { onSubmittedWorkDone(): Promise<void> } };

/** Private observation only: the Viewer continues to own device recreation and retained scene resources. */
class ViewportRecovery {
  private source: Source | null = null;
  private host: ((notice: ViewportRecoveryNotice) => void) | null = null;
  private device: Device | null = null;
  private generation = 0;
  private attachment = {};
  private latest: ViewportRecoveryNotice | null = null;
  private diagnostic = '';
  private disposed = false;
  private unhook: (() => void) | null = null;

  constructor(source?: Source) { if (source) this.attach(source); }
  /** Available before createViewer awaits startup. Generic GPU diagnostics alone do not mean recovery failed. */
  report(message: string): void { if (!this.disposed) this.diagnostic = message; }
  attach(source: Source): void {
    if (this.disposed || this.source === source) return;
    if (this.source) this.diagnostic = '';
    this.unhook?.(); this.generation++; this.attachment = {}; this.device = null; this.latest = null;
    this.source = source;
    const recreated = () => this.recreated(source), failed = (error: { message: string }) => this.failed(source, error);
    source.onRecover = recreated; source.onRecoverError = failed;
    this.unhook = () => {
      if (source.onRecover === recreated) source.onRecover = null;
      if (source.onRecoverError === failed) source.onRecoverError = null;
    };
    this.watchDevice();
    const pending = source.recovery;
    if (pending) {
      this.restoring();
      const generation = this.generation;
      void Promise.resolve(pending).then(() => {
        if (this.source !== source || generation !== this.generation) return;
        if (source.ready) this.recreated(source);
        else this.failed(source, new Error(this.diagnostic || 'The GPU viewer could not recover.'));
      }, error => { if (this.source === source && generation === this.generation) this.failed(source, new Error(String(error))); });
    } else if (!source.ready) this.failed(source, new Error(this.diagnostic || 'The GPU viewer is unavailable.'));
    else if ((source.stats?.deviceLosses ?? 0) > 0) {
      // Loss can finish before createViewer returns. Its existing counter provides that startup history.
      this.restoring(); this.recreated(source);
    }
  }
  setHost(host: (notice: ViewportRecoveryNotice) => void): void {
    if (this.disposed) return;
    this.host = host;
    if (this.latest) host(this.latest);
  }
  private publish(notice: ViewportRecoveryNotice): void {
    if (this.disposed || !this.source) return;
    const published: ViewportRecoveryNotice = { ...notice, isCurrent: () => !this.disposed && this.latest === published };
    this.latest = published; this.host?.(published);
  }
  private restoring(): void {
    this.publish({ state: 'restoring', title: 'Restoring viewport', hint: 'Your model remains open.', detail: '' });
  }
  private watchDevice(): void {
    const device = this.source?.computeDevice as Device | null;
    if (!device?.lost || !device.queue || device === this.device) return;
    this.device = device;
    const attachment = this.attachment;
    // An unresolved device-loss promise must not retain a disposed renderer or React host callback.
    void Promise.resolve(device.lost).then(() => {
      if (!this.source || this.attachment !== attachment || this.device !== device) return;
      // Viewer hides computeDevice while recovering. The remembered device still owns this loss.
      const current = this.source.computeDevice;
      if (current && current !== device) return;
      this.generation++; this.restoring();
    }, () => {});
  }
  private recreated(source: Source): void {
    if (this.disposed || this.source !== source) return;
    this.watchDevice();
    const device = this.device, generation = ++this.generation;
    if (device && source.ready) void this.waitForFrame(source, device, generation);
  }
  private current(source: Source, device: Device, generation: number): boolean {
    return !this.disposed && this.source === source && this.device === device && this.generation === generation && source.ready && source.computeDevice === device;
  }
  private async waitForFrame(source: Source, device: Device, generation: number): Promise<void> {
    try {
      await source.frame();
      if (!this.current(source, device, generation)) return;
      // frame() may resolve despite queue rejection. Verify this same replacement device explicitly.
      await device.queue.onSubmittedWorkDone();
      if (!this.current(source, device, generation)) return;
      this.publish({ state: 'restored', title: 'Viewport restored', hint: 'Your model remains open.', detail: '' });
    } catch (error) {
      if (this.current(source, device, generation)) this.failed(source, error instanceof Error ? error : new Error(String(error)));
    }
  }
  private failed(source: Source, error: { message: string }): void {
    if (this.disposed || this.source !== source) return;
    this.generation++;
    this.publish({ state: 'failed', title: 'Viewport unavailable', hint: 'Save your work, then reload to restore the view.', detail: error.message });
  }
  dispose(): void {
    this.unhook?.(); this.unhook = null; this.generation++; this.attachment = {}; this.disposed = true;
    this.source = null; this.host = null; this.device = null; this.latest = null; this.diagnostic = '';
  }
}
export function createViewportRecovery(source?: Source) { return new ViewportRecovery(source); }

const admitted = new WeakSet<object>();
/** Idempotent under React updater replay. A newer unrelated error or Undo notice keeps its exact identity/action. */
export function viewportRecoveryToast(current: FriendlyError | null, next: ViewportRecoveryNotice): FriendlyError | null {
  if (next.isCurrent?.() === false || (current && !admitted.has(current))) return current;
  admitted.add(next);
  return next;
}

/** Attachment ownership is checked both at callback delivery and when its queued React update is applied. */
export function viewportRecoveryHost(current: () => boolean, deliver: (notice: ViewportRecoveryNotice) => void) {
  return (notice: ViewportRecoveryNotice): void => {
    const isCurrent = () => current() && notice.isCurrent?.() !== false;
    if (isCurrent()) deliver({ ...notice, isCurrent });
  };
}
