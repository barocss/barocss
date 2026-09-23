import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeCss, structureFingerprint } from './normalize';

const [rawPath, approvedPath] = process.argv.slice(2);
if (!rawPath || !approvedPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-approved-structures.ts <raw-css-json> <approved-json>');
}

type RawRecord = { candidate: string; tailwindCss: string; baroCss: string };
const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as { records: RawRecord[] };
const approvedCss = (css: string) => ({
  fingerprint: structureFingerprint(css),
  nodes: normalizeCss(css),
});
const approved = Object.fromEntries(raw.records.map(({ candidate, tailwindCss, baroCss }) => [
  candidate,
  { tailwind: approvedCss(tailwindCss), barocss: approvedCss(baroCss) },
]));
writeFileSync(approvedPath, `${JSON.stringify(approved, null, 2)}\n`);
