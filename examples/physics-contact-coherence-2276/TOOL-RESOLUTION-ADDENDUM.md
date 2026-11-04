# Preserve private01 tool-resolution refusal

Root private01 failed during freeze at548.502291ms, MODULE_NOT_FOUND for
@esbuild/darwin-arm64/bin/esbuild. No compiler, candidate, original kernel or
reference ran; World0. The installed esbuild works, but its native dependency
is resolved relative to esbuild actual module, not this worktree caller.
Resolve/createRequire from realpath(require.resolve(esbuild)) and authenticate
that actual installed binary. No install, download, env/security change or
fallback is introduced. All private math/input/gate/call/time budgets stay.
Original source seal, files and failed receipt are immutable in
baseline/private-first-01. Root freezes the repaired loader with a new seal
before fresh private02. This is tooling repair, not physical qualification.
