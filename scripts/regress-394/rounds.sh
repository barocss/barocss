#!/bin/sh
# Round-robin: each round runs every version once (runs=1 per invocation), so machine drift spreads over all versions.
# Usage: sh scripts/regress-394/rounds.sh <rounds> [versions...]
D=$(dirname "$0"); n=$1; shift
for r in $(seq 1 "$n"); do TAG=-r$r sh "$D/run.sh" ssr 1 "$@"; done
