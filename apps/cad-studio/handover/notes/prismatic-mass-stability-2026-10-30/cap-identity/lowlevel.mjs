import {writeFileSync} from 'node:fs';
import {prismaticFromProfile,transformPrismatic,booleanPrismatic,brepFromPrismatic,prismaticMassProperties} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/dist/index.js';
const original=transformPrismatic(prismaticFromProfile({outer:[{kind:'arc',start:[3,0],center:[0,0],direction:'ccw'}],height:5.00009,tag:'n1'}),{matrix:[1,0,0,1],offset:[.1234567,-.2345678],zOffset:.3456789});
const level=original.slabs[0].z1-5.00009;
const tool=prismaticFromProfile({outer:[{kind:'arc',start:[3.1234567,-.23456780000000022],center:[.1234567000000002,-.23456780000000022],direction:'ccw'}],height:5.00009,from:level,tag:'n6'});
const solid=booleanPrismatic(original,tool,'difference'),brep=brepFromPrismatic(solid),mass=prismaticMassProperties(solid,1);writeFileSync(process.argv[2],JSON.stringify({original,tool,solid,brep,mass},null,2));console.log(JSON.stringify({caps:solid.caps?.map(c=>({z:c.z,tag:c.tag})),slabs:solid.slabs.map(s=>[s.z0,s.z1]),names:brep.faces.map(f=>f.name),mass}));
