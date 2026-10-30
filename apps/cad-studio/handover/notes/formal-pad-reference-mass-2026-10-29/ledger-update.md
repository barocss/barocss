# Formal mass work-ledger supplement

Status: temporary draft updated and frozen. No repository file or test file was changed. No build, test, or runtime probe was run.

The actual carrier CoefficientContext has a separate rational counter. Its checked direct-integer path increments integerOperations and calls charge(), so carrier.counts.work already includes that direct work and auxiliary coefficient work. It does not include rational operations, GCD steps, or float-search steps.

The formal helper now imports exactly:

    totalImportedSourceWork = carrier.work
      + carrier.rational.operations
      + carrier.rational.gcdSteps
      + carrier.rational.floatSearchSteps.

It does not add carrier.integerOperations to work again. That field remains included in sourceOperations for the separate200k exact/direct operation cap.

One Context.totalWork() now computes:

    totalImportedSourceWork + localStructural
      + localQ.operations + localQ.gcdSteps + localQ.floatSearchSteps
      + localDirect.

Both check() and the returned counts.work use this same function. The existing operation, aggregate-GCD, bit, work, density, moment, and output-error policies are unchanged. The independent reviewer agreed that this import normalization matches the actual carrier and D304 ledger convention.

Only the temporary formal-mass source and regenerated candidate patch were updated. The temporary tests retain their prior content. All execution/fit claims remain NOT RUN. The separate selected-quarter radial metadata wording remains outside this ledger-only edit.
