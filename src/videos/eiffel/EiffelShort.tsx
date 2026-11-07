// "The Man Who Sold the Eiffel Tower Twice": 75 s vertical short (1080x1920 @ 30 fps).
// Architecture: Three.js world posed per frame from story.ts + full post-processing chain:
// InkPass (lines) -> LensBlur (thin-lens DOF) -> Bloom -> ToneMapping -> Grade + Center-Bottom Subtitles.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

export const EIFFEL_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({
  ink: true, lens: false, pre: false, bloom: true, grade: true, grain: false,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {})
});

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.5,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    levels: 6,
    radius: 0.6
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("eiffel kit"));
  useEffect(() => {
    loadKit().then((k) => {
      setKit(k);
      continueRender(handle);
    });
  }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.golden, GRADE_STRENGTH.golden),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }),
  }), [camera, scene]);

  useEffect(() => () => {
    if (typeof (fx.ink as any)?.dispose === "function") {
      (fx.ink as any).dispose();
    }
  }, [fx]);

  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      {on.grain ? <primitive object={fx.grain} dispose={null} /> : null}
    </EffectComposer>
  ), [fx, on]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);

  // Thin lens DOF focus
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  const s = SHOTS[id - 1] ?? SHOTS[0];
  gradeFor(fx.grade, s.light);
  fx.grain.seed = f;

  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas
      width={720}
      height={1280}
      {...(dprOverride() ? { dpr: dprOverride() } : {})}
      shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 42, near: 0.2, far: 1500 }}
    >
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export type SubtitleItem = { idx: number; text: string; start: number; end: number; dur: number };
export type EiffelShortProps = {
  language?: "english" | "bengali" | "hindi";
  subtitles?: { sentences: SubtitleItem[] } | null;
};

export const EiffelShort: React.FC<EiffelShortProps> = ({ language, subtitles }) => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;

  const t = f / 30;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;

  // Active subtitle sentence
  const currentSentence = subtitles?.sentences?.find(
    (s) => t >= s.start && t <= s.end + 0.3
  );

  const fontFamily =
    language === "bengali"
      ? "'Noto Sans Bengali', 'Lohit Bengali', sans-serif"
      : language === "hindi"
      ? "'Noto Sans Devanagari', 'Lohit Devanagari', sans-serif"
      : "system-ui, -apple-system, 'Inter', 'Segoe UI', sans-serif";

  const fontSize = language === "english" ? 34 : 37;

  return (
    <AbsoluteFill style={{ background: "#ffc47c" }}>
      <style>{`
        @font-face {
          font-family: 'Noto Sans Bengali';
          src: url('${staticFile("fonts/NotoSansBengali-Bold.ttf")}') format('truetype');
          font-weight: bold;
        }
        @font-face {
          font-family: 'Noto Sans Devanagari';
          src: url('${staticFile("fonts/NotoSansDevanagari-Bold.ttf")}') format('truetype');
          font-weight: bold;
        }
      `}</style>

      {layersAt(f).map((l, i) => (
        <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />
      ))}

      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}

      {/* Subtitles Overlay */}
      {currentSentence && (
        <div
          style={{
            position: "absolute",
            bottom: 95,
            left: 30,
            right: 30,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "rgba(16, 14, 24, 0.78)",
              backdropFilter: "blur(8px)",
              border: "2px solid rgba(255, 255, 255, 0.16)",
              borderRadius: "20px",
              padding: "12px 24px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
              maxWidth: 660,
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: "bold",
                fontSize,
                lineHeight: 1.35,
                color: "#ffffff",
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
                letterSpacing: language === "english" ? "0.02em" : "0.01em",
              }}
            >
              {currentSentence.text}
            </span>
          </div>
        </div>
      )}

      {/* Audio bed playback for studio preview */}
      {language && <Audio src={staticFile(`audio/mix_${language}.mp3`)} />}
    </AbsoluteFill>
  );
};
