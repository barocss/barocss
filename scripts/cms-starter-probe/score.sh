#!/bin/bash
# usage: score.sh <candUrl> <label>
export PW_DIR=/Users/user/.npm/_npx/705bc6b22212b352
export CHROME="/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
node /Users/user/github/barocss/barocss/.claude/worktrees/agent-a89aecf355e60b202/scripts/cms-starter-probe/score.mjs http://127.0.0.1:6701 http://127.0.0.1:6702 "$1" "$2" > /private/tmp/claude-501/cms282/score-$2.json
python3 -c "import json;d=json.load(open('/private/tmp/claude-501/cms282/score-$2.json'));p=d.pop('pages');print(d);[print(k,v) for k,v in p.items()]"
