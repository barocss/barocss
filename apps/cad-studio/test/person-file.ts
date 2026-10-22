// Rows rule b in tests: a test's rows reach a loader only as a file the person supplied in the conversation.
// The values are each test's own test rows, not a catalogue.
import { receivePersonRowFiles, type PersonRowFiles } from '@barocss/cad-model/chat/rowFiles';

/** One supplied file at turn 1: the context the chat state carries, and the reference a loader takes. */
export function personFile(name: string, payload: unknown): { rowFiles: PersonRowFiles; file: string } {
  const rowFiles = receivePersonRowFiles('0123456789abcdef01234567', [{ name, text: JSON.stringify(payload), turn: 1 }], 1);
  return { rowFiles, file: rowFiles.files[0].id };
}
