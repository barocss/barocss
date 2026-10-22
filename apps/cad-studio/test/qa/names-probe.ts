// QA helper: prints the persistent edge and face names of the starter plate (for the UI probe's selection hooks).
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { starterDoc } from '@barocss/cad-model/engine/doc';
const r = evaluateDoc(starterDoc(), 1);
if (r.ok) { console.log(JSON.stringify(r.bodies[0].mesh.edges.filter(e => !e.straight).map(e => e.names))); console.log(JSON.stringify(r.bodies[0].mesh.faces.map(f => f.name))); }
