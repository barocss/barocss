# D296 Text relief API inventory candidate audit

No blocker was found for adopting this candidate. All eight added keys match the prior source-derived list; no key is removed or duplicated. All 54 changed fields are classified: 13 intentional semantic fields and 41 union-order-only fields. There are zero well-known-symbol ID-only changes, unclassified changes or unexpected semantic changes.

## Inputs and reproduction

- Frozen baseline: `/tmp/barocss-text-relief-api-inventory-baseline-before-d296.json`; 17,248,336 bytes; SHA-256 `836c2ac3ee30e4c350ada849661b4da639ac4517295a84d7fa55052a7adad0ab`.
- Candidate: `/tmp/barocss-text-relief-api-inventory-candidate-d296.json`; 17,264,184 bytes; SHA-256 `6b5d16c42444fec1178a956cb9279af1e90049a84a604ec0ae34aa9caf340df4`.
- Precheck: `/tmp/barocss-text-relief-api-inventory-precheck-d296.{md,json}`.
- Detailed audit: `/tmp/barocss-text-relief-api-inventory-review-d296.json`.
- Reproduction script: `/tmp/barocss-text-relief-api-inventory-review-d296.cjs`.
- Node 22.19.0 and TypeScript 5.9.3 were used only to parse and compare artifact type expressions; no compiler program, build or source module execution was used.

```sh
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node /tmp/barocss-text-relief-api-inventory-review-d296.cjs
```

## Counts

| Item | Count |
| --- | ---: |
| Baseline exposures | 6,729 |
| Candidate exposures | 6,737 |
| Added keys | 8 |
| Removed keys | 0 |
| Duplicate keys in either artifact | 0 |
| Existing exposure rows changed | 36 |
| Existing exposure rows unchanged | 6,693 |
| Changed fields inside existing exposures | 53 |
| Intentional semantic exposure fields | 12 |
| Union-order-only exposure fields | 41 |
| Well-known-symbol ID-only exposure fields | 0 |
| Other changed fields | 1, intentional core snapshot kind propagation |
| Unclassified / unexpected semantic fields | 0 |
| Full old records preserved in changed member arrays | 847 |
| New intentional member records | 9 |
| Removed old member records | 0 |
| Schema/declaration/D295 contract checks repeated | 169 |
| Total explicit artifact checks after D296 additions | 212, all pass |

## Every added key

All additions belong to `@barocss/cad-model`. Each has one variant with conditions `[[]]`. Target files, declaration kinds, type/value spaces and observed roles match the source: `./api` uses the unchanged facade-observation label; other routes use the unchanged generic observation label.

| Subpath | Export | Space | Target |
| --- | --- | --- | --- |
| `./api` | StudioTextReliefOptions | type | src/api/part.ts, interface |
| `./api/index` | StudioTextReliefOptions | type | src/api/part.ts, interface |
| `./api/part` | StudioTextReliefOptions | type | src/api/part.ts, interface |
| `./app/textCommand` | readTextFontValue | value | src/app/textCommand.ts, function |
| `./app/textReliefCommand` | textReliefCommand | value | src/app/textReliefCommand.ts, const |
| `./app/textReliefCommand` | textReliefEditCommand | value | src/app/textReliefCommand.ts, function |
| `./engine/doc` | TextReliefNode | type | src/engine/doc.ts, interface |
| `./engine/doc` | textReliefNodeProblem | value | src/engine/doc.ts, function |

StudioTextReliefOptions requires readonly size/depth/at/mode; at is a readonly two-Dim tuple. tolerance and tracking are readonly optional. No plane, h, height, or face option appears. The three re-export variants have identical complete shapes and targets.

TextReliefNode contains the required mutable data properties kind/text-relief, parent:BodyRef, faces:[string], text:string, font:FontSource, size:Dim, at:[Dim,Dim], depth:Dim, mode:emboss|engrave, tolerance:number and optional tracking:Dim. Its face tuple is exactly one mutable element; it is not widened to string[]. Existing NodeExtras remain in ModelNode's intersection.

The new callable shapes are exact: readTextFontValue takes value:string|number|undefined and required load:boolean, returning FontSource; textReliefEditCommand takes number plus TextReliefNode & NodeExtras, returning Command; textReliefNodeProblem takes unknown and Readonly<Record<string,number>>, returning string|null. textReliefCommand is explicitly typed Command, with no fabricated literal fields/defaults and no function call signature. Public readonly/optional/callable/index/declaration fields were compared completely.

## Every semantic difference

