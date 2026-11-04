/** Candidate type examples, not current repository exports until adopted. */
import * as React from 'react';
import {Revolve,Rectangle,Circle,Extrude,Definitions,Translate,Rotate,type ProfileHandle,type SolidHandle} from '../../src/index.js';
const profile=React.createRef<ProfileHandle>(),solid=React.createRef<SolidHandle>();
const nested=<Revolve axis="y" angle={90}><Rectangle min={[10,20]} max={[20,50]}/></Revolve>;
const reused=<><Translate offset={[30,40,5]} solid={solid}/><Definitions><Revolve ref={solid} axis="y" angle={360} origin={[0,0]} profile={profile}/><Circle ref={profile} center={[15,25]} radius={2}/></Definitions></>;
const composed=<Rotate axis="z" angle={90}>{nested}</Rotate>;
// @ts-expect-error profile and child are exclusive
const mixed=<Revolve axis="y" angle={90} profile={profile}><Rectangle min={[10,20]} max={[20,50]}/></Revolve>;
// @ts-expect-error a solid token is not a profile source
const wrong=<Revolve axis="y" angle={90} profile={solid}/>;
// @ts-expect-error only existing sketch X/Y axes are exposed, not Z/free direction
const axis=<Revolve axis="z" angle={90}>{nested}</Revolve>;
// @ts-expect-error two origin coordinates required
const origin=<Revolve axis="x" angle={90} origin={[0,0,0]}><Rectangle min={[10,20]} max={[20,50]}/></Revolve>;
// @ts-expect-error there is no public manual sketch index prop
const sketch=<Revolve axis="y" angle={90} sketch={0}/>;
const stillExtrude=<Extrude distance={6}><Rectangle min={[0,0]} max={[80,60]}/></Extrude>;
void[nested,reused,composed,mixed,wrong,axis,origin,sketch,stillExtrude];
