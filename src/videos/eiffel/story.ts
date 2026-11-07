// Timeline of "The Man Who Sold the Eiffel Tower Twice"
// 5-Act Narrative Arc over exactly 2250 frames (75.0 s @ 30 fps).
// Continuous gliding cameras, slow holds with creeping push-ins, dutch tilts, kicks, and depth-of-field blur.
export const FPS = 30;
export const TOTAL = 2250;
export const D0 = 0.0; // plaza ground height (m)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type SceneSet = "plaza" | "suite" | "window" | "station";
export type ShotDef = {
  id: number; a: number; b: number; light: Light; set: SceneSet;
  act: number; desc: string;
};

export const SHOTS: ShotDef[] = [
  // Act 1: The Hook (0s - 10s / f0 - 300)
  { id: 1, a: 0, b: 150, light: "golden", set: "plaza", act: 1, desc: "Paris 1925 plaza wide push-in, Eiffel silhouette in background" },
  { id: 2, a: 150, b: 300, light: "golden", set: "plaza", act: 1, desc: "Low-angle hero shot of Lustig in fedora tipping hat, dutch tilt" },
  // Act 2: The Setup (10s - 25s / f300 - 750)
  { id: 3, a: 300, b: 450, light: "golden", set: "suite", act: 2, desc: "Lustig at desk forging official government documents with wax seal" },
  { id: 4, a: 450, b: 600, light: "golden", set: "suite", act: 2, desc: "Hotel de Crillon secret meeting: 6 scrap dealers seated around table" },
  { id: 5, a: 600, b: 750, light: "golden", set: "window", act: 2, desc: "Lustig by grand arched French window gesturing out at the Eiffel Tower" },
  // Act 3: The Psychological Trick (25s - 45s / f750 - 1350)
  { id: 6, a: 750, b: 950, light: "golden", set: "suite", act: 3, desc: "Medium shot on André Poisson clutching his leather briefcase, sweating" },
  { id: 7, a: 950, b: 1150, light: "golden", set: "suite", act: 3, desc: "Over-the-shoulder CU on Lustig whispering bribe under table with a wink" },
  { id: 8, a: 1150, b: 1350, light: "golden", set: "suite", act: 3, desc: "Poisson's anxious expression breaks into a broad, relieved greedy grin" },
  // Act 4: The Escape & Second Attempt (45s - 60s / f1350 - 1800)
  { id: 9, a: 1350, b: 1500, light: "golden", set: "suite", act: 4, desc: "Poisson handing over heavy suitcase of cash across table to Lustig" },
  { id: 10, a: 1500, b: 1650, light: "day", set: "station", act: 4, desc: "Vienna Express train departing Paris platform, Lustig waving with suitcase" },
  { id: 11, a: 1650, b: 1800, light: "golden", set: "plaza", act: 4, desc: "6 months later: Lustig strides back into Paris plaza with walking cane" },
  // Act 5: The Moral / Punchline (60s - 75s / f1800 - 2250)
  { id: 12, a: 1800, b: 2025, light: "golden", set: "plaza", act: 5, desc: "Cinematic sweeping crane pull-back over Paris streetlamps & Eiffel Tower" },
  { id: 13, a: 2025, b: TOTAL, light: "golden", set: "plaza", act: 5, desc: "Final hero hold on Lustig tipping fedora with knowing smirk into black" },
];

export const XFADE: Record<number, number> = { 3: 8, 4: 6, 6: 8, 9: 6, 10: 8, 11: 8, 12: 8 };
export const FLASH_AT = 150; // White flash transition right on the hook punch

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [
        { id: s.id - 1, alpha: 1 },
        { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }
      ];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type ShotKey = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => ShotKey };

const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});

const fullCam = (c: ShotKey): Cam => ({ fov: 42, roll: 0, ...c });

const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) {
    for (let i = 0; i < Math.min(x, n); i++) {
      s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
    }
  }
  return Math.exp(-s);
};

const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): ShotKey => ({
  pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k],
  look,
  ...rest
});

