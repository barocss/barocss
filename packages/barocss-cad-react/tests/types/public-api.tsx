import * as React from 'react';
import {Part,Rectangle,Circle,Extrude,Union,Target,Definitions,type ProfileHandle,type SolidHandle,type ModelLifecycle} from '../../src/index.js';
import {ModelHost,type EnginePort,type MassPolicy,type ExistingViewerSink} from '../../src/engine.js';
const lifecycle:ModelLifecycle={dirty(){},invalid(){},complete(){},detached(){}};
const profile=React.createRef<ProfileHandle>(),solid=React.createRef<SolidHandle>();
const valid=<Part admission="synchronous" lifecycle={lifecycle} units="mm"><Extrude profile={profile} distance={6}/><Definitions><Circle ref={profile} center={[0,0]} radius={3}/></Definitions></Part>;
const nested=<Extrude distance={6}><Rectangle min={[0,0]} max={[10,10]}/></Extrude>;
const reuse=<Target solid={solid}/>;
// @ts-expect-error solid output is not an extrusion profile source
const wrongSource=<Extrude distance={6} profile={solid}/>;
// @ts-expect-error ref and children are mutually exclusive
const mixed=<Extrude distance={6} profile={profile}><Circle center={[0,0]} radius={3}/></Extrude>;
// @ts-expect-error Target accepts a solid source, not a profile source
const wrongTarget=<Target solid={profile}/>;
// @ts-expect-error no Sketch-only input vocabulary
const sketchOnly=<Extrude distance={6} sketch={profile}/>;
// @ts-expect-error explicit synchronous supported shape admission required
const noAdmission=<Part lifecycle={lifecycle}>{nested}</Part>;
// @ts-expect-error callback refs are not graph dependency tokens
const callbackRef=<Circle ref={()=>{}} center={[0,0]} radius={3}/>;
// @ts-expect-error native face queries are a separate unsupported source capability
const faceSource=<Extrude distance={6} profile={{kind:'face',nativeName:'n1.top'}}/>;
const shared=<Union ref={solid}>{nested}{nested}</Union>;
function injected(engine:EnginePort,massPolicy:MassPolicy,sink:ExistingViewerSink){return new ModelHost({engine,ownership:'borrowed',massPolicy,sink,ownsSink:false});}
void [valid,reuse,wrongSource,mixed,wrongTarget,sketchOnly,noAdmission,callbackRef,faceSource,shared,injected];
