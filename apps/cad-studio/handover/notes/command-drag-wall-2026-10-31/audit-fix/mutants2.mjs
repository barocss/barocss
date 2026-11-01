import M from './mutants.mjs';
const keep = ['M1_drop_live_check', 'M4_never_clear_bad', 'M7_bad_always_latest', 'M9_failure_resets_to_lastOk', 'M12_clear_strict', 'F1a_stale_success_moves_lastOk_back', 'F1b_pointer_resets_bisect_step', 'F1c_guard_ignores_bad_side', 'F1d_cur_not_strict_bad'];
export default Object.fromEntries(keep.map(k => [k, M[k]]));
