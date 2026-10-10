import type { ScreenNode, ScreenSpec } from '@barocss/render';

export interface StreamIdentity { streamId: string; revision: number }
export interface Envelope extends StreamIdentity { version: 1; seq: number }
export type InputRecord =
  | (Envelope & { type: 'root'; id: string })
  | (Envelope & { type: 'node'; id: string; node: ScreenNode<string, string> })
  | (Envelope & { type: 'checkpoint' | 'commit' });
export interface OutputRecord extends Envelope {
  type: 'snapshot'; sourceSeq: number; phase: 'preview' | 'committed';
  spec: ScreenSpec<string, string>; css: string;
}
export const PROTOCOL_VERSION: 1;
export const STREAM_LIMITS: Readonly<{
  inputBytes: number; inputLineBytes: number; inputRecords: number; nodes: number;
  snapshots: number; cssBytes: number; outputBytes: number; outputLineBytes: number;
}>;
export function assertJsonData(value: unknown, depth?: number): void;
export function exactFields(value: unknown, keys: readonly string[]): void;
export function validateIdentity(identity: unknown): void;
export function validateInputRecord(record: unknown, identity: StreamIdentity, expectedSeq: number): InputRecord;
export function validateOutputRecord(record: unknown, identity: StreamIdentity, expectedSeq: number): OutputRecord;
export function encodeRecord(record: unknown): Uint8Array;
export interface JsonlDecoder {
  push(chunk: Uint8Array): void;
  finish(): { bytes: number; records: number };
}
export function createJsonlDecoder(options: {
  identity: StreamIdentity; kind?: 'input'; onRecord(record: InputRecord): void;
}): JsonlDecoder;
export function createJsonlDecoder(options: {
  identity: StreamIdentity; kind: 'output'; onRecord(record: OutputRecord): void;
}): JsonlDecoder;
