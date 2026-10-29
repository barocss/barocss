#!/bin/zsh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
python3 /tmp/d328/verify.py || exit $?
/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy 1800 d328-browser-final || exit $?
trap '/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh release' EXIT
cd apps/cad-studio || exit $?
CAD_STUDIO_CHAT_PORT=52792 CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright FLOW_ONLY='^O9: the section plane|^G19\.2:|^G3 display modes:|^G24 3D annotations:|^G23 CNC:|^G22 clearance:|^G23 print layers:|^G6: the analysis maps|^requirements:|^A6\.3:|^A6\.4:' FLOW_RENDERER=webgpu FLOW_DPR=1 FLOW_DEBUG=1 node test/browser-flow.mjs /tmp/d328/browser-first > /tmp/d328/browser-first.txt 2>&1
result=$?
echo "{\"exit\":$result}" > /tmp/d328/browser-first-exit.json
cd ../../..
python3 /tmp/d328/verify.py > /tmp/d328/browser-first-source-after.txt 2>&1
tail -n 25 /tmp/d328/browser-first.txt
exit $result
