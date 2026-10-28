# Open font originals for CAD text and wrap work

The owner selected using several open-source fonts on 2026-10-28. These unmodified upstream files are test inputs,
not runtime dependencies or built-in font defaults. Each directory includes its original OFL 1.1 license.
`sources.json` records the exact upstream commit, source URL and inspected binary metadata.

- ABeeZee Regular: a small Latin input, with short `loca` offsets.
- Nanum Gothic Regular: Korean and Latin sans-serif outlines, with long `loca` offsets.
- Nanum Myeongjo Regular: Korean and Latin serif outlines, with a different units-per-em scale.

The download check read the sfnt directory, required `head`, `maxp`, `cmap`, `loca`, `glyf`, `hhea` and `hmtx`, checked
all table extents against the file, and confirmed no `fvar` or CFF table. The license text was checked after whitespace
normalisation. No glyph parser, text shaping, CAD outline conversion, emboss or wrap support is implied by this
asset preparation. The local `.gitattributes` preserves upstream license whitespace without treating it as project code. The current CAD profile contract still accepts lines and arcs only.

Do not modify these font originals or remove their license files. Do not add a runtime font library or WASM dependency
to the CAD packages. Font parsing and geometry conversion require separate implementation and verification.
