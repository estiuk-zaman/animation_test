# Master sound mixing script for "The Man Who Sold the Eiffel Tower Twice"
# Generates music score, SFX cues, ducking automation, and final mastered audio for EN, BN, HI.
import os, sys, json, time, subprocess
import numpy as np
from scipy import signal, ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from dsp import (SR, ns, st, dbg, read_wav, write_wav, integrated, momentary, momentary_max,
                 short_term, lra, true_peak, fades, pan, place, make_ir, convolve_st, lp, hp, bp, peq, shelf)
import instruments as I
import sfx_gen as G

DUR = 75.0
N = ns(DUR)  # 3,600,000 samples @ 48kHz
TARGET_LUFS = -15.0
CEIL_DBTP = -1.2
DUCK_DB = -3.5

def limiter(x, ceil_db=CEIL_DBTP, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    g2 = g1.copy()
    idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR))
        gap = ns(rel * 8)
        brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]])
        ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap)
            seg = g1[a:e]
            out = np.empty(len(seg))
            g = 1.0
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                out[k] = g
            g2[a:e] = out
    g3 = ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest")
    g3 = np.minimum(g3, 1.0)
    return x * g3[None, :], g3

def render_score():
    print("Rendering synthesized heist march score...")
    # Bb major / G minor heist march
    Q = 0.5  # 120 bpm quarter note
    t = np.arange(N) / SR
    
    # Track buffers
    m_left = np.zeros(N)
    m_right = np.zeros(N)
    
    # Snare / Marching rhythm
    R = np.random.default_rng(1925)
    for beat_idx in range(int(DUR / Q)):
        t_beat = beat_idx * Q
        if t_beat >= DUR - 1.0:
            break
        pos = ns(t_beat)
        
        # Snare rim & brush
        sn_dur = 0.12
        sn_len = ns(sn_dur)
        if pos + sn_len < N:
            # Kick on 1 & 3, Snare on 2 & 4
            is_snare = (beat_idx % 2 == 1)
            is_kick = (beat_idx % 2 == 0)
            
            if is_kick:
                f0 = 90.0
                kt = np.arange(sn_len) / SR
                k_env = np.exp(-kt * 24.0)
                k_wave = np.sin(2 * np.pi * (f0 * np.exp(-kt * 30.0)) * kt) * k_env * 0.4
                m_left[pos:pos+sn_len] += k_wave * 0.7
                m_right[pos:pos+sn_len] += k_wave * 0.7
                
            if is_snare:
                st_noise = R.uniform(-1, 1, sn_len)
                st_env = np.exp(-np.arange(sn_len) / SR * 35.0)
                sn_wave = bp(st_noise * st_env, 1200, 3500, 1) * 0.35
                m_left[pos:pos+sn_len] += sn_wave * 0.8
                m_right[pos:pos+sn_len] += sn_wave * 0.6
                
            # Suspense hi-hat ticks during Act 3 (The trick: 25s - 45s)
            if 25.0 <= t_beat <= 45.0:
                for sub in [0.25, 0.75]:
                    sub_pos = ns(t_beat + sub * Q)
                    hh_len = ns(0.04)
                    if sub_pos + hh_len < N:
                        hh_n = hp(R.uniform(-1, 1, hh_len), 7000) * np.exp(-np.arange(hh_len)/SR * 90.0) * 0.15
                        m_left[sub_pos:sub_pos+hh_len] += hh_n * 0.4
                        m_right[sub_pos:sub_pos+hh_len] += hh_n * 0.7
                        
    # Bassline (Tuba / Double Bass oom-pah)
    bass_notes = [
        # Act 1 (0-10s): mysterious Bb -> Gm
        (0.0, 5.0, 34), (5.0, 10.0, 31),
        # Act 2 (10-25s): jaunty Bb -> F -> Gm -> F
        (10.0, 14.0, 34), (14.0, 18.0, 41), (18.0, 22.0, 31), (22.0, 25.0, 41),
        # Act 3 (25-45s): chromatic tension Cm -> D7 -> Gm -> F#dim
        (25.0, 30.0, 36), (30.0, 35.0, 38), (35.0, 40.0, 31), (40.0, 45.0, 30),
        # Act 4 (45-60s): energetic escape Eb -> F -> Bb -> Gm
        (45.0, 50.0, 39), (50.0, 55.0, 41), (55.0, 60.0, 34),
        # Act 5 (60-75s): grand resolve Bb -> Eb -> F7 -> Bb
        (60.0, 65.0, 34), (65.0, 69.0, 39), (69.0, 72.5, 41), (72.5, 74.5, 34)
    ]
    for start_t, end_t, midi_pitch in bass_notes:
        n_beats = int((end_t - start_t) / Q)
        freq = I.m2f(midi_pitch)
        for b in range(n_beats):
            bt = start_t + b * Q
            b_pos = ns(bt)
            b_dur = 0.4
            b_len = ns(b_dur)
            if b_pos + b_len < N:
                t_vec = np.arange(b_len) / SR
                b_wave = (np.sin(2 * np.pi * freq * t_vec) +
                          0.4 * np.sin(4 * np.pi * freq * t_vec) +
                          0.2 * np.sin(6 * np.pi * freq * t_vec)) * np.exp(-t_vec * 6.0) * 0.28
                m_left[b_pos:b_pos+b_len] += b_wave * 0.7
                m_right[b_pos:b_pos+b_len] += b_wave * 0.7
                
    # Melodic Woodwind & Whistle motif (Parisian accordion / whistle flavor)
    melody_phrases = [
        # Act 1 Hook: rising motif
        (1.0, 70), (1.5, 74), (2.0, 77), (3.0, 79), (4.5, 77),
        (5.5, 70), (6.0, 74), (6.5, 77), (7.5, 75), (8.5, 74),
        # Act 2 Setup: cheeky march
        (11.0, 82), (11.5, 82), (12.0, 84), (12.5, 86), (13.5, 82),
        (15.0, 77), (15.5, 79), (16.0, 81), (17.0, 82), (18.5, 77),
        (20.0, 79), (21.0, 82), (22.5, 87), (23.5, 86), (24.0, 84),
        # Act 3 Sneaky Trick: staccato pizzicato notes
        (26.0, 60), (27.0, 63), (28.0, 67), (29.5, 66), (31.0, 65),
        (32.5, 63), (34.0, 62), (36.0, 67), (37.5, 70), (39.0, 72),
        (41.0, 74), (42.5, 75), (43.5, 77),
        # Act 4 Escape: brisk ascending gallop
        (46.0, 70), (46.5, 74), (47.0, 77), (47.5, 82),
        (48.5, 84), (49.5, 86), (51.0, 82), (52.0, 77),
        (53.5, 79), (54.5, 82), (56.0, 87), (57.5, 86), (58.5, 82),
        # Act 5 Moral: grand triumphant resolving line
        (61.0, 82), (62.0, 84), (63.0, 86), (64.5, 89),
        (66.0, 87), (67.5, 86), (69.0, 84), (70.5, 82), (72.5, 82)
    ]
    for m_time, midi_pitch in melody_phrases:
        pos = ns(m_time)
        dur = 0.45
        mlen = ns(dur)
        if pos + mlen < N:
            freq = I.m2f(midi_pitch)
            t_vec = np.arange(mlen) / SR
            # Soft flute / whistle with slight vibrato
            vib = 1.0 + 0.015 * np.sin(2 * np.pi * 5.5 * t_vec)
            w_wave = (np.sin(2 * np.pi * freq * vib * t_vec) +
                      0.3 * np.sin(4 * np.pi * freq * t_vec) +
                      0.1 * np.sin(6 * np.pi * freq * t_vec)) * (np.sin(np.pi * np.clip(t_vec / dur, 0, 1)) ** 0.5) * 0.22
            m_left[pos:pos+mlen] += w_wave * 0.8
            m_right[pos:pos+mlen] += w_wave * 0.5

    # Reverb space
    music_stereo = np.vstack([m_left, m_right])
    ir = make_ir(1.4, 42, length=1.2)
    music_wet = convolve_st(music_stereo, ir)
    music_mix = music_stereo * 0.8 + music_wet * 0.2
    return music_mix

