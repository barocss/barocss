import {Extrude,Profile,Outer,Voids,Loop,LineSegment,ArcSegment} from '../src/index.js';

/** Canonical D509 authoring that realizes all six new elements in one contained case. */
export function SegmentedProfiledPlate({radius}:{radius:number}){
  return <Extrude distance={8}>
    <Profile><Outer><Loop>
      <LineSegment start={[0,0]}/><LineSegment start={[60,0]}/>
      <LineSegment start={[60,40]}/><LineSegment start={[0,40]}/>
    </Loop></Outer><Voids><Loop>
      <ArcSegment start={[30+radius,20]} center={[30,20]} direction="ccw"/>
    </Loop></Voids></Profile>
  </Extrude>;
}
