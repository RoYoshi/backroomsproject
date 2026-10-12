import os, sys, asyncio, json, time, statistics
sys.path.insert(0, '/home/claude/backrooms-shadows/dev/stage-3d')
import lib3d
from playwright.async_api import async_playwright
GAME = os.path.abspath(sys.argv[1]); OUT = sys.argv[2]; T = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
FR = """()=>{ if(window.__pf) return; const f=window.__pf={on:false,last:0,d:[]}; const L=t=>{ if(f.on){ if(f.last) f.d.push(t-f.last); f.last=t; } requestAnimationFrame(L) }; requestAnimationFrame(L) }"""
async def meas(P, secs=5):
    await P.evaluate("()=>{__pf.d=[];__pf.last=0;__pf.on=true}"); await P.wait_for_timeout(int(secs*1000))
    d = await P.evaluate("()=>{__pf.on=false; return __pf.d}"); return round(statistics.median(d), 1) if d else None, len(d)
STATS = """()=>{ const D=__api.death(); let n=0, vis=0, gi=0, cached=0; const walk=(o,v)=>{ n++; const vv=v&&o.visible!==false; if(vv) vis++; if(o.context&&o.context.instructions) gi+=o.context.instructions.length; else if(o.geometry&&o.geometry.graphicsData) gi+=o.geometry.graphicsData.length; if(o.isCachedAsTexture||o._cacheAsTexture||(o.renderGroup&&o.isRenderGroup)) cached++; for(const c of (o.children||[])) walk(c,vv) };
  const roots={blood:D.blood, foreground:D.foreground, debris:D.debris}; const out={};
  for(const k in roots){ n=0;vis=0;gi=0;cached=0; if(roots[k]) walk(roots[k],true); out[k]={n,vis,gi,cached,visible:roots[k]&&roots[k].visible} }
  out.t=D.elapsed; out.state=D.settle; return out }"""
async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(GAME, port, OUT + '.server.log'); errs = []; R = {'game': GAME, 't': T}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS); ca = await b.new_context(viewport={'width': 1280, 'height': 720})
            A = await lib3d.join(ca, port, 'attr', 'Alice', errs); await lib3d.admin_open(A); await A.evaluate(FR)
            sp = await A.evaluate(lib3d.SPOTS, 'open'); await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", sp); await A.wait_for_timeout(2500)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            R['idle'] = await meas(A)
            await A.evaluate("()=>{const L=window.__dlab||(window.__dlab={on:false,paused:false,speed:1,step:0,xray:false,viz:false}); L.on=true; L.paused=true; L.step=0}")
            await A.keyboard.press('Backquote'); await A.wait_for_timeout(300); await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
            await lib3d.click(A, '[data-c=preview][data-k=hound][data-var=A]')
            for _ in range(200):
                if await A.evaluate("()=>__api.G.caught && __api.death().active"): break
                await A.wait_for_timeout(50)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            await A.evaluate(f"()=>{{window.__dlab.step={int(T*60)}}}"); await A.wait_for_timeout(3000)
            R['stats'] = await A.evaluate(STATS)
            R['paused'] = await meas(A)
            for lay in ('blood', 'debris', 'foreground'):
                await A.evaluate(f"()=>{{__api.death().{lay}.visible=false}}"); await A.wait_for_timeout(800)
                R['no_' + lay] = await meas(A)
                await A.evaluate(f"()=>{{__api.death().{lay}.visible=true}}")
            R['paused_again'] = await meas(A)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    R['errors'] = errs[:5]; json.dump(R, open(OUT, 'w'), indent=1); print(json.dumps(R))
asyncio.run(main())
