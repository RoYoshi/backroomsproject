"""Renders every entity / capture sound offline (OfflineAudioContext) and measures it: audible, not clipping, no clicks, dies away, plausible spectrum.
   python3 audio_test.py     (starts its own server)"""
import os
_HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=next(p for p in (os.path.join(_HERE,'..','..','g'),os.path.join(_HERE,'..','..')) if os.path.exists(os.path.join(p,'server.js')))
import asyncio, subprocess, time, base64, sys, wave
import numpy as np
from playwright.async_api import async_playwright
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']
PORT=8976
SR=44100
JS=r"""
async (names) => {
  const E = window.__ents, A = __api, H = A.H, SR = 44100, out = {};
  const cues = {
    hound_growl: () => E.houndVoice(H.x + 150, H.y, 'growl', .9),
    hound_guard: () => E.houndVoice(H.x + 150, H.y, 'guard', .9),
    hound_snarl: () => E.houndVoice(H.x + 120, H.y, 'snarl', .9),
    hound_lungecue: () => E.houndVoice(H.x + 200, H.y, 'lungecue', .9),
    hound_kill: () => E.houndVoice(H.x + 90, H.y, 'kill', 1),
    hound_step: () => E.houndStep(H.x + 200, H.y, 300, 0),
    hound_breath_hard: () => E.houndBreath(H.x + 160, H.y, 1),
    hound_breath_idle: () => E.houndBreath(H.x + 160, H.y, 0),
    hound_scrape: () => E.houndScrape(H.x + 100, H.y),
    smiler_form: () => { E.smilerVoice(H.x + 200, H.y, 'form'); E.smilerVoice(H.x + 200, H.y, 'click'); },
    smiler_rush: () => E.smilerVoice(H.x + 200, H.y, 'rush'),
    lamp_out: () => E.smilerVoice(H.x + 200, H.y, 'blackout'),
    knock: () => E.sfxKnock(), gasp: () => E.sfxGasp(), release: () => E.sfxRelease(),
    hound_far: () => E.houndVoice(H.x + 900, H.y, 'growl', 1),
    hound_left: () => E.houndVoice(H.x - 300, H.y, 'growl', .9),
  };
  const real = A.audio;
  for (const name of names) {
    const ctx = new OfflineAudioContext(2, SR * 2.6, SR); const gain = ctx.createGain(); gain.connect(ctx.destination);
    A.audio = () => ({ context: ctx, gain }); try { cues[name](); } finally { A.audio = real; }      // only the cue itself is scheduled onto the offline context
    const buf = await ctx.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const f = new Float32Array(L.length * 2); f.set(L, 0); f.set(R, L.length);
    let s = ''; const u8 = new Uint8Array(f.buffer); for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    out[name] = btoa(s);
  }
  return out;
}
"""
def analyse(name,b64):
    a=np.frombuffer(base64.b64decode(b64),dtype=np.float32); n=len(a)//2; L=a[:n]; R=a[n:]; m=np.maximum(np.abs(L),np.abs(R))
    pk=float(m.max()); 
    if pk<1e-4: return dict(name=name,ok=False,why='SILENT',peak=pk)
    thr=max(pk*.02,.0015); idx=np.nonzero(m>thr)[0]; on=idx[0]/SR; off=idx[-1]/SR
    span=slice(idx[0],idx[-1]+1); x=(L+R)[span]/2
    rms=float(np.sqrt(np.mean(x**2)))
    # clicks / abrupt cuts: the level in 10 ms windows (hop 5 ms) must never jump by more than ~14 dB from one window to the next (after the very start) while it is above 5% of the peak
    W=int(.010*SR); H_=int(.005*SR); k=(len(x)-W)//H_; rm=np.array([np.sqrt(np.mean(x[i*H_:i*H_+W]**2)) for i in range(max(k,0))])+1e-9; big=0.0
    for i in range(3,len(rm)):
        a_,b_=rm[i-1],rm[i]
        if max(a_,b_)>.05*pk*.7: big=max(big,max(b_/a_,a_/b_))
    click=float(big)
    # tail: what is left 25 ms before the end of the audible span, relative to the peak (must have faded well down, not be cut)
    e=idx[-1]; tail=float(m[max(0,e-int(.025*SR)):e+1].max()/pk)
    # spectral centroid
    w=np.hanning(len(x)); sp=np.abs(np.fft.rfft(x*w)); fr=np.fft.rfftfreq(len(x),1/SR); cen=float((sp*fr).sum()/max(sp.sum(),1e-9))
    lr=float(np.sqrt(np.mean(L[span]**2))/max(np.sqrt(np.mean(R[span]**2)),1e-9))
    return dict(name=name,ok=True,peak=round(pk,3),rms=round(rms,4),on=round(on,3),len=round(off-on,2),click=round(click,3),tail=round(tail,3),centroid=int(cen),LR=round(lr,2))
async def main():
    subprocess.run(['fuser','-k',f'{PORT}/tcp'],stderr=subprocess.DEVNULL)
    srv=subprocess.Popen(['node','server.js',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT); time.sleep(1.2)
    bad=0
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=ARGS); c=await b.new_context(viewport={'width':800,'height':500}); pg=await c.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
            await pg.goto(f'http://localhost:{PORT}/'); await pg.wait_for_timeout(2500); await pg.fill('#name','T'); await pg.evaluate("document.getElementById('enter').click()"); await pg.wait_for_timeout(4500)
            await pg.evaluate("()=>__api.tp(5000,3504)"); await pg.wait_for_timeout(500)
            names=['hound_growl','hound_guard','hound_snarl','hound_lungecue','hound_kill','hound_step','hound_breath_hard','hound_breath_idle','hound_scrape','smiler_form','smiler_rush','lamp_out','knock','gasp','release','hound_far','hound_left']
            res=await pg.evaluate(JS,names); rows=[]
            for nme in names:
                r=analyse(nme,res[nme]); rows.append(r)
                if r['ok']:
                    flags=[]
                    if r['peak']>.98: flags.append('CLIPS')
                    if r['click']>5: flags.append('CLICK/CUT')
                    if r['len']>.15 and r['tail']>.12: flags.append('CUTS OFF')
                    if r['centroid']<90: flags.append('SUB-BASS ONLY')
                    r['flags']=flags
                    if flags: bad+=1
                else: bad+=1
                print(r)
            wav=lambda nme,b64: None
            print('page errors',errs); 
            await b.close()
    finally: srv.terminate()
    print('\nRESULT', 'OK' if not bad else f'{bad} PROBLEM(S)')
    sys.exit(1 if bad else 0)
asyncio.run(main())
