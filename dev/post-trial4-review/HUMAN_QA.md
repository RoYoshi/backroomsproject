# Post-Trial 4 review — Human QA for the owner

Commit to test: the head of `post-trial4-review-polish` (R4, the commit that adds this page; its game code is R1's `0542327`). To run it, check out the branch and start `node server.js` (Node 18 or
later, nothing to install). For the admin tools, set your own `ADMIN_PASSCODE` in the environment; never use the built-in default
and never write the passcode into notes.

For two players, use two browser windows (or two devices) with the same `?room=` name. A phone, or a browser's phone emulation with
touch, covers the touch checks.

Tick only what you actually saw. Anything you skip stays **NOT CHECKED**.

## 1. RGB sliders (the main fix)

- [ ] **Body.** Customize → Wanderer. The Body RGB numbers match your saved body colour as soon as the panel opens, not 0 / 0 / 0.
- [ ] Click a body swatch. All three sliders and numbers jump to that swatch's colour.
- [ ] Drag Red. Only the red number changes and the preview's red tint follows; green and blue stay where they were.
- [ ] Focus a slider with Tab and press the arrow keys. It moves one step at a time and the number follows.
- [ ] **Hands.** Changing the body does not move the Hands sliders. The Hands sliders follow a hands swatch the same way.
- [ ] **Beam.** Loadout tab. The Beam RGB sliders show your beam colour and follow a beam swatch. With the camcorder chosen, the
      beam section (sliders included) is hidden.
- [ ] **HUD.** Settings → HUD. With the colour on Default, the sliders read 243 / 231 / 167. A swatch moves them. Dragging one
      changes the HUD colour (the LEVEL 0 / STAMINA sample at the top of the page, and the HUD in your next run). **Reset HUD**
      returns the sliders to 243 / 231 / 167.
- [ ] **Saved.** Reload the page. Your body, hands, beam and HUD colours are what you left, and so are their sliders.
- [ ] **Seen by others.** A second player in the same room sees your new body and hands colours.
- [ ] **Layout.** In Customize the sliders are thin lines, not tall boxes. In Settings the numbers sit inside the box. On a phone
      nothing runs off the right edge and the sliders can be dragged with a finger.

## 2. Nearby chat (Trial 2, with Trial 4's additions)

- [ ] **Hint.** In a run on a computer, `ENTER Nearby Chat` sits at the bottom centre. It is gone while you type, on the pause
      screen, in Customize and Settings, while dead, and on the main menu, and it comes back when you return to play. On a phone
      there is no hint; SAY is at the right edge.
- [ ] **Colour.** Give the two players different HUD colours. When player A speaks next to player B, B's bubble for A has A's colour
      (border, tail, and the edge arrow when A is off screen). Text stays light on dark.
- [ ] Typing in the composer never moves your wanderer. Esc closes the composer without pausing.
- [ ] Mute in the composer's Options still hides that speaker's lines.
- [ ] A player in another room, or far away, sees nothing.
- [ ] Main-menu lounge works as before: other rooms' players appear, and there is no chat panel during play.
- [ ] (Known, Low, unchanged) With the inventory drawer (Tab) open, the hint still shows and Enter opens the composer. Tell us
      whether you want that changed.

## 3. Gameplay and reset (should be exactly as before)

- [ ] Pause shows **SPONTANEOUSLY COMBUST?**. Pressing it does what NEW RUN always did, including the cooldown or denial message
      (the label comes back afterwards), the run menu, the world reset and the body left behind.
- [ ] Death, respawn, reconnect (reload during a run) and back to the main menu behave as before.
- [ ] The main menu's title still drifts gently (Trial 1). With Settings → Display → Reduced motion On it rests.

## 4. Screen effects

- [ ] Being caught shows a dark, still vignette, with no white or red flash.
- [ ] Walking into a glitched wall and leaving: no screen-wide tearing or inverted flash.
- [ ] (Known, Medium, not changed: needs your decision) With Reduced motion On, the screen still shakes and the light still
      flickers when an entity is close. Say whether reduced motion should stop those too.

## Your decision

- **PASS / ACCEPT** the review's corrections, or
- **NEEDS CHANGES** (list them), or
- **ROLL BACK** to `518b990` (Trial 4's closed head; nothing to undo elsewhere).

None of these merges, deploys or starts Trial 3.
