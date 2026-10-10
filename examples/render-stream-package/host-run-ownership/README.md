# Delayed final admission: host run ownership

This example uses the emitted `@barocss/render-stream` Fetch and protocol exports. The browser is the existing authored consumer in the parent example. It tests a host callback that waits after valid source EOF and before any host state write. The package cannot undo callback side effects; the host checks its owned signal and current run token at the write boundary.

Two literal screens are fixed in `host.mjs`: A uses `host-a` revision 1, a light card and `A preview`; B uses `host-b` revision 2, a dark card and `B current`. Each source has eight v1 records. The invalid-tail control reuses B's screen with `host-c` revision 3 and appends bytes after commit. The host ledger is bounded and in memory only.

Run from the repository root with Node 22 and existing dependencies:

```sh
pnpm --dir packages/barocss-render-stream build
node examples/render-stream-package/stage.mjs
node --check examples/render-stream-package/host-run-ownership/host.mjs
node --check examples/render-stream-package/host-run-ownership/flow.mjs
PLAYWRIGHT_CORE_DIR=/path/to/installed/playwright-core node examples/render-stream-package/host-run-ownership/flow.mjs
```

In a sparse checkout, lease the already installed root `node_modules` as an ignored symlink. The parent `stage.mjs` requires compiled kit, server and render `dist` from current matching source; build those first if absent. Staging uses public package manifests and emitted JavaScript. The flow writes ignored `output/report.json` and screenshots.

The acceptance order is A preview and held final callback; B starts and aborts A; B reaches normal EOF, commits and saves once; A resumes and refuses before a write; duplicate B admission refuses; invalid tail calls no final callback. The report keeps ordered source, callback, signal, accepted and Save events. Browser input, CSS and the accepted screen stay with B after A resumes and after the invalid tail. Closing the browser and host removes their active work. This is a deterministic local HTTP/browser run, not model timing, durable storage, or production authentication evidence.

The first setup attempt to create another full managed worktree failed with `No space left on device` before code was written. The failed checkout was removed automatically. A clean existing managed worktree was reused in sparse mode at parent `028c9e509b35de56e61db3b92a034b5277fbb291`.

## Native result

Node 22.19.0 syntax checks and current stream package build passed. The public-entry staging reported render-stream ESM SHA256 `3aa8d038e6432cf861a6151cd557d44420f54c63a4662523d453700b2948d6f6`. Chrome 155.0.8059.39 passed the authored local HTTP flow with zero page errors, external requests or model calls. Run A read 8 records and reached normal EOF; its callback entered with no accepted host state. B read 8 records and was accepted once. B Save wrote `Sujin` once. Duplicate B admission returned false. After A was released, its owned signal was aborted and its callback returned false before a write. B's accepted spec, CSS, input and Save ledger were unchanged. The invalid-tail control read 9 chunks; its callback was never entered. It also left B unchanged. All three response and owned-signal listeners were removed, and the server closed with zero active runs.

The first browser attempt passed. A focused code review then found that a normally completed run retained its abort listener. A child correction removed owned-signal and response listeners explicitly; the same bounded flow passed again. The final ignored report is `/tmp/render-stream-1387-listener-cleanup/report.json`. These observations prove this authored in-memory host sequence only. A's aborted HTTP response reports `Response closed`; the browser ignores that superseded run as intended.
