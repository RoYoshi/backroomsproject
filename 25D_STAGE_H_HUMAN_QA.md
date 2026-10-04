# Stage H human-QA handoff

**Engineering complete. HUMAN QA PENDING.** The user is the final gameplay/design authority. Stage I is not begun and main was not modified or merged.

Extract `THE_FAR_BACKROOMS_STAGE_H_FINAL.zip` and open a terminal in `thefarbackrooms-level0`. Node >=18 is the product declaration; engineering evidence used Node v24.19.0. Normal Level 0: `node server.js 3000`, then open `http://localhost:3000/`. Verify familiar movement, camera, lighting, Hound/Smiler behavior, multiplayer and death feel.

For the authorized spatial QA fixture, create its world file:

```bash
node -e "require('fs').writeFileSync('stage-h-world.json',JSON.stringify(require('./dev/stage_e/fixture').fixture(),null,2))"
```

Choose a local admin passcode, then launch on Linux/macOS:

```bash
TFB_WORLD="$PWD/stage-h-world.json" ADMIN_PASSCODE="your-local-test-passcode" node server.js 3000
```

Open `http://localhost:3000/?room=stage-h-qa` in two separate browser profiles/private sessions. This uses the REAL production page and accepted fixture; Stage H does not supply a new stacked Level 0 layout. The default runtime deliberately remains flat.

For precise placements in a local QA session, open the browser console after entering the room. Capture the page's next real outbound socket call, then authenticate using your chosen passcode:

```javascript
await new Promise(resolve => {
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (...args) {
    WebSocket.prototype.send = send;
    window.stageHQASocket = this;
    send.apply(this, args);
    resolve();
  };
});
stageHQASocket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.t === 'admin' || m.t === 'ares') console.log(m);
});
__net.testAuth('your-local-test-passcode');
```

Confirm the logged admin response has `ok: true`. Define this console-only helper; it uses the existing authenticated epoch/life/ack command path, pausing local input while proposals drain:

```javascript
window.stageHCommand = async function (command) {
  const paused = __api.paused();
  if (!paused) document.querySelector('#help').click();
  await new Promise(r => setTimeout(r, 300));
  const p = __net.spatialState().pose;
  const reply = new Promise(resolve => {
    const listener = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'ares') {
        stageHQASocket.removeEventListener('message', listener);
        resolve(m);
      }
    };
    stageHQASocket.addEventListener('message', listener);
  });
  stageHQASocket.send(JSON.stringify({t:'a', ...command,
    worldEpoch:p.worldEpoch, life:p.generation, ack:p.discontinuity}));
  const result = await reply;
  if (!paused) __api.unpause();
  if (!result.ok) throw Error(result.msg);
  return result;
};
await stageHCommand({c:'spatial-tp',pose:{x:160,y:160,z:180,support:'support:upper-west'}});
```

Use `{x:160,y:160,z:0,support:'support:ground-north'}` for the lower client. Optional existing QA commands include `{c:'freeze',on:1}`, `{c:'spatial-entity',kind:'hound',pose:{x:220,y:160,z:0,support:'support:ground-north'}}` and `{c:'preview',k:'hound',var:'B'}`. Resume monster thinking with `{c:'freeze',on:0}`. These are local QA tools, not new gameplay permissions; do not change physics to obtain a placement.

| Area | Human checks |
|---|---|
| Traversal | Ramp/stair ascent, departure and fall are readable and continuous; no floor snap or slab passage. |
| Two clients | Same XY above/below; each cutaway is independent. Changing one view cannot reveal state to the other. |
| Cutaway | Only eligible overhead groups fade; boundary movement avoids flicker and does not make material physically disappear. |
| Leaks | Hide Hounds/Smilers, eyes/faces, corpse/hands, gear/hat, decals/trails/replays and beams behind slabs/walls. Any revealing fragment is FAIL. |
| Light/IR | Flashlight/headlamp/lantern through real openings versus intact slabs; OFF has no aura; LOW/HIGH NV and detached light agree with physical XYZ. |
| Aim | Nearest physically visible face/actor is selected; hidden same-screen targets stay rejected; fade grants no reach through geometry. |
| View options | 16:9/16:10/ultrawide, high DPR, UI 0.5–2, full/reduced detail, NV and 2×/4× zoom. No extra world knowledge. |
| Art and aftermath | Rounded player body and two hands retained; canonical corpse/equipment/replay depth and caught UI feel coherent. |
| Flat control | Accepted G feel, timing, camera, map, lighting and deaths remain familiar. |

Settings → Customize → World View controls local cutaway and full/reduced detail. Hardware performance needs your browser/GPU observations: the engineering SwiftShader run misses 16.7 ms, and full-quality two-client capture missed an airborne phase. Reduced detail passed that capture, but no smooth hardware profile is certified. Known aggregate eleven failures/shared F22/P08 UNKNOWN and Stage G's active-aftermath capacity limit remain disclosed.

For each discrepancy record source commit, browser/GPU, viewport/DPR, UI/detail/NV/zoom, client count, world placement and exact steps, plus screenshot/video if useful. Automated gates prove the tested invariants; they do not decide readability, fear, camera comfort or death feel. Stop at H pending your QA.
