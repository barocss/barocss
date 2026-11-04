/** Candidate example recipe; no native IDs or manual sketch references. */
import {Rectangle,Revolve} from '../src/index.js';
export function RevolvedSection({angle}:{angle:number}){
  return <Revolve axis="y" angle={angle}>
    <Rectangle min={[10,20]} max={[20,50]}/>
  </Revolve>;
}
