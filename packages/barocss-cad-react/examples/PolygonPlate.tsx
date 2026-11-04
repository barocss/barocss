import {Extrude,Polygon} from '../src/index.js';

/** A closed pentagonal plate. Existing native geometry decides validity. */
export function PolygonPlate({width}:{width:number}){
  return <Extrude distance={8}>
    <Polygon points={[[0,0],[width,0],[width,50],[10,50],[0,40]]}/>
  </Extrude>;
}
