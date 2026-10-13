# Stage 3D HQ2 — NEW RUN authority

NEW RUN is the server's decision. The browser sends only an intent and changes nothing until the server answers. This document describes the contract as built, checkpoint by checkpoint.

## H2-1: the decision

### The messages

| Direction | Message | Meaning |
|---|---|---|
| client → server | `{t:'nr', q, w}` | "I pressed NEW RUN". `q` is this page's press number (a positive integer that only increases). `w` is the world epoch the page last saw (`s.w`) |
| server → client | `{t:'nra', q, ok:1, de, w}` | Approved: the player is already out of the world (menu state on the server). `de` is the event id the explosion will carry (H2-2) |
| server → client | `{t:'nra', q, ok:0, why, wait?}` | Refused; nothing changed anywhere. `why`: `state` (not in a run), `dead`, `held` (in a capture), `cooldown` (`wait`: seconds left of the 30 s), `epoch` (the press named a world an admin has since reset) |
| server → client | `s.w` | The world epoch in every snapshot |

**Removed.**
- A client's `fx` (`k:'vanish'`, and the client death replay already ignored since D7) is no longer read.
- A client's `b` (`c:'Vanish'`: the light record the old fade left) is no longer read.
- The server no longer creates a `Vanish` light record or relays a vanish.

### The server (`server.js` `nrIntent`, `sim.js` `newRun` / `nrWhy` / `nrWait`)

**One answer per press.**
- The same `q` again gets the same answer, so a resend never makes a second event.
- An older `q`, a malformed one (0, negative, fractional, a string, ≥ 2³¹) or an intent within 250 ms of the last gets no answer (counted as dropped).

**Checks, in order.**
1. The world named.
2. In a run (active, not out through a glitched wall).
3. Not dead.
4. Not held.
5. The 30 s since this player's last approved NEW RUN.

**Approval.** Approval and leaving the world are one step (`newRun`): the player's `active` flag drops in the same message handler that sends the answer. So no snapshot after the answer shows a living player there.

**The lifecycle.** `join` and `leave` from alive are always refused. A living run ends only through NEW RUN or a death, and the vanish window of HQ1 (2–20 s after an accepted vanish) is gone.

**What never comes through here.** An admin world reset, a death, END and RESPAWN. None of them answers a NEW RUN, explodes anyone, or starts or resets anyone's cooldown.

**Reconnect.** A new connection is a new player, as before (there are no accounts), with a fresh cooldown. An approval the old connection never received still stands: that player is out of the world.

### The browser (`mp.js` `__net.nr`, the bundle's `Xnr` / `Xok`)

**Online**
1. The NEW RUN button sends the intent; the button shows `NEW RUN · …` and is disabled while it waits.
2. **Approved**: the avatar is hidden at once, a 0.8 s beat follows, then the run menu (`Nend`). SPAWN there starts the new run.
3. **Refused**: the button says `NEW RUN · WAIT n S` or `NEW RUN · NOT NOW` for 2.5 s. The dialog stays open and nothing else happens.
4. No answer within 2.5 s (a dropped connection): the button comes back.
5. An approval that arrives later is still followed, because the server has decided.

Presses while one waits, after an approval, or within 300 ms of the last do nothing.

**Offline** (no connection at all): the old local fade, unchanged. It sends nothing and shares nothing with anyone.

### Evidence

`dev/stage-3d-hq2/evidence/h2-1/` (its `SUMMARY.md`):
- protocol 26/26;
- the real-browser E02 run 7/7;
- the three mutations caught: no cooldown; approved but still in the world; client-first;
- the older suites' three expected protocol deltas, each replaced.

## H2-2: the explosion

(Added at H2-2.)
