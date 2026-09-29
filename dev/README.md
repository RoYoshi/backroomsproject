# dev/ - test suite for the v16 movement, AI and death systems (optional)

Nothing here is needed to play or host the game; `server.js` never serves this folder. It exists so the behaviour can be re-checked after any change.

## What it is

`harness.js` runs the **real** `sim.js` + `ai.js` (the same code the server runs) headless at 60 Hz with scripted "puppet" players, so a scenario is a few lines: put a player and an entity somewhere, run the clock, look at what the simulation did. Entities are never scripted; the scenarios only set the stage and measure what emerges. Everything is seeded and deterministic (scenario Y08 checks that).

## Run

```
node dev/tests/run.js s_percept.js s_hound.js s_smiler.js s_capture.js s_system.js    # 54 scenarios, about 30 s
ONLY=H09 node dev/tests/run.js s_hound.js                                             # one scenario (regex on the name)
DATA=1 node dev/tests/run.js s_smiler.js                                              # extra data for failures
node dev/tests/live.js                                                                # real server.js + two WebSocket clients (needs Node 22+: built-in WebSocket)
python3 dev/tests/move_test.py                                                        # Part I movement checks in a headless browser (pip install playwright; playwright install chromium)
python3 dev/tests/audio_test.py                                                       # renders every entity / capture sound offline and measures it (same requirements)
node dev/tests/play_server.js 8000 play                                               # the real server, but entities always "play" with a caught victim (or `quick`): for watching the held / down / crawl / release visuals
```

`run.js`, `live.js`, `move_test.py` and `audio_test.py` exit with code 1 if anything fails.

## Scenarios (54, on the real simulation)

### s_percept.js - perception, memory, personality
- **P01** noticing distance: run > walk > crouch
- **P02** a light beam makes a walker easier to notice
- **P03** standing still: a hound that is not looking never finds a silent standing player 300 px away behind it
- **P04** walls block sight
- **P05** hearing: a running player is heard through a wall, a crouch-walker at the same spot is not
- **P06** sliding / vaulting / landing are loud events, a standing player is silent
- **P07** exhausted breathing is audible only close by
- **P08** memory: the last known position is used, goes stale, the hound gives up and goes back to roaming
- **P09** no impossible information: a silent player two rooms away leaves no trace in a roaming hound's memory
- **P10** social awareness: a silent second player behind walls is not a threat; a runner approaching is
- **P11** personality: same species, different individuals
- **P12** traversal caps: hounds vault, smilers vault slower, nobody squeezes through wall holes without CAN_USE_TIGHT_GAPS

### s_hound.js
- **H01** bait a lunge and sidestep: a late sidestep beats it, standing still does not
- **H02** no invincibility frames; a slide can pass under a lunge
- **H03** chase outcomes in the long corridor: a fresh runner with a head start lasts, an exhausted one is caught fast
- **H04** lunges start only when in range, roughly aligned and with a clear line
- **H05** poor sharp turning at full speed
- **H06** recovery after a missed lunge
- **H07** every hound state is reached by emergent play
- **H08** searching is logical: starts at the last known position, fans out, does not home in on a quiet crouching player
- **H09** the wall impact only ever happens against a wall that is really there
- **H10** exhausted prey: variant D only for a player with nothing left
- **H11** no repeated identical death selection
- **H12** after a kill: EXCITED, then feeding; an intruder at the body is guarded against and hunted
- **H13** pack instinct
- **H14** far hounds sleep and wake

### s_smiler.js
- **S01** a smiler dropped in the light fades within a moment
- **S02** a flashlight beam makes it fade; it never keeps standing in the beam
- **S03** no teleporting (bounded movement per tick for smilers and hounds)
- **S04** every smiler state arises on its own
- **S05** running provokes a rush (variant A)
- **S06** cornered in a dead end: variant B
- **S07** light failure: rare, only for someone standing in the light, three stages each one closer, then variant C
- **S08** groups are followed, not engaged; a lone player is
- **S09** a blackout makes them bolder
- **S10** "play" style: the victim is held for seconds, then killed (D) or let go

### s_capture.js
- **C01** quick or play depends on the situation
- **C02** CAUGHT is not DEAD: the next major decision comes after a tense stretch
- **C03** false hope
- **C04** interruption / rescue
- **C05** after a quick kill it reads the room
- **C06** the death itself: one kill per life, record, body where the victim fell
- **C07** spawn protection and admin god mode
- **C08** two hunters, one victim: exactly one capture

### s_system.js
- **Y01** level of detail (near / mid / far)
- **Y02** performance for the shipped population and a stress population
- **Y03** snapshot size, nothing private on the wire
- **Y04** stuck entities are recovered
- **Y05** turning and snapping: smooth headings, bounded acceleration
- **Y06** no wall clipping over long emergent runs
- **Y07** no pop-in: smilers only fade, entities spawn out of sight
- **Y08** determinism
- **Y09** population caps and bodies over a long session
- **Y10** bodies persist for the configured time (`BODY_TTL`)

## live.js (real server, two clients)
- **L1** the browser can load the game files but never `ai.js` / `sim.js` / `server.js`
- **L2-L3** both clients get snapshots at about 20 Hz, see each other, and receive byte-identical entity data; nothing internal to the AI is on the wire
- **L4** without the passcode no admin command works, and a living player cannot send a death replay or a corpse
- **L5** the right passcode unlocks admin; the server kills a player (variant chosen server-side), tells everyone, relays the replay and stores one body per player with the light left behind; a living player cannot fake either
- **L6** the AI debug feed goes only to the unlocked admin who switched it on
- **L7** downstream bandwidth per client
- **L8** five wrong passcodes lock attempts for a minute

## move_test.py (Part I, in a browser)
M01 speeds - M02 states - M03 stamina regeneration by state - M04 sprint length - M05 exhaustion never disables a mechanic - M06 recovery - M07 slide length by surface - M08 slides need running speed - M09 no slide-cancel chain - M10 three vault qualities - M11 vault detection and approach angle - M12 crawl through wall holes - M13 under low furniture and window sills - M14 what the server hears

## Layout
- `paths.js` finds the game folder (works inside it and next to a `g/` working tree).
- `harness.js` is the puppet-player world; `tests/lib.js` has the geometry finders and helpers the scenarios share.
