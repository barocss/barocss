import { staticModifier } from "../../core/registry";

// --- Basic pseudo-class variants ---
staticModifier('hover', ['&:hover'], { order: 50, source: 'pseudo' });
staticModifier('focus', ['&:focus'], { order: 50, source: 'pseudo' });
staticModifier('active', ['&:active'], { order: 50, source: 'pseudo' });
staticModifier('visited', ['&:visited'], { order: 50, source: 'pseudo' });
staticModifier('focus-visible', ['&:focus-visible'], { order: 50, source: 'pseudo' });
staticModifier('focus-within', ['&:focus-within'], { order: 50, source: 'pseudo' }); 