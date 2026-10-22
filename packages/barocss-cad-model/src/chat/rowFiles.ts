// Capabilities issued by the person's conversation input. Tool arguments cannot mint one.
import { sha256Hex } from '../team/digest';

export interface RowFileInput { name: string; text: string; turn: number }
export interface RowFileSource { filename: string; suppliedBy: 'person'; turn: number; sha256: string }
export interface PersonRowFile { id: string; text: string; source: RowFileSource }
export interface PersonRowFiles { readonly files: readonly PersonRowFile[] }
const issued = new WeakSet<PersonRowFiles>();
const bytes = (s: string) => new TextEncoder().encode(s);

/** Called only by the browser's user input or the server restoring that input, never a tool. */
export function receivePersonRowFiles(conversation: string, inputs: readonly RowFileInput[], turnCount: number): PersonRowFiles {
  if (!/^[a-f0-9]{24}$/.test(conversation)) throw new Error('Invalid row-file conversation.');
  if (!Array.isArray(inputs) || inputs.length > 32) throw new Error('At most 32 row files per conversation.');
  let total = 0;
  const files = inputs.map(input => {
    if (!input || Object.keys(input).some(k => !['name', 'text', 'turn'].includes(k)) || typeof input.name !== 'string' || !/^[^/\\]{1,160}\.json$/i.test(input.name) || [...input.name].some(c => c.charCodeAt(0) < 32) || typeof input.text !== 'string' || !Number.isInteger(input.turn) || input.turn < 1 || input.turn > turnCount) throw new Error('A row file needs a JSON filename, text and its user conversation turn.');
    const content = bytes(input.text); total += content.length;
    if (content.length > 262144 || total > 1048576) throw new Error('Row files are limited to 256 KiB each and 1 MiB per conversation.');
    JSON.parse(input.text);
    const sha256 = sha256Hex(content), source = Object.freeze({ filename: input.name, suppliedBy: 'person' as const, turn: input.turn, sha256 });
    const id = `rows-${sha256Hex(bytes(JSON.stringify([conversation, input.name, input.turn, sha256])))}`;
    return Object.freeze({ id, text: input.text, source });
  });
  const result = Object.freeze({ files: Object.freeze(files) }); issued.add(result);
  return result;
}
export function revokePersonRowFiles(context: PersonRowFiles | undefined): void { if (context) issued.delete(context); }
export function isPersonRowFiles(context: PersonRowFiles | undefined): context is PersonRowFiles { return !!context && issued.has(context); }
export function personRowFile(context: PersonRowFiles | undefined, id: unknown): PersonRowFile | undefined {
  return isPersonRowFiles(context) && typeof id === 'string' ? context.files.find(file => file.id === id) : undefined;
}
export const ROWS_NOT_FROM_PERSON = '[ROWS_NOT_FROM_PERSON] Load a JSON file attached or pasted by the person in this conversation. Agent-written rows and suppliedBy claims are not accepted.';

/** Parses a whole JSON paste; this returns input data and grants no file authority. */
export function pastedRowFile(text: string, turn: number): RowFileInput | null {
  const json = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/i, '$1');
  if (!json.startsWith('{') && !json.startsWith('[')) return null;
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' ? { name: `pasted-rows-turn-${turn}.json`, text: json, turn } : null;
  } catch { return null; }
}
