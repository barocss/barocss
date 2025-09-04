import { staticModifier } from "../../core/registry";

// --- Structural selector variants ---
staticModifier('first', ['&:first-child'], { source: 'pseudo' });
staticModifier('last', ['&:last-child'], { source: 'pseudo' });
staticModifier('only', ['&:only-child'], { source: 'pseudo' });
staticModifier('odd', ['&:nth-child(odd)'], { source: 'pseudo' });
staticModifier('even', ['&:nth-child(even)'], { source: 'pseudo' });
staticModifier('first-of-type', ['&:first-of-type'], { source: 'pseudo' });
staticModifier('last-of-type', ['&:last-of-type'], { source: 'pseudo' });
staticModifier('only-of-type', ['&:only-of-type'], { source: 'pseudo' });
staticModifier('empty', ['&:empty'], { source: 'pseudo' }); 