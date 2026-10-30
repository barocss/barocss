import { BarocssError } from '@barocss/cad/api';
import { pinBlobs } from '@barocss/cad-model/engine/blobs';
import { fontFromBytes, type FontSource } from '@barocss/cad-model/engine/font/source';

/** Native File also satisfies this interface; tests can control read completion without a browser. */
export interface FontFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** One active HUD session. Cancellation and replacement invalidate both reads and content-key work. */
export class FontUpload {
  #session: object | null = null;
  #sequence = 0;
  #release: (() => void) | null = null;

  sync(session: object | null): void {
    if (session === this.#session) return;
    this.#session = session;
    this.#sequence++;
    this.#release?.(); this.#release = null;
  }

  async load(session: object, file: FontFile): Promise<FontSource | null> {
    this.sync(session);
    const sequence = ++this.#sequence;
    this.#release?.(); this.#release = null;
    try {
      // Keep the reader's current 8 MiB admission before allocating a native File buffer.
      if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > 8 * 1024 * 1024) {
        throw new BarocssError('TTF_BUDGET', 'A font file must fit the 8 MiB input budget.', undefined, { source: 'true-type' });
      }
      const buffer = await file.arrayBuffer();
      if (sequence !== this.#sequence || session !== this.#session) return null;
      const source = await fontFromBytes(new Uint8Array(buffer), { filename: file.name });
      if (sequence !== this.#sequence || session !== this.#session) return null;
      this.#release = pinBlobs([source.blob]);
      return source;
    } catch (error) {
      if (sequence !== this.#sequence || session !== this.#session) return null;
      throw error;
    }
  }
}
