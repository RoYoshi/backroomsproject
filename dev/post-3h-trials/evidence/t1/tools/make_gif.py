# T1 evidence (scratch): the capture's frames as animated GIFs, each frame shown for the time it really lasted: the title at 1:1, and a
# 4x enlargement of its upper-left corner (where a 3 px drift is easiest to see).  usage: make_gif.py <capture dir> <out dir>
import json, sys, pathlib
from PIL import Image, ImageDraw
C, O = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); O.mkdir(parents=True, exist_ok=True)
R = json.loads((C / 't1_capture_frames.json').read_text()); F = R['frames']['new']
ims = [Image.open(C / f['file']).convert('RGB') for f in F]
durs = [max(40, F[i + 1]['ms'] - F[i]['ms']) for i in range(len(F) - 1)] + [1000]
def save(frames, name):
    p = [im.convert('P', palette=Image.ADAPTIVE, colors=128) for im in frames]
    p[0].save(O / name, save_all=True, append_images=p[1:], duration=durs, loop=0, optimize=True)
lab = []
for im, f in zip(ims, F):
    a = im.copy(); d = ImageDraw.Draw(a); d.text((8, 6), f"Trial 1  t={f['ms']/1000:5.1f} s  offset x {f['x']:+.2f} px, y {f['y']:+.2f} px", fill=(200, 190, 150)); lab.append(a)
save(lab, 't1_title_drift_capture.gif')
w, h = ims[0].size; box = (int(w * .12), int(h * .18), int(w * .12) + 120, int(h * .18) + 60)
zoom = []
for im, f in zip(ims, F):
    z = im.crop(box).resize((480, 240), Image.NEAREST); d = ImageDraw.Draw(z); d.text((6, 4), f"4x  t={f['ms']/1000:5.1f} s", fill=(200, 190, 150)); zoom.append(z)
save(zoom, 't1_title_drift_capture_4x.gif')
print(len(F), 'frames;', sum(durs) / 1000, 's')
