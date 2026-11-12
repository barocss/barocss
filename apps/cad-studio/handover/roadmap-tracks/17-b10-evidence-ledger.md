# B10 v1 — Desktop Studio, Viewer and CAD React evidence ledger

[Product baseline](04-product-baseline.md) · [Platform and extensions](03-platform-and-extensions.md)

## Frozen scope

One desktop Chrome WebGPU host. Studio and the Viewer facade each use their public consumer paths. Use the source workspace, the existing Model, Viewer and Worker, and authored in-repo inputs. Bind each result to its exact source, fixture, scene and renderer. Keep output pixels, native dimensions and retained resource counters separate.

| Group | Required behavior | Evidence |
| --- | --- | --- |
| B10-01 | Studio creates one 64 × 32 × 8 mm box, edits height to 12 mm with the same body key, and binds the new input and uploaded geometry to body, face and edge picks. Undo/Redo restore the corresponding geometry. | **PASS, current Studio [D770](../notes/studio-current-mesh-and-selection-2026-11-12/README.md)**. [D524](../notes/gpu-mesh-input-ownership-2026-11-05/README.md) retains the earlier bounded case. |
| B10-02 | The public Viewer facade loads and replaces a declared native surface source with the same logical geometry ID. The current pixels, source revision, pick and selection agree after replacement. | **PASS, current Viewer and Studio [D771](../notes/viewer-native-source-replacement-2026-11-12/README.md)**. |
| B10-03 | Studio section clipping follows the current document on a declared cut. Verify visible or clipped geometry, pick ownership and removal of the cut without changing the document. | **PASS, current Studio [D772](../notes/studio-section-occurrence-picking-2026-11-12/README.md)**. [D720](../notes/thin-section-span-2026-11-12/README.md) retains a thin-section boundary. |
| B10-04 | Resize one existing Viewer scene, preserve current picks and frames, then replace, clear and dispose it. Verify bounded owned geometry and resource counts. | **PASS, current Viewer and Studio [D773](../notes/viewer-resize-and-resource-lifetime-2026-11-12/README.md)**. Existing Viewer WebGPU and D319 lifetime tests are candidate evidence. |
| B10-05 | Measure frame cadence, update latency and a defined resource or memory signal on one frozen desktop workload. Record warmup, samples and exact device. | Pending. [D515](../notes/slow-drag-cadence-current-2026-11-04/README.md) retains a separate drag workload. |
| B10-06 | Render a declared CAD React model with the existing Viewer through props A→B→A. Bind frames to accepted geometry, then open and edit the exact returned Doc in Studio. | Pending. [D509](../notes/cad-react-profile-composition-2026-11-04/README.md) retains the earlier component and consumer proof. |
| B10-07 | Refuse a failed result, recover or restart its current consumer and dispose it. Check that obsolete completions and frame evidence cannot present stale success. | Pending. P0-R05, R08 and R09 retain narrower recovery evidence. |

D773 qualifies 4/7 current groups. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. Full package publication, mobile, general scale, broad driver support and arbitrary geometry are outside this matrix.
