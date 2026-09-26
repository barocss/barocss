#!/bin/sh
# Rerun every #405 variant from the repo root. Needs PW_DIR and CHROME. cdn/tw fetch jsDelivr bundles in memory.
set -e
R=${ROUNDS:-10}
for v in base notrans flags focus headed pf eager; do PROBE_PORT=7900 node scripts/first-paint-405/run.mjs $v $R; done
for v in cdn tw; do
  PROBE_PORT=7904 BARO_UMD=/__mem__/baro.js TWB_DIR=/__mem__/twb node --import ./scripts/first-paint-404/shim.mjs scripts/first-paint-405/run.mjs $v $R
done
node scripts/first-paint-405/summarize.mjs
