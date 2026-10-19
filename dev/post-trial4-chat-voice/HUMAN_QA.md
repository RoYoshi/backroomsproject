# Nearby chat UX and character voices — Human QA for the owner

Test the head of `post-trial4-chat-voice-polish`: checkpoint C5, the commit that adds this page. Its game code is C4's (`f704dc6`), and its
hash is in the handoff message. Start it with `node server.js` (Node 18 or later, nothing to install).
For two players, open two browser windows, or a computer and a phone, with the same `?room=` name, and stand close together.
Headphones help with the voices. Tick only what you actually saw or heard. Anything you skip stays **NOT CHECKED**.

The automated checks ran in a headless browser with software graphics and no speakers. **They cannot tell you how the voices sound,
how smooth the typing looks on a real screen, or how it feels on a real phone.** Those are what this page is for.

## 1. The chat icon (desktop and phone)

- [ ] **Desktop.** In a run, a small speech-bubble icon sits in the lower-right corner, dim until you hover it. Its key (`Enter`) is
      shown in a small box beside it, and "Nearby chat" appears above it when you hover or Tab to it.
- [ ] **Coordinates.** With Settings → HUD → Coordinates on, the icon moves up above them instead of covering them.
- [ ] **Phone.** The icon is a square button just above INV / LIGHT and easy to tap. Held sideways, it sits on the bottom row, left of
      LIGHT. It never covers the stick, the buttons, PAUSE, or the stamina/status text.
- [ ] **Hidden at the right times.** You can't see it on the main menu, while paused, in Customize or Settings, while dead, or while
      typing. It comes back when you return to play.
- [ ] It looks like part of the game's own HUD (dark, quiet, cream/amber), not a bright new button.

## 2. Opening chat

- [ ] Clicking (or tapping) the icon opens the "Nearby" composer at once, with the cursor in the text field.
- [ ] Pressing the chat key (Enter by default) does the same.
- [ ] If you were walking when it opened, you stop. Typing **W A S D C F** in the box only types letters: you don't move, crouch or
      toggle the light.
- [ ] **Enter** sends the line. **Esc** closes the box **without** pausing the game.
- [ ] **Offline** (SOLO): no icon, and Enter does nothing new.

## 3. Changing the chat key

- [ ] Settings → Controls has a **Chat → Nearby chat** row showing `Enter` and `Num Enter`.
- [ ] Set it to **T**. The icon's key changes to `T`; T opens chat in a run, and plain Enter no longer does (Enter still sends inside
      the box).
- [ ] Try to give it **F**. You're told F is the light's key and offered **Swap keys** / **Cancel**. Swap moves the light to the old
      key, and the light then works on that key while F opens chat. Cancel changes nothing.
- [ ] **Reset controls to defaults** brings back Enter (and the icon shows `Enter` again).
- [ ] Your other key choices from before this update are all still there after reloading.
- [ ] The pause screen's control list shows the Nearby chat key.

## 4. Typed-out speech

- [ ] A friend's line appears in their bubble **a little at a time**, like being spoken. It pauses briefly at commas and after
      ". ? !" and "...", then stays on screen for a moment once complete.
- [ ] The bubble doesn't jump or resize while the words appear.
- [ ] A long line (up to the 160-character limit) still finishes and stays readable. Nothing hangs around forever.
- [ ] If the same person says something new while a line is still appearing, the new line replaces it at once.
- [ ] A slow voice (Speed 50%) writes visibly slower than a fast one (Speed 200%).
- [ ] Emoji, flags and accented letters appear whole, never as broken boxes halfway through.
- [ ] **Instant text:** Settings → Display → **Typed-out speech** off (or the composer's Options → Speech text) shows each line
      complete at once.
- [ ] **Reduced motion** (Settings → Display → Reduced motion On) also shows lines complete at once.
- [ ] (Screen reader users, if you can test it) a nearby line is read out once, complete, not letter by letter.

## 5. Your voice (Customize → Wanderer → Voice)

- [ ] Seven voices: Classic, Soft, Deep, Electronic, Static, Hollow, Chime. Picking one plays a sample, and the line under the
      buttons types itself out along with the sound.
- [ ] **Pitch** and **Speed** sliders change the sample in a way you can hear. **Preview** replays it. **Reset voice** goes back to
      Classic, 0, 100%.
- [ ] Your choice is still there after a reload.
- [ ] **Listen for:** no voice is harsh, startlingly loud or clipped, and none is much quieter than the others. Do they suit the
      Backrooms (uncanny, restrained) rather than sounding like cartoon effects? Note any you'd change.

## 6. Hearing others

- [ ] Settings → Sound → **Wanderer voices** off silences every voice; the bubbles still type. On again brings them back.
- [ ] **Voice volume** changes how loud voices are. The game's master volume and the Sound off switch also apply.
- [ ] The composer's Options → **Voices: on/off** does the same as the Settings switch.

## 7. Two players with different voices

- [ ] Player A picks **Deep**, pitch −5, speed 70%. Player B picks **Soft**, pitch +4, speed 130%.
- [ ] When A speaks, **both** screens play A's deep, slow voice and A's line types slowly.
- [ ] When B replies, both play B's soft, quick voice. Neither player hears their own settings applied to the other.
- [ ] A speaker to your left sounds a little to the left, and a distant one (at the edge of hearing) is quieter.
- [ ] With three or more people talking at once, it doesn't turn into a wall of noise (at most two voices sound together).

## 8. Muting, distance, reconnects, replacements

- [ ] Muting someone (composer → Options → their name) hides their bubbles **and** silences their voice.
- [ ] A player far away (more than 6 floor tiles), or in another room, shows nothing and makes no sound.
- [ ] Reload one page mid-run: chat works again after the reconnect, with no stuck bubble or voice.
- [ ] Bubbles and voices stop at once when the speaker leaves, dies or the world resets, and when you die or leave.
- [ ] A new line from the same speaker cuts off the old voice cleanly, with no overlapping leftovers.

## 9. Performance and errors

- [ ] Several people chatting doesn't make the game stutter on your computer or phone.
- [ ] No crackling or audio glitches during long conversations.
- [ ] The browser console (F12) shows no red errors while chatting, rebinding or customizing your voice.

## 10. Everything that was already there

- [ ] Main-menu lounge chat, the title drift, speaker-coloured bubble borders, the RGB colour sliders, "Spontaneously Combust?" and
      the gentle capture effects all behave as before.

## Your decision

- **PASS / ACCEPT**, or
- **NEEDS CHANGES** (list them; for the voices, say which presets to change and how), or
- **ROLL BACK** to `1a89863` (the review's head; nothing to undo elsewhere).

None of these merges, deploys or starts Trial 3.
