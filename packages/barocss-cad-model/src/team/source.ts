// O9: where an export came from, written beside a file whose bytes cannot carry it — an STL's fixed 80-byte header, the
// robot exports that external readers' frozen oracles pin (URDF, MJCF, SDF, USD) — as `<name>.source.json`. It names
// the document's revision (team/revision.ts: what a revision covers, 64-bit, for staleness), a SHA-256 of the same
// content (for integrity), and for a robot the hand-set values its export read: the base and the joints' limits and
// ratings a person set. STEP, 3MF and the drawing carry the revision in the file itself.
import type { StudioDoc } from '../engine/doc';
import { canonicalOf, revisionOf } from './revision';
import { sha256Hex } from './digest';
import { readRobot, type RobotSettings } from '../robot/joints';

export interface SourceRecord {
  format: 'barocss-source'; version: 1;
  /** The document's revision the file was made from. */
  revision: string;
  /** SHA-256 of the revision's canonical content (the input). */
  digest: string;
  /** What the file is (its name), so a record beside several files says each. */
  files: string[];
  /** A robot export's hand-set values: the base link and the joints' settings. */
  handSet?: RobotSettings;
}
/** The record of the files made from a document (`robot`: with its hand-set values). */
export function sourceRecord(doc: StudioDoc, files: readonly string[], o: { robot?: boolean } = {}): SourceRecord {
  return { format: 'barocss-source', version: 1, revision: revisionOf(doc), digest: sha256Hex(new TextEncoder().encode(canonicalOf(doc))), files: [...files], ...(o.robot ? { handSet: readRobot(doc.robot) } : {}) };
}
/** The record as its file's bytes (stable: the same document, the same bytes). */
export const sourceBytes = (r: SourceRecord) => new TextEncoder().encode(JSON.stringify(r, null, 1) + '\n');
/** The record's file name beside `name` (its extension dropped): part.stl → part.source.json. */
export const sourceName = (name: string) => `${name.replace(/\.[^./\\]+$/, '')}.source.json`;
