// The RB9 ladder's rungs (O70) in order: those built so far (RB9.1).
import type { Rung } from './core';
import { RUNG1, RUNG2, RUNG3, RUNG13 } from './rungs-basic';
import { RUNG5, RUNG10 } from './rungs-sheet';
import { RUNG8, RUNG9 } from './rungs-enclosure';
import { RUNG12, RUNG14 } from './rungs-assembly';

export const RUNGS: readonly Rung[] = [RUNG1, RUNG2, RUNG3, RUNG5, RUNG8, RUNG9, RUNG10, RUNG12, RUNG13, RUNG14];
