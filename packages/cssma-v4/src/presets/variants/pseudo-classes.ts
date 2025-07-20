import { staticModifier } from "../../core/registry";

// --- Basic pseudo-class variants ---
staticModifier('hover', ['&:hover'], { order: 50 });
staticModifier('focus', ['&:focus'], { order: 50 });
staticModifier('active', ['&:active'], { order: 50 });
staticModifier('visited', ['&:visited'], { order: 50 });
staticModifier('focus-visible', ['&:focus-visible'], { order: 50 });
staticModifier('focus-within', ['&:focus-within'], { order: 50 }); 