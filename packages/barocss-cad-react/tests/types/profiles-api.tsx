import * as React from 'react';
import {Profile,Outer,Voids,Loop,LineSegment,ArcSegment,Rectangle,Circle,Extrude,Revolve,Definitions,type ProfileHandle,type SolidHandle,type ProfileRef,type LoopProps,type ProfileProps,type OuterProps,type VoidsProps} from '../../src/index.js';
const source=React.createRef<ProfileHandle>(),bore=React.createRef<ProfileHandle>(),solid=React.createRef<SolidHandle>();
const direct=<Extrude distance={8}><Profile><Outer><Rectangle min={[0,0]} max={[60,40]}/></Outer><Voids><Circle center={[30,20]} radius={6}/></Voids></Profile></Extrude>;
function Outline({ref}:{ref?:ProfileRef}){return <Loop ref={ref}><LineSegment start={[0,0]}/><LineSegment start={[60,0]}/><LineSegment start={[60,40]}/><LineSegment start={[0,40]}/></Loop>;}
const reused=<><Revolve axis="y" angle={90} profile={source}/><Definitions><Profile ref={source}><Outer><Outline/></Outer><Voids profiles={[bore]}/></Profile><Loop ref={bore}><ArcSegment start={[36,20]} center={[30,20]} direction="ccw"/></Loop></Definitions></>;
const a:LoopProps={children:<LineSegment start={[0,0]}/>},b:ProfileProps={children:<Outer profile={source}/>},c:OuterProps={profile:source},d:VoidsProps={profiles:[bore]};
// @ts-expect-error Outer child and profile token are exclusive
const mixed=<Outer profile={source}><Rectangle min={[0,0]} max={[10,10]}/></Outer>;
// @ts-expect-error Voids children and reference list are exclusive
const mixedVoids=<Voids profiles={[bore]}><Circle center={[0,0]} radius={1}/></Voids>;
// @ts-expect-error solid tokens are not closed profile inputs
const wrong=<Outer profile={solid}/>;
// @ts-expect-error segment descriptors have no native edge/profile ref API
const segmentRef=<LineSegment ref={source} start={[0,0]}/>;
// @ts-expect-error ArcSegment direction is explicit
const noDirection=<ArcSegment start={[1,0]} center={[0,0]}/>;
// @ts-expect-error no Regions/raw Model escape hatch is exposed
const regions=<Profile regions={[]}><Outer profile={source}/></Profile>;
void[direct,reused,a,b,c,d,mixed,mixedVoids,wrong,segmentRef,noDirection,regions];
