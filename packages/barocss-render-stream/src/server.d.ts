import type { RenderContract, ScreenSpec } from '@barocss/render';
import type { InputRecord, StreamIdentity } from './protocol.js';

export interface CompiledCandidate {
  sourceSeq: number; spec: ScreenSpec<string, string>; css: string; final?: true;
}
export interface StreamCompiler {
  accept(record: InputRecord): CompiledCandidate | null;
  finish(): CompiledCandidate & { final: true };
}
/** Each checkpoint and commit is a complete validated view with its full CSS sheet. */
export function createCompiler(options: {
  identity: StreamIdentity; contract: RenderContract<string, string>;
}): StreamCompiler;
