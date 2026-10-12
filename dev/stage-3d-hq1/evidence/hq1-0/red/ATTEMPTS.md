# RED capture attempts (harness failures, kept)

Every RED capture ran on an export of the D7 parent (`git archive ffe2b53`). The failed attempts below are harness problems, not game behaviour. Their screenshots are kept as JPEG.

| Folder | What went wrong | Fix in the harness |
|---|---|---|
| `attempt1_victim_killed_before_preview` | A smiler killed Alice while the admin panel was still removing the monsters (the server log shows `de=1: Smiler A`), so the preview was refused: "you are not in the halls right now" | Wait, then respawn her if dead (`ensure_alive`) before placing her |
| `attempt2_victim_in_god_mode` | Giving Alice god mode (to protect her) meant her client never started the death the server committed: the server said `ok`, the page never showed the death | No god mode for the victim (god mode for the spectator only, as in D6) |
| `attempt3_death_card_and_slow_join` | The victim's "impact" picture showed the death card (taken 2 s into the death, not 0.86 s, because SwiftShader is slow). The late joiner needed 25 s to load and join | The Death Lab is paused on both screens and stepped to impact + 0.6 s. The late joiner is loaded first and waits at the name prompt |
| `attempt4_late_joiner_not_placed` | The late joiner was teleported during her fall into the level, which does not stick | Wait for the fall to end |
| `attempt5_late_joiner_moved_back` | The teleport still did not stick | Check the position after each teleport and repeat it |
| `attempt6_start_not_seen_in_8s` | The server committed the preview (`ok`), but the page took more than 8 s to show the death while a third page was loading | Wait up to 20 s |
| `attempt7_late_joiner_teleport_undone` | The server's movement checks undid a non-admin's teleport | The late joiner authenticates with the synthetic test passcode, as the other harness pages already do (`lib3d.join`) |
| `attempt1_light_labels_misdated` | The light sheet labelled pictures "release + 4 s" when they were taken about 17 s after the death: one sample with two screenshots takes 5–10 s on SwiftShader | Each picture is labelled with the time it was actually taken |
