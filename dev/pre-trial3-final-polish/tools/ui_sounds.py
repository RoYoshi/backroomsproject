#!/usr/bin/env python3
"""dev/pre-trial3-final-polish/tools/ui_sounds.py - pre-Trial 3 polish P7: the interface's placeholder sounds.

    python3 -I -B dev/pre-trial3-final-polish/tools/ui_sounds.py make  [--work DIR] [--out FILE.json]
    python3 -I -B dev/pre-trial3-final-polish/tools/ui_sounds.py check [--work DIR] [--out FILE.json]

Seven short sounds, synthesized here from sine waves, simple envelopes and seeded noise - nothing sampled, nothing copied from any
game or library.  They are placeholders: Mariikyu (the game's sound designer) can replace any of them with a file of the same name in
public/assets/ (dev/pre-trial3-final-polish/SOUND_ASSETS.md says how; the web server serves only files directly in public/assets/, so
they sit there, named ui_*.mp3, beside the menu's music).  Each is mono, 44.1 kHz (the menu's audio context runs at that rate, so
nothing is resampled), faded in and out so it starts and ends on silence, and mastered at its intended loudness relative to the
others (the hover tick quietest); the game applies only the UI volume, the master volume and SOUND ON/OFF on top.

make:  renders each sound (deterministic: the same numbers every run), writes it as 16-bit WAV in the work folder, encodes it to MP3
       with ffmpeg's libmp3lame (96 kbit/s CBR, no ID3 tags, the LAME header kept so decoders trim the encoder's padding) into
       public/assets/ui_*.mp3, decodes the MP3 back and records what it holds (the inventory: name, file, bytes, sha256, duration,
       peak, RMS, first and last samples, the render's own hash).
check: renders again and decodes the committed MP3s: each render's hash equals the inventory's (the recipe did not drift), each file
       is the one inventoried (sha256), decodes to mono 44.1 kHz of the right length (within the codec's frame), peaks below -6 dBFS,
       starts and ends near silence (no click), and no other ui_*.mp3 is in public/assets/.
Exit 0 only when every sound passes.  Needs numpy and ffmpeg (libmp3lame); fails plainly if either is missing - it never writes a
file that is not what its name says.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, wave

import numpy as np

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT_DIR = os.path.join(REPO, 'public', 'assets')
INVENTORY = os.path.join(REPO, 'dev', 'pre-trial3-final-polish', 'SOUND_ASSETS.json')
SR = 44100
BITRATE = '96k'


def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def env(t, attack, decay):
    """a soft attack (1 - e^-t/a) and an exponential decay"""
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay)


def lowpass(x, hz):
    """one-pole low-pass"""
    a = np.exp(-2 * np.pi * hz / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def lowpass2(x, hz):
    """two one-pole low-passes in a row (12 dB an octave): noise that is a breath, not a hiss"""
    return lowpass(lowpass(x, hz), hz)


def tail(x, s=0.01):
    """a part's own raised-cosine fade-out, so a part never ends on a step (a click) when it is laid over another"""
    x = x.copy()
    n = max(1, int(s * SR))
    x[-n:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n))
    return x


def tone(t, hz, glide_to=None, glide_s=None):
    """a sine whose pitch may slide (exponentially) from hz to glide_to over glide_s seconds"""
    if glide_to is None:
        return np.sin(2 * np.pi * hz * t)
    k = np.clip(t / glide_s, 0, 1)
    f = hz * (glide_to / hz) ** k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def place(total, part, at):
    """add part into total starting at `at` seconds"""
    i = int(round(at * SR))
    n = min(len(part), len(total) - i)
    total[i:i + n] += part[:n]
    return total


def finish(x, peak_db, fade_in=0.0015, fade_out=0.008):
    """fades (raised cosine) at both ends, then scaled so the peak is peak_db dBFS"""
    x = x.astype(np.float64).copy()
    n_in, n_out = max(1, int(fade_in * SR)), max(1, int(fade_out * SR))
    x[:n_in] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n_in))
    x[-n_out:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n_out))
    x[-1] = 0.0
    p = np.max(np.abs(x))
    return x * (10 ** (peak_db / 20) / p) if p > 0 else x


def hover():
    # a faint high tick: two partials, gone in a few milliseconds
    t = t_axis(0.045)
    x = (tone(t, 1760) + 0.3 * tone(t, 2637)) * env(t, 0.0008, 0.009)
    return finish(x, -24, fade_out=0.006)


def click():
    # a soft "tok": a sine dropping slightly in pitch, a fifth above it, and a breath of filtered noise at the front
    rng = np.random.default_rng(7)
    t = t_axis(0.11)
    body = (tone(t, 880, 800, 0.02) + 0.35 * tone(t, 1320, 1200, 0.02)) * env(t, 0.0015, 0.026)
    noise = lowpass2(rng.standard_normal(len(t)), 2600) * env(t, 0.0005, 0.004) * 1.4
    return finish(body + noise, -12)


