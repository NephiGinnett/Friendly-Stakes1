"use client";

import { useState } from "react";

interface Props {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PinConfirmModal({ label, onConfirm, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const d = await res.json();
      if (d.valid) {
        onConfirm();
      } else {
        setError("Incorrect PIN.");
        setPin("");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="w-full max-w-xs rounded-2xl bg-[rgb(22,22,32)] border border-violet-500/30 p-6 space-y-4 text-center shadow-2xl">
        <p className="text-slate-400 text-sm">🔒 Confirm with PIN</p>
        <p className="text-white font-semibold">{label}</p>
        <input
          type="password"
          className="input text-center tracking-[0.5em] text-lg w-full"
          placeholder="----"
          maxLength={4}
          inputMode="numeric"
          pattern="\d{2,4}"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && verify()}
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 btn-ghost">Cancel</button>
          <button onClick={verify} disabled={loading || pin.length < 2} className="flex-1 btn-primary">
            {loading ? "..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
