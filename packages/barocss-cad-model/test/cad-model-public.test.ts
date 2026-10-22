import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// The owner, 2026-10-21: "@barocss/cad-model 은 완전 공개 패키지야" — every file under its src/ ships, so none may hold
// a machine's own paths (a home directory, a temp folder).

const SRC = resolve(import.meta.dirname, '../src');
function filesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesOf(join(dir, e.name)) : [join(dir, e.name)]);
}

test('@barocss/cad-model is fully public: no file under src/ holds an absolute /Users/, /private/, /home/ or /var/folders/ path', () => {
  const files = filesOf(SRC);
  assert.ok(files.length > 150, `${files.length} files`);
  const found = files.flatMap(f => (readFileSync(f, 'utf8').match(/\/(?:Users|private|home|var\/folders)\/[^\s'"`)]*/g) ?? []).map(p => `${relative(SRC, f)}: ${p}`));
  assert.deepEqual(found, []);
});
