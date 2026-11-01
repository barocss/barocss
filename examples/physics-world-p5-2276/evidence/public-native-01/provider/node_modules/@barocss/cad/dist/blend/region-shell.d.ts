import { type Brep } from '../brep/brep-core.js';
/** The shell of `body` t thick, the faces named in `open` opened, by bounding planes' bands and regions' slabs. */
export declare function regionShell(body: Brep, t: number, open: ReadonlySet<string>, id: string): Brep;
