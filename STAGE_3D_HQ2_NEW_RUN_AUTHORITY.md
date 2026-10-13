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

An approved NEW RUN is one explosion, decided and finished by the server like a death's aftermath. It is no attack.

### The event (`server.js` `boomStart`, `death_srv.js` `boomFx` / `boomBegin`)

Approval and the explosion are the same step: in the handler that answers `nra ok`, the server opens the aftermath.
- **Where:** the position and facing it holds for the player.
- **Which blast:** its seed and direction come from one hash of the world's number and the event id (`dphys.boomPlan`), never a random draw.
- **The light:** if the light was a lit emitter (on, and not a camcorder), the HQ1 light profile `lf` is chosen once.

**The replay message**, sent once to every client, including the player's own page:

`{t:'fx', k:'boom', id, de, w, x, y, a, d, s, lk, ek, ec, ep, vx, vy, lo, lf?, el?, srv:1}`

A late joiner gets it with `el`, how far it has run. There are no attacker fields.

**The physics.** The server runs the same 240 Hz physics as every page, from the same numbers. At its end (3.2 s) it places the corpse itself:
- `bodies` record `c:'Boom'`: the one body, both hands, the light and the hat where they came to rest;
- the four blood bursts and up to three wall marks;
- `lf` with the light's release (the blast);
- the event id.

**One corpse per player:**
- a later blast or death of the same player replaces it;
- a world reset drops an explosion still playing and clears every corpse.

**It touches nothing else.** No other player is moved, corrected, stunned or hurt, and no entity is told anything. It has no light of its own. No death message is sent, and no killer is placed (`killerEnd` is now called only for a hound). An admin revive never cancels it.

### The physics (`dphys.js` kind `Boom`, beside the untouched Hound/Smiler variants)

**The blast**, on the first step:
- the one rounded body is thrown along the blast at 250–420 px/s with a spin of 9–18 rad/s and a hard squash;
- the two hands fly apart on their springs;
- the light and the hat are torn away with their own kicks;
- four blood bursts land 8–30 px around the body, on floor, never inside a solid.

**After the blast**, the same ground friction, wall contacts and settling as every death:
- a wall struck faster than 80 px/s is a wall mark, so HQ1's wallpaper stain appears on that face;
- the body's flight leaves a smear;
- the light's HQ1 clock starts at the blast (a headlamp's too).

The eight death variants never reach this code: `create`, `stepOnce`, `begin` and `prepare` branch off first for `Boom` only.

### The screens (`mp.js`, `ents.js`, the bundle)

**Every page, the player's own included:**
- plays the blast through the bundle's death class with no attacker;
- hears it once, placed (distance, pan, muffled through walls; `ents.boomVoice`), unless it joined late;
- shows the falling light by HQ1's rules (`replayLights`, the corpse's light);
- stamps HQ1's wallpaper stains (`wallStains`) for a blast as for a death.

**The player** is hidden the moment the approval arrives; its own light goes out with it. The blast shows during the 0.8 s beat. The run menu then says "YOU BLEW YOURSELF UP — What is left of you stays where you stood." The offline fade keeps the menu's own words.

### Evidence

`dev/stage-3d-hq2/evidence/h2-2/` (its `SUMMARY.md`).
