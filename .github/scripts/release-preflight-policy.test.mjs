import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/npm-release.yml', 'utf8');

function assertDevelopPreflightOnly(source) {
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /github\.ref == 'refs\/heads\/develop'/);
  for (const forbidden of [
    /^\s+publish:/m,
    /changesets\/action@/,
    /\bnpm publish\b/,
    /\bchangeset publish\b/,
    /\bNPM_TOKEN\b/,
    /id-token: write/,
    /contents: write/,
  ]) {
    assert.doesNotMatch(source, forbidden, `Develop preflight cannot contain ${forbidden}`);
  }
}

test('develop workflow has no npm publication path', () => {
  assertDevelopPreflightOnly(workflow);
});

test('develop dispatch with a publish input is rejected', () => {
  assert.throws(() => assertDevelopPreflightOnly(`${workflow}\n      publish:\n        type: boolean\n`));
});

test('develop dispatch with a publish command is rejected', () => {
  assert.throws(() => assertDevelopPreflightOnly(`${workflow}\n      - run: pnpm changeset publish\n`));
});
