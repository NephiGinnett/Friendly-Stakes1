"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  modelSrc?: string; // path to .glb when ready — e.g. "/models/the-house.glb"
  size?: "sm" | "md" | "lg";
  enableTTS?: boolean;
  ttsText?: string;
};

const SIZE_MAP = { sm: 180, md: 280, lg: 420 };

// Atmospheric CSS placeholder — swap modelSrc in when the Blender file is ready.
function OrbPlaceholder({ px }: { px: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: px, height: px }}
    >
      {/* outer ring glow */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          width: px,
          height: px,
          background:
            "radial-gradient(ellipse at center, rgba(139,0,0,0.18) 0%, rgba(20,0,0,0.6) 60%, transparent 100%)",
          boxShadow: "0 0 60px 20px rgba(139,0,0,0.12)",
        }}
      />
      {/* ring 1 */}
      <div
        className="absolute rounded-full border border-red-900/30"
        style={{ width: px * 0.88, height: px * 0.88 }}
      />
      {/* ring 2 */}
      <div
        className="absolute rounded-full border border-red-900/20"
        style={{ width: px * 0.72, height: px * 0.72 }}
      />
      {/* core iris */}
      <div
        className="absolute rounded-full"
        style={{
          width: px * 0.52,
          height: px * 0.52,
          background:
            "radial-gradient(ellipse at 45% 42%, rgba(80,0,0,0.9) 0%, rgba(10,0,0,1) 70%)",
          boxShadow: "0 0 30px 8px rgba(139,0,0,0.25), inset 0 0 20px rgba(200,0,0,0.1)",
        }}
      />
      {/* pupil */}
      <div
        className="absolute rounded-full"
        style={{
          width: px * 0.22,
          height: px * 0.22,
          background:
            "radial-gradient(ellipse at center, rgba(220,20,20,0.9) 0%, rgba(80,0,0,1) 100%)",
          boxShadow: "0 0 12px 4px rgba(220,20,20,0.4)",
        }}
      />
      {/* reflection glint */}
      <div
        className="absolute rounded-full bg-white/10"
        style={{
          width: px * 0.05,
          height: px * 0.05,
          top: px * 0.3,
          left: px * 0.34,
        }}
      />
    </div>
  );
}

export default function HouseViewer({ modelSrc, size = "md", enableTTS, ttsText }: Props) {
  const px = SIZE_MAP[size];
  const [modelReady, setModelReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load model-viewer web component when a modelSrc is provided
  useEffect(() => {
    if (!modelSrc) return;
    if (customElements.get("model-viewer")) { setModelReady(true); return; }
    const script = document.createElement("script");
    script.type = "module";
    // TODO: replace with self-hosted build when going offline-first
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
    script.onload = () => setModelReady(true);
    document.head.appendChild(script);
  }, [modelSrc]);

  function speak() {
    if (!ttsText || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // TODO: swap window.speechSynthesis for Railway TTS endpoint when deployed
    // POST /api/tts { text } → returns audio/mpeg stream → play via AudioContext
    const utter = new SpeechSynthesisUtterance(ttsText);
    utter.rate = 0.88;
    utter.pitch = 0.7;
    utter.volume = 1;
    // Pick a low, deliberate voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.name.toLowerCase().includes("daniel") ||
        v.name.toLowerCase().includes("alex") ||
        v.lang === "en-GB"
    );
    if (preferred) utter.voice = preferred;
    utter.onend = () => setSpeaking(false);
    utterRef.current = utter;
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: px, height: px }}>
        {modelSrc && modelReady ? (
          // @ts-expect-error — model-viewer is a custom element
          <model-viewer
            src={modelSrc}
            alt="The House"
            auto-rotate
            rotation-per-second="6deg"
            camera-controls
            style={{ width: "100%", height: "100%", background: "transparent" }}
            shadow-intensity="0"
            exposure="0.6"
          />
        ) : (
          <OrbPlaceholder px={px} />
        )}
      </div>

      {enableTTS && ttsText && (
        <button
          onClick={speak}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-red-900/40 text-red-400/70 text-xs font-mono hover:border-red-700/60 hover:text-red-300 transition-colors"
        >
          <span>{speaking ? "▐▐" : "▶"}</span>
          <span>{speaking ? "STOP" : "HEAR THE HOUSE"}</span>
        </button>
      )}
    </div>
  );
}
