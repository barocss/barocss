import { part, sketch } from '@barocss/cad-model/api';
const d = part('d').extrude(sketch().polygon([[0, 0], [10, 0], [10, 6], [0, 6]]), { h: 5 }).fillet(b => b.edges().along('z').where(e => e.a[0] === 10 && e.a[1] === 6), { radius: 1 }).doc;
console.log(JSON.stringify(d.nodes));
