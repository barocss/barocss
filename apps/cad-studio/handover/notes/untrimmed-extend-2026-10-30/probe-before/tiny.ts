import { directOps, emptyDirect, importSource } from '../../../../../../../../../../Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct';
const d = importSource(emptyDirect(), `@model t { version:0; length-unit:mm;
 @surface #p { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1];
  control-points:[[[0,0,0.0000005],[0,10,0.0000005]],[[20,0,0.0000005],[20,10,0.0000005]]]; weights:[[1,1],[1,1]]; } }`, 't');
try { directOps.extendSurface(d, d.objects[0].id, 'u-max', 5); console.log('SUCCESS'); } catch (e: any) { console.log('THROW', e.code, e.message); }