def render_sfx():
    print("Rendering Paris 1920s SFX & ambience stems...")
    s_left = np.zeros(N)
    s_right = np.zeros(N)
    R = np.random.default_rng(2026)
    
    # 1. Parisian daytime ambient breeze & distant city presence
    amb_breeze = G.breeze(DUR, R, 1.0, 0.12, 900)
    s_left += amb_breeze[0] * 0.35
    s_right += amb_breeze[1] * 0.35
    
    # 2. Distant French church bells (chimes at 0.5s, 15.0s, 60.5s)
    for bell_t in [0.5, 18.0, 61.0]:
        b_pos = ns(bell_t)
        b_len = ns(3.0)
        if b_pos + b_len < N:
            t_vec = np.arange(b_len) / SR
            bell = (np.sin(2 * np.pi * 523.25 * t_vec) * np.exp(-t_vec * 1.5) +
                    0.5 * np.sin(2 * np.pi * 1046.5 * t_vec) * np.exp(-t_vec * 2.5) +
                    0.25 * np.sin(2 * np.pi * 1567.9 * t_vec) * np.exp(-t_vec * 3.5)) * 0.15
            s_left[b_pos:b_pos+b_len] += bell * 0.4
            s_right[b_pos:b_pos+b_len] += bell * 0.7
            
    # 3. Paper shuffle & official wax seal stamp (Hotel de Crillon meeting: ~14s, ~23s)
    for p_t in [14.2, 23.5]:
        pos = ns(p_t)
        plen = ns(0.6)
        if pos + plen < N:
            noise = R.uniform(-1, 1, plen)
            paper = bp(noise, 1500, 4000, 1) * np.exp(-np.arange(plen)/SR * 12.0) * 0.25
            # Stamp thud
            t_vec = np.arange(plen) / SR
            thud = np.sin(2 * np.pi * 110 * np.exp(-t_vec * 40.0) * t_vec) * np.exp(-t_vec * 25.0) * 0.35
            s_left[pos:pos+plen] += (paper + thud) * 0.6
            s_right[pos:pos+plen] += (paper + thud) * 0.6
            
    # 4. Briefcase latch click & leather snap (~44.5s)
    b_pos = ns(44.5)
    b_len = ns(0.4)
    if b_pos + b_len < N:
        click_n = R.uniform(-1, 1, b_len)
        click = hp(click_n, 3500) * np.exp(-np.arange(b_len)/SR * 50.0) * 0.45
        t_vec = np.arange(b_len) / SR
        click += np.sin(2 * np.pi * 320 * t_vec) * np.exp(-t_vec * 30.0) * 0.3
        s_left[b_pos:b_pos+b_len] += click * 0.7
        s_right[b_pos:b_pos+b_len] += click * 0.5
        
    # 5. Steam train chuff & whistle as Lustig flees to Vienna (~48s - 56s)
    for step in range(8):
        chuff_t = 48.0 + step * 0.7
        c_pos = ns(chuff_t)
        c_len = ns(0.35)
        if c_pos + c_len < N:
            c_noise = R.uniform(-1, 1, c_len)
            chuff = bp(c_noise, 400, 1800, 1) * np.exp(-np.arange(c_len)/SR * 15.0) * 0.28
            s_left[c_pos:c_pos+c_len] += chuff * 0.6
            s_right[c_pos:c_pos+c_len] += chuff * 0.8
            
    # Train whistle at 50.5s
    w_pos = ns(50.5)
    w_len = ns(1.6)
    if w_pos + w_len < N:
        t_vec = np.arange(w_len) / SR
        whistle = (np.sin(2 * np.pi * 587.33 * t_vec) + 0.9 * np.sin(2 * np.pi * 739.99 * t_vec)) * \
                  (np.sin(np.pi * np.clip(t_vec / 1.6, 0, 1)) ** 0.5) * 0.25
        s_left[w_pos:w_pos+w_len] += whistle * 0.4
        s_right[w_pos:w_pos+w_len] += whistle * 0.8
        
    # 6. Final comedic punctuation wink / bell ding (~73.2s)
    d_pos = ns(73.2)
    d_len = ns(1.2)
    if d_pos + d_len < N:
        t_vec = np.arange(d_len) / SR
        ding = np.sin(2 * np.pi * 1760.0 * t_vec) * np.exp(-t_vec * 3.5) * 0.2
        s_left[d_pos:d_pos+d_len] += ding * 0.6
        s_right[d_pos:d_pos+d_len] += ding * 0.6

    sfx_stereo = np.vstack([s_left, s_right])
    return sfx_stereo

