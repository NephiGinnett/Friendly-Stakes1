"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HouseViewer from "@/components/HouseViewer";

type Slot = { label: string; type: string };
type MadLib = { id: number; title: string; slots: Slot[]; stageId: number | null };
type Stage = {
  id: number;
  order: number;
  title: string;
  storyText: string;
  playerPrompt: string;
  isActive: boolean;
  ttsAudioUrl: string;
};
type Clue = { id: number; slug: string; hintText: string; pagePath: string; order: number; discovered: boolean };
type EverFieldData = {
  active: boolean;
  stages: Stage[];
  currentStageId: number | null;
  currentStagePrompt: string | null;
  myResponse: string | null;
  madLib: MadLib | null;
  myMadLibEntry: string[] | null;
  clues: Clue[];
};

const NOISE = "!@#$%^&*-+=|;:<>?/~{}[]".split("");
function glitch(text: string): string {
  return text
    .split("")
    .map((c) => (Math.random() < 0.06 ? NOISE[Math.floor(Math.random() * NOISE.length)] : c))
    .join("");
}

export default function EverFieldPage() {
  const router = useRouter();
  const [data, setData] = useState<EverFieldData | null>(null);
  const [loading, setLoading] = useState(true);

  // Story prompt state
  const [responseText, setResponseText] = useState("");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mad libs state
  const [madLibAnswers, setMadLibAnswers] = useState<string[]>([]);
  const [mlMsg, setMlMsg] = useState<string | null>(null);
  const [mlSubmitting, setMlSubmitting] = useState(false);
  const [showMadLib, setShowMadLib] = useState(false);

  // Glitch title
  const [titleText, setTitleText] = useState("F R I E N D L Y   S T A K E S  ×  E V E R F I E L D");
  const titleBase = "F R I E N D L Y   S T A K E S  ×  E V E R F I E L D";
  const glitchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // random glitch bursts on the title
    glitchRef.current = setInterval(() => {
      if (Math.random() < 0.2) {
        setTitleText(glitch(titleBase));
        setTimeout(() => setTitleText(titleBase), 120);
      }
    }, 3000);
    return () => { if (glitchRef.current) clearInterval(glitchRef.current); };
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (!d.user) router.push("/login"); });
    fetch("/api/everfield/current")
      .then((r) => r.json())
      .then((d: EverFieldData) => { setData(d); setLoading(false); });
  }, [router]);

  useEffect(() => {
    if (data?.myResponse) setResponseText(data.myResponse);
    if (data?.madLib && data.myMadLibEntry) setMadLibAnswers(data.myMadLibEntry);
    else if (data?.madLib) setMadLibAnswers(Array(data.madLib.slots.length).fill(""));
  }, [data]);

  async function submitResponse() {
    if (!data?.currentStageId || !responseText.trim()) return;
    setSubmitting(true);
    const r = await fetch("/api/everfield/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: data.currentStageId, response: responseText }),
    });
    const j = await r.json();
    setSubmitMsg(j.ok ? "Received. The House has noted it." : j.error ?? "Error");
    setSubmitting(false);
  }

  async function submitMadLib() {
    if (!data?.madLib) return;
    if (madLibAnswers.some((a) => !a.trim())) {
      setMlMsg("Fill in all the blanks first.");
      return;
    }
    setMlSubmitting(true);
    const r = await fetch("/api/everfield/madlib", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ madLibId: data.madLib.id, responses: madLibAnswers }),
    });
    const j = await r.json();
    setMlMsg(j.ok ? "Words received. The House will use them." : j.error ?? "Error");
    setMlSubmitting(false);
  }

  async function discoverClue(slug: string) {
    const r = await fetch("/api/everfield/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const j = await r.json();
    if (j.ok) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              clues: prev.clues.map((c) =>
                c.slug === slug ? { ...c, discovered: true } : c
              ),
            }
          : prev
      );
      alert(j.flavorText || "You found something.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Navbar />
        <p className="font-mono text-red-900/60 text-sm animate-pulse">
          {">> CONNECTING TO THE HOUSE..."}
        </p>
      </div>
    );
  }

  if (!data?.active) {
    return (
      <div className="min-h-screen bg-black text-red-900/60 font-mono">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4 text-center">
          <HouseViewer size="lg" />
          <pre className="text-red-900/40 text-xs leading-5">{`  ░░░░░░▒▒▒▒▒▓▓▓▓▓████▓▓▓▓▓▒▒▒▒▒░░░░░░
  ░                                  ░
  ░   T H E   H O U S E              ░
  ░   is not yet open for this.      ░
  ░                                  ░
  ░░░░░░▒▒▒▒▒▓▓▓▓▓████▓▓▓▓▓▒▒▒▒▒░░░░░░`}</pre>
          <p className="text-red-900/50 text-sm">Something is coming. The House has not forgotten you.</p>
        </div>
      </div>
    );
  }

  const currentStage = data.stages.find((s) => s.id === data.currentStageId);

  return (
    <div className="min-h-screen bg-black text-stone-300 font-mono">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-14">

        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-red-900/50 text-xs tracking-widest uppercase">
            {titleText}
          </p>
          <h1 className="text-2xl text-stone-200 tracking-wide">
            T H E &nbsp; H O U S E
          </h1>
          <p className="text-stone-500 text-sm italic">
            &ldquo;We have been watching longer than you have been playing.&rdquo;
          </p>
        </div>

        {/* The House portrait */}
        <div className="flex justify-center">
          {/* Swap modelSrc="/models/the-house.glb" here when the Blender file is ready */}
          <HouseViewer
            size="lg"
            enableTTS={!!currentStage?.storyText}
            ttsText={currentStage?.storyText || undefined}
          />
        </div>

        {/* Published story stages */}
        {data.stages.length > 0 && (
          <div className="space-y-10">
            {data.stages.map((stage) => (
              <div key={stage.id} className="border border-red-950/40 rounded p-6 space-y-4 bg-stone-950/40">
                <div className="flex items-center gap-3">
                  <span className="text-red-800/60 text-xs">STAGE {stage.order}</span>
                  <span className="text-stone-400 text-sm font-semibold">{stage.title}</span>
                </div>
                {stage.storyText ? (
                  <div className="text-stone-400 text-sm leading-7 whitespace-pre-wrap border-l-2 border-red-950/40 pl-4">
                    {stage.storyText}
                  </div>
                ) : (
                  <p className="text-stone-600 text-xs italic">
                    — The House is composing this chapter. Check back soon.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Active player prompt */}
        {data.currentStageId && currentStage?.isActive && (
          <div className="border border-red-900/50 rounded p-6 space-y-5 bg-red-950/10">
            <pre className="text-red-800/60 text-xs">{`  ╔═══════════════════════════════════════╗
  ║  >> STAGE ${currentStage.order} — YOUR RESPONSE DUE   ║
  ╚═══════════════════════════════════════╝`}</pre>
            <p className="text-stone-300 text-sm leading-7 italic">
              &ldquo;{currentStage.playerPrompt}&rdquo;
            </p>
            <p className="text-stone-600 text-xs">
              Your response is private. The House will see it. No other player will.
            </p>
            <textarea
              className="w-full bg-black border border-red-950/50 rounded p-3 text-stone-300 text-sm font-mono resize-none focus:outline-none focus:border-red-800/60 h-36"
              placeholder="Begin typing. The House is listening."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <button
                onClick={submitResponse}
                disabled={submitting || !responseText.trim()}
                className="px-4 py-2 bg-red-950/60 border border-red-800/40 text-red-300 text-xs rounded hover:bg-red-900/50 disabled:opacity-40 transition-colors"
              >
                {submitting ? "TRANSMITTING..." : "SUBMIT RESPONSE"}
              </button>
              {submitMsg && (
                <span className="text-stone-500 text-xs">{submitMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* Mad Libs */}
        {data.madLib && (
          <div className="border border-stone-800/50 rounded p-6 space-y-5 bg-stone-950/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-stone-500 text-xs tracking-widest uppercase">Mad Libs</p>
                <h2 className="text-stone-300 text-sm font-semibold mt-1">{data.madLib.title}</h2>
              </div>
              <button
                onClick={() => setShowMadLib((v) => !v)}
                className="text-stone-500 text-xs hover:text-stone-300 transition-colors"
              >
                {showMadLib ? "▲ HIDE" : "▼ FILL IN"}
              </button>
            </div>

            {showMadLib && (
              <div className="space-y-4">
                <p className="text-stone-600 text-xs">
                  Fill in each blank without knowing the story. The House will use your words — expect the real version, and expect the funny version.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.madLib.slots.map((slot, i) => (
                    <div key={i} className="space-y-1">
                      <label className="text-stone-500 text-xs capitalize">
                        {i + 1}. {slot.label}
                        <span className="text-stone-700 ml-1">({slot.type})</span>
                      </label>
                      <input
                        type="text"
                        className="w-full bg-black border border-stone-800/50 rounded px-3 py-1.5 text-stone-300 text-sm font-mono focus:outline-none focus:border-stone-600 placeholder:text-stone-700"
                        placeholder={`a ${slot.type}...`}
                        value={madLibAnswers[i] ?? ""}
                        onChange={(e) => {
                          const updated = [...madLibAnswers];
                          updated[i] = e.target.value;
                          setMadLibAnswers(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={submitMadLib}
                    disabled={mlSubmitting}
                    className="px-4 py-2 bg-stone-900 border border-stone-700/50 text-stone-300 text-xs rounded hover:border-stone-600 disabled:opacity-40 transition-colors"
                  >
                    {mlSubmitting ? "SUBMITTING..." : data.myMadLibEntry ? "UPDATE WORDS" : "SUBMIT WORDS"}
                  </button>
                  {mlMsg && <span className="text-stone-500 text-xs">{mlMsg}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clues / Easter eggs */}
        {data.clues.length > 0 && (
          <div className="border border-stone-900/50 rounded p-6 space-y-4 bg-stone-950/30">
            <p className="text-stone-600 text-xs tracking-widest uppercase">Transmissions</p>
            <p className="text-stone-600 text-xs">
              The House has hidden signals across the site. Find them.
            </p>
            <div className="space-y-3">
              {data.clues.map((clue) => (
                <div key={clue.slug} className="flex items-start gap-3">
                  <span className={`text-sm mt-0.5 ${clue.discovered ? "opacity-100" : "opacity-30"}`}>
                    {clue.discovered ? "👁" : "░"}
                  </span>
                  <div className="flex-1">
                    {clue.discovered ? (
                      <p className="text-stone-400 text-xs">
                        Transmission {clue.order}: <span className="italic text-stone-500">{clue.hintText}</span>
                        <span className="ml-2 text-green-900/60">[found]</span>
                      </p>
                    ) : (
                      <p className="text-stone-600 text-xs">
                        Transmission {clue.order}: <span className="italic">{clue.hintText || "..."}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Closing mark */}
        <div className="text-center space-y-2 pt-4 border-t border-stone-900/30">
          <p className="text-red-950/60 text-xs tracking-widest">
            ──────────── THE HOUSE ALWAYS KNOWS ────────────
          </p>
          <p className="text-stone-800 text-xs">👁</p>
        </div>

      </div>
    </div>
  );
}
