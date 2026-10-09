const box=(id,centerM,halfExtentsM)=>({id,centerM,halfExtentsM,orientationXYZW:[0,0,0,1]});
const id=i=>'box'+String(i).padStart(2,'0');
const steps=count=>Array.from({length:count},(_,i)=>box(id(i),[.5+i/1000,.05,0],[.25,.05,.75]));
const make=(name,boxes,{walls=false,clear=false,excludeId=null,error=null}={})=>{
 const index=excludeId===id(0)?1:0;
 const analytic=error||clear?null:{fraction:walls?.4:(.75+index/1000)/1.5,
 normalM:walls?[-1,0,0]:[0,1,0],bodyId:id(index),...(walls?{}:{pointM:[.25+index/1000,.1,0]})};
 return {name,scene:{revision:'sweepRef1',boxes},query:{revision:'sweepRef1',centerM:[-.5,clear?.600001:.6,0],displacementM:[walls?2:1.5,0,0],excludeId},analytic,error};
};
export const CASES=[
 make('DISTINCT_1_GRAZE',steps(1)),make('DISTINCT_8_GRAZE',steps(8)),make('DISTINCT_16_GRAZE',steps(16)),make('DISTINCT_32_GRAZE',steps(32)),
 make('DISTINCT_32_REVERSE',steps(32).reverse()),make('DISTINCT_32_EXCLUDE',steps(32),{excludeId:id(0)}),make('DISTINCT_32_CLEAR',steps(32),{clear:true}),
 make('DISTINCT_32_WALL',Array.from({length:32},(_,i)=>box(id(i),[.5+i/1000,.6,0],[.05,1,1])),{walls:true}),
 make('DISTINCT_32_OVERLAP_LAST',[...steps(31),box(id(31),[-.5,.6,0],[.05,1,1])],{error:'INITIAL_OVERLAP'}),
];
export const PROFILES=CASES.map((fixture,i)=>({name:fixture.name,sourceCount:fixture.scene.boxes.length,groupCount:fixture.scene.boxes.length,expectedScalarCalls:i===5?31:fixture.scene.boxes.length}));
