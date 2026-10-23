# Sample shop rows

These files are **examples**, taken from the sources each row and field names. They are not a standard, and nothing here is built into BaroCSS. Check every value against the standard and against your supplier before you use a drawing or part for manufacture.

A document uses rows only after a person loads them. In the studio that is Library → Load sample rows… for a kind; in chat, the person attaches the file. The agent can suggest a file. It cannot load rows that no person supplied: `[ROWS_NOT_FROM_PERSON]`. Each loaded row keeps a receipt that names its file.

| file | kind | what it gives |
|------|------|---------------|
| `fastener-sizes.json` | `fastener-sizes` | metric coarse M3–M12: pitch, heads, nut, washer, the lengths offered, ISO 273 clearance holes and the tap drill. Fields not cross-checked are listed in `unchecked`. |
| `casting-rules.json` | `casting-rules` | die and sand casting limits by alloy family (least wall and draft, tolerance, section-change ratio), and sand casting's pattern allowances (shrinkage, machining), each with the page it was read from |

With no casting rules for its process, a cast part's report says `[CASTING_RULE_ROW]` and leaves every rule that reads a limit or an allowance unknown. A sand-casting pattern is refused.

Without a row for a size, any command that needs that size refuses with `[FASTENER_SIZE_ROW]`. That covers a fastener, a tapped hole, and fitting a fastener to a hole. Readings without the row draw no thread, give no tap drill, and estimate the position tolerance, each said so.

Nothing is migrated. The studio is unreleased, so the document schema tracks the latest. A document without these rows has none until a person loads them.
