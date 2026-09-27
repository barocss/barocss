// Verify a complete saved capture before replay or viewing; never repair it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { schedule } from './plan.mjs';
import { verifyFrozen } from './freeze.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function verifyCapture(captureDir) {
  const manifestBytes = fs.readFileSync(path.join(captureDir, 'manifest.json'));
  const rowsBytes = fs.readFileSync(path.join(captureDir, 'rows.json'));
  const manifest = JSON.parse(manifestBytes), rows = JSON.parse(rowsBytes);
  const planned = schedule();
  if (manifest.kind !== 'codex-ui-458-capture' || manifest.planHash !== verifyFrozen() ||
      manifest.scheduledCount !== planned.length ||
      JSON.stringify(rows.map((row) => row.id)) !== JSON.stringify(planned.map((row) => row.id))) throw new Error('Capture plan or schedule mismatch');
  const inventory = { 'manifest.json': sha(manifestBytes), 'rows.json': sha(rowsBytes) };
  for (const row of rows) {
    const dirName = `attempt-${String(row.ordinal).padStart(2, '0')}`;
    const dir = path.join(captureDir, dirName);
    if (!row.attempted) {
      if (fs.existsSync(dir)) throw new Error(`Unattempted cell has an attempt directory: ${row.id}`);
      continue;
    }
    const requestPath = path.join(dir, 'request.json'), reservePath = path.join(dir, 'reservation.json'), transportPath = path.join(dir, 'transport.json');
    const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    const reservation = JSON.parse(fs.readFileSync(reservePath, 'utf8'));
    const transport = JSON.parse(fs.readFileSync(transportPath, 'utf8'));
    if (request.id !== row.id || reservation.id !== row.id || reservation.ordinal !== row.ordinal ||
        reservation.planHash !== manifest.planHash || reservation.consumesOneAttempt !== true ||
        reservation.requestSha256 !== sha(JSON.stringify(request))) throw new Error(`Invalid request/reservation: ${row.id}`);
    const rawPath = path.join(dir, 'raw-final.txt');
    const rawHash = fs.existsSync(rawPath) ? sha(fs.readFileSync(rawPath)) : null;
    if (rawHash !== row.rawFinalSha256 || rawHash !== transport.rawFinalSha256) throw new Error(`Raw final hash mismatch: ${row.id}`);
    for (const name of ['request.json', 'reservation.json', 'transport.json', 'events.jsonl', ...(rawHash ? ['raw-final.txt'] : [])]) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) throw new Error(`Missing evidence ${dirName}/${name}`);
      inventory[`${dirName}/${name}`] = sha(fs.readFileSync(file));
    }
  }
  const found = fs.readdirSync(captureDir).filter((name) => /^attempt-\d+$/.test(name)).sort();
  const expected = rows.filter((row) => row.attempted).map((row) => `attempt-${String(row.ordinal).padStart(2, '0')}`).sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error('Unexpected or missing attempt directory');
  return { manifest, rows, manifestSha256: sha(manifestBytes), evidenceSha256: sha(JSON.stringify(inventory)), inventory };
}
