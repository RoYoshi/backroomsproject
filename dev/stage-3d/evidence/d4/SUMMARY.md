# D4: authoritative shared aftermath, spectators, late join, disconnect

The full protocol is in `STAGE_3D_DEATH_AUTHORITY_AND_PROTOCOL.md`. In short, the server owns each death from kill to corpse:
- one death id;
- one replay sent by the server;
- the victim starting from the server's own record;
- the corpse made by the server at the death's end.

Changed files:
- `server.js`: `aftStart`, `aftSend`, `aftTick`, the `fx`/`b` handlers and the revive cancel.
- `dev/sim_glue.js` → `sim.js`: `worldSeq`, a counter of world resets.
- `mp.js`: `__dvic`, no death `fx`/`b`, dedupe by `de`, `el`, `end`, own corpse hidden while dying.
- `dphys.js`: knock and drag limits in walk mode.
- the bundle: one hook in the death class's `start`.

Results:
- **`parity_d4.json`:** all eight, at normal speed in real browsers. Victim against server and spectator against server:
  - body ≤ 0.41 px, light ≤ 0.68 px, hands and hat 0;
  - blood: same seeds, ≤ 0.55 px;
  - the client sends nothing.
- **`death_net_d4.json`:** 16/16. The parent (`death_net_parent.log`) passes 6/16.
- **golden3d:** every difference starts in the death domain. Non-death output is identical, except one follow-on in `deaths`: identical up to the first killer hand-back at 5.9 s, then the released hound goes on differently.
- **Existing suites:**
  - `ir_net` passes.
  - `audit_net` 16/17, `audit_net2` 10/11, `live`: 3 checks fail. The five failing checks assert the parent protocol and are superseded by `death_net` (mapping in the protocol document). All their other checks pass.
- **Film:** `film/sheet_*.jpg`, parent and D4 block by block.
- **`corpse_*/`:** hand-over, drying, culling and late joiner. In the admin death lab preview the admin stands up again next to its corpse; that figure is in the pictures, in the parent's too.
