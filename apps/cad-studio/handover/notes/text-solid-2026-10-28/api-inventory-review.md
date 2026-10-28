# Text API inventory candidate review — 0f836e8f2

The candidate matches the source-derived API change list. It adds 32 exposure keys, removes none, and changes 19 fields in ten existing exposure rows. Every changed field is an intentional text/u8 API change. There are no unclassified changes, unexpected semantic changes, union-order-only differences or well-known-symbol ID-only differences in this candidate.

## Frozen inputs and method

- Baseline: `/tmp/barocss-text-api-inventory-baseline-before-0f836e8f2.json`, copied from `apps/library-docs/scripts/api-inventory.expected.json` before adoption; 17,169,824 bytes, SHA-256 `49c9d823fcea435a79b7c436ca7bd33eb72b44feebae7849a34e49cc73705758`.
- Candidate: `/tmp/barocss-text-api-inventory-candidate-0f836e8f2.json`; 17,248,336 bytes, SHA-256 `836c2ac3ee30e4c350ada849661b4da639ac4517295a84d7fa55052a7adad0ab`.
- Prior source-derived list: `/tmp/barocss-text-api-inventory-precheck-0f836e8f2.{md,json}`.
- Reproduction script: `/tmp/barocss-text-api-inventory-review-0f836e8f2.cjs`; detailed audit: `/tmp/barocss-text-api-inventory-review-0f836e8f2.json`.
- Runtime for this lightweight artifact analysis: Node 22.19.0; TypeScript 5.9.3.

Rows are keyed by `(package, subpath, exportName, space)`. The audit first compares complete JSON trees, including targets, conditions, roles and every public shape field. Changed type expressions are parsed as TypeScript ASTs. Only immediate `UnionType` children are sorted as a multiset; nested syntax, parentheses, intersection/member order, duplicate counts, tokens and modifiers remain significant. There is no string splitting at `|`. Intentional union additions are removed only when their exact expected branch AST is present, then the remaining AST is compared with the baseline. No compiler program, source build or tests are run.

## Results

| Item | Count |
| --- | ---: |
| Baseline exposures | 6,697 |
| Candidate exposures | 6,729 |
| Added keys | 32 |
| Removed keys | 0 |
| Duplicate keys in either input | 0 |
| Unchanged existing exposure rows | 6,687 |
| Existing rows with changes | 10 |
| Intentional semantic fields | 19 |
| Union-order-only fields | 0 |
| Well-known-symbol ID-only fields | 0 |
| Other top-level changed fields | 0 |
| Unclassified or unexpected semantic fields | 0 |
| Explicit artifact contract checks | 169, all pass |

`schemaVersion`, `policyVersion`, `typescriptVersion`, `packageExports` and `coreResultChecks` are byte-equivalent JSON values. All existing targets, conditions, roles, callable/construct signatures, readonly/optional flags, base/static shapes and index signatures remain unchanged except for the explicit differences below. The eight earlier TrueType reader exposures are unchanged. No cad or gpu exposure changes.

## New exposure keys

All additions are in `@barocss/cad-model`. No package export-map edit is present: the existing wildcard map exposes the new source files. Every new route has one variant with conditions `[[]]`. The `./api` role is the generator's existing `facade-exposure; immutability NOT_PROVEN`; other new routes retain `unclassified-observed; no policy exemption`.

| Subpath | Type exports | Value exports | Count |
| --- | --- | --- | ---: |
| `./engine/font/source` | FontSource, FontSourceMetadata, FontSourceErrorCode, FontSourceError | isFontSourceError, fontSourceError, fontFromBytes, readFontSource | 8 |
| `./engine/font/profiles` | FontProfileErrorCode, FontProfileError, FontProfileLine, FontProfileComponent, FontProfileGlyph, FontProfileRun, FontProfileOptions | isFontProfileError, buildFontProfiles | 9 |
| `./app/textCommand` | none | textCommand, textEditCommand | 2 |
| `./engine/doc` | TextNode | textNodeProblem, textDocumentProblem | 3 |
| `./api/part` | StudioTextOptions | none | 1 |
| `./api` | StudioTextOptions, FontSource, FontSourceMetadata | fontFromBytes | 4 |
| `./api/index` | StudioTextOptions, FontSource, FontSourceMetadata | fontFromBytes | 4 |
| `./engine/blobs` | none | fontRefs | 1 |

All type/value spaces, target files/names/declaration kinds and re-export shapes match the prior list. FontSource/FontSourceMetadata/fontFromBytes target `src/engine/font/source.ts`; StudioTextOptions targets `src/api/part.ts`. Each API re-export has the exact same variant as its source route.

