# A/B dry run (scripted agent)

Arms: json (v1 tools without run_script) and hybrid (v2 tools with model.run). Tokens estimated at 4 characters a token from what each model turn would read (one tool call a turn); "new" is input not read from the prompt cache.

| brief | arm | passed | pass@k | pass^k | calls | refused | input tokens | new input | output | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|
| block-hole | json | 3/3 | yes | yes | 4 | 0 | 94461 | 19620 | 320 | 157 |
| block-hole | hybrid | 3/3 | yes | yes | 2 | 0 | 13864 | 4844 | 320 | 142 |
| washer | json | 3/3 | yes | yes | 3 | 0 | 73876 | 18793 | 286 | 146 |
| washer | hybrid | 3/3 | yes | yes | 2 | 0 | 13713 | 4775 | 308 | 148 |
| phone-stand | json | 3/3 | yes | yes | 7 | 0 | 163234 | 22772 | 407 | 153 |
| phone-stand | hybrid | 3/3 | yes | yes | 2 | 0 | 14212 | 5003 | 343 | 148 |
| machined-plate | json | 3/3 | yes | yes | 9 | 0 | 210012 | 24413 | 478 | 221 |
| machined-plate | hybrid | 3/3 | yes | yes | 2 | 0 | 14417 | 5112 | 370 | 214 |
| l-bracket | json | 3/3 | yes | yes | 7 | 0 | 162241 | 22431 | 414 | 169 |
| l-bracket | hybrid | 3/3 | yes | yes | 2 | 0 | 14293 | 5039 | 355 | 168 |
| flange | json | 3/3 | yes | yes | 5 | 0 | 113941 | 19959 | 361 | 197 |
| flange | hybrid | 3/3 | yes | yes | 2 | 0 | 14472 | 5146 | 347 | 289 |
| open-box | json | 3/3 | yes | yes | 4 | 0 | 95055 | 19928 | 318 | 138 |
| open-box | hybrid | 3/3 | yes | yes | 2 | 0 | 13810 | 4821 | 318 | 138 |
| pcb-enclosure | json | 3/3 | yes | yes | 13 | 0 | 338263 | 31017 | 604 | 406 |
| pcb-enclosure | hybrid | 3/3 | yes | yes | 2 | 0 | 14795 | 5283 | 385 | 316 |
| stepped-shaft | json | 3/3 | yes | yes | 7 | 0 | 155077 | 20645 | 405 | 212 |
| stepped-shaft | hybrid | 3/3 | yes | yes | 2 | 0 | 14123 | 4970 | 338 | 180 |
| knob | json | 3/3 | yes | yes | 5 | 0 | 113282 | 19601 | 364 | 270 |
| knob | hybrid | 3/3 | yes | yes | 2 | 0 | 14054 | 4935 | 339 | 265 |

| arm | briefs | pass rate | calls a brief | refused | input tokens a brief | new input | output |
|---|---|---|---|---|---|---|---|
| json | 10 | 100 % | 6.4 | 0 | 151944 | 21918 | 396 |
| hybrid | 10 | 100 % | 2 | 0 | 14175 | 4993 | 342 |
