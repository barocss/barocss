// Loopback-only, read-only viewer for saved #458 artifacts. It has no subprocess endpoint.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { schedule } from './plan.mjs';
import { verifyCapture } from './provenance.mjs';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const cell = (value) => value === undefined || value === null ? '—' : typeof value === 'boolean' ? value ? 'pass' : 'fail' : String(value);
const line = (label, value) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(cell(value))}</div>`;
function record(captureDir, row) {
  if (!row.attempted) return { request: null, raw: null, transport: null };
  const dir = path.join(captureDir, `attempt-${String(row.ordinal).padStart(2, '0')}`);
  const json = (name) => { const file = path.join(dir, name); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; };
  const rawPath = path.join(dir, 'raw-final.txt');
  return { request: json('request.json'), raw: fs.existsSync(rawPath) ? fs.readFileSync(rawPath, 'utf8') : null, transport: json('transport.json') };
}
export function createViewer({ captureDir, replayDir, token = randomBytes(24).toString('hex') }) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('Viewer token must be 48 hex characters');
  const verified = verifyCapture(captureDir);
  const manifest = verified.manifest;
  const rows = verified.rows;
  const report = JSON.parse(fs.readFileSync(path.join(replayDir, 'report.json')));
  const planned = schedule();
  if (report.captureManifestSha256 !== verified.manifestSha256 || report.captureEvidenceSha256 !== verified.evidenceSha256 ||
      JSON.stringify(rows.map((row) => row.id)) !== JSON.stringify(planned.map((row) => row.id)) ||
      JSON.stringify(report.scoring.map((row) => row.id)) !== JSON.stringify(planned.map((row) => row.id)) ||
      JSON.stringify(report.replay.map((row) => row.id)) !== JSON.stringify(planned.map((row) => row.id))) throw new Error('Viewer artifact binding or schedule invalid');
  const shots = new Map();
  for (const row of report.replay) for (const screen of Object.values(row.screen ?? {})) {
    if (!screen.screenshot || !/^shots\/[a-z]+--(?:variable|utility)--[a-z]+--(?:desktop|narrow)\.png$/.test(screen.screenshot)) continue;
    const file = path.join(replayDir, screen.screenshot);
    if (fs.existsSync(file)) shots.set(screen.screenshot, file);
  }
  function page() {
    const content = rows.map((row, index) => {
      const score = report.scoring[index], replay = report.replay[index], saved = record(captureDir, row);
      const pictures = Object.entries(replay.screen ?? {}).map(([name, screen]) => `<figure><figcaption>${escapeHtml(name)} · style ${escapeHtml(cell(screen.stylePass))} · overflow ${escapeHtml(cell(screen.overflow))}</figcaption><img alt="${escapeHtml(row.id + ' ' + name)}" loading="lazy" src="/v/${token}/${screen.screenshot}"></figure>`).join('');
      return `<article id="${escapeHtml(row.id)}"><h2>${escapeHtml(row.id)}</h2><div class="meta">${line('Capture', row.status)}${line('Supported', row.support.supported)}${line('Request satisfied', score.requestSatisfied)}${line('Correct abstention', score.abstentionCorrect)}${line('JSON chain', score.chainAfter)}${line('Full session', replay.sessionSuccess)}${line('Browser', replay.status)}${line('State', replay.statePreserved)}${line('Focus', replay.focusPreserved)}${line('Action', replay.actionPass)}${line('Host unchanged', replay.hostUnchanged)}${line('Theme', replay.themeAdherence)}${line('No overflow', replay.overflowFree)}${line('Usage', saved.transport?.usage ? JSON.stringify(saved.transport.usage) : null)}${line('Elapsed ms', saved.transport?.elapsedMs)}${line('Exit', saved.transport?.exitCode)}</div><p class="errors">${escapeHtml([...score.errors, ...(replay.errors ?? [])].join(' | ') || 'No recorded errors')}</p><details><summary>Exact request and session history</summary><pre>${escapeHtml(saved.request?.prompt ?? 'Not attempted')}</pre></details><details><summary>Raw final response</summary><pre>${escapeHtml(saved.raw ?? 'No final response')}</pre></details><div class="shots">${pictures}</div></article>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Issue 458 saved pilot</title><style>body{font:14px system-ui,sans-serif;max-width:1100px;margin:auto;padding:20px;background:#f6f7f8;color:#18212b}h1{font-size:24px}article{background:white;border:1px solid #ccd3db;border-radius:10px;padding:16px;margin:18px 0}h2{font-size:18px}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px}.errors{color:#a12b2b}pre{white-space:pre-wrap;word-break:break-word;max-height:400px;overflow:auto;background:#f1f3f5;padding:12px}.shots{display:flex;gap:10px;overflow:auto}figure{margin:10px 0}img{max-width:350px;border:1px solid #ccd3db}summary{cursor:pointer}nav a{margin-right:10px}</style></head><body><h1>Issue 458 saved pilot ${manifest.synthetic ? '(synthetic)' : '(live)'}</h1><p>Read-only localhost viewer. Model generation is separate. ${rows.length} scheduled cells; ${rows.filter((row) => row.attempted).length} attempted.</p><nav>${rows.map((row) => `<a href="#${escapeHtml(row.id)}">${escapeHtml(row.id)}</a>`).join('')}</nav>${content}</body></html>`;
  }
  const server = http.createServer((req, res) => {
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
    const send = (status, type, body) => { res.writeHead(status, { ...headers, 'content-type': type }); res.end(body); };
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    const host = req.headers.host ?? '';
    if (!/^127\.0\.0\.1(?::\d+)?$/.test(host) && !/^localhost(?::\d+)?$/.test(host)) return send(403, 'text/plain', 'Host not allowed');
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === `/v/${token}` || pathname === `/v/${token}/`) return send(200, 'text/html; charset=utf-8', page());
    const prefix = `/v/${token}/`;
    if (pathname.startsWith(prefix)) {
      const relative = pathname.slice(prefix.length);
      const file = shots.get(relative);
      if (file) return send(200, 'image/png', fs.readFileSync(file));
    }
    return send(404, 'text/plain', 'Not found');
  });
  return { server, token };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const capture = args[args.indexOf('--capture') + 1], replay = args[args.indexOf('--replay') + 1];
  if (!capture || !replay || !args.includes('--capture') || !args.includes('--replay')) throw new Error('Use --capture and --replay');
  const { server, token } = createViewer({ captureDir: path.resolve(capture), replayDir: path.resolve(replay) });
  server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/v/${token}/`));
}
