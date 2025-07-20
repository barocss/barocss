import { staticModifier } from "../../core/registry";

// --- Structural selector variants ---
staticModifier('first', ['&:first-child'], { order: 50 });
staticModifier('last', ['&:last-child'], { order: 50 });
staticModifier('only', ['&:only-child'], { order: 50 });
staticModifier('odd', ['&:nth-child(odd)'], { order: 50 });
staticModifier('even', ['&:nth-child(even)'], { order: 50 });
staticModifier('first-of-type', ['&:first-of-type'], { order: 50 });
staticModifier('last-of-type', ['&:last-of-type'], { order: 50 });
staticModifier('only-of-type', ['&:only-of-type'], { order: 50 });
staticModifier('empty', ['&:empty'], { order: 40 }); 