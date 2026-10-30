#!/bin/sh
# Chrome with SwiftShader WebGPU for the browser suites. Chrome keeps only the last --enable-features switch, so
# Vulkan is merged into the one Playwright passes instead of being added as a second switch.
[ -n "$WEBGPU_REAL_CHROME" ] || { echo 'WEBGPU_REAL_CHROME is not set' >&2; exit 2; }
found=
for arg in "$@"; do
  shift
  case "$arg" in --enable-features=*) arg="$arg,Vulkan"; found=1 ;; esac
  set -- "$@" "$arg"
done
[ -n "$found" ] || set -- "$@" --enable-features=Vulkan
exec "$WEBGPU_REAL_CHROME" --enable-unsafe-webgpu --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader \
  --disable-vulkan-surface --ignore-gpu-blocklist "$@"
