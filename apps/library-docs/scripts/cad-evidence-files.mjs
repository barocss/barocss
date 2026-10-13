import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/i;
export function verifyEvidenceFiles(receipt, evidenceRoot) {
  const errors = [];
  const root = realpathSync(evidenceRoot);
  function verify(label, entry, size) {
    if (!entry || typeof entry.path !== 'string' || !entry.path || isAbsolute(entry.path) || entry.path.split(/[\\/]/).includes('..') || entry.path.includes('\\')) {
      errors.push(label + ': evidence-root-relative path required'); return;
    }
    const path = resolve(root, entry.path);
    const rel = relative(root, path);
    if (!rel || rel.startsWith('..'+sep) || rel === '..' || isAbsolute(rel)) {
      errors.push(label + ': outside evidence root'); return;
    }
    try {
      if (!lstatSync(path).isFile()) { errors.push(label + ': regular file required'); return; }
      const actual = realpathSync(path);
      const ar = relative(root, actual);
      if (ar === '..' || ar.startsWith('..'+sep) || isAbsolute(ar)) { errors.push(label + ': symlink escape'); return; }
      const bytes = readFileSync(actual);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (!SHA256.test(entry.sha256 || '') || digest.toLowerCase() !== entry.sha256.toLowerCase()) errors.push(label + ': sha256 mismatch');
      if (size !== undefined && (!Number.isSafeInteger(size) || bytes.length !== size)) errors.push(label + ': byte count mismatch');
    } catch { errors.push(label + ': cannot read evidence file'); }
  }
  for (const [i, shot] of (receipt.screenshots ?? []).entries()) verify('screenshots.'+i, shot);
  if (receipt.stages?.file === 'PASS') verify('download', receipt.download, receipt.download?.byteCount);
  return {ok:errors.length===0,errors};
}