def duck_audio(spans, depth=DUCK_DB, pre=0.08, post=0.12, att=0.07, rel=0.45):
    ctrl = 1000
    nc = int(DUR * ctrl) + 2
    va = np.zeros(nc)
    for s, e in spans:
        va[max(0, int((s - pre) * ctrl)): int((e + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env = np.zeros(nc)
    e = 0.0
    for i in range(nc):
        tgt = va[i]
        e += (tgt - e) * (ka if tgt > e else kr)
        env[i] = e
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)

def process_mix(lang, music_raw, sfx_stem):
    print(f"\nProcessing final mix for {lang.upper()}...")
    vdir = f"/tmp/eiffel_run5/{lang}"
    vpath = f"{vdir}/mastered.wav"
    subpath = f"{vdir}/subtitles.json"
    
    with open(subpath) as f:
        meta = json.load(f)
        
    spans = [[s["start"], s["end"]] for s in meta["sentences"]]
    
    # Load voice
    x, sr = read_wav(vpath)
    v_raw = x[0] if x.shape[0] == 1 else x.mean(0)
    v_stem = np.zeros(N)
    v_stem[:min(N, len(v_raw))] = v_raw[:N]
    v_st = st(v_stem)
    v_ref = integrated(v_st)
    print(f"Voice {lang}: {v_ref:.2f} LUFS")
    
    # Duck music under voice
    dk = duck_audio(spans, depth=-4.0)
    m_ducked = music_raw * dbg(dk)[None, :]
    
    # Music gain relative to voice
    Lm = integrated(m_ducked)
    target_m = v_ref - 11.5  # standard background bed level
    m_gain = target_m - Lm if np.isfinite(Lm) else -15.0
    m_final = m_ducked * dbg(m_gain)
    
    # SFX gain
    Ls = integrated(sfx_stem)
    target_s = v_ref - 12.0
    s_gain = target_s - Ls if np.isfinite(Ls) else -18.0
    s_final = sfx_stem * dbg(s_gain)
    
    # Mix together
    mix_raw = v_st + m_final + s_final
    
    # Master to TARGET_LUFS (-15 LUFS) with limiter
    Lmix = integrated(mix_raw)
    G = TARGET_LUFS - Lmix
    mix_mastered, _ = limiter(mix_raw * dbg(G))
    
    final_lufs = integrated(mix_mastered)
    final_tp = true_peak(mix_mastered)
    print(f"Final Master ({lang}): {final_lufs:.2f} LUFS | True Peak: {final_tp:.2f} dBTP | Dur: {mix_mastered.shape[1]/SR:.2f}s")
    
    out_wav = f"{HERE}/mix_{lang}.wav"
    write_wav(out_wav, mix_mastered, 24)
    print(f"Saved: {out_wav}")
    return out_wav

def main():
    m_raw = render_score()
    s_stem = render_sfx()
    
    for lang in ["english", "bengali", "hindi"]:
        process_mix(lang, m_raw, s_stem)

if __name__ == "__main__":
    main()
