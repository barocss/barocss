// Completeness gate for #446 browser evidence. It does not require the build-only control to pass later edits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMS, SCENARIOS } from './contract.mjs';
import { INITIAL_LAYOUT_TOKENS } from './styles.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(fs.readFileSync(path.join(here, 'evidence/replay.json'), 'utf8'));
const failures = [];
const expected = Object.keys(SCENARIOS).length * Object.keys(ARMS).length * 4 * report.repeats;
if (report.repeats < 2 || report.rows.length !== expected) failures.push(`expected ${expected} rows with at least two repeats`);
const cases = new Set();
const expectedCases = new Set(Object.keys(SCENARIOS).flatMap((scenario) => Object.keys(ARMS).flatMap((arm) => ['initial', 'density', 'responsive', 'structure'].flatMap((stage) => Array.from({ length: report.repeats }, (_, repeat) => `${scenario}/${arm}/${stage}/${repeat}`)))));
for (const row of report.rows) {
  const key = `${row.scenario}/${row.arm}/${row.stage}/${row.repeat}`;
  if (cases.has(key)) failures.push(`duplicate ${key}`);
  if (!expectedCases.has(key)) failures.push(`unexpected ${key}`);
  cases.add(key);
  if (row.error || row.errors?.length) failures.push(`${key}: browser/harness error: ${row.error || row.errors?.join('; ')}`);
  for (const field of ['specValid', 'domPass', 'inputValuePreserved', 'focusPreserved', 'actionPass', 'stylePass', 'themeAdherence', 'hostStyleDelta']) if (typeof row[field] !== 'boolean') failures.push(`${key}: ${field} missing`);
  if (!Number.isInteger(row.unstyledFrames) || row.unstyledFrames < 0 || row.unstyledFrames > 4) failures.push(`${key}: frame count missing`);
  if (row.repeat === 0 && (!row.screenshot || !fs.existsSync(path.join(here, 'evidence', row.screenshot)))) failures.push(`${key}: screenshot missing`);
  if (!Array.isArray(row.frames) || row.frames.length !== 4) failures.push(`${key}: frame trace missing`);
}
for (const key of expectedCases) if (!cases.has(key)) failures.push(`missing ${key}`);
const expectedInventory = [...new Set([...report.inventory.utility.tokens])].sort();
if (JSON.stringify(report.inventory.build.tokens) !== JSON.stringify(expectedInventory)) failures.push('build and utility initial CSS inventory differ');
for (const token of INITIAL_LAYOUT_TOKENS) if (!report.inventory.build.tokens.includes(token)) failures.push(`build initial class missing: ${token}`);
for (const token of ['p-3', 'gap-3', 'grid-cols-1']) if (report.inventory.build.tokens.includes(token)) failures.push(`build learned later-stage class: ${token}`);
if (failures.length) { console.error(failures.slice(0, 20).join('\n')); process.exitCode = 1; }
else console.log(`Verified ${report.rows.length} measured rows, ${Object.keys(SCENARIOS).length * Object.keys(ARMS).length * 4} first-repeat screenshots, and a frozen build-control inventory.`);
