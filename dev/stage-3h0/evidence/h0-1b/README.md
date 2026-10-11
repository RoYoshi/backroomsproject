# evidence/h0-1b: the client baseline rebuilt after a harness fix (H0-2)

## What failed

The first H0-2 gate run marked every client scene as different. The reports are kept in `../h0-2/attempt1/`. The H0-1 baseline is kept, unchanged, in `../h0-1/`.

## Why

The harness's page-state record (`cli_scenes.js`, `pageState()`) listed and hashed every element in `<body>`, the page's own `<script>` elements included.
- **Old against new.** H0-2 adds one script element by design: `assets/net-wire.js`, loaded before `mp.js`. So the old and new pages always differed in that record.
- **Old against the baseline.** The inline list of declared globals changed from `[]` to `["__mpLib"]`. So even the old side differed from the H0-1 baseline.

The scripts are the harness's loading order, not something `mp.js` produced. Nothing `mp.js` sent, called or changed differed.

## The fix

`pageState()` now leaves `<script>` elements out of the body list and out of the HTML hash. It changes nothing else.

## The rebuilt baseline

The baseline was rebuilt here from the accepted parent's own code, on both sides:

    node dev/stage-3h0/golden/cli_golden.js --new-ref edd2af9 --repeat 1 --write-baseline --out dev/stage-3h0/evidence/h0-1b

The parent against itself is identical in all 9 scenes, three runs each. The 35 deliberate changes are still all caught (`cli_mutants.json`).

`run_checkpoint.js` uses this folder's `cli_traces/` as the client baseline from H0-2 on. The server baseline is still `../h0-1/srv_traces/`, which the fix does not touch.
