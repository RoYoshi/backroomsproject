# D5: victim and spectator staging, death-only sound, reduced motion

Changed:
- **The death sound's blows fall when the physics' blows fall.** It no longer uses a fixed table per killer. Hound C strikes at 0.20 and 0.21 s, Hound D at 0.45 s, Smiler B at 0.7 s; before, every Hound death sounded the same.
- **The sounds of what really happened**, procedural and placed where they happen (distance, pan, muffled through walls):
  - the body hitting a wall;
  - the light leaving the hand and landing, or knocking a wall;
  - the hat landing.
- **A spectator hears the death,** placed: before, spectators heard nothing of a replayed death. A late joiner arriving mid-way does not hear its start.
- **Sound only through the game's own audio,** with the master volume and sound ON/OFF. A drop-in death recording (`sounds/death*.mp3`, `sfx.js`) follows the same placement. Nothing new plays on the menu, and no file was added.
- **Reduced motion** (Settings → reduced motion, the `rm` class): the death's camera shake is a quarter as strong. The 1.4× death zoom and the death screen are unchanged.

Bundle: 3 more exact-text hooks (`apply_bundle.py`, 6 in all):
- `death(kind, options)`;
- the two shake terms.

`sound_check.py`: Alice dies, Bob watches from 150 px, Carol is 1,600 px away. Compared with the parent (`sound_parent.log`):
- **Blow times:** the victim's death sound now has the physics' blow times; at the parent it had the fixed table.
- **Spectator:** Bob now hears the death sound (gain 1 at 150 px) and its wall and light events. At the parent he heard nothing.
- **Out of earshot:** Carol's client receives the events but plays no death sound.
- **Sound OFF:** with Bob's sound switched off, no death sound plays for him.
- **Reduced motion:** the shake factor is 0.25 with reduced motion and 1 without. The largest measured shake in a Hound A death was 0.185 px normally and 0.048 px with reduced motion. (The Hound C run reads 0: the tool sees the scene only once a corpse exists.)

Regression, all passing:
- golden3d: unchanged from D4 (one documented follow-on);
- `death_net` 16/16;
- `phys_test`;
- `gore_geo` 0/0.
