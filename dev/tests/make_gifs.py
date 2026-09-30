"""Turn the frames kept by death_film.py (KEEP=1 STEP=4, one folder per variant) into GIFs: normal speed and 0.25x.
   python3 make_gifs.py /tmp/gif /tmp/gif_out"""
import os, sys, glob
from PIL import Image
src=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True); STEP=int(os.environ.get('STEP','4')); W,H=760,520; cw,ch=380,310
for d in sorted(glob.glob(os.path.join(src,'*/'))):
    name=os.path.basename(d.rstrip('/')); fr=sorted(glob.glob(os.path.join(d,'*_[0-9][0-9][0-9].jpg')))
    if not fr: continue
    ims=[Image.open(f).crop((W//2-cw//2,H//2-ch//2,W//2+cw//2,H//2+ch//2)).convert('P',palette=Image.ADAPTIVE,colors=96) for f in fr]
    dt=STEP/60.0
    for tag,mul in (('normal',1),('0.25x',4)):
        ims[0].save(os.path.join(out,f'{name}_{tag}.gif'),save_all=True,append_images=ims[1:],duration=int(round(dt*mul*1000/10)*10),loop=0,optimize=True)
    print(name,len(ims),'frames',f'{len(ims)*dt:.1f}s of sim time')
