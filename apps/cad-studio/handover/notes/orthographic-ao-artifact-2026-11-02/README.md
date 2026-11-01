---
work_id: D428
artifact_type: orthographic-ao-artifact-assessment
status: qualified-bounded-diagnostic-no-product-repair
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-02
---

# Orthographic AO artifact — bounded diagnosis

D428 measures the WebGPU orthographic surface pattern recorded by D427 on rows 6, 13 and 16. Overall progress stays about 43%. Product files are unchanged. [Commands, numbers and limits](qualification.json).

The first real Studio ON/OFF/ON experiment holds the original centered STEP, document, native source arrays, Viewer mesh data/IDs/materials, ground/grid/lights, camera pose and raster clips exactly. Fixed interior-region mean absolute luminance second difference changes from 6.935 to 0.449 and back to 6.935. AO participation is established for this profile.

The second real Studio experiment pairs public `Mesh.bounded` with public AO controls in five settled arms. Ground and grid stay visible, all source data and forward X/Y/W framing stay fixed, and every transformed ground corner remains within raster depth [0,1]. Scene bounds, raster Z/inverse matrices and derived frame/shadow quantities are permitted consequences; this is not a clip-only intervention.

| Ground bounded | AO | Raster near / far (mm) | ROI mean second difference |
| --- | --- | --- | --- |
| true | on | -29.68571844 / 29.72013216 | 6.93495348 |
| true | off | same | 0.44918870 |
| false | off | -0.04324117 / 0.04324117 | 0.44918870 |
| false | on | same | 0.45503914 |
| true, restored | on | original range | 6.93495348 |

The AO-OFF ROI bytes are identical between bounds states. Restored ON ROI bytes and the full captured public state equal baseline exactly. Root viewed all five images: the fine pattern disappears in the narrower-range AO-ON arm and returns on restoration. These controls support a depth-conditioning correction but do not identify one unique shader intermediate or prove general image quality.

Source review explains why the default bounded ground helper's 20 mm XY padding expands a 0.002 mm body to a 59.4 mm depth interval: automatic orthographic clipping uses the full 3D bounding-sphere radius. Depth32float step near this body is about 3.54e-6 mm. AO reconstructs positions and normals from depth; PBR vertex normals follow a separate path.

Both runs preserve all frozen source files through cleanup (755 and 758 respectively), with zero page/console errors, source changes or downloads. Contexts, browsers and servers close, and own gate leases release. All raw evidence stays under `/tmp`. No product correction or new unit/type/full-kernel run is claimed. The latest full-kernel result remains D424.

Next is D429: refine Viewer automatic orthographic clipping to the box's support along the view direction. Keep public `Camera.clip`, helper bounded status, scene bounds, AO defaults, grid extension and manual guards. Retain legacy clipping for visible label scenes and invalid or collapsed candidates. Qualify AO-ON images and picking before accepting a correction. Far-coordinate GPU work follows that boundary.

Issue #2263 stays open: complete assembly, presentation, PMI and remaining surface/loop acceptance is absent. No further develop integration or release is included.
