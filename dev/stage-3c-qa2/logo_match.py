#!/usr/bin/env python3
"""Stage 3C QA2 - is the logo on screen the user's file, unaltered? (development only)

  python3 -I dev/stage-3c-qa2/logo_match.py SCREENSHOT.png LOGO.png LEFT TOP WIDTH HEIGHT [--dpr 1]

LEFT TOP WIDTH HEIGHT: the sign box on screen in CSS pixels (#mmTitle). The supplied PNG is composited over black (as a browser
draws it on the black menu), its sign box (x 409..1638, y 410..831 of 2048 x 1152) is resized to the box on screen, and the two are
compared pixel by pixel: mean and 99th-percentile absolute difference per channel, the mean colour of each (a recolour would move
it), and the correlation. Prints JSON."""
import json, sys
from PIL import Image
import numpy as np
shot, logo = sys.argv[1], sys.argv[2]; L, T, W, H = [float(x) for x in sys.argv[3:7]]
dpr = float(sys.argv[sys.argv.index('--dpr') + 1]) if '--dpr' in sys.argv else 1.0
src = Image.open(logo).convert('RGBA')
flat = Image.alpha_composite(Image.new('RGBA', src.size, (0, 0, 0, 255)), src).convert('RGB').crop((409, 410, 1639, 832))
sc = Image.open(shot).convert('RGB')
box = (round(L * dpr), round(T * dpr), round((L + W) * dpr), round((T + H) * dpr))
on = np.asarray(sc.crop(box)).astype(float)
ref = np.asarray(flat.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)).astype(float)
d = np.abs(on - ref)
r = {'box': box, 'meanAbsDiff': round(float(d.mean()), 3), 'p99AbsDiff': round(float(np.percentile(d, 99)), 2),
     'meanColourOnScreen': [round(float(x), 2) for x in on.reshape(-1, 3).mean(axis=0)], 'meanColourOfFile': [round(float(x), 2) for x in ref.reshape(-1, 3).mean(axis=0)],
     'correlation': round(float(np.corrcoef(on.ravel(), ref.ravel())[0, 1]), 4)}
print(json.dumps(r))
