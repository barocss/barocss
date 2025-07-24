import { staticModifier } from "../../core/registry";
 
// --- Group and peer variants ---
// group-hover/peer-hover: allow chaining with focus/active/hover
staticModifier('group-hover', ['.group:hover &'], { source: 'group' });
staticModifier('peer-hover', ['.peer:hover ~ &'], { source: 'peer' });
staticModifier('peer-checked', ['.peer:checked ~ &'], { source: 'peer' }); 