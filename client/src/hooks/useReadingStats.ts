import { useEffect, useRef, useState } from "react";

const KEY = "lexi.stats.v1";
const TICK_SECONDS = 5;
const IDLE_LIMIT_MS = 60_000; // stop counting if nothing happens for a minute
const STREAK_MIN_SECONDS = 60; // a day counts toward the streak after 1 minute of reading

interface Stats {
  days: Record<string, number>; // "2026-11-03" -> seconds read
  goalMin: number;
}

const dayKey = (d = new Date()) => d.toLocaleDateString("en-CA");

function load(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "");
    return { days: s.days ?? {}, goalMin: s.goalMin ?? 20 };
  } catch {
    return { days: {}, goalMin: 20 };
  }
}

function computeStreak(days: Record<string, number>): number {
  const d = new Date();
  // If today hasn't hit the minimum yet, the streak is still alive from yesterday.
  if ((days[dayKey(d)] ?? 0) < STREAK_MIN_SECONDS) d.setDate(d.getDate() - 1);
  let streak = 0;
  while ((days[dayKey(d)] ?? 0) >= STREAK_MIN_SECONDS) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Counts time actually spent reading: a book is open, the tab is visible, and the user is active. */
export function useReadingStats(reading: boolean) {
  const [stats, setStats] = useState<Stats>(load);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    const events = ["scroll", "mousemove", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
  }, []);

  useEffect(() => {
    if (!reading) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) return;
      setStats((s) => {
        const k = dayKey();
        return { ...s, days: { ...s.days, [k]: (s.days[k] ?? 0) + TICK_SECONDS } };
      });
    }, TICK_SECONDS * 1000);
    return () => clearInterval(id);
  }, [reading]);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(stats));
  }, [stats]);

  const todaySec = stats.days[dayKey()] ?? 0;
  return {
    todayMin: Math.floor(todaySec / 60),
    goalMin: stats.goalMin,
    goalHit: todaySec >= stats.goalMin * 60,
    streak: computeStreak(stats.days),
    setGoal: (goalMin: number) => setStats((s) => ({ ...s, goalMin })),
  };
}
