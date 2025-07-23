import { staticModifier } from "../../core/registry";

// --- Structural selector variants ---
staticModifier('first', ['&:first-child'], { order: 50, source: 'pseudo' });
staticModifier('last', ['&:last-child'], { order: 50, source: 'pseudo' });
staticModifier('only', ['&:only-child'], { order: 50, source: 'pseudo' });
staticModifier('odd', ['&:nth-child(odd)'], { order: 50, source: 'pseudo' });
staticModifier('even', ['&:nth-child(even)'], { order: 50, source: 'pseudo' });
staticModifier('first-of-type', ['&:first-of-type'], { order: 50, source: 'pseudo' });
staticModifier('last-of-type', ['&:last-of-type'], { order: 50, source: 'pseudo' });
staticModifier('only-of-type', ['&:only-of-type'], { order: 50, source: 'pseudo' });
staticModifier('empty', ['&:empty'], { order: 40, source: 'pseudo' }); 