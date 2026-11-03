# Dynamic host desktop

Root execution only, after the actual host transaction prerequisite passes. All commands use fresh IDs. Do not start or consume a manual lease during this campaign.

Freeze takes exactly four required arguments in this order: transaction parity receipt, clean Native proof directory, transaction Source proof directory, transaction Native proof directory. It also binds the executed transaction author freeze, generated input freeze and all four actual command guard receipts.

1. `node examples/physics-coupled-dynamic-host-viewer-2276/freeze.mjs TRANSACTION_PARITY_PASS_RECEIPT NATIVE_CLEAN_PROOF_DIRECTORY TRANSACTION_SOURCE_PROOF_DIRECTORY TRANSACTION_NATIVE_PROOF_DIRECTORY`
2. `node examples/physics-coupled-dynamic-host-viewer-2276/build.mjs build-01`
3. `node examples/physics-coupled-dynamic-host-viewer-2276/scene/server.mjs build-01`
4. Set `PLAYWRIGHT_CLI` to the exact already installed frozen CLI. Run `node examples/physics-coupled-dynamic-host-viewer-2276/browser-run.mjs desktop-01`.
5. `node examples/physics-coupled-dynamic-host-viewer-2276/audit-browser.mjs desktop-01 audit-01`

Stop at first failure. Preserve output and return NOT_RUN for later checks. Root must close only this owned proof server. A new manual server requires a separate fresh process after the proof lease ends. See CONTRACT.md for proof limits.
