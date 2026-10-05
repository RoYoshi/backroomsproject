# Human QA of SH4 (`3f12c47`, `shadows-2d 1.0`): the verdict this correction answers

The user played the finished SH4 build and reported, verbatim:

> "It feels like the same game"

> "The Shadows are VERY Faint"

> "The shadows aren't noticable"

Recorded as:

| gate | result |
|---|---|
| gameplay preservation | **PASS**: a hard preservation result the correction must not disturb |
| shadow visibility | **FAIL**: too faint |
| shadow noticeability | **FAIL**: not noticeable |

SH4 is therefore **not** human-QA approved. The correction pack (THE FAR BACKROOMS — 2D Shadow Visibility Correction Master
Pack, SHA-256 `cea50968124169eab2e3a1005eb8d2d5c8bbaef459414f99c80606af80551be6`; its files and `PACK_STATE.json` are
recorded beside this file) authorizes only a bounded presentation correction in `assets/shadows-2d.js`. Its primary target:

> At MEDIUM quality, a normal player should notice the shadows during ordinary gameplay without needing debug mode,
> screenshot comparisons, or repeatedly toggling shadows OFF and ON.

The engineering evidence in this folder does not replace that judgement. Visual quality is not self-approved.
