# A9 rows — a test fixture standing in for the person's files

The A9 acceptance run (`test/a9-acceptance.test.ts`) loads each file here as a file the person supplied in the
conversation, through the same person-file path as the chat (rows rule b; `receivePersonRowFiles`, then
`features.load_rows` or the stock tools by `file`). The run is automated, so these files stand in for the person's.
**The owner's own acceptance with a real person-supplied row/fit file is still pending.**

Every row either cites where its numbers come from or says it is an estimate:
- 6204 (bearings): NSK's 6204 page, source B1 in D139.
- 214 (orings): Global O-Ring's AS568 chart, source O1 in D139.
- The fit rows: estimates. ISO 286's fundamental deviations are not public as text (D139), so every row is
  flagged `estimate: true`.
- R40 (sections): an estimate, sharp-cornered (`outerRadius` 0), so A = 40² − 34² as the A9 S0 freezes.
- Stock (B1, R30) and frame stock (S6): an illustrative shop list for this run, not a real shop's. Their loaders
  require a source text, which names this fixture.
- The fastener row SCS-M6x20 (F9): an illustrative shop row for the four cap screws, not a real supplier's; its
  loader requires a source text, which names this fixture. It names what is bought; the screws' shape is the fastener
  command's own.

Dimensions only: no standards text and no copied tables.
