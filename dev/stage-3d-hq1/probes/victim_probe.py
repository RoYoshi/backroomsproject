"""Stage 3D HQ1 - the victim's own death: its clock and the lights its page hands its lighting (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/probes/victim_probe.py GAME_DIR OUTDIR

Alice dies (Hound A, open room, flashlight on, AUTO-REVIVE off); every 0.7 s: the death's start time against performance.now(),
its elapsed time, active / finished, the corpse id, window.__peerLights and the body list (victim_probe.json)."""
import os, sys, asyncio, json, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import hq1lib as L
from playwright.async_api import async_playwright
GAME = sys.argv[1]; OUT = sys.argv[2]; W, H = 960, 640
async def main():
    port = L.free_port(); srv = L.start_server(GAME, port, OUT + '/vp_server.log'); errs = []; R = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS); ca = await b.new_context(viewport={'width': W, 'height': H})
            A = await L.join(ca, port, 'vp', 'Alice', errs); await L.admin_open(A); await A.wait_for_timeout(1500); await L.ensure_alive(A)
            await L.auto_revive(A, False)
            spot = await A.evaluate(L.lib3d.SPOTS, 'open'); await L.place(A, spot[0], spot[1], spot[2], W, H)
            R['lightOn'] = await A.evaluate("()=>__api.lightOn()")
            await L.preview(A, 'hound', 'A')
            R['start'] = await A.evaluate("()=>({startAt:__api.death().startAt, perf:performance.now()/1000, el:__api.death().elapsed})")
            seq = []
            for i in range(14):
                seq.append(await A.evaluate("()=>{const d=__api.death(); return {t:+(performance.now()/1000).toFixed(2), el:+d.elapsed.toFixed(2), active:d.active, fin:d.finished, corpse:d.corpseId, caught:!!__api.G.caught, peers:(window.__peerLights||[]).map(p=>[Math.round(p.x),Math.round(p.y),p.on,p.dead]), bodies:(__api.bodyList()||[]).map(b=>[String(b.ownerId),!!b.remote,b.lo])}}"))
                await A.wait_for_timeout(700)
            R['seq'] = seq
            await b.close()
    finally:
        L.stop_server(srv)
    json.dump(R, open(OUT + '/victim_probe.json', 'w'), indent=1); print(json.dumps(R)[:400])
asyncio.run(main())