| Existing key or other field | Fields | Accepted change |
| --- | ---: | --- |
| @barocss/cad `.` CadPartFeature | 3 | Expanded and declared union gain only the readonly profile-relief branch; member array gains clearance, kind=profile-relief and sketches. |
| @barocss/cad `.` CadPartSnapshot | 1 | features[].kind gains the literal profile-relief only. |
| StudioPart at ./api, ./api/index, ./api/part | 3 | Each member array adds one required public textRelief method and retains all 59 prior records. |
| ./engine/doc ModelNode | 1 | Member array adds at:[Dim,Dim], faces:[string] and kind=text-relief; all 353 prior records remain. |
| ./engine/doc isSolidNode | 2 | Function type and call signature gain exactly TextReliefNode & NodeExtras as one predicate alternative. |
| ./engine/refusal CadModelCode | 2 | Inferred and declared code unions gain only TEXT_RELIEF_PICK. |
| coreResultChecks[CadPartSnapshot].directMembers[features].type | 1 | Same profile-relief literal propagation as the snapshot exposure. |

The native profile-relief branch retains the existing Base intersection and has exactly readonly kind, target:string, faces:readonly string[], sketches:readonly string[], depth:CadPartDim, mode:emboss|engrave, optional clearance:number, optional expect:Readonly<Record<string,CadPartNameSignature>>. Each complete branch is checked structurally: remove only this exact branch AST, and the remainder equals the old full AST. Declared optional properties and TypeScript's inferred explicit `| undefined` are matched separately. No native font/text metadata is introduced. ReliefSketch/profileRelief remain internal exports, not new package exposure keys.

StudioPart.textRelief is exactly `(faces:(body:BodyQuery)=>FaceQuery,font:FontSource,text:string,options:StudioTextReliefOptions)=>StudioPart` in the printer's method record, with required method status, no readonly/optional change and no extra overload. The source's polymorphic `this` is represented as StudioPart by this inventory printer, consistently with the other fluent methods. Existing standalone Text, rectangular emboss/engrave and all other fluent methods remain intact.

The preliminary list said core result semantics should remain unchanged. The full audit refines that expectation: CadPartSnapshot declares its feature kind from CadPartFeature's kind set, so this single indexed-access consequence must propagate into both the exposure and the direct core-result audit. Removing only the new literal recovers the exact previous AST; all other core result properties/targets/rules/index signatures remain unchanged. This is an intentional consequence of the planned native union addition, not an unrelated result-shape change.

Five changed member arrays retain all old complete records, including kind/type/readonly/optional/callability details:

| Member array | Old preserved | Added | Removed |
| --- | ---: | ---: | ---: |
| CadPartFeature | 317 | 3 | 0 |
| StudioPart ./api | 59 | 1 | 0 |
| StudioPart ./api/index | 59 | 1 | 0 |
| StudioPart ./api/part | 59 | 1 | 0 |
| ModelNode | 353 | 3 | 0 |
| Total | 847 | 9 | 0 |

## Notation differences

All 41 remaining exposure-field differences are AST-proven union-member order only. They affect existing CAD diagnostic/error unions, CadExpression's nested operation union, and GPU material-expression/error types at the two existing GPU routes. For example, the nested numeric operation alternatives contain the same `/`, `*`, `+`, `-` values in another order. The complete containing type AST, including its nested object fields and callback signatures, is unchanged under the sole union-child sorting rule. No GPU meaning change is accepted merely because the package is unrelated.

The comparator sorts only immediate UnionType children as a multiset. It preserves nested structure, parentheses, duplicate counts, intersection order, property order, optional/readonly modifiers, tokens, literals, call/construct returns, bases, static members and namespace children. It never splits strings on `|`, flattens unions or globally erases numeric suffixes. Existing well-known-symbol member names and IDs happen not to differ in this candidate; no such notation allowance was needed.

schemaVersion, policyVersion, TypeScript version and packageExports are exactly unchanged. The eight earlier TrueType reader keys, original FontSource/profile/options/callback shapes, BlobArray/BlobType u8, fromFeature's optional context, and existing source/text API exports remain. The repeated base/schema/D295 contract assertions and new D296 checks pass without changing the generator or canonicalizer.

## Audit boundary and first script correction

The first temporary audit expected the declared native branch syntax in both inventory fields. TypeScript's inferred type field explicitly adds `| undefined` to optional clearance/expect while the declaration field retains the source spelling. The script rejected that unmatched branch, then was corrected to check both exact field-specific forms. Candidate and source were not changed. The first diagnostic is preserved at `/tmp/barocss-text-relief-api-inventory-review-first-native-branch-assumption.log`.

This audit proves artifact change classification only. COMMAND_DOCS/CHAT_COMMANDS/default values, runtime immutability, source snapshots, body focus, selected-face matching, geometry/topology, height tracking, moved-reference behaviour, Save/Open, glyph coverage and browser flows require their separate evidence. No source/test/docs/expected file, generator/canonicalizer or package metadata was modified; only /tmp audit files were written. No build, geometry, test, browser, download, push, PR or release operation was run.
