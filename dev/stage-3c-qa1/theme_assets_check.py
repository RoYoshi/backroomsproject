#!/usr/bin/env python3
"""Stage 3C QA1 - the main-menu theme files, checked against MAIN_MENU_THEME_LOCK.md (development only).

  python3 dev/stage-3c-qa1/theme_assets_check.py [--out FILE.json]      (in the repository)

The source (audio_source/MainTheme.wav) and the two playback derivatives (assets/MainTheme_MenuIntro.wav, assets/
MainTheme_MenuLoop.wav) must be byte-identical to the user's files (SHA-256 from the lock). The derivatives are read as PCM-24:
rate, channels, frame counts and durations; peaks and RMS; the jump at the Intro->Loop handoff and at the Loop's own seam
(last frame -> first frame) against the ordinary sample-to-sample motion around them. The player's cache version string in
assets/ui.js (THEME.v) must be the first 8 hex digits of each derivative's SHA-256, so a new file never plays from an old cache."""
import hashlib, json, re, sys, wave, os
import numpy as np
LOCK = {'audio_source/MainTheme.wav': 'ba087949275af24c7ceb4c927c5b2ba64ede448a850dd6ecd1be968763af4fa8',
        'assets/MainTheme_MenuIntro.wav': '64b2124ba6970b36284802e9fdf53b3ba373b665dc6bccce95bd3895a5b6fbd0',
        'assets/MainTheme_MenuLoop.wav': '848db3af81c7bd023b3e32e68f39fd83ed835232ecf8fc44278b2c232ca158b9'}
EXPECT = {'assets/MainTheme_MenuIntro.wav': (1357824, 30.789660), 'assets/MainTheme_MenuLoop.wav': (2416640, 54.799093)}
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
def pcm(p):
    w = wave.open(p, 'rb'); n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    raw = np.frombuffer(w.readframes(n), dtype=np.uint8)
    assert sw == 3, 'expected PCM-24'
    a = raw.reshape(-1, 3).astype(np.int32); v = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16); v = np.where(v >= 1 << 23, v - (1 << 24), v)
    return (v / float(1 << 23)).reshape(-1, ch), sr, sw * 8
def main():
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    R = {'files': {}, 'checks': []}
    ck = lambda name, ok, note=None: R['checks'].append({'name': name, 'ok': bool(ok), 'note': note})
    for p, h in LOCK.items():
        got = sha(p); R['files'][p] = {'sha256': got, 'bytes': os.path.getsize(p)}
        ck(p + ' is the user\'s file (SHA-256 as locked)', got == h, got)
    X = {}
    for p, (frames, dur) in EXPECT.items():
        x, sr, bits = pcm(p); X[p] = x
        rms, peak = float(np.sqrt((x ** 2).mean())), float(np.abs(x).max())
        R['files'][p].update({'rate': sr, 'bits': bits, 'channels': x.shape[1], 'frames': x.shape[0], 'seconds': round(x.shape[0] / sr, 6),
                              'peakDbfs': round(20 * np.log10(peak), 2), 'rmsDbfs': round(20 * np.log10(rms), 2)})
        ck(p + ': 44.1 kHz, stereo, PCM-24, %d frames (%.6f s)' % (frames, dur), sr == 44100 and x.shape[1] == 2 and bits == 24 and x.shape[0] == frames and abs(x.shape[0] / sr - dur) < 1e-6)
    I, L = X['assets/MainTheme_MenuIntro.wav'], X['assets/MainTheme_MenuLoop.wav']
    loc = lambda a, i0, n=2000: float(np.sqrt(((a[i0 + 1:i0 + 1 + n] - a[i0:i0 + n]) ** 2).mean()))
    j1, j2 = float(np.sqrt(((L[0] - I[-1]) ** 2).mean())), float(np.sqrt(((L[0] - L[-1]) ** 2).mean()))
    near = {'loopStart': loc(L, 0), 'loopEnd': loc(L, len(L) - 2002), 'introEnd': loc(I, len(I) - 2002)}
    R['seams'] = {'introToLoopJumpRms': round(j1, 8), 'loopEndToStartJumpRms': round(j2, 8), 'adjacentSampleRms': {k: round(v, 8) for k, v in near.items()}}
    ck('Intro -> Loop handoff: the jump is no bigger than the ordinary sample-to-sample motion there', j1 <= max(near['introEnd'], near['loopStart']), R['seams'])
    ck('Loop seam (last frame -> first frame): the jump is no bigger than the ordinary sample-to-sample motion there', j2 <= max(near['loopEnd'], near['loopStart']), R['seams'])
    v = re.search(r"v: '([0-9a-f]{8})\.([0-9a-f]{8})'", open('assets/ui.js', encoding='utf-8').read())
    ck("the player's cache version (assets/ui.js THEME.v) names these exact files", v and v.group(1) == LOCK['assets/MainTheme_MenuIntro.wav'][:8] and v.group(2) == LOCK['assets/MainTheme_MenuLoop.wav'][:8], v and v.group(0))
    R['ok'] = all(c['ok'] for c in R['checks'])
    for c in R['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'])
    s = json.dumps(R, indent=1); print(s if not out else 'written ' + out)
    if out: open(out, 'w').write(s + '\n')
    return 0 if R['ok'] else 1
if __name__ == '__main__': sys.exit(main())
