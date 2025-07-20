import { staticModifier } from "../../core/registry";

// --- Attribute selector variants ---
staticModifier('rtl', ['&[dir=rtl]'], { order: 20 });
staticModifier('ltr', ['&[dir=ltr]'], { order: 20 });
staticModifier('inert', ['&[inert]'], { order: 40 });
staticModifier('open', ['&:is([open], :popover-open, :open)'], { order: 40 }); 