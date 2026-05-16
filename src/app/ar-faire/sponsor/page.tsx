"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";

type User = { id: number; username: string; points: number; isAdmin: boolean };

const TIER_RATES = [
  { rate: 250, label: "250 pts", tier: "rare", border: "border-blue-500", text: "text-blue-300", bg: "bg-blue-500/15", name: "Rare (Blue)" },
  { rate: 500, label: "500 pts", tier: "epic", border: "border-violet-500", text: "text-violet-300", bg: "bg-violet-500/15", name: "Epic (Purple)" },
  { rate: 1000, label: "1,000 pts", tier: "legendary", border: "border-amber-500", text: "text-amber-300", bg: "bg-amber-500/15", name: "Legendary (Gold)" },
];

// Bookmark: 2" × 7" ≈ aspect ratio 2:7 = width:height
const BM_W = 70;
const BM_H = 245;

type Question = { text: string; choiceA: string; choiceB: string; choiceC: string; correctIndex: number | null };

const emptyQuestion = (): Question => ({ text: "", choiceA: "", choiceB: "", choiceC: "", correctIndex: null });

export default function SponsorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [sponsorRate, setSponsorRate] = useState<250 | 500 | 1000>(250);
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion(), emptyQuestion(), emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Bookmark image crop
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropY, setCropY] = useState(0);
  const [dragStart, setDragStart] = useState<{ y: number; cropY: number } | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
  }, [router]);

  const selectedTier = TIER_RATES.find((t) => t.rate === sponsorRate)!;

  const updateQuestion = (i: number, field: keyof Question, value: string | number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addQuestion = () => {
    if (questions.length < 10) setQuestions((p) => [...p, emptyQuestion()]);
  };
  const removeQuestion = (i: number) => {
    if (questions.length > 5) setQuestions((p) => p.filter((_, idx) => idx !== i));
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setImgSrc(src);
      setCropY(0);
      const img = new Image();
      img.onload = () => {
        setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        imgRef.current = img;
        drawCrop(img, 0, img.naturalWidth, img.naturalHeight);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const drawCrop = (img: HTMLImageElement, yOffset: number, nw: number, nh: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = BM_W;
    canvas.height = BM_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bookmarkAspect = BM_H / BM_W; // tall bookmark ratio
    const imgAspect = nh / nw;

    if (imgAspect >= bookmarkAspect) {
      // Image is taller than bookmark ratio — fit width, scroll vertically
      const srcW = nw;
      const srcH = nw * bookmarkAspect;
      const maxY = nh - srcH;
      const clampedY = Math.max(0, Math.min(yOffset, maxY));
      ctx.drawImage(img, 0, clampedY, srcW, srcH, 0, 0, BM_W, BM_H);
    } else {
      // Image is wider than bookmark ratio — draw blurred background to fill,
      // then center the image scaled to fill width
      const scale = BM_W / nw;
      const drawH = nh * scale;
      const drawY = (BM_H - drawH) / 2 + yOffset;

      // Fill background with tier color
      const tierFill: Record<number, string> = { 250: "#1d4ed8", 500: "#7c3aed", 1000: "#b45309" };
      ctx.fillStyle = tierFill[sponsorRate] ?? "#334155";
      ctx.fillRect(0, 0, BM_W, BM_H);

      // Sharp image centered
      ctx.drawImage(img, 0, drawY, BM_W, drawH);
    }

    setCroppedDataUrl(canvas.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ y: e.clientY, cropY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !imgNaturalSize || !imgRef.current) return;
    const dy = e.clientY - dragStart.y;
    const img = imgRef.current;
    const { w: nw, h: nh } = imgNaturalSize;
    const bookmarkAspect = BM_H / BM_W;
    const imgAspect = nh / nw;

    let newY: number;
    if (imgAspect >= bookmarkAspect) {
      // Portrait: scroll within vertical crop window
      const srcH = nw * bookmarkAspect;
      const maxY = nh - srcH;
      const scale = nh / BM_H;
      newY = Math.max(0, Math.min(dragStart.cropY - dy * scale, maxY));
    } else {
      // Landscape: nudge the centered image up/down (limited range)
      const scale = BM_W / nw;
      const drawH = nh * scale;
      const maxOffset = (BM_H - drawH) / 2;
      newY = Math.max(-maxOffset, Math.min(dragStart.cropY - dy, maxOffset));
    }

    setCropY(newY);
    drawCrop(img, newY, nw, nh);
  };
  const onMouseUp = () => setIsDragging(false);

  const submit = async () => {
    setError("");
    if (!title.trim() || !author.trim()) { setError("Title and author required"); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim() || !q.choiceA.trim() || !q.choiceB.trim() || !q.choiceC.trim()) {
        setError(`Question ${i + 1} is incomplete.`); return;
      }
      if (q.correctIndex === null) { setError(`Select the correct answer for question ${i + 1}.`); return; }
    }
    if (user && user.points < sponsorRate) { setError("Not enough points"); return; }
    setLoading(true);
    const res = await fetch("/api/ar-faire/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(), author: author.trim(), sponsorRate,
        questions: questions.map((q) => ({ ...q, correctIndex: q.correctIndex as number })),
        imageUrl: croppedDataUrl ?? undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setSuccess(true);
    else setError(data.error ?? "Something went wrong");
  };

  if (!user) return null;

  if (success) {
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => router.push("/ar-faire")} className="text-slate-400 hover:text-white text-sm">&larr; AR Faire</button>
            <PointsBadge points={user.points} />
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-10 text-center space-y-4">
          <p className="text-4xl">📬</p>
          <p className="text-xl font-bold text-white">Quiz submitted!</p>
          <p className="text-sm text-slate-400">The House will review your submission. Points have been escrowed — you&apos;ll be refunded if it&apos;s rejected.</p>
          <button onClick={() => router.push("/ar-faire")} className="btn-primary">Back to AR Faire</button>
        </div>
        <Navbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/ar-faire")} className="text-slate-400 hover:text-white text-sm">&larr; AR Faire</button>
            <h1 className="text-lg font-bold text-white mt-0.5">Sponsor a Quiz</h1>
          </div>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">

        {/* Book info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Book Details</h2>
          <div>
            <label className="label">Book Title</label>
            <input className="input w-full" placeholder="e.g. The Giver" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Author</label>
            <input className="input w-full" placeholder="e.g. Lois Lowry" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
        </div>

        {/* Sponsor rate */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Sponsor Rate</h2>
          <p className="text-xs text-slate-500">This determines the points reward for quiz completers and the tier of your bookmark in the gacha pool.</p>
          <div className="space-y-2">
            {TIER_RATES.map((t) => (
              <button
                key={t.rate}
                onClick={() => setSponsorRate(t.rate as 250 | 500 | 1000)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-sm ${
                  sponsorRate === t.rate
                    ? `${t.bg} ${t.border} ${t.text} font-semibold`
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${sponsorRate === t.rate ? t.border : "border-slate-600"}`} />
                <span>{t.name}</span>
                <span className="ml-auto font-bold">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600">You have {user.points.toLocaleString()} pts</p>
        </div>

        {/* Bookmark image */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Bookmark Image <span className="text-slate-600 font-normal text-sm">(optional)</span></h2>
          <p className="text-xs text-slate-500">Upload an image and drag to position your bookmark crop. It will be entered into the gacha pool with a <span className={selectedTier.text}>{selectedTier.name}</span> border.</p>

          <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer" />

          {imgSrc && (
            <div className="flex gap-4 items-start">
              <div className="text-xs text-slate-500 space-y-1">
                <p>Drag the preview to reposition</p>
                <p className={`font-semibold ${selectedTier.text}`}>↓ {selectedTier.name} bookmark</p>
              </div>
              <div
                ref={containerRef}
                className="relative shrink-0 cursor-ns-resize select-none"
                style={{ width: BM_W, height: BM_H }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  width={BM_W}
                  height={BM_H}
                  className="rounded-lg"
                  style={{ display: "block" }}
                />
                {/* Tier border overlay */}
                <div
                  className={`absolute inset-0 rounded-lg border-4 pointer-events-none ${
                    sponsorRate === 250 ? "border-blue-500" :
                    sponsorRate === 500 ? "border-violet-500" : "border-amber-500"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Quiz Questions ({questions.length}/10)</h2>
            {questions.length < 10 && (
              <button onClick={addQuestion} className="text-xs text-violet-400 hover:text-violet-300">+ Add question</button>
            )}
          </div>
          <p className="text-xs text-slate-500 -mt-2">Minimum 5, maximum 10. Mark the correct answer with the radio button.</p>

          {questions.map((q, i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400">Question {i + 1}</span>
                {questions.length > 5 && (
                  <button onClick={() => removeQuestion(i)} className="text-xs text-slate-600 hover:text-red-400">Remove</button>
                )}
              </div>
              <div>
                <label className="label">Question text</label>
                <textarea
                  className="input w-full resize-none h-14 text-sm"
                  placeholder="e.g. What is the protagonist's name?"
                  value={q.text}
                  onChange={(e) => updateQuestion(i, "text", e.target.value)}
                  maxLength={300}
                />
              </div>
              <div className="space-y-2">
                <label className="label">Answer choices — select the correct one</label>
                {(["choiceA", "choiceB", "choiceC"] as const).map((field, ci) => (
                  <div key={field} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correctIndex === ci}
                      onChange={() => updateQuestion(i, "correctIndex", ci)}
                      className="accent-violet-500 shrink-0"
                    />
                    <input
                      className="input flex-1 text-sm"
                      placeholder={`Choice ${["A", "B", "C"][ci]}`}
                      value={q[field]}
                      onChange={(e) => updateQuestion(i, field, e.target.value)}
                    />
                    {q.correctIndex === ci && <span className="text-xs text-emerald-400 shrink-0">✓ correct</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Submitting..." : `Submit Quiz — escrow ${sponsorRate.toLocaleString()} pts`}
        </button>
      </div>

      <Navbar />
    </div>
  );
}
