# #1179 ROOT reporting source review

SOURCE ONLY. Read bundle.mjs, harness-entry.mjs, archive.mjs and recording-base.mjs. No import, AST/parser, model/reference/World, build, type or writer/control execution. Repository files remain unchanged by this reviewer.

## Concrete defect found and already corrected by ROOT

`bundle.mjs:11` preserves the import extension when replacing Physics src/ with dist/. The original `harness-entry.mjs:4-6` used package helper `.ts` paths, which would request dist/validation.ts, dist/dynamic-hinge-joint.ts and dist/joint-motor.ts. Original package build emits `.js`/`.d.ts`, not `.ts`.

ROOT changed these three harness imports to `.js` BEFORE freeze. Source esbuild may resolve them to the real TS sources; compiled maps them to real dist JS. Read the changed three lines. Private provider profile.ts remains source as selected. No further correction for this defect is needed.

## Remaining concrete first-evidence preservation gap

Both emergency paths create their file with default writeFile mode `w`:

- `archive.mjs:26` (parity emergency)
- `recording-base.mjs:7` (source emergency)

The earlier absent-file check at `archive.mjs:29` is not exclusive creation of this later emergency file. A second emergency call on the same recorder can replace the first emergency evidence. Main JSON/raw and alias receipt files use fresh `wx`, but emergency does not. This conflicts with the requested fresh-file/first-failure preservation property.

Minimal storage-only correction before freeze: use `writeFile(path,gzipSync(data),{flag:'wx'})` at both sites. A second call then fails without changing the first bytes. Do not silently erase or retry the first file. This changes no producer/reference/numerical data or model semantics.

## No signature or zero-raw defect found

The selected consumer writer signature `(record,rawBuffers[])` matches recorder.write. Both consumer and native controls await the writer before the next call. Native controls pass `[]`; SOURCE writes full JSON plus LF, updates the JSON hash/record count, and adds zero raw bytes. It omits an empty gzip raw member rather than omitting the JSON record. PARITY consumes one full JSON line and zero raw bytes for each such control. Appending these records after actual physical raw frames leaves a valid nonempty canonical raw stream.

SOURCE main budget uses actual newly stored gzip JSON+raw bytes. PARITY adds only newly stored thin receipt bytes; canonical full files become hardlink aliases only AFTER exact full-line/raw comparisons, EOF of both streams and all four canonical metrics match. Logical alias bytes are separately reported. The 64MiB main checks are in compressed stored bytes. The 2MiB emergency check currently bounds decoded JSON bytes, not the same main-budget unit; the final receipt/docs must keep that distinction.

Archive/base imports are standard-library plus own recording-base only. They do not import or call physics/reference code. Harness exports the selected producer APIs and four original helpers only. No new runtime/model execution was performed by this review.
