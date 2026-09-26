---
"@barocss/server": patch
---

Test-only: the extractClasses unclosed-opener linearity check now counts bytes scanned instead of timing it, so CI speed can't make releases flaky. Measured growth is linear (exponent 0.7 to 1.0) on both 0.8.0 and the current code.
