"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate } from "@/lib/utils";
import { getDisplayVersion } from "@/lib/version";
import { ACHIEVEMENTS } from "@/lib/achievements";

type User = { id: number; username: string; points: number; isAdmin: boolean; avatarAchievementId: string | null };
type WagerEntry = { userId: number; side: string; stake: number };
type Wager = {
  id: number; title: string; creatorStake: number; status: string;
  winnerSide: string | null; createdAt: string;
  creator: { id: number; username: string };
  entries: WagerEntry[];
};
type PointLog = { id: number; amount: number; reason: string; createdAt: string };
type PlayerInfo = { id: number; username: string; points: number; isAdmin: boolean; avatarAchievementId?: string | null };
type AchievementBadge = { id: string; name: string; emoji: string; imageUrl: string | null; unlockedAt: string };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>([]);
  const [viewing, setViewing] = useState<string>(""); // username being viewed; "" = self
  const [profilePlayer, setProfilePlayer] = useState<PlayerInfo | null>(null);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [achievements, setAchievements] = useState<AchievementBadge[]>([]);
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [discordUserId, setDiscordUserId] = useState<string | null>(null);
  const [discordInput, setDiscordInput] = useState("");
  const [discordMsg, setDiscordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [discordLoading, setDiscordLoading] = useState(false);

  // Load notification preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem("notifsEnabled");
      if (stored === "false") setNotifsEnabled(false);
    } catch { /* ignore */ }
  }, []);

  // Load user list and auth check once
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/users")
      .then((r) => r.ok ? r.json() : [])
      .then(setAllUsers);
    fetch("/api/settings/discord")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setDiscordUserId(d.discordUserId); });
  }, [router]);

  // Reload profile data whenever viewing target or logged-in user changes
  useEffect(() => {
    if (!user) return;
    if (!viewing) {
      // Back to self
      setProfilePlayer(user);
      fetch("/api/wagers").then((r) => r.json()).then(setWagers);
      fetch("/api/point-log").then((r) => r.json()).then(setPointLogs);
      fetch("/api/achievements")
        .then((r) => r.ok ? r.json() : [])
        .then((data: { id: string; name: string; emoji: string; imageUrl: string | null; unlockedAt: string | null; unlocked: boolean }[]) =>
          setAchievements(data.filter(a => a.unlocked && a.unlockedAt).map(a => ({
            id: a.id, name: a.name, emoji: a.emoji, imageUrl: a.imageUrl ?? null, unlockedAt: a.unlockedAt!,
          })))
        );
    } else {
      fetch(`/api/players/${viewing}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setProfilePlayer(data.player);
            setWagers(data.wagers);
            setPointLogs([]);
            setAchievements(data.achievements ?? []);
          }
        });
    }
    setTooltipId(null);
  }, [viewing, user]);

  const saveDiscord = async () => {
    setDiscordLoading(true);
    setDiscordMsg(null);
    const res = await fetch("/api/settings/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordUserId: discordInput.trim() || null }),
    });
    const d = await res.json();
    setDiscordLoading(false);
    if (res.ok) {
      setDiscordUserId(d.discordUserId);
      setDiscordInput("");
      setDiscordMsg({ text: d.discordUserId ? "Linked! Check your Discord DMs for a confirmation." : "Discord unlinked.", ok: true });
    } else {
      setDiscordMsg({ text: d.error, ok: false });
    }
  };

  const toggleNotifs = () => {
    const next = !notifsEnabled;
    setNotifsEnabled(next);
    try { localStorage.setItem("notifsEnabled", String(next)); } catch { /* ignore */ }
  };

  if (!user || !profilePlayer) return null;

  const isSelf = profilePlayer.id === user.id;

  const getPlayerSide = (w: Wager) => {
    if (w.creator.id === profilePlayer.id) return "for";
    return w.entries.find((e) => e.userId === profilePlayer.id)?.side ?? null;
  };

  const myWagers = wagers.filter(
    (w) => w.creator.id === profilePlayer.id || w.entries.some((e) => e.userId === profilePlayer.id)
  );

  const wins = myWagers.filter(
    (w) => w.status === "settled" && w.winnerSide === getPlayerSide(w)
  ).length;
  const losses = myWagers.filter(
    (w) => w.status === "settled" && w.winnerSide !== null && w.winnerSide !== getPlayerSide(w)
  ).length;
  const active = myWagers.filter((w) =>
    ["open", "started", "voting"].includes(w.status)
  ).length;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-bold text-white shrink-0">Profile</h1>
          <select
            className="input flex-1 text-sm py-1.5"
            value={viewing || user.username}
            onChange={(e) => setViewing(e.target.value === user.username ? "" : e.target.value)}
          >
            <option value={user.username}>{user.username} (you)</option>
            {allUsers
              .filter((u) => u.username !== user.username)
              .map((u) => (
                <option key={u.id} value={u.username}>{u.username}</option>
              ))}
          </select>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <div className="card text-center space-y-3">
          {(() => {
            const avatarId = profilePlayer.avatarAchievementId;
            const avatarDef = avatarId ? ACHIEVEMENTS[avatarId as keyof typeof ACHIEVEMENTS] : null;
            const avatarImg = avatarDef ? (avatarDef as { imageUrl?: string }).imageUrl : null;
            return avatarImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarImg} alt={avatarDef?.name ?? "avatar"} className="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-violet-500/40" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-violet-600/30 flex items-center justify-center text-2xl font-bold text-violet-300 mx-auto">
                {profilePlayer.username[0].toUpperCase()}
              </div>
            );
          })()}
          <h2 className="text-xl font-bold text-white">{profilePlayer.username}</h2>
          <PointsBadge points={profilePlayer.points} />
          {profilePlayer.isAdmin && (
            <span className="inline-block bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">Admin</span>
          )}

          {/* Achievement badges */}
          {achievements.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center pt-1 relative">
              {achievements.map((a) => (
                <div key={a.id} className="relative">
                  <button
                    onClick={() => setTooltipId(tooltipId === a.id ? null : a.id)}
                    className="hover:scale-125 transition-transform block"
                    title={a.name}
                  >
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.imageUrl} alt={a.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <span className="text-xl leading-none">{a.emoji}</span>
                    )}
                  </button>
                  {tooltipId === a.id && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 rounded-xl bg-slate-900 border border-white/10 p-3 text-left shadow-xl">
                      <p className="text-xs font-bold text-white">{a.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(a.unlockedAt).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "numeric", minute: "2-digit", hour12: true,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-emerald-400">{wins}</p>
            <p className="text-xs text-slate-500">Wins</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-rose-400">{losses}</p>
            <p className="text-xs text-slate-500">Losses</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-sky-400">{active}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">
            {isSelf ? "Your Wagers" : `${profilePlayer.username}'s Wagers`}
          </h3>
          {myWagers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No wagers yet</p>
          ) : (
            <div className="space-y-2">
              {myWagers.map((w) => {
                const side = getPlayerSide(w);
                const won = w.status === "settled" && w.winnerSide === side;
                const lost = w.status === "settled" && w.winnerSide !== null && w.winnerSide !== side;
                const pool = w.creatorStake + w.entries.reduce((sum, e) => sum + e.stake, 0);
                return (
                  <button
                    key={w.id}
                    onClick={() => router.push(`/wagers/${w.id}`)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{w.title}</p>
                      {won && <span className="text-xs text-emerald-400 font-medium">Won +{formatPoints(pool)}</span>}
                      {lost && <span className="text-xs text-rose-400 font-medium">Lost</span>}
                      {!won && !lost && <span className="text-xs text-slate-500">{w.status}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(w.createdAt)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isSelf && (
          <div>
            <h3 className="font-semibold text-white mb-3">Point History</h3>
            {pointLogs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No point changes yet</p>
            ) : (
              <div className="space-y-1.5">
                {pointLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 text-sm">
                    <span className="text-slate-300 truncate pr-3">{log.reason}</span>
                    <span className={`shrink-0 font-semibold tabular-nums ${log.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {log.amount >= 0 ? `+${log.amount}` : log.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isSelf && (user.isAdmin || new Date() >= new Date("2026-05-16T18:00:00")) && (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎮</span>
              <div>
                <p className="text-sm font-medium text-white">Discord Notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">Get DMs when someone challenges you, votes open, and more</p>
              </div>
            </div>

            {discordUserId ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <span className="text-emerald-400 text-sm">✓ Linked</span>
                  <span className="text-xs text-slate-500 font-mono ml-1">{discordUserId}</span>
                </div>
                <button
                  onClick={() => { setDiscordInput(""); saveDiscord(); }}
                  disabled={discordLoading}
                  className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Unlink Discord
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Open Discord → Settings → Advanced → enable Developer Mode → right-click your name → Copy User ID.
                </p>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm font-mono"
                    placeholder="Your Discord User ID"
                    value={discordInput}
                    onChange={(e) => setDiscordInput(e.target.value)}
                    maxLength={20}
                  />
                  <button
                    onClick={saveDiscord}
                    disabled={discordLoading || !discordInput.trim()}
                    className="btn-primary text-sm"
                  >
                    {discordLoading ? "..." : "Link"}
                  </button>
                </div>
              </div>
            )}

            {discordMsg && (
              <p className={`text-xs ${discordMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>
                {discordMsg.text}
              </p>
            )}
          </div>
        )}

        {isSelf && (
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Activity Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Red dots on nav when action is needed</p>
            </div>
            <button
              onClick={toggleNotifs}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifsEnabled ? "bg-violet-600" : "bg-slate-600"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifsEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
        )}
      </div>

        {isSelf && (
          <p className="text-center text-xs text-slate-700 pb-2">
            Friendly Stakes v{getDisplayVersion(user.isAdmin)}
          </p>
        )}

      <Navbar />
    </div>
  );
}