def back():
    # a short downward glide with a little air: going back, closing a panel
    rng = np.random.default_rng(11)
    t = t_axis(0.16)
    body = (tone(t, 900, 480, 0.11) + 0.18 * tone(t, 1800, 960, 0.11)) * env(t, 0.004, 0.045)
    air = lowpass2(rng.standard_normal(len(t)), 1500) * env(t, 0.003, 0.03) * 0.6
    return finish(body + air, -13)


def blips(first, second):
    t = t_axis(0.15)
    out = np.zeros(len(t))
    for at, hz in ((0.0, first), (0.052, second)):
        tt = t_axis(0.09)
        b = (tone(tt, hz) + 0.12 * tone(tt, hz * 3)) * env(tt, 0.0025, 0.022)
        place(out, tail(b), at)
    return out


def toggle_on():
    # two soft blips, rising a fifth (C5 to G5)
    return finish(blips(523.25, 783.99), -13)


def toggle_off():
    # the same two blips, falling (G5 to C5), a touch quieter
    return finish(blips(783.99, 523.25), -14)


def open_():
    # a panel opening: a low hum that beats slowly against itself (196 Hz against 199 Hz - the uncanny part, like a tube warming),
    # its fifth, a swell of filtered noise, and two faint ticks as if a light caught
    rng = np.random.default_rng(23)
    t = t_axis(0.34)
    hum = (tone(t, 196) + tone(t, 199) + 0.45 * tone(t, 294) + 0.15 * tone(t, 588)) * env(t, 0.03, 0.11)
    swell = lowpass2(rng.standard_normal(len(t)), 700) * env(t, 0.02, 0.06) * 2.2
    x = hum + swell
    for at, g in ((0.0, 0.5), (0.046, 0.3)):
        tt = t_axis(0.012)
        place(x, tail(g * tone(tt, 3150) * env(tt, 0.0004, 0.0025), 0.004), at)
    return finish(x, -12, fade_in=0.002, fade_out=0.02)


def unavailable():
    # "not yet": two muted, identical low notes, the second slightly flat - an acknowledgment, not an alarm
    t = t_axis(0.22)
    out = np.zeros(len(t))
    for at, hz in ((0.0, 329.63), (0.075, 329.63 * 2 ** (-30 / 1200))):
        tt = t_axis(0.13)
        b = (tone(tt, hz) + 0.25 * tone(tt, hz * 2)) * env(tt, 0.003, 0.035)
        place(out, tail(lowpass(b, 1400)), at)
    return finish(out, -15, fade_out=0.015)


SOUNDS = [
    ('hover', 'ui_hover.mp3', hover, 'Pointer over a control, or the keyboard moving to one (throttled)'),
    ('click', 'ui_click.mp3', click, 'A button, tab, swatch or choice pressed'),
    ('back', 'ui_back.mp3', back, 'Back, Close, Done; a panel closing (Escape)'),
    ('toggleOn', 'ui_toggle_on.mp3', toggle_on, 'A switch turned on'),
    ('toggleOff', 'ui_toggle_off.mp3', toggle_off, 'A switch turned off'),
    ('open', 'ui_open.mp3', open_, 'A panel opening: Settings, Customize, Credits, Help, PLAY'),
    ('unavailable', 'ui_unavailable.mp3', unavailable, 'Something not available yet: the Account button ("Accounts Coming Soon...")'),
]


def pcm16(x):
    return np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')


def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16(x).tobytes())


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if not exe:
        sys.exit('ui_sounds: ffmpeg is not installed - no MP3 can be made (nothing written)')
    enc = subprocess.run([exe, '-hide_banner', '-encoders'], capture_output=True, text=True).stdout
    if 'libmp3lame' not in enc:
        sys.exit('ui_sounds: this ffmpeg has no libmp3lame encoder - no MP3 can be made (nothing written)')
    return exe


