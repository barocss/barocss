// Validate the manual's single CAD capability page, not a second status registry.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const page = await readFile(new URL('../docs/packages/cad/capabilities.md', import.meta.url), 'utf8');
const checkpoint = page.match(/adopted source checkpoint is \[[^\]]+\]\(https:\/\/github\.com\/barocss\/barocss\/commit\/([0-9a-f]{40})\)/)?.[1];
if (!checkpoint) throw new Error('Missing immutable adopted source checkpoint');
const links = [...page.matchAll(/https:\/\/github\.com\/barocss\/barocss\/blob\/([^/]+)\/([^\s)#]+)/g)];
if (links.length < 20) throw new Error('Missing source/consumer evidence links');
for (const [, sha, path] of links) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Evidence must use a full immutable SHA: ${sha}`);
  execFileSync('git', ['cat-file', '-e', `${sha}:${path}`], { cwd: root });
  // Root separately verifies publication of this checkpoint; local existence alone is insufficient.
  execFileSync('git', ['merge-base', '--is-ancestor', sha, checkpoint], { cwd: root });
}
for (const text of ['#1589', '#1591', '#1592', '#1594', '#1595', '#1596', '#1597', '#1598', '#1599', '#1601', '#1602', '#1603', '#1604', 'UNPROVEN', 'UNRUN', '5/6', '16 → 20', '**sibling**', '27 recorded']) {
  if (!page.includes(text)) throw new Error(`Missing scope/evidence boundary: ${text}`);
}
const receipt = JSON.parse(await readFile(new URL('../evidence/exact-prism-modeling.json', import.meta.url)));
if (receipt.engineSourcePin !== '31b3033f9db55cab3aa61e3a15e755546d49823a') throw new Error('Existing executed recipe pin changed: requires its own execution');
const config = await readFile(new URL('../docs/.vitepress/config.mts', import.meta.url), 'utf8');
if (!config.includes("'capabilities', 'exact-prism-modeling'")) throw new Error('Missing CAD sidebar entry');
console.log(JSON.stringify({ page: 'cad/capabilities', immutableBlobLinks: links.length, exactPrismPinPreserved: true, nativeCampaignRun: false }));
