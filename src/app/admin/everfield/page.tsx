"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type Response = { id: number; userId: number; response: string; sentToScott: boolean; createdAt: string; user: { username: string } };
type Stage = {
  id: number;
  order: number;
  title: string;
  storyText: string;
  playerPrompt: string;
  isActive: boolean;
  isPublished: boolean;
  responses: Response[];
};

type MadLibEntry = { id: number; madLibId: number; responses: string; user: { username: string } };
type MadLib = {
  id: number;
  title: string;
  slots: string;
  realVersion: string;
  isActive: boolean;
  stageId: number | null;
  entries: MadLibEntry[];
};

type Clue = { id: number; slug: string; pagePath: string; hintText: string; flavorText: string; isActive: boolean; order: number; discoveries: { user: { username: string }; discoveredAt: string }[] };

type AdminData = {
  stages: Stage[];
  madLibs: MadLib[];
  clues: Clue[];
  config: { active: boolean; currentStageId: number | null } | null;
};

export default function EverFieldAdmin() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stages" | "madlibs" | "clues" | "config">("stages");
  const [msg, setMsg] = useState<string | null>(null);

  // Stage editor
  const [editStage, setEditStage] = useState<Partial<Stage & { id?: number }> | null>(null);
  const [stageSaving, setStageSaving] = useState(false);

  // MadLib editor
  const [editMadLib, setEditMadLib] = useState<Partial<MadLib & { slotsRaw: string }> | null>(null);
  const [mlSaving, setMlSaving] = useState(false);

  // Clue editor
  const [editClue, setEditClue] = useState<Partial<Clue> | null>(null);
  const [clueSaving, setClueSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (!d.user || !d.user.isAdmin) router.push("/"); });
    loadData();
  }, [router]);

  async function loadData() {
    const r = await fetch("/api/admin/everfield");
    if (!r.ok) { router.push("/"); return; }
    const d = await r.json();
    setData(d);
    setLoading(false);
  }

  async function toggleEvent(active: boolean) {
    await fetch("/api/admin/everfield", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setMsg(active ? "Event activated." : "Event deactivated.");
    loadData();
  }

  async function setCurrentStage(id: number | null) {
    await fetch("/api/admin/everfield", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStageId: id }),
    });
    setMsg("Current stage updated.");
    loadData();
  }

  async function saveStage() {
    if (!editStage) return;
    setStageSaving(true);
    const r = await fetch("/api/admin/everfield/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editStage),
    });
    const j = await r.json();
    setStageSaving(false);
    if (j.ok) { setMsg("Stage saved."); setEditStage(null); loadData(); }
    else setMsg(j.error ?? "Error");
  }

  async function saveMadLib() {
    if (!editMadLib) return;
    setMlSaving(true);
    const payload = { ...editMadLib, slots: editMadLib.slotsRaw ?? editMadLib.slots };
    const r = await fetch("/api/admin/everfield/madlib", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    setMlSaving(false);
    if (j.ok) { setMsg("Mad lib saved."); setEditMadLib(null); loadData(); }
    else setMsg(j.error ?? "Error");
  }

  async function saveClue() {
    if (!editClue) return;
    setClueSaving(true);
    const r = await fetch("/api/admin/everfield/clue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editClue),
    });
    const j = await r.json();
    setClueSaving(false);
    if (j.ok) { setMsg("Clue saved."); setEditClue(null); loadData(); }
    else setMsg(j.error ?? "Error");
  }

  function exportResponses(stage: Stage) {
    const lines = stage.responses.map(
      (r) => `=== ${r.user.username.toUpperCase()} ===\n${r.response}\n`
    );
    const blob = new Blob([`STAGE ${stage.order}: ${stage.title}\n${"─".repeat(40)}\n\n${lines.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `everfield-stage${stage.order}-responses.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMadLibsFunny(ml: MadLib) {
    const slots: { label: string; type: string }[] = JSON.parse(ml.slots);
    // Interleave entries: take slot i from a different player each time
    const lines = ["=== THE FUNNY VERSION ===\n"];
    slots.forEach((slot, i) => {
      const byPlayer = ml.entries.map((e) => JSON.parse(e.responses)[i]).filter(Boolean);
      const pick = byPlayer[i % byPlayer.length] ?? "(blank)";
      lines.push(`[${slot.label.toUpperCase()}] → ${pick}  (from ${ml.entries[i % ml.entries.length]?.user.username ?? "?"})`);
    });
    lines.push("\n=== THE REAL VERSION ===\n");
    lines.push(ml.realVersion || "(not written yet)");

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `madlib-${ml.id}-output.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-stone-600 font-mono text-sm animate-pulse">Loading...</div>;

  const TABS = [
    { key: "stages", label: "Stages & Responses" },
    { key: "madlibs", label: "Mad Libs" },
    { key: "clues", label: "Clues" },
    { key: "config", label: "Config" },
  ] as const;

  return (
    <div className="min-h-screen bg-black text-stone-300 font-mono">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        <div className="flex items-center justify-between">
          <h1 className="text-lg text-stone-200">Everfield — Admin</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded border ${data?.config?.active ? "border-green-800 text-green-500" : "border-red-950 text-red-800"}`}>
              {data?.config?.active ? "EVENT LIVE" : "INACTIVE"}
            </span>
            <button
              onClick={() => toggleEvent(!data?.config?.active)}
              className="text-xs px-3 py-1 border border-stone-700 rounded hover:border-stone-500 text-stone-400 transition-colors"
            >
              {data?.config?.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="bg-stone-900 border border-stone-700 rounded px-4 py-2 text-xs text-stone-400 flex items-center justify-between">
            {msg}
            <button onClick={() => setMsg(null)} className="text-stone-600 hover:text-stone-400 ml-4">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-stone-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs transition-colors ${tab === t.key ? "text-stone-200 border-b-2 border-stone-400 -mb-px" : "text-stone-600 hover:text-stone-400"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── STAGES ── */}
        {tab === "stages" && (
          <div className="space-y-6">
            <button
              onClick={() => setEditStage({ order: (data?.stages.length ?? 0) + 1, title: "", playerPrompt: "", storyText: "", isActive: false, isPublished: false })}
              className="text-xs px-3 py-1.5 border border-stone-700 rounded hover:border-stone-500 text-stone-400 transition-colors"
            >
              + New Stage
            </button>

            {editStage !== null && (
              <div className="bg-stone-950 border border-stone-700 rounded p-5 space-y-4">
                <p className="text-xs text-stone-500">{editStage.id ? `Editing Stage ${editStage.order}` : "New Stage"}</p>
                {[
                  { key: "order", label: "Order", type: "number" },
                  { key: "title", label: "Title", type: "text" },
                  { key: "playerPrompt", label: "Player Prompt", type: "textarea" },
                  { key: "storyText", label: "Story Text (Scott's chapter)", type: "textarea" },
                  { key: "ttsAudioUrl", label: "TTS Audio URL (optional)", type: "text" },
                ].map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-stone-500">{label}</label>
                    {type === "textarea" ? (
                      <textarea
                        className="w-full bg-black border border-stone-800 rounded px-3 py-2 text-stone-300 text-sm resize-none h-28 focus:outline-none focus:border-stone-600"
                        value={(editStage as Record<string, unknown>)[key] as string ?? ""}
                        onChange={(e) => setEditStage((p) => ({ ...p, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type={type}
                        className="w-full bg-black border border-stone-800 rounded px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600"
                        value={(editStage as Record<string, unknown>)[key] as string ?? ""}
                        onChange={(e) => setEditStage((p) => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-6 text-xs">
                  <label className="flex items-center gap-2 text-stone-400 cursor-pointer">
                    <input type="checkbox" checked={!!editStage.isActive} onChange={(e) => setEditStage((p) => ({ ...p, isActive: e.target.checked }))} />
                    Players can respond
                  </label>
                  <label className="flex items-center gap-2 text-stone-400 cursor-pointer">
                    <input type="checkbox" checked={!!editStage.isPublished} onChange={(e) => setEditStage((p) => ({ ...p, isPublished: e.target.checked }))} />
                    Story visible to players
                  </label>
                </div>
                <div className="flex gap-3">
                  <button onClick={saveStage} disabled={stageSaving} className="text-xs px-4 py-1.5 bg-stone-800 border border-stone-600 rounded hover:border-stone-400 disabled:opacity-40 transition-colors">
                    {stageSaving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditStage(null)} className="text-xs px-4 py-1.5 border border-stone-800 rounded hover:border-stone-600 text-stone-500 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {data?.stages.map((stage) => (
              <div key={stage.id} className="border border-stone-800/60 rounded p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500 text-xs">STAGE {stage.order}</span>
                    <span className="text-stone-300 text-sm">{stage.title}</span>
                    {stage.isActive && <span className="text-green-700 text-xs">[accepting responses]</span>}
                    {stage.isPublished && <span className="text-blue-800 text-xs">[published]</span>}
                    {data.config?.currentStageId === stage.id && <span className="text-yellow-700 text-xs">[current]</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditStage(stage)} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">Edit</button>
                    <button onClick={() => setCurrentStage(stage.id)} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">Set Current</button>
                    <button onClick={() => exportResponses(stage)} disabled={stage.responses.length === 0} className="text-xs text-stone-500 hover:text-stone-300 disabled:opacity-30 transition-colors">Export for Scott ↓</button>
                  </div>
                </div>

                <p className="text-stone-600 text-xs italic">&ldquo;{stage.playerPrompt}&rdquo;</p>

                {stage.responses.length === 0 ? (
                  <p className="text-stone-700 text-xs">No responses yet.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-stone-600 text-xs">{stage.responses.length} response{stage.responses.length !== 1 ? "s" : ""}:</p>
                    {stage.responses.map((r) => (
                      <div key={r.id} className="bg-stone-950 border border-stone-900 rounded p-3 space-y-1">
                        <p className="text-stone-500 text-xs">{r.user.username}</p>
                        <p className="text-stone-300 text-sm leading-6 whitespace-pre-wrap">{r.response}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── MAD LIBS ── */}
        {tab === "madlibs" && (
          <div className="space-y-6">
            <button
              onClick={() => setEditMadLib({ title: "", slotsRaw: '[{"label":"a noun","type":"noun"}]', realVersion: "", isActive: false })}
              className="text-xs px-3 py-1.5 border border-stone-700 rounded hover:border-stone-500 text-stone-400 transition-colors"
            >
              + New Mad Lib
            </button>

            {editMadLib !== null && (
              <div className="bg-stone-950 border border-stone-700 rounded p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-stone-500">Title</label>
                  <input type="text" className="w-full bg-black border border-stone-800 rounded px-3 py-1.5 text-sm text-stone-300 focus:outline-none focus:border-stone-600" value={editMadLib.title ?? ""} onChange={(e) => setEditMadLib((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-stone-500">Slots (JSON array of {"{label, type}"})</label>
                  <textarea className="w-full bg-black border border-stone-800 rounded px-3 py-2 text-sm text-stone-300 font-mono resize-none h-28 focus:outline-none focus:border-stone-600" value={editMadLib.slotsRaw ?? editMadLib.slots ?? ""} onChange={(e) => setEditMadLib((p) => ({ ...p, slotsRaw: e.target.value }))} />
                  <p className="text-stone-700 text-xs">e.g. {"[{\"label\":\"a place\",\"type\":\"noun\"},{\"label\":\"an emotion\",\"type\":\"adjective\"}]"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-stone-500">Real Version (Scott&apos;s canonical story — paste in after the event)</label>
                  <textarea className="w-full bg-black border border-stone-800 rounded px-3 py-2 text-sm text-stone-300 resize-none h-28 focus:outline-none focus:border-stone-600" value={editMadLib.realVersion ?? ""} onChange={(e) => setEditMadLib((p) => ({ ...p, realVersion: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
                  <input type="checkbox" checked={!!editMadLib.isActive} onChange={(e) => setEditMadLib((p) => ({ ...p, isActive: e.target.checked }))} />
                  Active (players can fill in)
                </label>
                <div className="flex gap-3">
                  <button onClick={saveMadLib} disabled={mlSaving} className="text-xs px-4 py-1.5 bg-stone-800 border border-stone-600 rounded hover:border-stone-400 disabled:opacity-40 transition-colors">
                    {mlSaving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditMadLib(null)} className="text-xs px-4 py-1.5 border border-stone-800 rounded text-stone-500 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {data?.madLibs.map((ml) => (
              <div key={ml.id} className="border border-stone-800/60 rounded p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-stone-300 text-sm">{ml.title}</span>
                    {ml.isActive && <span className="text-green-700 text-xs">[active]</span>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { const parsed = JSON.parse(ml.slots); setEditMadLib({ ...ml, slotsRaw: JSON.stringify(parsed, null, 2) }); }} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">Edit</button>
                    <button onClick={() => exportMadLibsFunny(ml)} disabled={ml.entries.length === 0} className="text-xs text-stone-500 hover:text-stone-300 disabled:opacity-30 transition-colors">Export both versions ↓</button>
                  </div>
                </div>
                <p className="text-stone-600 text-xs">{ml.entries.length} entr{ml.entries.length !== 1 ? "ies" : "y"} submitted</p>
                {ml.entries.length > 0 && (
                  <div className="space-y-2">
                    {(() => {
                      const slots: { label: string }[] = JSON.parse(ml.slots);
                      return ml.entries.map((e) => {
                        const answers: string[] = JSON.parse(e.responses);
                        return (
                          <div key={e.id} className="bg-stone-950 border border-stone-900 rounded p-3 space-y-1">
                            <p className="text-stone-500 text-xs">{e.user.username}</p>
                            <div className="flex flex-wrap gap-2">
                              {answers.map((a, i) => (
                                <span key={i} className="text-xs bg-stone-900 border border-stone-800 rounded px-2 py-0.5 text-stone-300">
                                  {slots[i]?.label}: <strong>{a}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── CLUES ── */}
        {tab === "clues" && (
          <div className="space-y-6">
            <button
              onClick={() => setEditClue({ slug: "", pagePath: "", hintText: "", flavorText: "", isActive: false, order: (data?.clues.length ?? 0) + 1 })}
              className="text-xs px-3 py-1.5 border border-stone-700 rounded hover:border-stone-500 text-stone-400 transition-colors"
            >
              + New Clue
            </button>

            {editClue !== null && (
              <div className="bg-stone-950 border border-stone-700 rounded p-5 space-y-4">
                {[
                  { key: "order", label: "Order", type: "number" },
                  { key: "slug", label: "Slug (unique ID, e.g. transmission-1)", type: "text" },
                  { key: "pagePath", label: "Page path where it lives (e.g. /feed)", type: "text" },
                  { key: "hintText", label: "Public hint text (cryptic, shown on Everfield page)", type: "text" },
                  { key: "flavorText", label: "Flavor text (what The House says when found)", type: "textarea" },
                ].map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-stone-500">{label}</label>
                    {type === "textarea" ? (
                      <textarea className="w-full bg-black border border-stone-800 rounded px-3 py-2 text-sm text-stone-300 resize-none h-20 focus:outline-none focus:border-stone-600" value={(editClue as Record<string, unknown>)[key] as string ?? ""} onChange={(e) => setEditClue((p) => ({ ...p, [key]: e.target.value }))} />
                    ) : (
                      <input type={type} className="w-full bg-black border border-stone-800 rounded px-3 py-1.5 text-sm text-stone-300 focus:outline-none focus:border-stone-600" value={(editClue as Record<string, unknown>)[key] as string ?? ""} onChange={(e) => setEditClue((p) => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))} />
                    )}
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
                  <input type="checkbox" checked={!!editClue.isActive} onChange={(e) => setEditClue((p) => ({ ...p, isActive: e.target.checked }))} />
                  Active (visible in clue tracker)
                </label>
                <div className="flex gap-3">
                  <button onClick={saveClue} disabled={clueSaving} className="text-xs px-4 py-1.5 bg-stone-800 border border-stone-600 rounded hover:border-stone-400 disabled:opacity-40 transition-colors">
                    {clueSaving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditClue(null)} className="text-xs px-4 py-1.5 border border-stone-800 rounded text-stone-500 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {data?.clues.map((clue) => (
              <div key={clue.id} className="border border-stone-800/60 rounded p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500 text-xs">#{clue.order}</span>
                    <span className="text-stone-300 text-sm font-mono">{clue.slug}</span>
                    <span className="text-stone-600 text-xs">{clue.pagePath}</span>
                    {clue.isActive && <span className="text-green-700 text-xs">[active]</span>}
                  </div>
                  <button onClick={() => setEditClue(clue)} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">Edit</button>
                </div>
                <p className="text-stone-600 text-xs italic">&ldquo;{clue.hintText}&rdquo;</p>
                <p className="text-stone-600 text-xs">
                  Found by: {clue.discoveries.length === 0 ? "nobody yet" : clue.discoveries.map((d) => d.user.username).join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <div className="space-y-4 text-sm">
            <div className="bg-stone-950 border border-stone-800 rounded p-5 space-y-3">
              <p className="text-stone-500 text-xs">Current config</p>
              <pre className="text-stone-400 text-xs">{JSON.stringify(data?.config, null, 2)}</pre>
            </div>
            <div className="space-y-2">
              <p className="text-stone-500 text-xs">Set active stage:</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCurrentStage(null)} className="text-xs px-3 py-1 border border-stone-800 rounded hover:border-stone-600 text-stone-500 transition-colors">None</button>
                {data?.stages.map((s) => (
                  <button key={s.id} onClick={() => setCurrentStage(s.id)} className={`text-xs px-3 py-1 border rounded transition-colors ${data.config?.currentStageId === s.id ? "border-yellow-700 text-yellow-600" : "border-stone-800 hover:border-stone-600 text-stone-500"}`}>
                    Stage {s.order}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
