"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwAssistUsername, setPwAssistUsername] = useState("");
  const [pwAssistMsg, setPwAssistMsg] = useState("");
  const [pwAssistLoading, setPwAssistLoading] = useState(false);
  const [showAssist, setShowAssist] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.push("/feed");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const requestPwAssist = async () => {
    if (!pwAssistUsername.trim()) return;
    setPwAssistLoading(true);
    setPwAssistMsg("");
    try {
      const res = await fetch("/api/auth/request-pw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: pwAssistUsername.trim() }),
      });
      const d = await res.json();
      setPwAssistMsg(res.ok ? "Password sent to your Discord DM!" : d.error);
    } catch {
      setPwAssistMsg("Something went wrong.");
    } finally {
      setPwAssistLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Friendly Stakes</h1>
          <p className="text-slate-500">Place fun wagers with your crew</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-rose-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <button
          onClick={() => { setShowAssist(!showAssist); setPwAssistMsg(""); }}
          className="w-full mt-3 text-sm text-slate-500 hover:text-violet-400 transition-colors"
        >
          Request password assistance
        </button>

        {showAssist && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              className="input w-full"
              placeholder="Your username"
              value={pwAssistUsername}
              onChange={(e) => setPwAssistUsername(e.target.value)}
            />
            <button
              onClick={requestPwAssist}
              disabled={pwAssistLoading || !pwAssistUsername.trim()}
              className="btn-ghost w-full text-sm"
            >
              {pwAssistLoading ? "Sending..." : "Send password to my Discord"}
            </button>
            {pwAssistMsg && (
              <p className={`text-sm text-center ${pwAssistMsg.includes("sent") ? "text-emerald-400" : "text-rose-400"}`}>
                {pwAssistMsg}
              </p>
            )}
          </div>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          New here?{" "}
          <Link href="/register" className="text-violet-400 hover:text-violet-300">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
