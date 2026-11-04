/** Existing Bracket with existing native Rotate followed by Translate. */
import {Rotate,Translate} from '../src/index.js';
import {Bracket} from './Bracket.js';
export function TransformedBracket({dx,angle}:{dx:number;angle:number}){
  return <Translate offset={[dx,40,5]}><Rotate axis="z" angle={angle} pivot={[0,0,0]}><Bracket width={80}/></Rotate></Translate>;
}
