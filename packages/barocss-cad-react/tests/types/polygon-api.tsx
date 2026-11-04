import * as React from 'react';
import {Polygon,Extrude,Revolve,Translate,Definitions,type PolygonProps,type ProfileRef,type ProfileHandle,type SolidHandle} from '../../src/index.js';
const profile=React.createRef<ProfileHandle>(),solid=React.createRef<SolidHandle>();
const points=[[0,0],[60,0],[60,50],[10,50],[0,40]] as const;
function Outline({ref,width}:{ref?:ProfileRef;width:number}){return <Polygon ref={ref} points={[[0,0],[width,0],[width,50],[10,50],[0,40]]}/>;}
const props:PolygonProps={points,ref:profile};
const child=<Extrude distance={8}><Polygon points={points}/></Extrude>;
const shared=<><Extrude distance={8} profile={profile}/><Definitions><Outline ref={profile} width={60}/></Definitions></>;
const turned=<Revolve axis="y" angle={90}><Polygon points={[[10,0],[20,0],[20,10]]}/></Revolve>;
// @ts-expect-error Polygon has only two coordinates per point
const wrongPoint=<Polygon points={[[0,0,0],[1,0],[0,1]]}/>;
// @ts-expect-error Polygon output is a profile, not a solid token
const wrongRef=<Polygon ref={solid} points={points}/>;
// @ts-expect-error profile tokens cannot be used as solid inputs
const wrongSolid=<Translate offset={[0,0,0]} solid={profile}/>;
// @ts-expect-error a Polygon has no public native ID prop
const manual=<Polygon id="n3" points={points}/>;
// @ts-expect-error child and profile reference remain exclusive
const mixed=<Extrude distance={8} profile={profile}><Polygon points={points}/></Extrude>;
void[props,child,shared,turned,wrongPoint,wrongRef,wrongSolid,manual,mixed];
