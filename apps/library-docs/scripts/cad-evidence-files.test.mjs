import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyEvidenceFiles } from './cad-evidence-files.mjs';

test('checks physical screenshot and download bytes and rejects tampering', () => {
 const root=mkdtempSync(join(tmpdir(),'cad-evidence-'));
 try {
  const image=Buffer.from('actual screenshot fixture bytes'), file=Buffer.from('authored model bytes');
  writeFileSync(join(root,'frame.png'),image);writeFileSync(join(root,'part.cad.json'),file);
  const digest=b=>createHash('sha256').update(b).digest('hex');
  const receipt={screenshots:[{path:'frame.png',sha256:digest(image)}],stages:{file:'PASS'},download:{path:'part.cad.json',sha256:digest(file),byteCount:file.length}};
  assert.equal(verifyEvidenceFiles(receipt,root).ok,true);
  writeFileSync(join(root,'frame.png'),Buffer.from('tampered'));
  assert.match(verifyEvidenceFiles(receipt,root).errors.join(','),/sha256 mismatch/);
  receipt.screenshots[0].path='../outside.png';
  assert.match(verifyEvidenceFiles(receipt,root).errors.join(','),/relative path required/);
  receipt.screenshots=[];
  receipt.download.byteCount++;
  assert.match(verifyEvidenceFiles(receipt,root).errors.join(','),/byte count mismatch/);
 } finally {rmSync(root,{recursive:true,force:true});}
});
test('refuses symlink leaving evidence root',()=>{
 const root=mkdtempSync(join(tmpdir(),'cad-root-')),outside=mkdtempSync(join(tmpdir(),'cad-other-'));
 try {
  writeFileSync(join(outside,'secret'),Buffer.from('x'));
  symlinkSync(join(outside,'secret'),join(root,'escape'));
  const result=verifyEvidenceFiles({screenshots:[{path:'escape',sha256:'a'.repeat(64)}],stages:{file:'UNRUN'}},root);
  assert.equal(result.ok,false);
 } finally {rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
