import type { PhysicsState } from '../../packages/barocss-physics/src/types.js';

export interface DiagnosticMetadata {
  phase: string;
  stepIndex: number;
  pass: number | null;
  pair: string[] | null;
  hit: unknown;
  manifold: unknown;
}
export interface DiagnosticFrame {
  metadata: DiagnosticMetadata;
  state: PhysicsState;
}

function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}

/** Inspection-only sink. No caller callback or mutable world reference escapes. */
export class DiagnosticRecorder {
  #frames: DiagnosticFrame[] = [];
  record(metadata: DiagnosticMetadata, state: PhysicsState): void {
    if (this.#frames.length >= 126) throw new Error('diagnostic frame limit');
    const frame = structuredClone({ metadata, state });
    freeze(frame);
    this.#frames.push(frame);
  }
  snapshot(): DiagnosticFrame[] { return structuredClone(this.#frames); }
}
