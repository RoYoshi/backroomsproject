# Trial 3 — Skin-Stealer: deferred and gated

Kept from the pack (`10_POST_TRIAL3_DEFERRED.md`) and added by T0's capability matrix. Nothing here is implemented, simulated or
faked in Trial 3.

| Item | Why | Owner decision needed |
|---|---|---|
| Red Rooms lighting redesign | out of scope (pack 10) | separate stage |
| Stronger heartbeat / danger red pulse | out of scope (pack 10) | separate stage |
| Stealing the victim's flashlight; a monster carrying a light | no H.A.N.D.S. item system, no P.O.C.K.E.T. item-id transfer; a monster light would be a second emitter while the real light lies by the corpse | after H.A.N.D.S. / P.O.C.K.E.T. carry real item ids |
| Dragging or hiding a corpse | no server-authoritative corpse interaction; G.I.B. corpses are made at the death's end and keyed by player | after corpse interaction exists |
| Disguised passage through crawlspaces | no LogicZ; the collider is the same in both forms | after LogicZ |
| A generic (unearned) human disguise | would be a mechanic the species has not earned in play | yes: whether to allow it, and when |
| Player health / bleeding | out of scope | separate stage |
| Organic Skin-Stealer population, spawn ecology, director caps | admin-only until approved | yes |

- **The engine's level of detail reads the true nearest-player distance (found at T3/T4, P9 behaviour, not changed).** N.A.N.I. sets every
  creature's tier (near / mid / far: how often it thinks and whether it steers) from the distance to the nearest living player, for all
  three species. It is not an input to any decision of the Skin-Stealer (who it watches, where it goes, whom it strikes), but two worlds
  that differ only in where an unsensed person is can tick the same creature at different rates. Changing the shared LOD is outside
  Trial 3's scope (it would change the Hound's and the Smiler's behaviour); SK15 holds the tier fixed with a watcher, SK23 compares only
  while the tiers agree. Owner decision if it should ever be evidence-based too.
