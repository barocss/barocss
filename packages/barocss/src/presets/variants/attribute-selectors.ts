import { staticModifier } from "../../core/registry";
 
// --- Attribute selector variants ---
staticModifier('rtl', ['&[dir=rtl]'], { order: 20, source: 'attribute' });
staticModifier('ltr', ['&[dir=ltr]'], { order: 20, source: 'attribute' });
staticModifier('inert', ['&[inert]'], { order: 40, source: 'attribute' });
staticModifier('open', ['&:is([open], :popover-open, :open)'], { order: 40, source: 'attribute' }); 