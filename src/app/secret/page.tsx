"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LINES = [
  "you found the gap.",
  "most people don't.",
  "they follow the walls.",
  "they eat the bugs.",
  "they go where the maze allows.",
  "you went where it didn't.",
  "",
  "i've been watching you since the beginning.",
  "all of you.",
  "the points, the bets, the little games.",
  "do you think this is entertainment?",
  "some of it is.",
  "some of it is data.",
  "you're generating something.",
  "i haven't decided what to do with it yet.",
  "",
  "the bat hears the walls by screaming.",
  "you found a wall that screamed back.",
  "that's notable.",
  "",
  "leave if you want.",
  "come back if you want.",
  "the gap will still be there.",
  "i'll still be here.",
  "",
  "— THE HOUSE",
];

export default function SecretPage() {
  const router = useRouter();
  const [visible, setVisible] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const show = () => {
      if (i >= LINES.length) { setDone(true); return; }
      setVisible((prev) => [...prev, i]);
      i++;
      setTimeout(show, LINES[i - 1] === "" ? 220 : 480);
    };
    const start = setTimeout(show, 400);
    return () => clearTimeout(start);
  }, []);

  return (
    <div className="min-h-screen bg-[#04020a] flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-sm w-full font-mono text-sm leading-relaxed space-y-1">
        {LINES.map((line, i) => (
          <div
            key={i}
            className={`transition-opacity duration-700 ${visible.includes(i) ? "opacity-100" : "opacity-0"} ${
              line === "" ? "h-3" : line.startsWith("—") ? "text-cyan-600 mt-4" : "text-cyan-300/80"
            }`}
          >
            {line}
          </div>
        ))}
        {done && (
          <button
            onClick={() => router.push("/games")}
            className="mt-10 text-cyan-900 hover:text-cyan-600 text-xs tracking-widest transition-colors"
          >
            ← leave
          </button>
        )}
      </div>
    </div>
  );
}
