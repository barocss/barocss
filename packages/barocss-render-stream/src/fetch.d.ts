import type { RenderContract } from '@barocss/render';
import type { OutputRecord, StreamIdentity } from './protocol.js';

/** The source must honor the owned signal; the host owns durable admission. */
export function createCompiledResponse(options: {
  identity: StreamIdentity;
  contract: RenderContract<string, string>;
  source(signal: AbortSignal): AsyncIterable<Uint8Array>;
  signal?: AbortSignal;
  includePreview?: boolean;
  acceptFinal(record: OutputRecord & { phase: 'committed' }, signal: AbortSignal):
    boolean | void | Promise<boolean | void>;
}): Response;
