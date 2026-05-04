"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (pin !== confirmPin) {
      setError("PINs don't match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/feed");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Join the Fun</h1>
          <p className="text-slate-500">Create your account to start wagering</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">Pick a username</label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="e.g. zoe, dave, etc."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={2}
              maxLength={20}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="pin" className="label">Set a PIN (2-4 digits)</label>
            <input
              id="pin"
              type="password"
              className="input text-center tracking-[0.5em] text-lg"
              placeholder="----"
              maxLength={4}
              inputMode="numeric"
              pattern="\d{2,4}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPin" className="label">Confirm PIN</label>
            <input
              id="confirmPin"
              type="password"
              className="input text-center tracking-[0.5em] text-lg"
              placeholder="----"
              maxLength={4}
              inputMode="numeric"
              pattern="\d{2,4}"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <p className="text-rose-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || pin.length < 2 || pin !== confirmPin}
            className="btn-primary w-full"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-400 hover:text-violet-300">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