const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): ShotKey => ({
  pos,
  look,
  fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k),
  ...rest
});

// Camera keys per shot
export const CAMS: Record<number, Key[]> = {
  // Shot 1: Establishing plaza wide crane push-in (0 - 150)
  1: [
    { f: 0, dur: 70, s: (f) => dolly([0, 7.5, 18], [0, 1.8, -10], pushK(f, 0, 0.002), { fov: 46 }) },
    { f: 75, dur: 65, s: (f) => dolly([0.4, 2.4, 8.5], [0, 1.8, 0], pushK(f, 75, 0.0025), { fov: 42, roll: -0.02 }) },
  ],
  // Shot 2: Low-angle hero close-up on Lustig (150 - 300)
  2: [
    { f: 150, cut: true, s: (f) => dolly([1.1, 0.85, 3.2], [0, 1.8, 0], pushK(f, 150, 0.002, 0.006, 30), { fov: 38, roll: -0.05 }) },
    { f: 230, dur: 60, s: (f) => dolly([0.6, 1.0, 2.5], [0, 1.85, 0], pushK(f, 230, 0.0018), { fov: 36, roll: -0.03 }) },
  ],
  // Shot 3: Forging government papers in suite (300 - 450)
  3: [
    { f: 300, cut: true, s: (f) => dolly([1.4, 1.7, 3.2], [0, 1.1, 0], pushK(f, 300, 0.0025), { fov: 38 }) },
    { f: 375, dur: 65, s: (f) => dolly([0.6, 1.35, 1.8], [0, 0.95, 0], pushK(f, 375, 0.002), { fov: 34, roll: 0.03 }) },
  ],
  // Shot 4: Secret meeting with 6 dealers (450 - 600)
  4: [
    { f: 450, cut: true, s: (f) => dolly([3.8, 2.4, 5.2], [0, 1.1, 0], pushK(f, 450, 0.002), { fov: 44, roll: -0.02 }) },
    { f: 525, dur: 65, s: (f) => dolly([2.2, 1.8, 3.6], [0, 1.2, 0], pushK(f, 525, 0.002), { fov: 40 }) },
  ],
  // Shot 5: Window overlooking Eiffel Tower (600 - 750)
  5: [
    { f: 600, cut: true, s: (f) => dolly([-2.2, 1.9, 3.0], [0, 2.0, -15], pushK(f, 600, 0.002), { fov: 44, roll: 0.03 }) },
    { f: 675, dur: 65, s: (f) => dolly([-1.2, 1.8, 2.2], [0, 2.2, -25], pushK(f, 675, 0.0018), { fov: 40 }) },
  ],
  // Shot 6: André Poisson nervous MS (750 - 950)
  6: [
    { f: 750, cut: true, s: (f) => dolly([0.8, 1.65, 3.2], [0.3, 1.45, 0], pushK(f, 750, 0.0025, 0.006, 35), { fov: 36, roll: 0.04 }) },
    { f: 850, dur: 80, s: (f) => dolly([0.4, 1.55, 2.2], [0.2, 1.5, 0], pushK(f, 850, 0.002), { fov: 32, roll: 0.02 }) },
  ],
  // Shot 7: Lustig whispers the bribe request (950 - 1150)
  7: [
    { f: 950, cut: true, s: (f) => dolly([-0.9, 1.65, 1.8], [0, 1.65, 0], pushK(f, 950, 0.002), { fov: 34, roll: -0.035 }) },
    { f: 1050, dur: 80, s: (f) => dolly([-0.5, 1.6, 1.4], [0, 1.7, 0], pushK(f, 1050, 0.002), { fov: 30 }) },
  ],
  // Shot 8: Poisson relieved greedy grin (1150 - 1350)
  8: [
    { f: 1150, cut: true, s: (f) => dolly([0.1, 1.55, 2.4], [0.1, 1.5, 0], pushK(f, 1150, 0.003, 0.008, 40), { fov: 34, roll: -0.03 }) },
    { f: 1250, dur: 80, s: (f) => dolly([0.05, 1.5, 1.7], [0.1, 1.52, 0], pushK(f, 1250, 0.002), { fov: 30 }) },
  ],
  // Shot 9: Handover of cash suitcase (1350 - 1500)
  9: [
    { f: 1350, cut: true, s: (f) => dolly([1.6, 1.4, 2.6], [0, 0.9, 0], pushK(f, 1350, 0.002), { fov: 38 }) },
    { f: 1425, dur: 65, s: (f) => dolly([0.9, 1.15, 1.6], [0, 0.85, 0], pushK(f, 1425, 0.002), { fov: 32, roll: 0.03 }) },
  ],
  // Shot 10: Vienna Express platform departure (1500 - 1650)
  10: [
    { f: 1500, cut: true, s: (f) => dolly([9.0, 2.6, 6.0], [4.5, 1.6, -10], pushK(f, 1500, 0.002), { fov: 44, roll: -0.02 }) },
    { f: 1575, dur: 65, s: (f) => dolly([7.5, 2.2, 0.0], [3.5, 1.6, -20], pushK(f, 1575, 0.002), { fov: 40 }) },
  ],
  // Shot 11: Lustig returns to Paris 6 months later (1650 - 1800)
  11: [
    { f: 1650, cut: true, s: (f) => dolly([-3.5, 1.5, 7.5], [0, 1.8, 0], pushK(f, 1650, 0.0025), { fov: 42, roll: 0.04 }) },
    { f: 1725, dur: 65, s: (f) => dolly([-1.5, 1.6, 4.6], [0, 1.85, 0], pushK(f, 1725, 0.002), { fov: 38, roll: 0.02 }) },
  ],
  // Shot 12: Epic sweeping crane pull-back at sunset (1800 - 2025)
  12: [
    { f: 1800, cut: true, s: (f) => dolly([0, 2.2, 7.0], [0, 1.8, -15], pushK(f, 1800, 0.0018), { fov: 42 }) },
    { f: 1910, dur: 100, s: (f) => dolly([0, 6.5, 24.0], [0, 3.5, -45], pushK(f, 1910, 0.0015), { fov: 48, roll: -0.02 }) },
  ],
  // Shot 13: Final hero hold on Lustig with smirk (2025 - 2250)
  13: [
    { f: 2025, cut: true, s: (f) => dolly([0.2, 1.8, 3.5], [0, 1.85, 0], pushK(f, 2025, 0.002, 0.006, 40), { fov: 36, roll: 0.035 }) },
    { f: 2140, dur: 90, s: (f) => dolly([0.1, 1.82, 2.6], [0, 1.85, 0], pushK(f, 2140, 0.0015), { fov: 32, roll: 0.02 }) },
  ],
};

export const camAt = (id: number, f: number): Cam => {
  const keys = CAMS[id];
  if (!keys) return fullCam({ pos: [0, 2, 8], look: [0, 1.8, 0] });
  let cur = fullCam(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? fullCam(k.s(f)) : mixCam(cur, fullCam(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};

// Depth-of-field lens blur per shot
export type DofDef = { cInf: number; focus?: (f: number) => V3 };
export const dofAt = (f: number): DofDef => {
  const s = shotAt(f);
  // Close-up shots get rich lens blur on background
  if (s.id === 2 || s.id === 6 || s.id === 7 || s.id === 8 || s.id === 13) {
    return { cInf: 14, focus: () => [0, 1.85, 0] };
  }
  // Medium suite shots
  if (s.id === 3 || s.id === 5 || s.id === 9 || s.id === 11) {
    return { cInf: 9, focus: () => [0, 1.4, 0] };
  }
  // Establishing & wide shots stay sharp
  return { cInf: 0 };
};

// Foreground props that frame the camera lens
export const FOREGROUND: Record<number, string> = {
  1: "lantern",
  4: "tableCorner",
  10: "luggageCart",
  12: "lantern"
};
