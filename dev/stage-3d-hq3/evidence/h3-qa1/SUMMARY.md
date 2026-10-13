# HQ3 human-QA correction 1: the white streaks on the gibs

## What the player saw

Thin white lines sometimes ran from the flying pieces (and from the settled remains) to a hand.

## The cause

The white highlight on each detached hand in `gore.js` `gibs()` is drawn with `g.arc(...)`.

**How Pixi joins the arc.** In the game's Pixi (v8), every `fill()`/`stroke()` starts the next path at the last point drawn. An `arc` then joins its start to that point with a straight line.

**Where the line ran.** The hand's disc is a closed circle, so the arc that followed it, the white highlight, was joined to a point on the core lump. That drew a white line at 25 % opacity from the lump to the hand, in flight and on the corpse.

**The dark-red stump arc** drawn after the highlight currently starts from no valid point, so it draws no line. This is because of how this Pixi version reports an arc's last point.

## Isolating it

Isolated with `gib_streaks.py`. Eight explosions (real breakup outlines; at 0 s, in flight, late in flight and at rest) were drawn by the real `gibs()` at 4x on a plain floor in a real game page. Each variant's `gore.js` was served to the page by the harness, and nothing on disk changed.

| `gore.js` | Stray pixels (outside every piece, hand and shadow) |
|---|---|
| shipped (`486564d`) | 3,699, in 6 of the 8 explosions |
| highlight switched off (isolation only, never committed) | 8,750. The stump arc inherits the join and draws thick dark-red lines instead, so removing the highlight is not the fix |
| **fixed: the highlight starts its own path (`g.beginPath().arc(...)`)** | **0** |
| the same applied to the stump arc too (not committed) | 0, but 639 pixels of the stumps drawn differently |

**Shipped versus fixed, pixel for pixel:**
- 10,454 pixels differ.
- Outside the hands, every one lies on two straight lines per explosion meeting at one point on the core lump (`gib_streaks_lines.json`: 0 off the lines).
- Only 1 is darker in the shipped picture: a white line only ever lightens.
- Inside the hands, the differences are the end of the same line. The highlight arc and the stump are unchanged (`shots/diff_shipped_fixed.png`).
- So the pieces, hands, colours, sizes and blood are as approved; only the lines are gone.

## The fix

One line of `gore.js`: `g.beginPath()` before the highlight's `arc`. The stump arc is left exactly as approved.

## A real explosion

`gib_browser.py` on the fixed game: Alice, Bob watching, Carol joining late. 5/5.
- One blast and one corpse of 6 pieces.
- No whole torso.
- The pieces apart at once.
- The same record on all three pages, with the replays ending within 1 px of it.
- The late joiner gets no blast and no sound.

`streak_fix_before_after.png` shows the same blast (the same server seed) on Bob's screen before and after, at 0.15 s and settled, and two of the 4x explosions.

**Not re-run:** the physics, sizes, record, sync, admin and the other HQ3 checks. Only the drawing of one arc changed.
