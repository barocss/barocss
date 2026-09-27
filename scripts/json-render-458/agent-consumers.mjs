// CLI-agent-only score, browser replay and local viewer with route evidence binding.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyAgentCapture } from './agent-provenance.mjs';
import { scoreSaved } from './score.mjs';
import { replaySaved } from './replay.mjs';
import { createViewer } from './viewer.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function saveExclusive(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
export function scoreAgentSaved(captureDir) {
  const before = verifyAgentCapture(captureDir);
  const scoring = scoreSaved(before.rows, captureDir);
  if (verifyAgentCapture(captureDir).agentEvidenceSha256 !== before.agentEvidenceSha256) throw new Error('CLI agent capture changed during scoring');
  return { scoring, synthetic: before.manifest.synthetic, agentEvidenceSha256: before.agentEvidenceSha256, toolUse: before.toolUse };
}
export function bindAgentReport(captureDir, replayDir) {
  const capture = verifyAgentCapture(captureDir);
  const reportBytes = fs.readFileSync(path.join(replayDir, 'report.json'));
  const report = JSON.parse(reportBytes);
  if (report.captureManifestSha256 !== capture.manifestSha256 || report.captureEvidenceSha256 !== capture.evidenceSha256) throw new Error('Replay report is not bound to capture');
  const binding = { kind: 'barocss-458-cli-agent-replay-binding', synthetic: capture.manifest.synthetic,
    routeKind: capture.route.kind, agentEvidenceSha256: capture.agentEvidenceSha256,
    genericEvidenceSha256: capture.evidenceSha256, reportSha256: sha(reportBytes), toolUse: capture.toolUse };
  saveExclusive(path.join(replayDir, 'agent-report-binding.json'), binding);
  return binding;
}
export function verifyAgentReport(captureDir, replayDir) {
  const capture = verifyAgentCapture(captureDir);
  const reportBytes = fs.readFileSync(path.join(replayDir, 'report.json'));
  const binding = JSON.parse(fs.readFileSync(path.join(replayDir, 'agent-report-binding.json')));
  if (binding.kind !== 'barocss-458-cli-agent-replay-binding' || binding.synthetic !== capture.manifest.synthetic ||
      binding.routeKind !== capture.route.kind || binding.agentEvidenceSha256 !== capture.agentEvidenceSha256 ||
      binding.genericEvidenceSha256 !== capture.evidenceSha256 || binding.reportSha256 !== sha(reportBytes) ||
      JSON.stringify(binding.toolUse) !== JSON.stringify(capture.toolUse)) throw new Error('CLI agent report binding drift');
  return { capture, report: JSON.parse(reportBytes), binding };
}
export async function replayAgentSaved({ captureDir, outputDir }) {
  const before = verifyAgentCapture(captureDir);
  const report = await replaySaved({ captureDir, outputDir });
  if (verifyAgentCapture(captureDir).agentEvidenceSha256 !== before.agentEvidenceSha256) throw new Error('CLI agent capture changed during replay');
  const binding = bindAgentReport(captureDir, outputDir);
  return { report, binding };
}
export function createAgentViewer({ captureDir, replayDir, token = randomBytes(24).toString('hex') }) {
  verifyAgentReport(captureDir, replayDir);
  return createViewer({ captureDir, replayDir, token });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const captureDir = option('--capture') && path.resolve(option('--capture'));
  if (!captureDir) throw new Error('Use score|replay|view --capture CAPTURE');
  if (command === 'score' && args.length === 2) {
    const result = scoreAgentSaved(captureDir);
    console.log(JSON.stringify({ synthetic: result.synthetic, agentEvidenceSha256: result.agentEvidenceSha256, scored: result.scoring.length,
      observableToolCalls: Object.values(result.toolUse).reduce((sum, count) => sum + count, 0) }, null, 2));
  } else if (command === 'replay' && option('--output') && args.length === 4) {
    const result = await replayAgentSaved({ captureDir, outputDir: path.resolve(option('--output')) });
    console.log(JSON.stringify({ agentEvidenceSha256: result.binding.agentEvidenceSha256, replayed: result.report.replay.filter((r) => r.status === 'replayed').length }, null, 2));
  } else if (command === 'view' && option('--replay') && args.length === 4) {
    const { server, token } = createAgentViewer({ captureDir, replayDir: path.resolve(option('--replay')) });
    server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/v/${token}/`));
  } else throw new Error('Use score --capture, replay --capture --output, or view --capture --replay');
}
