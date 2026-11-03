# Exact-size archive qualification

Root executed the frozen candidate once:

```sh
STREAM_TEST_OUT=FRESH_OLD18_OUT SIZED_TEST_OUT=FRESH_EXACT_OUT \
  $NODE22 examples/physics-world-p5-2276/command-run.mjs \
  stack-sized-controls-01 . $NODE22 --test \
  examples/physics-stack-stream-sized-2276/archive.test.mjs \
  examples/physics-stack-stream-sized-2276/exact-size.test.mjs
```

**23/23 PASS**, zero failures, outer860.710833ms. All pinned inputs and the
source seal were checked before and after execution. `ROOT-RESULT.json` binds
the actual receipt to source seal
`f509d7a0ade48b59e718c81091c8a34fd2fe20584225ca40161efd9f9e348e1c`.
The unchanged18-case bank remains byte-identical to the original archive tests.

The five additional groups pass the native JSON byte oracle for escaped and
Unicode strings, surrogate pairs/lone surrogates, signed zero and finite scalar
extremes; exact2MiB and one-byte-over admission; the actual failed ALIGNED2
record; the explicit512KiB word limit; and exact16MiB combined scratch admission
with one extra raw word refused while earlier appends remain pending.

The captured failed record roundtrip retains483481 whole JSON bytes,8842
numeric leaves/70736 word bytes, and the original body/point buffers. This proves
the new component can admit that representation under the unchanged wire and
scratch caps. It does not promote the old failed campaign.

Zero physics/reference calls occurred in this component test. Fresh combined
three-scene16-step live qualification remains required before full1200. Public
World/API and desktop integration remain NOT_RUN. Strict-global64MiB remains
NOT_QUALIFIED. Original tolerances, first failures and HOLDs remain unchanged.
