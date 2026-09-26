#!/bin/bash
# usage: mkcontent.sh <starter dir>
set -e
D=$1
B=/Users/user/github/barocss/barocss/.claude/worktrees/agent-a89aecf355e60b202/scripts/cms-probe/blocks
mkdir -p $D/src/content/posts/cms
i=0
for mb in opus-hero opus-feature-grid opus-comparison-table haiku-callout haiku-testimonial haiku-cta; do
  i=$((i+1))
  {
    printf -- '---\ntitle: "CMS entry %s"\ndescription: "Content from the CMS (%s)."\npubDatetime: 2026-09-%02dT00:00:00Z\ntags: ["cms"]\n---\n\nIntro paragraph for %s.\n\n<div data-block="%s">\n' $mb $mb $((i+10)) $mb $mb
    grep -v '^\s*$' $B/$mb.html | sed 's/^[[:space:]]*//'
    printf '\n</div>\n\nClosing paragraph.\n'
  } > $D/src/content/posts/cms/$mb.md
done
