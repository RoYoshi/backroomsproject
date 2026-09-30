"""Audit remediation: the server's fallback corpse is the same physical death the victim's own browser plays.
   A real browser dies (admin DEATHS preview, the real kill path) for each hound / smiler variant.  Its own replay message ('fx': every input of
   the death) and its own corpse message ('b') are captured on the wire; the server's fallback (death_srv.js) is then run on the same inputs and
   the two corpses compared: where the body lies, how it is turned, where the dropped light is.
   python3 fallback_parity.py [outdir]   -> prints JSON, exit code 1 if they disagree"""
import os, tempfile, sys, asyncio, subprocess, time, json
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=int(os.environ.get('PORT','9357')); OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(tempfile.gettempdir(),'fallback_parity'); os.makedirs(OUT,exist_ok=True)
HOOK="""(()=>{ window.__sent=[]; const S=WebSocket.prototype.send; WebSocket.prototype.send=function(d){ try{ const m=JSON.parse(d); if(m.t==='fx'||m.t==='b') window.__sent.push(m); }catch{} return S.call(this,d); }; })()"""
NODE=r"""
const path=require('path'), G=process.argv[1], D=require(path.join(G,'death_srv.js')), sim=require(path.join(G,'sim.js'))({seed:1});
const pairs=JSON.parse(require('fs').readFileSync(0,'utf8')), out=[];
for (const {fx,b} of pairs) {
  const kill={k:fx.c,v:fx.v,x:fx.x,y:fx.y,a:fx.a,ax:fx.sx,ay:fx.sy,w:fx.w||0}, info={name:'X',look:fx.lk,ek:fx.ek,ec:fx.ec,ep:fx.ep||'',vx:fx.vx,vy:fx.vy,ex:fx.ex,light:true};
  const s=D.bodyFor(1,kill,info,sim).body;
  // the browser takes its corpse on the first frame at or after the end of the death; at a low frame rate that is up to a frame later, and a light
  // still sliding has moved on a little.  So the light is also compared with the same simulation a little past the end (up to 0.3 s).
  const R=D.DP.simulate({kind:kill.k,v:kill.v,w:kill.w,victim:{x:kill.x,y:kill.y,angle:kill.a},src:{x:kill.ax,y:kill.ay},vx:info.vx,vy:info.vy,exhausted:!!info.ex,eqKind:info.ek,hat:String(info.look).split('|')[0],walls:(x,y)=>sim.blockersAt(x,y),clear:(x,y,r)=>sim.clearAt(x,y,r)});
  let late=1e9, lateT=0; for (let k=0;k<=15;k++){ const t=R.dur+k*.02; D.DP.advance(R.S,t); const m=D.DP.remains({ph:R.S}); const d=Math.hypot(m.dropped.x-b.dr[0],m.dropped.y-b.dr[1]); if(d<late){late=d;lateT=k*.02} }
  out.push({v:fx.c+' '+fx.v, body:Math.round(Math.hypot(s.x-b.x,s.y-b.y)), turn:+Math.abs(Math.atan2(Math.sin(s.a-b.a),Math.cos(s.a-b.a))).toFixed(3), light:Math.round(Math.hypot(s.dr[0]-b.dr[0],s.dr[1]-b.dr[1])), lightLate:Math.round(late), lateBy:+lateT.toFixed(2), client:[b.x,b.y], server:[s.x,s.y]});
}
console.log(JSON.stringify(out));
"""
async def main():
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=open(os.path.join(OUT,'server.log'),'w'),stderr=subprocess.STDOUT); time.sleep(1.2)
    pairs=[]; errs=[]
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS)
            c=await b.new_context(viewport={'width':480,'height':320}); A=await c.new_page()
            A.on('pageerror',lambda e:errs.append(str(e)[:300]))
            await A.add_init_script(HOOK)
            await A.goto(f'http://localhost:{PORT}/?room=parity'); await A.wait_for_timeout(2200); await A.fill('#name','Alice')
            await A.evaluate("document.getElementById('enter').click(); __net.testAuth('smoor')"); await A.wait_for_timeout(4500)
            click=lambda sel: A.evaluate("s=>{const e=document.querySelector(s); if(e){e.click(); return true} return false}",sel)
            await A.keyboard.press('Backquote'); await A.fill('#admPass','smoor'); await A.keyboard.press('Enter'); await A.wait_for_timeout(1200)
            await click('[data-a=tab][data-t=monsters]')
            for i in range(4): await click('[data-c=hounds][data-mode=remove]'); await A.wait_for_timeout(80)
            for i in range(6): await click('[data-c=smilers][data-mode=remove]'); await A.wait_for_timeout(80)
            await click('[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            for kind,var in [('hound','A'),('hound','B'),('hound','C'),('hound','D'),('smiler','A'),('smiler','B')]:
                await click('[data-a=place][data-w=open]'); await A.wait_for_timeout(900)
                n0=await A.evaluate("()=>window.__sent.length")
                await click(f'[data-c=preview][data-k={kind}][data-var={var}]')
                for k in range(60):
                    await A.wait_for_timeout(500)
                    got=await A.evaluate("(n)=>window.__sent.slice(n)", n0)
                    fx=next((m for m in got if m['t']=='fx' and m.get('k')=='death'),None); bb=next((m for m in got if m['t']=='b'),None)
                    if fx and bb: pairs.append({'fx':fx,'b':bb}); break
                await A.evaluate("()=>{ const G=__api.G; if(G.caught) document.getElementById('retry').click() }"); await A.wait_for_timeout(1500)
                if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                await click('[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(200)
            await b.close()
    finally: srv.terminate()
    r=subprocess.run(['node','-e',NODE,ROOT],input=json.dumps(pairs),capture_output=True,text=True)
    res=json.loads(r.stdout or '[]') if r.returncode==0 else []
    ok=len(res)>=4 and all(x['body']<=12 and x['turn']<.2 and (x['light']<=20 or x['lightLate']<=20) for x in res) and not errs
    print(json.dumps({'deaths':len(res),'compare':res,'node_err':r.stderr[-300:],'errors':errs,'ok':ok})); sys.exit(0 if ok else 1)
asyncio.run(main())
