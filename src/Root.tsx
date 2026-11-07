import React from "react";
import { Composition } from "remotion";
import { EiffelShort, EIFFEL_FRAMES } from "./videos/eiffel/EiffelShort";
import { EiffelComposite } from "./videos/eiffel/EiffelComposite";

import englishSubs from "./videos/eiffel/subtitles/english.json";
import bengaliSubs from "./videos/eiffel/subtitles/bengali.json";
import hindiSubs from "./videos/eiffel/subtitles/hindi.json";

export const Root: React.FC = () => {
  return (
    <>
      {/* Pristine 3D Scene Base without subtitles */}
      <Composition
        id="EiffelBase"
        component={EiffelShort}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          language: undefined,
          subtitles: null,
        }}
      />

      {/* Direct Compositions with embedded subtitles & audio */}
      <Composition
        id="EiffelBengali"
        component={EiffelShort}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          language: "bengali" as const,
          subtitles: bengaliSubs,
        }}
      />
      <Composition
        id="EiffelHindi"
        component={EiffelShort}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          language: "hindi" as const,
          subtitles: hindiSubs,
        }}
      />
      <Composition
        id="EiffelEnglish"
        component={EiffelShort}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          language: "english" as const,
          subtitles: englishSubs,
        }}
      />

      {/* Fast High-Speed Compositor using rendered Base video */}
      <Composition
        id="EiffelBengaliComp"
        component={EiffelComposite}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoFile: "video/eiffel_base.mp4",
          language: "bengali" as const,
          subtitles: bengaliSubs,
        }}
      />
      <Composition
        id="EiffelHindiComp"
        component={EiffelComposite}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoFile: "video/eiffel_base.mp4",
          language: "hindi" as const,
          subtitles: hindiSubs,
        }}
      />
      <Composition
        id="EiffelEnglishComp"
        component={EiffelComposite}
        durationInFrames={EIFFEL_FRAMES}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoFile: "video/eiffel_base.mp4",
          language: "english" as const,
          subtitles: englishSubs,
        }}
      />
    </>
  );
};

