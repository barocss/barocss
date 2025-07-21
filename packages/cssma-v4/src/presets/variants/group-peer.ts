import { staticModifier } from "../../core/registry";
 
// --- Group and peer variants ---
// group-hover/peer-hover: allow chaining with focus/active/hover
staticModifier('group-hover', ['.group:hover &'], { compounds: ['focus', 'active', 'hover'], order: 30 });
staticModifier('peer-hover', ['.peer:hover ~ &'], { compounds: ['focus', 'active', 'hover'], order: 30 });
staticModifier('peer-checked', ['.peer:checked ~ &'], { order: 30 }); 