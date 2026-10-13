# CAD Editor browser evidence protocol

This page defines the **minimum evidence required** before any of the CAD lessons can claim actual browser, GPU or physical file acceptance. It does not certify that a browser run has happened.

## Execute against a pinned checkout

Record the exact full source SHA, installed Node/pnpm versions, browser and driver versions, platform, viewport size, GPU/backend status, and commands. Use the installed CAD Editor app at `#/model`. Do not silently substitute a screenshot from a mocked Worker, an example rendering, or another commit.

Keep these stages separate:

| Stage | Acceptable evidence | Never infer |
| --- | --- | --- |
| Native provider | Qualified output/fixture, actual native diagnostic, source pin | GPU pixels or physical file save |
| Editor controller/Worker | Accepted generation, revisions, rejection retention, real transport | Genuine browser clicks from mocked actions |
| Browser React UI | Real page interactions, status/selection text, error-free console | Native exactness from pixels |
| GPU/display | Actual rendered/read-back frame with source/backend context | B-Rep topology, mass certificate |
| File roundtrip | File actually downloaded, bytes reread, fresh Open and re-edit | OS persistence merely from Download click |
| Documentation | Site build/links and source-backed content | Any of the five stages above |

## Core end-to-end sequence

Use the same application and a new browser context for physical reopening:

1. **Underside pocket:** load the preset, accept `depth=4` and `depth=8`, inspect named `part` and its separately qualified 5632/5120 mm³ native volumes, Undo and Redo.
2. **Round post:** load `round-post`, change height 6→9 and diameter 8→4; confirm the `post` name and *Certified volume unavailable*. Refuse zero diameter and prove the earlier accepted state survives.
3. **Mounting plate:** load `mounting-plate`, change hole radius 5→2.5; compare `blank` and `plate`, and record a refusal with accepted state unchanged.
4. **L-bracket:** load `union-bracket`, change `legWidth=8→12`, observe accepted `bracket` output, and test a source-qualified refusal with its exact preceding dimensions.
5. **File:** physically download the authored file; record byte count and checksum. In a fresh browser context, stage it with **Choose model file**, verify this alone does *not* replace accepted state, explicitly confirm **Open saved model**, choose the intended output and re-edit.

At each step record both the *input* and the *observable accepted result*. Native volume assertions need actual provider data, not screenshots. If a GPU device is unavailable or a browser refuses to start, record `UNRUN` or `BLOCKED` with the reason—not `PASS`.

## Evidence record

A run record should contain these required fields, with no secrets or private local path included in public artifacts:

```json
{
  "schema": 1,
  "sourceSha": "<full Git commit SHA>",
  "platform": "<OS and version>",
  "node": "<exact version>",
  "browser": "<browser and version>",
  "gpuBackend": "<actual detected backend or unavailable>",
  "caseId": "pocket-depth-roundtrip",
  "input": { "preset": "underside-pocket", "parameters": { "depth": 8 } },
  "accepted": { "output": "part", "generation": null, "nativeVolumeMM3": null },
  "stages": {
    "native": "UNRUN",
    "worker": "UNRUN",
    "browser": "UNRUN",
    "gpu": "UNRUN",
    "file": "UNRUN"
  },
  "screenshots": [],
  "download": null,
  "commands": [],
  "failures": [],
  "notes": "Template only. No execution has occurred."
}
```

The template's `null` values are intentionally **not** successes. For screenshots include the file's SHA-256, capture step and exact accepted output. For downloaded authored files include SHA-256, byte count, and cold-reopen status. Separate the authority of native XYZ coordinates from any displayed scene-axis conversion. State whether a real GPU readback was exercised.

## Acceptance rules

A case is `PASS` only when each stage required by that particular test ran and its observable assertions passed. `UNRUN`, `BLOCKED`, and `FAIL` are distinct; a prior source-pinned receipt may be cited as historical evidence but cannot be promoted to a fresh device result.

Do not add images to the public Manual until real capture provenance is available, and do not publish screenshots containing private files, tokens or user data.

[Learning path](./learning-path) · [Troubleshooting](./troubleshooting) · [CAD native modeling reference](../cad/modeling) · [Evidence tracking issue #1803](https://github.com/barocss/barocss/issues/1803)
