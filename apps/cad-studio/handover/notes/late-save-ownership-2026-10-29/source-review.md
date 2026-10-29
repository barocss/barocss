# Save completion source review

Sol High reviewed App, useProject and the private saveOwnership helper without editing or executing them. The first review found two required App corrections, subsequently confirmed fixed:

- A Save closure must use its render-bound document acceptance scope, not borrow the newest dispatch token at call time. Capture savedDoc and require token, current document reference and filename together. This preserves document ABA detection and rejects an old render callback even before the pending new render updates docNow.
- Preserve React's functional updater queue by forwarding raw(update). Do not mutate docNow from inside an eager/replayed/StrictMode updater. Direct value updates retain the existing synchronous document ref behavior. Even a no-op dispatch conservatively invalidates older Save receipts.

The hook invalidates its session object on store use, Close, Detach before an early return, and Open path request. Successful same-path tags advance after edits, while older successful receipts cannot overwrite a newer tag. First-save null-to-path transition remains valid. Save-only version reads and parts listing check the current successful owner after await; the final check and onCurrent callback have no await between them. Physical autosave deletion is omitted as selected; existing saved-equal checkpoint filtering is reused.

The final read found no further required repair within the selected Save scope. This does not qualify all Open/version/loadLog/refresh async ownership, all device or browser schedules, or runtime behavior. Focused tests, final source hashes and actual consumer execution remain separate evidence lanes.
