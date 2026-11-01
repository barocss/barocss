# Independent audit round 3 (targeted): editMate re-aiming a stored host-form nested end

**Result: PASS. Verdict: ACCEPT** for the round-2 HIGH finding.

## p5 probe, rerun with the new expectation (`audit3/p5-stale-edit.test.ts`): 4/4 pass
- **Mate under test:** a stored mate whose end is the sub-assembly's id `p1` plus the folded face name `n3.bottom`. It was run fresh, and stale (the earlier nested sibling gained a feature).
- **Model `editMate({distance: 6})`:** refused with `MATE_FACE_UNKNOWN … p1 is a sub-assembly … pick the face again`, in both cases. The stored end stays `p1`.
- **Chat `edit_mate {flip: true}`:** refused with the same words. The mates and positions in the document are unchanged.

## Mutant, on a scratch copy (`audit3/mut`)
- **Change:** `canonicalRef` put back on the stored ends in `mated()`.
- **Unmutated copy:** 20/20 pass.
- **Mutant:** 19 pass, 1 fail. **KILLED** by test 20, "a stored host-form end to a nested face (fresh or stale) is never converted by an edit…".

## Follow-ups
None.
