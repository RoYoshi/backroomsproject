| suite | baseline | candidate | same verdict | same counts | same failing set | same error messages |
|---|---|---|---|---|---|---|
| server-boot | PASS 1/1 | PASS 1/1 | yes | yes | yes | yes |
| npm-test | FAIL 151/162 | FAIL 151/162 | yes | yes | yes | yes |
| humanqa | PASS 6/6 | PASS 6/6 | yes | yes | yes | yes |
| entity-look | PASS 4/4 | PASS 4/4 | yes | yes | yes | yes |
| camera | PASS 12/12 | PASS 12/12 | yes | yes | yes | yes |
| fps | PASS 10/10 | PASS 10/10 | yes | yes | yes | yes |
| physics | PASS 53/53 | PASS 53/53 | yes | yes | yes | yes |
| interpolation | PASS 3/3 | PASS 3/3 | yes | yes | yes | yes |
| live | PASS 17/17 | PASS 17/17 | yes | yes | yes | yes |
| audit-net | PASS 17/17 | PASS 17/17 | yes | yes | yes | yes |
| audit-net2 | PASS 11/11 | PASS 11/11 | yes | yes | yes | yes |
| ir-net | PASS 4/4 | PASS 4/4 | yes | yes | yes | yes |
| browser-move | PASS 14/14 | PASS 14/14 | yes | yes | yes | yes |
| browser-play | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |
| browser-light | FAIL 13/15 | FAIL 13/15 | yes | yes | yes | yes |
| browser-ir | PASS 1/1 | BLOCKED None/None | **NO** | **NO** | yes | yes |
| browser-admin | FAIL 54/56 | FAIL 52/56 | yes | **NO** | **NO** | yes |
| browser-lifecycle | PASS 1/1 | PASS 1/1 | yes | yes | yes | yes |
| browser-smiler2d | PASS 2/2 | PASS 2/2 | yes | yes | yes | yes |
| browser-chase | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |
| browser-nav | FAIL 0/1 | FAIL 0/1 | yes | yes | yes | yes |

**Differences:**
- browser-ir: baseline PASS 1/1 [] [] vs candidate BLOCKED None/None [] []
- browser-admin: baseline FAIL 54/56 ['T10 no script errors on either page', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)'] vs candidate FAIL 52/56 ['T10 no script errors on either page', "T5 hound A: the death starts on the victim's screen with the variant asked for", 'T5 hound A: the other player sees the same death replay', 'T8 debug mode: overlay on, entity data, server timings, event log and ping arrive'] ['Failed to load resource: the server responded with a status of # (Not Found)']
