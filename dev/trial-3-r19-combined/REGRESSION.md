# Trial 3 R19 - the combined QA branch: regression

Trial 3 is **not owner-approved**.  Environment: this session's machine (2 CPUs, Linux, node v22.22.2), the repository's own scripts,
`ADMIN_PASSCODE=<synthetic>` in the shell for each run.  The tree: `a456230` (S `83a05c1` and N `451f1d6` merged); its game code is unchanged at `0619812`, which brings in only the tracks'
final reports.

## The suites

| run | R18 01e5d97 | S 83a05c1 | N 451f1d6 | **combined a456230** |
|---|---|---|---|---|
| `npm test` (dev/tests/run.js, its default list) | 330/343 | 336/349 | 334/347 | **340/353** (+6 SR, +4 NC) |
| failing | the 13 inherited P9 names | the same 13 | the same 13 | **the same 13**: 2F F13, 2F F22, C1, C18, C3, C4, C5, C9/C10, H07, L9, NV09, P01, P08 - none new |
| SR01-SR06 (s_skinr19.js) | 0/6 (the negative proof) | 6/6 | - | **6/6**, every note as on S |
| NC01-NC04 (s_nanicorner.js) | - | - | 4/4 | **4/4**, every note as on N |
| the locks: PR25, WL05 (the shared engine = R8/4518f93 + exactly the N hunk), C15 (no Skin-Stealer: every snapshot R8's) | PASS | PASS | PASS | **PASS** |
| `npm run build:check`, `dev/tools/checks/parts.js` | PASS | PASS | PASS | **PASS** |

`evidence/npm_test.txt`.

## Do the two tracks interact?

Every test's note on the combined tree was compared with the same test's note on S and on N (`dev/tests/run.js` output, test by test):
- against **S**, the only notes that differ are the N track's own (NV05, C15, PR25, WL05 - exactly as they differ on N) and three
  timings of this machine (Y02, NV12, X09) and L9's stack-trace path;
- against **N**, the only notes that differ are the S track's own (P02, P08, P09, P10, SK07, SK31, BR13, PR04, PR18, PR24, C13, C18,
  C27, R9-01, X07, P16 - exactly as they differ on S), the same timings, L9's path, and WL05's count of the hunk's lines (17 since the
  second review's comment correction; N's full log predates it, its lock re-run does not).

So in every seeded scene of the suite the Skin-Stealer behaves as on S and the shared follower as on N: neither change shows through the
other.  The S track's scenes (`dev/trial-3-r19-positioning/tools/scene_r19.js`: the hall at .7 and .85, walking off at .6 and .75, the
stale way round, the junction standing and walking, the escapes at 550/450/350 px) give the same lines on this tree as on S, seed for
seed (`evidence/scenes_c.txt`).  The cornering hunk can fire for a Skin-Stealer (its open approach and chase use the shared follower);
it did not in these scenes, and NC01's Skin-Stealer runs show what it does when it does (slow 0.27 -> 0 s at 270 px/s, no contact more).

## Never weaker: game outcomes against R18 (the owner's addendum)

The N branch's `tools/pursuit_outcomes.js` on R18 and on this tree, the same seeded chases (corner pursuits through rooms - real stamina,
endless stamina, starting farther back; laps round wall islands; sustained 60 s chases), paired run by run
(`evidence/outcomes/po_C.json`, `cmp_C.md`; R18's record is the N branch's `evidence/N2/outcomes/po_R18.json`):

| species | runs | caught (R18 -> combined) | attacks begun | runs that differ |
|---|---|---|---|---|
| Hound | 348 | 345 = 345 | 174 = 174 | 2, both sooner (N's cornering) |
| Skin-Stealer | 348 | 304 -> 305 | 367 -> 374 | 11: 7 sooner, 4 later (S's positioning; N's cornering did not act) |
| Smiler | 348 | 323 = 323 | 306 = 306 | 6: 4 sooner, 2 later (one lap scene twice; N's cornering) |

The lap study (`laps_S_C.md`): 234 laps per species; the Skin-Stealer 8 differ (4 sooner, 4 later), the Smiler 9 (6 sooner, 3 later),
the Hound none; catches and attacks equal.  The control on R18 itself - every creature started 1 px off - changes 160 of 702 laps by up
to 35 s: a single lap's difference is the chase's own sensitivity; the counts are the measure, and no monster is weaker on them.  Each
track's report has the detail (S: REGRESSION "Never weaker"; N: REGRESSION "Never weaker", with the control table).
