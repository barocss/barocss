const s15=Math.sin(Math.PI/12),c15=Math.cos(Math.PI/12),s30=Math.sin(Math.PI/6),c30=Math.cos(Math.PI/6);
const box=(id,centerM,halfExtentsM,orientationXYZW=[0,0,0,1])=>({id,centerM,halfExtentsM,orientationXYZW});
const floor=()=>box('floor',[0,-.05,0],[3,.05,1]);
const wall=(id='wall',x=.5)=>box(id,[x,.6,0],[.05,1,1]);
const step=(id='step')=>box(id,[.5,.05,0],[.25,.05,.75]);
const make=(name,boxes,centerM,displacementM,analytic=null,excludeId=null,error=null)=>({name,scene:{revision:'sweepRef1',boxes},
 query:{revision:'sweepRef1',centerM,displacementM,excludeId},analytic,error});
const side=Math.sqrt(.15**2-.055**2),corner=Math.sqrt(.15**2-.055**2-.08**2);
export const CASES=[
 make('EMPTY_ZERO',[],[0,0,0],[0,0,0]),make('EMPTY_MOVE',[],[0,0,0],[1,0,0]),
 make('FLOOR_FALL',[floor()],[0,.8,0],[0,-.6,0],{fraction:.5,normalM:[0,1,0]}),
 make('FLAT_PARALLEL',[floor()],[-1,.505,0],[2,0,0]),
 make('WALL',[wall()],[-.5,.6,0],[2,0,0],{fraction:.4,normalM:[-1,0,0]}),
 make('TOUCH_ZERO',[wall()],[.3,.6,0],[0,0,0],{fraction:0,normalM:[-1,0,0]}),
 make('TOUCH_AWAY',[wall()],[.3,.6,0],[-.2,0,0],{fraction:0,normalM:[-1,0,0]}),
 make('WALL_AWAY',[wall()],[-.5,.6,0],[-1,0,0]),
 make('STEP_CORNER',[step()],[-.5,.505,0],[1.5,0,0],{fraction:(.75-side)/1.5,normalM:[-side/.15,.055/.15,0],pointM:[.25,.1,0]}),
 make('STEP_GRAZE',[step()],[-.5,.6,0],[1.5,0,0],{fraction:.5,normalM:[0,1,0],pointM:[.25,.1,0]}),
 make('STEP_NEAR_CLEAR',[step()],[-.5,.600001,0],[1.5,0,0]),
 make('CORNER_3D',[step()],[-.5,.505,.83],[1.5,0,0],{fraction:(.75-corner)/1.5,normalM:[-corner/.15,.055/.15,.08/.15],pointM:[.25,.1,.75]}),
 make('CORNER_CLEAR',[step()],[-.5,.505,1],[1.5,0,0]),
 make('SLOPE15',[box('slope',[.05*s15,-.05*c15,0],[3,.05,1],[0,0,Math.sin(Math.PI/24),Math.cos(Math.PI/24)])],
 [-.75,Math.tan(Math.PI/12)*(-.75)+.35+.35/c15,0],[1,0,0],{fraction:.2/s15,normalM:[-s15,c15,0]}),
 make('Y_ROTATED_WALL',[box('turned',[.5,.6,0],[.05,1,1],[0,Math.sin(Math.PI/12),0,Math.cos(Math.PI/12)])],
 [-.5,.6,0],[1.5,0,0],{fraction:(1-.2/c30)/1.5,normalM:[-c30,0,s30]}),
 make('TIE_FORWARD',[wall('wall-a'),wall('wall-z')],[-.5,.6,0],[2,0,0],{fraction:.4,normalM:[-1,0,0],bodyId:'wall-a'}),
 make('TIE_REVERSE',[wall('wall-z'),wall('wall-a')],[-.5,.6,0],[2,0,0],{fraction:.4,normalM:[-1,0,0],bodyId:'wall-a'}),
 make('EARLIEST',[wall('z-near'),wall('a-far',.8)],[-.5,.6,0],[2,0,0],{fraction:.4,normalM:[-1,0,0],bodyId:'z-near'}),
 make('EXCLUDE',[wall()],[-.5,.6,0],[2,0,0],null,'wall'),
 make('CAP32_GRAZE',Array.from({length:32},(_,i)=>step('box'+String(i).padStart(2,'0'))),[-.5,.6,0],[1.5,0,0],{fraction:.5,normalM:[0,1,0],pointM:[.25,.1,0],bodyId:'box00'}),
 make('INITIAL_OVERLAP',[wall()],[.4,.6,0],[1,0,0],null,null,'INITIAL_OVERLAP'),
 make('INITIAL_INSIDE',[wall()],[.5,.6,0],[1,0,0],null,null,'INITIAL_OVERLAP'),
];
