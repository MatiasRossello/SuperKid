"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEPARTAMENTOS, type Departamento } from "@/lib/departamentos";
import { MODELS, type ModelId } from "@/lib/models";
import type { Generated } from "@/lib/summary";

type LabResponse = { input: unknown; results: Generated[]; note?: string };

const getSecret = () => { try { return localStorage.getItem("sk-lab-secret") ?? ""; } catch { return ""; } };

export default function Lab() {
  const [models, setModels] = useState<Set<ModelId>>(new Set(MODELS.map((m) => m.id)));
  const [depto, setDepto] = useState<Departamento>("Santa Rosa");
  const [scenario, setScenario] = useState<"live" | "replay" | "maipu">("replay");
  const [time, setTime] = useState("18:16"); // Mendoza time. Replay: Santa Rosa hail at 18:16 on 19/11. Maipú sim runs 15:00–16:10
  const secretRef = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<LabResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (secretRef.current) secretRef.current.value = getSecret(); }, []);

  const run = async () => {
    setBusy(true); setErr(null); setRes(null);
    const secret = secretRef.current?.value ?? "";
    try { localStorage.setItem("sk-lab-secret", secret); } catch {}
    const day = scenario === "replay" ? "2026-11-19" : "2026-11-21";
    const at = scenario === "live" ? undefined : new Date(`${day}T${time}:00-03:00`).toISOString();
    const r = await fetch("/api/lab", { method: "POST", headers: { "Content-Type": "application/json", "x-lab-secret": secret }, body: JSON.stringify({ departamento: depto, at, scenario: scenario === "live" ? undefined : scenario, models: [...models] }) });
    setBusy(false);
    if (!r.ok) return setErr(`${r.status}: ${await r.text()}`);
    setRes(await r.json());
  };

  return (
    <main className="flex flex-col gap-4 px-5 pb-12 pt-12">
      <Link href="/" className="text-sm font-semibold text-teal">← Inicio</Link>
      <h1 className="font-display text-4xl tracking-wide">LABORATORIO DE MODELOS</h1>
      <p className="text-sm text-muted">Mismo prompt y mismos datos que el pipeline. Acá no se guarda nada ni se mandan push.</p>

      <fieldset className="flex flex-col gap-2 rounded-2xl bg-card p-4">
        <legend className="sr-only">Modelos</legend>
        <span className="font-display tracking-[2px] text-sun">MODELOS</span>
        {MODELS.map((m) => (
          <label key={m.id} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-pink" checked={models.has(m.id)}
              onChange={() => setModels((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
            <span className="flex flex-col"><span className="font-semibold">{m.label}</span><span className="text-xs text-muted">{m.id}</span></span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-sun">
          Departamento
          <select value={depto} onChange={(e) => setDepto(e.target.value as Departamento)} className="h-12 rounded-xl border-[1.5px] border-line bg-card px-3 text-base font-normal text-cream">
            {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-sun">
          Datos
          <select value={scenario} onChange={(e) => { const v = e.target.value as "live" | "replay" | "maipu"; setScenario(v); if (v === "replay") setTime("18:16"); if (v === "maipu") { setTime("15:26"); setDepto("Maipú"); } }} className="h-12 rounded-xl border-[1.5px] border-line bg-card px-3 text-base font-normal text-cream">
            <option value="replay">Replay 19/11</option>
            <option value="maipu">Simulación Maipú</option>
            <option value="live">En vivo</option>
          </select>
        </label>
        {scenario !== "live" && (
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-sun">
            Hora (Mendoza)
            <input type="time" min="15:00" max={scenario === "replay" ? "20:58" : "16:10"} value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-xl border-[1.5px] border-line bg-card px-3 text-base font-normal text-cream" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-sun">
          Clave del lab
          <input ref={secretRef} type="password" autoComplete="off" placeholder="si está configurada" className="h-12 rounded-xl border-[1.5px] border-line bg-card px-3 text-base font-normal text-cream" />
        </label>
      </div>

      <button onClick={run} disabled={busy || !models.size} className="h-14 rounded-full bg-pink font-display text-xl tracking-wider disabled:opacity-60">
        {busy ? "GENERANDO…" : `COMPARAR ${models.size} MODELO${models.size === 1 ? "" : "S"}`}
      </button>
      {err && <p role="alert" className="rounded-xl bg-card-2 p-3 text-sm">{err}</p>}

      {res && (
        <section aria-live="polite" className="flex flex-col gap-3">
          {res.note && <p className="rounded-xl bg-card-2 p-3 text-sm">{res.note}</p>}
          {res.results.map((g, i) => {
            const asked = [...models][i];
            const label = MODELS.find((m) => m.id === asked)?.label ?? asked;
            return (
              <article key={asked} className={`flex flex-col gap-2 rounded-2xl border-[1.5px] bg-card p-4 ${g.error ? "border-line" : g.invented.length ? "border-sun" : "border-teal"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-bold">{label}</h2>
                  <span className="text-xs text-muted">{(g.ms / 1000).toFixed(1)} s</span>
                </div>
                <p className="text-[15px] leading-snug text-lilac">{g.text}</p>
                {g.error && <p className="text-xs text-sun">Falló ({g.error}). Se muestra la plantilla de respaldo.</p>}
                {!g.error && (g.invented.length
                  ? <p className="text-xs text-sun">Datos que no están en el input: {g.invented.join(", ")}. El pipeline usaría la plantilla.</p>
                  : <p className="text-xs text-teal">Sin números inventados.</p>)}
              </article>
            );
          })}
          <details className="rounded-xl bg-card p-3 text-xs">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Input que recibió el modelo</summary>
            <pre className="overflow-x-auto whitespace-pre-wrap text-muted">{JSON.stringify(res.input, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
