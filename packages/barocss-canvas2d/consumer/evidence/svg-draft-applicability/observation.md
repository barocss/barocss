# Cloud source/API observation

Status: bounded implementation checked; genuine browser acceptance UNRUN.

- New Polygon SVG accepted by the real source importer and original host bridge,
  using an XML Element adapter rather than browser parsing
- Actual host refusal function rejects missing or partially matching sample
  patterns with UNSUPPORTED_FEATURE before snapshot, frame, parser, importer,
  counters, session identities, source or retained refusal rows change
- Active/disposed and source-provenance errors remain first
- Actual run wrapper preserves the applicability failure through its final
  status update; it does not replace that failure with Ready
- Source review confirms the three original recipes are byte-for-byte unchanged,
  and actual entries are retained before the expected-code guard can throw
- Syntax, narrow TypeScript and host bundle passed

No physical upload, button click, native rendering/readback, listener identity
count, document snapshot or screenshot was observed here. The native flow is
pending due to the reported cloud-browser localhost connection refusal. The
original applicable branch is source-reviewed but runtime UNRUN. No historical
receipt, current integrated acceptance or release claim is upgraded.