def decode(exe, path):
    """the MP3 decoded by ffmpeg (which trims the encoder's padding from the LAME header): float samples, its rate and channels"""
    p = subprocess.run([exe, '-v', 'error', '-i', path, '-f', 's16le', '-acodec', 'pcm_s16le', '-'], capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:300])
    probe = subprocess.run([exe, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    x = np.frombuffer(p.stdout, dtype='<i2').astype(np.float64) / 32768
    return x, probe


def db(v):
    return round(20 * np.log10(max(v, 1e-9)), 2)


def describe(exe, name, fname, render, path):
    x, probe = decode(exe, path)
    raw = open(path, 'rb').read()
    return {
        'name': name, 'file': 'public/assets/' + fname, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
        'format': 'MP3 (MPEG-1 Layer III), mono, 44.1 kHz, %s CBR' % BITRATE.replace('k', ' kbit/s'),
        'renderSamples': len(render), 'renderSha256': hashlib.sha256(pcm16(render).tobytes()).hexdigest(),
        'renderSeconds': round(len(render) / SR, 4), 'decodedSamples': len(x), 'decodedSeconds': round(len(x) / SR, 4),
        'peakDbfs': db(np.max(np.abs(x))), 'rmsDbfs': db(float(np.sqrt(np.mean(x ** 2)))),
        'first': round(float(abs(x[0])), 5) if len(x) else None, 'last': round(float(abs(x[-1])), 5) if len(x) else None,
        'probe': [l.strip() for l in probe.splitlines() if 'Audio:' in l][:1],
    }


def main():
    args = sys.argv[1:]
    mode = args[0] if args else ''
    if mode not in ('make', 'check'):
        sys.exit(__doc__)
    opt = dict(zip(args[1::2], args[2::2]))
    exe = ffmpeg()
    work = tempfile.mkdtemp(prefix='ui-sounds-', dir=opt.get('--work'))
    rows, ok = [], True
    try:
        inv = json.load(open(INVENTORY)) if mode == 'check' else None
        for name, fname, fn, use in SOUNDS:
            x = fn()
            wav = os.path.join(work, fname.replace('.mp3', '.wav'))
            write_wav(wav, x)
            mp3 = os.path.join(OUT_DIR, fname)
            if mode == 'make':
                tmp = os.path.join(work, fname)
                p = subprocess.run([exe, '-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', BITRATE,
                                    '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', '-write_xing', '1', '-f', 'mp3', tmp],
                                   capture_output=True, text=True)
                if p.returncode != 0 or not os.path.getsize(tmp):
                    sys.exit('ui_sounds: ffmpeg could not encode %s: %s' % (fname, p.stderr[:300]))
                shutil.move(tmp, mp3)
            d = describe(exe, name, fname, x, mp3)
            d['use'] = use
            checks = {
                'mono_44k': 'mono' in (d['probe'][0] if d['probe'] else '') and '44100 Hz' in (d['probe'][0] if d['probe'] else ''),
                'length': abs(d['decodedSamples'] - d['renderSamples']) <= 1152,
                'peak_below_-6dBFS': d['peakDbfs'] < -6,
                'quiet_ends': d['first'] < 0.01 and d['last'] < 0.01,
                'small': d['bytes'] < 16000,
            }
            if inv is not None:
                was = next((r for r in inv['sounds'] if r['name'] == name), None)
                checks['recipe_unchanged'] = bool(was) and was['renderSha256'] == d['renderSha256']
                checks['file_inventoried'] = bool(was) and was['sha256'] == d['sha256'] and was['bytes'] == d['bytes']
            checks = {k: bool(v) for k, v in checks.items()}
            d['checks'] = checks
            ok = ok and all(checks.values())
            rows.append(d)
            print('%s %-12s %-20s %5d bytes  %.3f s  peak %6.2f dBFS  rms %6.2f dBFS  %s' % (
                'ok  ' if all(checks.values()) else 'FAIL', name, fname, d['bytes'], d['decodedSeconds'], d['peakDbfs'], d['rmsDbfs'],
                ', '.join(k for k, v in checks.items() if not v) or 'all checks'))
        extra = sorted(f for f in os.listdir(OUT_DIR) if f.startswith('ui_') and f.endswith('.mp3') and f not in {x for _, x, _, _ in SOUNDS})
        if extra:
            ok = False
            print('FAIL other ui_*.mp3 files in public/assets/: %s' % ', '.join(extra))
        ver = subprocess.run([exe, '-version'], capture_output=True, text=True).stdout.splitlines()[0]
        report = {
            'tool': 'dev/pre-trial3-final-polish/tools/ui_sounds.py', 'mode': mode, 'ffmpeg': ver, 'sampleRate': SR, 'bitrate': BITRATE,
            'origin': 'Programmatically synthesized placeholder (sine waves, envelopes, seeded noise) by this script; no samples, no third-party audio',
            'license': 'Original: generated by this repository\'s own script for The Far Backrooms (pre-Trial 3 polish P7); no third-party audio, samples or presets; the project\'s own asset like its other original files (the owners decide its terms)',
            'replace': 'Put a file with the same name in public/assets/ (MP3, mono, 44.1 kHz suggested); see dev/pre-trial3-final-polish/SOUND_ASSETS.md',
            'totalBytes': sum(r['bytes'] for r in rows), 'sounds': rows, 'extraFiles': extra, 'ok': ok,
        }
        if mode == 'make':
            with open(INVENTORY, 'w') as f:
                json.dump({k: v for k, v in report.items() if k not in ('mode', 'ok', 'extraFiles')}, f, indent=1)
                f.write('\n')
        if opt.get('--out'):
            with open(opt['--out'], 'w') as f:
                json.dump(report, f, indent=1)
                f.write('\n')
        print('UI SOUNDS (%s): %s - %d sounds, %d bytes in all' % (mode, 'PASS' if ok else 'FAIL', len(rows), report['totalBytes']))
        sys.exit(0 if ok else 1)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
