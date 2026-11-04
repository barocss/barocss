import {Extrude,Profile,Outer,Voids,Rectangle,Circle} from '../src/index.js';

/** One logical Model result. Native authority decides geometric validity and pieces. */
export function ProfiledPlate({radius}:{radius:number}){
  return <Extrude distance={8}>
    <Profile><Outer><Rectangle min={[0,0]} max={[60,40]}/></Outer>
      <Voids><Circle center={[30,20]} radius={radius}/></Voids>
    </Profile>
  </Extrude>;
}
