// The document's questions schema (R4 D4: the types engine/doc.ts stores, out of chat/questions.ts unchanged).
import type { BriefKey } from './brief';

export type Blocks = { field: BriefKey } | { requirement: string } | { dimension: string };
export interface Question { id: string; text: string; kind: 'choice' | 'number' | 'text'; options?: string[]; unit?: string; blocks: Blocks }
export interface Batch { n: number; questions: Question[]; status: 'open' | 'answered' | 'skipped'; /** Each question's answer as the user gave it, or null where skipped. */ answers?: Record<string, string | number | null>; at?: string }
export interface QuestionLog { version: 1; batches: Batch[] }
export type AskCode = 'TOO_MANY' | 'NOT_BLOCKING' | 'BATCHES_USED' | 'OPEN_BATCH' | 'BAD_QUESTION';
