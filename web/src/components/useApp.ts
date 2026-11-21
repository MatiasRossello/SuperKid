"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isDemoConfig, type DemoConfig } from "@/lib/demo";
import { demoAt, demoSnapshot } from "@/lib/demo-snapshot";
import { isDepartamento, type Departamento } from "@/lib/departamentos";
import { isScenario, SCENARIO_SPEED, SCENARIOS, type ScenarioId } from "@/lib/scenarios";
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

export const startScenario = (id: ScenarioId) => {
  write(session, "sk-scn-fix", null);
  write(session, "sk-scn", id);
  write(session, "sk-scn-t0", String(Date.now()));
};
/** Maipú demo: freeze the simulated clock `min` minutes into the script. */
export const freezeScenario = (min: number) => {
  write(session, "sk-scn", "maipu");
  write(session, "sk-scn-t0", String(Date.now()));
  write(session, "sk-scn-fix", String(min));
};
export const stopScenario = () => { write(session, "sk-scn", null); write(session, "sk-scn-t0", null); write(session, "sk-scn-fix", null); };

export const startDemo = (config: DemoConfig) => { stopScenario(); write(session, "sk-demo", JSON.stringify(config)); };
export const stopDemo = () => write(session, "sk-demo", null);
export function useDemo(): DemoConfig | null {
  const raw = useSyncExternalStore(subscribe, () => read(session, "sk-demo"), () => null);
  return useMemo(() => {
    if (!raw) return null;
    try { const v = JSON.parse(raw); return isDemoConfig(v) ? v : null; } catch { return null; }
  }, [raw]);
}

export type ActiveScenario = { id: ScenarioId; at: string; frozen?: number };

/** Running scenario and its virtual time, else null. `?replay=1` or `?sim=maipu` start one, `=0` stops it. */
export function useScenario(): ActiveScenario | null {
  const id = useSyncExternalStore(subscribe, () => read(session, "sk-scn"), () => null);
  const t0 = useSyncExternalStore(subscribe, () => read(session, "sk-scn-t0"), () => null);
  const fix = useSyncExternalStore(subscribe, () => read(session, "sk-scn-fix"), () => null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const sim = q.get("sim"), replay = q.get("replay");
    if (replay === "0" || sim === "0") stopScenario();
    else if (replay === "1") startScenario("replay");
    else if (isScenario(sim)) startScenario(sim);
  }, []);
  useEffect(() => {
    if (!t0) return;
    const tick = () => setNow(Date.now());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [t0]);
  if (isScenario(id) && fix !== null && !isNaN(Number(fix)))
    return { id, at: new Date(Date.parse(SCENARIOS[id].start) + Number(fix) * 60_000).toISOString(), frozen: Number(fix) };
  if (!isScenario(id) || !t0 || !now) return null;
  const { start, end } = SCENARIOS[id];
  const v = Date.parse(start) + (now - Number(t0)) * SCENARIO_SPEED;
  return { id, at: new Date(Math.min(v, Date.parse(end))).toISOString() };
}

export function useSnapshot(): { snap: Snapshot | null; error: boolean; scenario: ActiveScenario | null; demo: DemoConfig | null } {
  const demo = useDemo();
  const scenario = useScenario();
  const replayAt = !demo && scenario ? scenario.at : null;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  useEffect(() => {
    if (!demo) return;
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, [demo]);

  // Replay asks per 2-min frame (cacheable); live refreshes every minute. Demo is computed locally.
  const key = replayAt ? scenario!.id + "|" + replayAt.slice(0, 15) + String(Math.floor(Number(replayAt.slice(15, 16)) / 2) * 2) : "live";
  useEffect(() => {
    if (demo) return;
    let dead = false;
    const load = () =>
      fetch(replayAt ? `/api/status?scenario=${scenario!.id}&at=${encodeURIComponent(key.split("|")[1] + ":00Z")}` : "/api/status")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((s: Snapshot) => { if (!dead) { setSnap(s); setError(false); } })
        .catch(() => { if (!dead) setError(true); });
    load();
    const id = replayAt ? undefined : setInterval(load, 60_000);
    return () => { dead = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, key]);

  const demoSnap = demo ? demoSnapshot(demo, demoAt(demo, now || undefined)) : null;
  return { snap: demo ? demoSnap : snap, error: demo ? false : error, scenario: demo ? null : scenario, demo };
}