New interface members, readonly/optional flags, declaration kinds, empty index signatures and callable returns were checked explicitly. FontSource retains readonly required blob/filename and readonly optional source/license; metadata omits blob. StudioTextOptions requires readonly size/h and has readonly optional tolerance/tracking/plane. TextNode's authoring fields are mutable data properties, with optional tracking/plane. Profile properties are readonly while their nested loop arrays/coordinate tuples retain the declared mutable types. The error aliases preserve the existing BarocssError members and add their readonly typed code; their code unions contain exactly the three source codes or four profile codes. Inherited String/Error members and index signatures match the existing TrueType aliases. There is no new arbitrary any/unknown widening beyond those existing inherited library fields.

## Existing semantic changes — all 19 fields

| Existing exposure | Changed fields | Exact accepted change |
| --- | ---: | --- |
| StudioPart at `./api`, `./api/index`, `./api/part` | 3 member-array fields | Each retains its 58 old members and gains only required public method `text(font: FontSource, text: string, options: StudioTextOptions) => StudioPart`. |
| `./app/commands` Field | 3 | Expanded type and declared alias gain exactly the text and file branches; members gain accept, filename, the two kind records and maxLength. All old branches and 11 old member records remain. |
| `./engine/blobs` BlobArray | 3 | Expanded type and alias gain only Uint8Array. Members retain all 85 old records and gain exactly 17 Uint8Array records. |
| `./engine/blobs` BlobType | 2 | Expanded and declared literal unions gain only `"u8"`; f64/f32/u32/i32 remain. |
| `./engine/blobs` sha256 | 2 | Type and call signature simplify `Uint8Array<ArrayBufferLike> | BlobArray` to BlobArray after that alias gains Uint8Array. Promise<string> return and accepted array set are preserved. |
| `./engine/doc` ModelNode | 1 member-array field | All 348 old records remain; only font, kind=text, text, tolerance and tracking records are new. Other TextNode fields already have identical union member records and do not need duplicate records. |
| `./engine/doc` isSolidNode | 2 | Type and call signature gain exactly the `(TextNode & NodeExtras)` type-predicate alternative. Removing that one AST branch recovers the complete previous predicate. |
| `./engine/ids` fromFeature | 3 | Type/call signature add third optional `nodes?: readonly ModelNode[] | undefined`; first two required string parameters and boolean return stay identical. VariableDeclaration becomes FunctionDeclaration. The two-argument call remains admitted. |

Six changed member arrays preserve all 618 old member records exactly, remove zero records, and add 30 intentional records. This compares full member records as multisets, including kind, type, readonly and optional, rather than relying on member names or array lengths.

The new Field file branch has required synchronous method `filename(value: number | string): string | null`, plus required string accept and numeric maxLength. Its text branch has required numeric maxLength. The common optional `when` callback and number/choice branches are unchanged; Values remains `Record<string, number | string>`. New textCommand is typed Command; textEditCommand takes `(index: number, node: TextNode & NodeExtras)` and returns Command.

The 17 Uint8Array members were matched to all 17 analogous existing Float64Array members by renaming only the AST identifier Float64Array to Uint8Array and the exact toStringTag string literal. This includes callback argument/return and generic overload shapes. The new readonly `__@toStringTag@24` member with type `"Uint8Array"` is a semantic u8 addition, not an internal-ID-only difference. Existing iterator/unscopables/toStringTag IDs do not change in this candidate.

The source declares StudioPart.text with return `this`; the inventory printer represents the instance method as returning StudioPart, as for its other fluent methods. No source declaration was changed by the audit. The artifact alone does not certify subclass/runtime chaining semantics.

## Limits and audit note

This is an inventory-artifact review. It does not certify glyph geometry, source snapshots, body focus, standalone output, Save/Open, browser behaviour, license rights or runtime immutability. COMMAND_DOCS/CHAT_COMMANDS values and numeric field defaults/limits can change without a signature difference because their declared types are broad; no extra literal-value claim is inferred from inventory equality.

The first temporary review script incorrectly expected the generic observedRole on all added routes. It reported four role assertion failures for the `./api` re-exports. Inspection of the unchanged generator at `api-inventory.mjs:344–348` confirmed that `./api` has always used the facade label. The review expectation was corrected; no candidate/source change was needed. That first audit is preserved at `/tmp/barocss-text-api-inventory-review-first-role-assumption.json`.

No repository source, test, docs, expected file, inventory generator or canonicalizer was modified. Only /tmp audit artifacts were written. No build, test, formatter, candidate generation, download, push, PR or release was run.

Reproduce from the assigned worktree:

```sh
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node /tmp/barocss-text-api-inventory-review-0f836e8f2.cjs
```
