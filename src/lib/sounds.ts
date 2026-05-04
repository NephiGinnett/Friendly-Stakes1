"use client";

export function playWinSound() {
  try {
    const audio = new Audio("/win.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Browser blocked autoplay — fail silently
    });
  } catch {
    // Audio not supported — fail silently
  }
}
