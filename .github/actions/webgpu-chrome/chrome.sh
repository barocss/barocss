#!/bin/sh
# Chrome with a SwiftShader WebGPU flag set for the browser suites. The flags come from WEBGPU_CHROME_FLAGS
# (space-separated words, no quoting; browser-ci.mjs probes several sets and exports the first that presents a canvas).
# Chrome keeps only the last --enable-features switch, so any --enable-features=X word in the flags is merged into the
# one Playwright passes (or added as a single switch) instead of being a second switch.
# WEBGPU_CHROME_HEADED=1 drops Playwright's --headless so Chrome runs headed (under Xvfb on CI).
[ -n "$WEBGPU_REAL_CHROME" ] || { echo 'WEBGPU_REAL_CHROME is not set' >&2; exit 2; }
set -f
flags="${WEBGPU_CHROME_FLAGS---enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --ignore-gpu-blocklist}"
feats=
others=
for word in $flags; do
  case "$word" in --enable-features=*) feats="$feats,${word#--enable-features=}" ;; *) others="$others $word" ;; esac
done
feats="${feats#,}"
found=
for arg in "$@"; do
  shift
  [ "$WEBGPU_CHROME_HEADED" != 1 ] || case "$arg" in --headless|--headless=*) continue ;; esac
  case "$arg" in --enable-features=*) [ -z "$feats" ] || arg="$arg,$feats"; found=1 ;; esac
  set -- "$@" "$arg"
done
[ -n "$found" ] || [ -z "$feats" ] || set -- "$@" "--enable-features=$feats"
# shellcheck disable=SC2086
exec "$WEBGPU_REAL_CHROME" $others "$@"
