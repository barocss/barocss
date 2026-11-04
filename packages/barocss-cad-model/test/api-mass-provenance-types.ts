import type {MassResult} from '@barocss/cad/api';
import type {BodyResult} from '../src/engine/evaluate';
type Method='closed-form'|'planar-exact'|'quadrature'|'tessellated';
const legacy:MassResult={volume:1,mass:1,centroid:[0,0,0],inertia:[[1,0,0],[0,1,0],[0,0,1]]};
const method:Method|undefined=legacy.method;
const estimated:MassResult={...legacy,method:'tessellated',volumeBasis:{method:'tessellated',bound:null}};
const bound:number|null|undefined=estimated.volumeBasis?.bound;
// @ts-expect-error only native producer method vocabulary is accepted
const invalid:MassResult={...legacy,method:'family-inferred'};
function bodyMethod(body:BodyResult){const value:Method|undefined=body.massMethod;return value;}
void [legacy,method,estimated,bound,invalid,bodyMethod];
