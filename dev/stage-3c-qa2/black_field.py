#!/usr/bin/env python3
"""Stage 3C QA2 - does the field around the menu read as black? (development only)

  python3 -I dev/stage-3c-qa2/black_field.py SCREENSHOT.png BOXES_JSON [--dpr 1] [--limit 8]

BOXES_JSON: a JSON list of [left, top, right, bottom] boxes in CSS pixels (the menu's own parts: the logo's sign box, the rails, PLAY
and its row, the footer, an open panel), which are left out. Every other pixel is the field: prints JSON with the share of field
pixels brighter than LIMIT (any channel, 0-255), the brightest field pixel, and the field's mean. Level 0 behind the menu would be
far brighter than the limit (its lit carpet and walls are around 60-120)."""
import json, sys
from PIL import Image
import numpy as np
shot, boxes = sys.argv[1], json.loads(sys.argv[2])
dpr = float(sys.argv[sys.argv.index('--dpr') + 1]) if '--dpr' in sys.argv else 1.0
lim = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else 8
a = np.asarray(Image.open(shot).convert('RGB')).astype(int)
mask = np.ones(a.shape[:2], bool)
for l, t, r, b in boxes:
    mask[max(0, int(t * dpr)):max(0, int(b * dpr) + 1), max(0, int(l * dpr)):max(0, int(r * dpr) + 1)] = False
mx = a.max(axis=2)[mask]
print(json.dumps({'fieldPixels': int(mask.sum()), 'shareAboveLimit': round(float((mx > lim).mean()), 6), 'brightest': int(mx.max()) if mx.size else None,
                  'mean': round(float(a[mask].mean()), 3) if mx.size else None, 'limit': lim}))
