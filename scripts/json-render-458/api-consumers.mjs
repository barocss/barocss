// API-only saved-evidence consumers. Legacy CLI/stub consumers stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyApiCapture } from './api-provenance.mjs';
import { scoreSaved } from './score.mjs';
import { replaySaved } from './replay.mjs';
import { createViewer } from './viewer.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function saveExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
export function scoreApiSaved(captureDir) {
  const before = verifyApiCapture(captureDir);
  const scoring = scoreSaved(before.rows, captureDir);
  if (verifyApiCapture(captureDir).apiEvidenceSha256 !== before.apiEvidenceSha256) throw new Error('API capture changed during scoring');
  return { scoring, apiEvidenceSha256: before.apiEvidenceSha256 };
}
export function bindApiReport(captureDir, replayDir) {
  const capture = verifyApiCapture(captureDir);
  const reportBytes = fs.readFileSync(path.join(replayDir, 'report.json'));
  const report = JSON.parse(reportBytes);
  if (report.captureManifestSha256 !== capture.manifestSha256 || report.captureEvidenceSha256 !== capture.evidenceSha256) throw new Error('Replay report is not bound to capture');
  const binding = { kind: 'barocss-458-api-replay-binding', apiEvidenceSha256: capture.apiEvidenceSha256,
    genericEvidenceSha256: capture.evidenceSha256, reportSha256: sha(reportBytes) };
  saveExclusive(path.join(replayDir, 'api-report-binding.json'), binding);
  return binding;
}
export function verifyApiReport(captureDir, replayDir) {
  const capture = verifyApiCapture(captureDir);
  const reportBytes = fs.readFileSync(path.join(replayDir, 'report.json'));
  const binding = JSON.parse(fs.readFileSync(path.join(replayDir, 'api-report-binding.json')));
  if (binding.kind !== 'barocss-458-api-replay-binding' || binding.apiEvidenceSha256 !== capture.apiEvidenceSha256 ||
      binding.genericEvidenceSha256 !== capture.evidenceSha256 || binding.reportSha256 !== sha(reportBytes)) throw new Error('API report binding drift');
  return { capture, report: JSON.parse(reportBytes), binding };
}
export async function replayApiSaved({ captureDir, outputDir }) {
  const before = verifyApiCapture(captureDir);
  const report = await replaySaved({ captureDir, outputDir });
  if (verifyApiCapture(captureDir).apiEvidenceSha256 !== before.apiEvidenceSha256) throw new Error('API capture changed during replay');
  const binding = bindApiReport(captureDir, outputDir);
  return { report, binding };
}
export function createApiViewer({ captureDir, replayDir, token = randomBytes(24).toString('hex') }) {
  verifyApiReport(captureDir, replayDir);
  return createViewer({ captureDir, replayDir, token });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const captureDir = option('--capture') && path.resolve(option('--capture'));
  if (!captureDir) throw new Error('Use score|replay|view --capture CAPTURE');
  if (command === 'score' && args.length === 2) {
    const result = scoreApiSaved(captureDir);
    console.log(JSON.stringify({ apiEvidenceSha256: result.apiEvidenceSha256, scored: result.scoring.length }, null, 2));
  } else if (command === 'replay' && option('--output') && args.length === 4) {
    const result = await replayApiSaved({ captureDir, outputDir: path.resolve(option('--output')) });
    console.log(JSON.stringify({ apiEvidenceSha256: result.binding.apiEvidenceSha256, replayed: result.report.replay.filter((r) => r.status === 'replayed').length }, null, 2));
  } else if (command === 'view' && option('--replay') && args.length === 4) {
    const { server, token } = createApiViewer({ captureDir, replayDir: path.resolve(option('--replay')) });
    server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/v/${token}/`));
  } else throw new Error('Use score --capture, replay --capture --output, or view --capture --replay');
}
