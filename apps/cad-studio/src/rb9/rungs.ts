// The RB9 ladder's rungs (O70) in order: those built so far (RB9.1).
import type { Rung } from './core';
import { RUNG1, RUNG2, RUNG3, RUNG13 } from './rungs-basic';
import { RUNG5, RUNG10 } from './rungs-sheet';

export const RUNGS: readonly Rung[] = [RUNG1, RUNG2, RUNG3, RUNG5, RUNG10, RUNG13];
