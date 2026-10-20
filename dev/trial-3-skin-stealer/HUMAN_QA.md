# Trial 3 — Skin-Stealer: owner Human QA (about 45–60 minutes)

**What to run:** branch `trial-3-skin-stealer` at its head — not `main`, not P9. (A commit cannot name its own hash: the final
hash and tree are in the handoff message.)

```
git fetch origin trial-3-skin-stealer
git checkout --detach origin/trial-3-skin-stealer
git log -1 --format=%H       # the hash from the handoff
npm run build:check          # should say PASS (44 outputs)
ADMIN_PASSCODE=<any passcode of your own> node server.js
```

Open `http://localhost:8000` in a normal browser. Use real speakers or headphones for the sound items, a second (and for Part D a
third) tab or browser for the multiplayer items, and a phone or the browser's touch emulation where it says so. **Mark what you saw,
not what the automated checks say** — they cannot judge how anything looks, feels or sounds. Skipped = NOT CHECKED.

**The Skin-Stealer exists only when an admin makes one.** In a run: press **`** (backquote) to open the admin panel and unlock it
with your passcode; then press **K** with the panel open — a sixth tab, **SKIN**, appears (P9's five tabs are unchanged until you
do). SKIN: **+ SKIN-STEALER** (somewhere dark, far from everyone), **+ NEAR ME** (one near you), **− SKIN-STEALER**, its count (admin
maximum 4), and the three death previews. The world, the director and RESPAWN ALL never make one.

To see what it is thinking: DEBUG tab → switch the overlay on. Its label is lilac and has its own lines: HUNGER and its band,
STAMINA, its PLAN and WHY, its time with you and whom it has left alone, its GUESS of your route, its SKIN and how many lines of
speech it holds (never the words). Useful, but try each part once **without** the overlay too — the point is how it feels.

It is hungrier the longer it goes without a kill (about +0.1 a minute; a new one starts between 0.45 and 0.65). Most of what it
does depends on that, so the same meeting can go differently. Nothing here is scripted: if something does not happen, try again,
wait a minute, or spawn another.

## Part A — what it is (5 min)

- [ ] **+ NEAR ME**, then find it with your light. It is a tall, thin, pale figure, clearly neither the Hound nor a Smiler. In the
      dark it is black like everything else; under a lamp or your light its sallow skin shows. It casts a shadow like a body.
- [ ] Watch it for a while without the overlay: it walks with long strides, stops to listen, tilts its head too far. Its steps are
      padded and soft; when it stalks you they are quieter still. Standing still close by, it sometimes breathes — rarely.
- [ ] Settings → Display → Lighting and shadows: Low, Medium, High — it reads in each. On a phone (or touch emulation) too.

## Part B — the hunter that may not hunt (10–15 min)

- [ ] **It can leave.** Sometimes it sees you, looks, and goes away — and does not come back for you for a while. (Satiated, more
      than one of you in view, lit and watched, tired, or its time with you spent.)
- [ ] **The bait.** Meet its eyes when it is very hungry: it backs slowly round a corner and waits there (less hungry, it just backs out of sight and may wait). Do not follow — it gives up
      and leaves. Follow — you come round that corner close to it (careful).
- [ ] **Its guess.** Let it see you moving, then get out of its sight. It may appear ahead of you, waiting beside the way it thinks
      you will take. Double back or take the other turn: it guesses wrong, waits, and gives up (the overlay's GUESS shows where).
- [ ] **The race.** Rested, run away down a long straight: it gives chase briefly, falls behind and gives up. Exhausted, you are not
      so lucky. It never runs for long, never teleports, never finds you through a wall it cannot see through.
- [ ] **Talking draws it.** Say something (Enter) while it is near but cannot see you: it may come to look where the voice came from.
- [ ] Long empty stretches stay empty: it does not hang around you forever.

## Part C — the strike and the kill (8–10 min; a second player for the spectator items)

- [ ] **The tell.** Before it leaps it crouches for a fraction of a second, with a dry click and a sharp breath. Step aside then and
      it misses: it skids, stands recovering, and cannot spring again for 2–3 s — a real chance to get away. A leap into a wall stuns it.
- [ ] Nobody is killed through a wall or from a distance: only its body reaching yours. Walking into arm's reach of a hungry one is
      fatal (a short grab).
- [ ] The deaths: SKIN tab → **NECK BREAK** (A), **POUNCE** (B), **NECK BITE** (C) play each on you through the real kill path.
      Fast and decisive (3.2–3.5 s), the snap / the bites audible. Are they right for the game? Too much, too little?
- [ ] A second player watches one: they see the same death, the creature drawn over the victim, then the corpse with the dropped
      light, both persisting. The creature then feeds beside the body (and leaves if it is disturbed).
- [ ] Close the victim's tab in the middle of its death: exactly one corpse remains for the others.
- [ ] Your own screen during its death is as dark as during a Hound death (the bundle's death view), with no extra black fade.

## Part D — deception (10–15 min; three tabs: the victim, the speaker, the listener)

The skin is earned: it wears the look of someone it has killed, after feeding on them for a few seconds undisturbed.

1. Tab 1 (the victim): **+ NEAR ME**, then a death preview. Tabs 2 and 3 stay well away and do not look at it while it feeds (about
   20–35 s; MONSTERS tab → a faster world speed shortens it, set it back after).
2. When it has fed, it looks like tab 1's wanderer (the overlay's SKIN line says whose).

- [ ] **The skin:** an ordinary wanderer in the victim's look — but with nothing in its hands and no light, its arms stiff at its
      sides, walking a little slowly; no name when you hover it; it is in no list of players. Subtle enough to fool you at a glance,
      clear enough to notice when you look?
- [ ] Seen in its skin, it does not hide: it walks up to you openly, stops some way off and stares. Not hungry, it then walks on.
      Hungry, it comes closer and springs from about 120 px — the skin drops at the wind-up (the creature is suddenly there).
      Back away before that: it walks after you, but slower than you walk.
- [ ] **Its words.** Tab 2 hides behind a wall near it and says something (Enter). Tab 3 then walks into its sight: it repeats the
      opening words of tab 2's line — lower case, sometimes with its last word again ("wait for me... me") — in a low, breathy voice
      that is nobody's. With nothing heard it uses a few generic calls ("hello?", "is someone there?", "this way" ...). A very hungry one
      may also call out from hiding while it waits round a corner.
- [ ] Its line is a bubble over it (or an edge hint toward it), only for players near it in the same room — never in the menu
      lounge, never in another room, never far away. A screen reader hears "A voice nearby says: ...".
- [ ] Mutes: chat composer → Options lists it as **"An unknown voice"**; muting that silences it. Muting the *person* whose words
      it repeats also silences the echo of their words. Voices off / volume, speech written out or not, reduced motion: as for people.
- [ ] Nothing is faked: it never takes the victim's flashlight or carries a light, never moves or hides the corpse, never passes a
      crawlspace (in either form). These are recorded as deferred, not shipped.

## Part E — the game as it was (5–8 min)

- [ ] Without a Skin-Stealer the game is P9's: Hounds and Smilers behave as before (their deaths and corpses too), and the panel has
      its five tabs until K.
- [ ] With one in the world, the Hound and the Smiler still behave as before.
- [ ] Chat (lounge and nearby), voices, controls, RGB fields, credits, menu sounds, P9's single red death impact and the spawn shadow
      are unchanged. No bright full-screen flash; the Red Rooms unchanged.
- [ ] Solo and multiplayer, a phone, the three lighting tiers: usable, no console errors, no stutter you notice (with 1 and with 4).

## Owner decisions

- **ACCEPT TRIAL 3** — the shipped capabilities are clear, meaningful and verified (acceptance does not authorize a merge, a deploy
  or organic spawning).
- **NEEDS CHANGES** — with the reproduction, a screenshot or video, what is too fast / slow / loud / dark, and the build hash.
- **BLOCKED / DECISION NEEDED** — if the deception you expect needs a subsystem that does not exist yet (`DEFERRED.md`).
- **ROLL BACK** — to P9 (`pre-trial3-final-polish`), which is untouched.

Open questions for you (details in `TRIAL_3_REPORT.md`): every number in `BALANCE_TABLE.md` is a proposal; the art is interim; the
unearned (generic) disguise, flashlight theft, corpse dragging and crawlspaces in a skin wait for their subsystems; organic spawning
waits for your ecology decision.
