# Source ownership review

The selected path is Viewer.orbit → setView → present/show → Presenter.show. Native backend updateFrame uses the same Presenter.show path.

| Resource | Owner | Replacement policy |
| --- | --- | --- |
| Geometry created by Presenter.addOwned | Presenter | Remove its tracked Mesh, then call Geometry.dispose |
| Newly created Geometry when Mesh addition fails | Presenter | Dispose immediately and rethrow; no orphan |
| Core explicit Geometry shared across caller Meshes | Caller/Core existing contract | Mesh.remove does not dispose it; caller can reuse it and dispose it explicitly |
| Mesh instance/material/map GPU buffers | Mesh/Core existing remove path | Released by Mesh.remove before Geometry disposal |
| Geometry geometry/scalar GPU buffers | Geometry | Existing release implementation; shared zero-UV buffer excluded |
| External ImageTexture/material maps | Their existing owner | Presenter does not dispose them; Core final disposal retains its original policy |

Core createGeometry, add, remove, clear, Geometry.dispose/release, and device-loss restoration are unchanged. Presenter creates fresh Geometry for each item; no external Geometry object is accepted by its Drawing input. PreparedGeometry still copies caller arrays. No data-identity cache or revision policy is introduced.

The successful add is registered in `this.meshes` immediately. If a later item fails, earlier successful Meshes remain, as before. The next show removes/disposes those tracked items. Geometry input preparation failure creates no registered Geometry. Actual Mesh constructor failure and post-construction slot-growth failure both occur after Geometry registration and now dispose that new Geometry.

Review limitation: the scoped CPU harness proves registry ownership, production cleanup calls and unchanged scene data behavior. It does not establish actual WebGPU rendering or physical driver allocation reclamation. The consumer browser lane supplies separate product evidence. No broader Core lifetime/API rewrite is included.
