import {readFileSync,writeFileSync} from 'node:fs';
import {exportStep} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/index.ts';
import {emptyDoc,withNode} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts';
import {partBreps} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
const b=JSON.parse(readFileSync('/tmp/d343-circle-browser/chrome-native.json','utf8')).native.brep;
const doc=withNode(emptyDoc(),{kind:'import',name:'chrome.step',step:exportStep(b)});const after=partBreps(doc)[0].brep;writeFileSync('/tmp/d343-circle-browser/imported-native.json',JSON.stringify(after,null,2));
