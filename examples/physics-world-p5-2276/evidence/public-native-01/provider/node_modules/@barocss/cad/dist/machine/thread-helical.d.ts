import { type Brep } from '../brep/brep-core.js';
import { type ThreadSolidRequest } from './thread-solid.js';
/** The thread with exact (B-spline) helical faces: a rod, a hex bolt or a hex nut, as `threadSolid` builds them faceted. */
export declare function helicalThreadSolid(req: ThreadSolidRequest): Brep;
