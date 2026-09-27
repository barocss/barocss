import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.argv[2]; if(!root)throw new Error('Pass dry-run directory');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const captured=JSON.parse(fs.readFileSync(path.join(root,'rows.json')));
const replay=JSON.parse(fs.readFileSync(path.join(root,'replay.json')));
assert.equal(manifest.synthetic,true);assert.equal(captured.length,manifest.planned.length);
assert.deepEqual(captured.map(r=>r.id),manifest.planned.map(r=>r.id));
assert.ok(captured.every(r=>r.synthetic&&r.status==='valid'));
assert.equal(replay.rows.length,captured.length+captured.filter(r=>r.arm==='utility').length);
for(const row of replay.rows){
 assert.equal(row.rendered,true);assert.equal(row.semanticPass,true);assert.equal(row.inputValuePreserved,true);assert.equal(row.focusPreserved,true);assert.equal(row.actionPass,true);assert.equal(row.themeAdherence,true);assert.equal(row.hostStyleDelta,false);assert.deepEqual(row.errors,[]);
 assert.equal(row.classification,row.arm==='build'&&row.stage!=='initial'?'style':'pass');
 assert.equal(row.frames.length,4);assert.ok(fs.existsSync(path.join(root,row.screenshot)));
}
console.log(`Synthetic preparation verified: ${captured.length} scheduled responses and ${replay.rows.length} replay/control rows. No model-quality conclusion.`);
