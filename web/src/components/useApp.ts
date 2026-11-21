"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isDepartamento, type Departamento } from "@/lib/departamentos";
import { REPLAY_END, REPLAY_SPEED, REPLAY_START } from "@/lib/radar";
import type { Snapshot } from "@/lib/status";

// Every storage access is guarded: private mode / blocked storage must not break the app.
const read = (s: () => Storage, k: string) => { try { return s().getItem(k); } catch { return null; } };
const write = (s: () => Storage, k: string, v: string | null) => {
  try { if (v === null) s().removeItem(k); else s().setItem(k, v); } catch {}
  window.dispatchEvent(new Event("sk-storage"));
};
const subscribe = (cb: () => void) => {
  window.addEventListener("sk-storage", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("sk-storage", cb); window.removeEventListener("storage", cb); };
};
const local = () => localStorage, session = () => sessionStorage;

/** undefined while hydrating, null when the user hasn't picked one. */
export function useDepto(): [Departamento | null | undefined, (d: Departamento) => void] {
  const v = useSyncExternalStore(subscribe, () => read(local, "sk-depto") ?? "", () => undefined);
  const d = v === undefined ? undefined : isDepartamento(v) ? v : null;
  return [d, (x) => write(local, "sk-depto", x)];
}

export const startReplay = () => write(session, "sk-replay-t0", String(Date.now()));
export const stopReplay = () => write(session, "sk-replay-t0", null);

/** Virtual ISO time while the replay runs, else null. `?replay=1` starts it, `?replay=0` stops it. */
export function useReplayAt(): string | null {
  const t0 = useSyncExternalStore(subscribe, () => read(session, "sk-replay-t0"), () => null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("replay");
    if (q === "1" && !read(session, "sk-replay-t0")) startReplay();
    if (q === "0") stopReplay();
  }, []);
  useEffect(() => {
    if (!t0) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [t0]);
  if (!t0 || !now) return null;
  const v = Date.parse(REPLAY_START) + (now - Number(t0)) * REPLAY_SPEED;
  return new Date(Math.min(v, Date.parse(REPLAY_END))).toISOString();
}

export function useSnapshot(): { snap: Snapshot | null; error: boolean; replayAt: string | null } {
  const replayAt = useReplayAt();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  // Replay asks per 2-min frame (cacheable); live refreshes every minute.
  const key = replayAt ? replayAt.slice(0, 15) + String(Math.floor(Number(replayAt.slice(15, 16)) / 2) * 2) : "live";
  useEffect(() => {
    let dead = false;
    const load = () =>
      fetch(replayAt ? `/api/status?at=${encodeURIComponent(key + ":00Z")}` : "/api/status")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((s: Snapshot) => { if (!dead) { setSnap(s); setError(false); } })
        .catch(() => { if (!dead) setError(true); });
    load();
    const id = replayAt ? undefined : setInterval(load, 60_000);
    return () => { dead = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { snap, error, replayAt };
}
