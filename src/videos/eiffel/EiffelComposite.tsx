import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { SubtitleItem } from "./EiffelShort";

export type EiffelCompositeProps = {
  videoFile: string;
  language: "english" | "bengali" | "hindi";
  subtitles: { sentences: SubtitleItem[] };
};

export const EiffelComposite: React.FC<EiffelCompositeProps> = ({
  videoFile,
  language,
  subtitles,
}) => {
  const f = useCurrentFrame();
  const t = f / 30;

  const currentSentence = subtitles.sentences.find(
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
    <AbsoluteFill style={{ background: "#000000" }}>
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

      <OffthreadVideo src={staticFile(videoFile)} style={{ width: 720, height: 1280 }} />

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
      {/* Audio track */}
      <Audio src={staticFile(`audio/mix_${language}.mp3`)} />
    </AbsoluteFill>
  );
};

