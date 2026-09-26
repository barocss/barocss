#!/bin/bash
# #250 AI HTML email probe — generation step.
# Rerun: bash scripts/email-probe/gen.sh && node scripts/email-probe/probe.mjs
# Neutral prompts (no styling approach named) x {opus,haiku}, plus one Tailwind-asking control prompt.
cd "$(dirname "$0")/outputs" || exit 1
req() {
  case $1 in
    welcome) echo "Write the complete HTML for a welcome email for new users of a project-management app called Tasko. Output only the HTML document.";;
    receipt) echo "Write the complete HTML for an order receipt email from an online bookstore, with 3 line items, tax and total. Output only the HTML document.";;
    newsletter) echo "Write the complete HTML for a monthly newsletter email from a coffee roaster with 3 short articles. Output only the HTML document.";;
    reset) echo "Write the complete HTML for a password reset email with a reset button and expiry notice. Output only the HTML document.";;
    invite) echo "Write the complete HTML for an event invitation email for a developer meetup, with date, venue and RSVP button. Output only the HTML document.";;
  esac
}
for k in welcome receipt newsletter reset invite; do for m in opus haiku; do
  [ -s "$k.$m.json" ] || env -u CLAUDECODE claude -p "$(req $k)" --model $m --output-format json > "$k.$m.json" &
done; done
for m in opus haiku; do
  [ -s "tw-receipt.$m.json" ] || env -u CLAUDECODE claude -p "$(req receipt | sed 's/ Output only/ Style it with Tailwind CSS utility classes. Output only/')" --model $m --output-format json > "tw-receipt.$m.json" &
done
wait
