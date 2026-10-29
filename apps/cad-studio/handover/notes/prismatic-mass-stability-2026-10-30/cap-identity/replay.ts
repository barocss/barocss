import {readFileSync,writeFileSync} from 'node:fs';
import {part} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/api/index.ts';
import {evaluateDoc,partBreps} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
import {partSnapshot} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/part.ts';
const doc=JSON.parse(readFileSync('/tmp/d343-studio/run-02/04-captured-thin-native-read.bcad','utf8')),before=JSON.stringify(doc),snap=partSnapshot(doc),view=evaluateDoc(doc,0),p=part('replay',doc);const target=partBreps(doc).find(b=>b.key==='b7')!;
const result={sourceUnchanged:before===JSON.stringify(doc),doc,native:target,publicNames:p.body('b7').select().faces().names(),model:view.bodies.find(b=>b.key==='b7'),snapshot:snap};writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify({names:result.publicNames,nativeNames:target.brep.faces.map(f=>f.name),snapshotKeys:snap.outputs.map(o=>Object.keys(o))}));
