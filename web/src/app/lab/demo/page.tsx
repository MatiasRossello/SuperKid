"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Stars, Wanted } from "@/components/ui";
import { startDemo, useDepto } from "@/components/useApp";
import { addDays, conditionLabel, DEMO_CONDITIONS, mendozaToday, type DemoCondition, type DemoConfig, type DemoDay } from "@/lib/demo";
import { demoSnapshot } from "@/lib/demo-snapshot";
import { DEPARTAMENTOS, type Departamento } from "@/lib/departamentos";
import { MODELS, type ModelId } from "@/lib/models";
import type { Generated } from "@/lib/summary";

type LabResponse = { input: unknown; results: Generated[]; note?: string };
const getSecret = () => { try { return localStorage.getItem("sk-lab-secret") ?? ""; } catch { return ""; } };

function DayRow({ day, i, onChange, onRemove, canRemove }: { day: DemoDay; i: number; onChange: (d: DemoDay) => void; onRemove: () => void; canRemove: boolean }) {
  const set = (patch: Partial<DemoDay>) => onChange({ ...day, ...patch });
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-night/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm tracking-wider text-sun">DÍA {i + 1}</span>
        {canRemove && <button type="button" onClick={onRemove} className="min-h-11 px-2 text-xs font-bold text-muted underline">Quitar</button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Fecha
          <input type="date" value={day.date} onChange={(e) => set({ date: e.target.value })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Clima
          <select value={day.condition} onChange={(e) => set({ condition: e.target.value as DemoCondition })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream">
            {DEMO_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {day.condition === "lluvia" && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Lluvia medida (mm)
          <input type="number" min={0} step={0.1} value={day.mm ?? 12} onChange={(e) => set({ mm: Number(e.target.value) })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
        </label>
      )}
      {day.condition === "granizo" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Probabilidad %
            <input type="number" min={0} max={100} value={day.prob ?? 90} onChange={(e) => set({ prob: Number(e.target.value) })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Área km²
            <input type="number" min={1} value={day.area_km2 ?? 150} onChange={(e) => set({ area_km2: Number(e.target.value) })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Máx °C
          <input type="number" value={day.max ?? 28} onChange={(e) => set({ max: Number(e.target.value) })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Mín °C
          <input type="number" value={day.min ?? 16} onChange={(e) => set({ min: Number(e.target.value) })} className="h-11 rounded-lg border border-line bg-card px-2 text-sm text-cream" />
        </label>
      </div>
    </div>
  );
}

function initialConfig(): DemoConfig {
  const today = typeof window !== "undefined" ? mendozaToday() : "2026-01-01";
  return {
    departamento: "Maipú",
    days: [
      { date: today, condition: "granizo", prob: 90, area_km2: 150, max: 26, min: 16 },
      { date: addDays(today, 1), condition: "calma", max: 28, min: 17 },
      { date: addDays(today, 2), condition: "calma", max: 29, min: 18 },
    ],
  };
}

export default function DemoLab() {
  const router = useRouter();
  const [, setDepto] = useDepto();
  const [config, setConfig] = useState<DemoConfig>(initialConfig);
  const [models, setModels] = useState<Set<ModelId>>(new Set([MODELS[0].id]));
  const secretRef = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<LabResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (secretRef.current) secretRef.current.value = getSecret(); }, []);

  const ready = config.days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  const snap = ready ? demoSnapshot(config) : null;
  const zone = snap?.zones[config.departamento];
  const setDay = (i: number, d: DemoDay) => setConfig((c) => ({ ...c, days: c.days.map((x, j) => (j === i ? d : x)) }));
  const addDay = () => setConfig((c) => {
    const last = c.days[c.days.length - 1];
    const nextDate = last ? new Date(new Date(`${last.date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10) : mendozaToday();
    return { ...c, days: [...c.days, { date: nextDate, condition: "calma" as DemoCondition, max: 28, min: 16 }].slice(0, 7) };
  });

  const apply = () => {
    setDepto(config.departamento);
    startDemo(config);
    router.push("/");
  };

  const runModel = async () => {
    setBusy(true); setErr(null); setRes(null);
    const secret = secretRef.current?.value ?? "";
    try { localStorage.setItem("sk-lab-secret", secret); } catch {}
    try {
      const r = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-lab-secret": secret },
        body: JSON.stringify({ departamento: config.departamento, demo: config, models: [...models] }),
      });
      if (!r.ok) return setErr(`${r.status}: ${await r.text()}`);
      setRes(await r.json());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-col gap-4 px-5 pb-12 pt-12">
      <div className="flex items-center justify-between gap-2">
        <Link href="/lab" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal">← Laboratorio</Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal">Inicio →</Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl leading-none tracking-wide">DEMO · CLIMA FICTICIO</h1>
        <p className="text-sm text-muted">Configurá ubicación, fecha y clima por día. Se inyecta en el snapshot y en el prompt del modelo para probar la app como si los datos fueran reales. No se guarda nada ni se envían push.</p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <span className="font-display tracking-[2px] text-sun">UBICACIÓN Y FECHA</span>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Departamento (ubicación actual simulada)
          <select value={config.departamento} onChange={(e) => setConfig((c) => ({ ...c, departamento: e.target.value as Departamento }))} className="h-12 rounded-xl border-[1.5px] border-line bg-night px-3 text-base font-normal text-cream">
            {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted">La fecha de hoy por defecto es {mendozaToday()} (Mendoza). Podés cambiar la fecha de cada día abajo.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display tracking-[2px] text-sun">CLIMA POR DÍA</span>
          <button type="button" onClick={addDay} disabled={config.days.length >= 7} className="min-h-11 rounded-full border-2 border-teal px-3 text-xs font-bold text-teal disabled:opacity-50">+ Agregar día</button>
        </div>
        {config.days.map((day, i) => (
          <DayRow key={i} day={day} i={i} onChange={(d) => setDay(i, d)} onRemove={() => setConfig((c) => ({ ...c, days: c.days.filter((_, j) => j !== i) }))} canRemove={config.days.length > 1} />
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-night p-4">
        <span className="font-display text-xs tracking-[2px] text-sun">PREVIEW · LO QUE VERÍA LA APP</span>
        {zone ? (
          <>
            <div className="flex justify-end"><Wanted level={zone.level} /></div>
            <div className="flex items-center gap-3"><Stars level={zone.level} size={28} /><span className="text-sm text-muted">Nivel {zone.level}/5 · {conditionLabel(config.days[0].condition)}</span></div>
            <p className="text-sm text-lilac">{zone.summary}</p>
            <p className="text-xs text-muted">Fuentes: {zone.sources.map((s) => s.fuente).join(", ") || "—"}</p>
          </>
        ) : <p className="text-sm text-muted">Cargando fechas…</p>}
      </section>

      <button onClick={apply} disabled={!ready} className="h-14 rounded-full bg-pink font-display text-xl tracking-wider disabled:opacity-60">APLICAR A LA APP (DEMO)</button>
      <p className="text-center text-xs text-muted">Aplica la demo en esta sesión: Inicio, Alerta y Mapa van a mostrar estos datos ficticios.</p>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <span className="font-display tracking-[2px] text-sun">PROBAR CON MODELO (PROMPT REAL)</span>
        <p className="text-sm text-muted">Envía los mismos datos ficticios al prompt de resumen. Así probás cómo responde el modelo sin esperar clima real.</p>
        <div className="flex flex-col gap-1">
          {MODELS.map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5 accent-pink" checked={models.has(m.id)}
                onChange={() => setModels((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Clave del lab (si está configurada)
          <input ref={secretRef} type="password" autoComplete="off" placeholder="si está configurada" className="h-11 rounded-lg border border-line bg-night px-2 text-sm text-cream" />
        </label>
        <button onClick={runModel} disabled={busy || !models.size} className="h-12 rounded-full bg-teal font-display text-lg tracking-wider text-night disabled:opacity-60">
          {busy ? "GENERANDO…" : "GENERAR RESPUESTA DEL MODELO"}
        </button>
        {err && <p role="alert" className="rounded-xl bg-card-2 p-3 text-sm">{err}</p>}
        {res && (
          <div className="flex flex-col gap-3">
            {res.note && <p className="rounded-xl bg-card-2 p-3 text-sm">{res.note}</p>}
            {res.results.map((g, i) => {
              const asked = [...models][i];
              const label = MODELS.find((m) => m.id === asked)?.label ?? asked;
              return (
                <article key={asked} className={`flex flex-col gap-2 rounded-xl border-[1.5px] bg-night p-3 ${g.error ? "border-line" : g.invented.length ? "border-sun" : "border-teal"}`}>
                  <div className="flex items-baseline justify-between gap-2"><h2 className="font-bold">{label}</h2><span className="text-xs text-muted">{(g.ms / 1000).toFixed(1)} s</span></div>
                  <p className="text-sm leading-snug text-lilac">{g.text}</p>
                  {g.error && <p className="text-xs text-sun">Falló ({g.error}). Se muestra la plantilla de respaldo.</p>}
                  {!g.error && (g.invented.length ? <p className="text-xs text-sun">Datos no presentes en el input: {g.invented.join(", ")}</p> : <p className="text-xs text-teal">Sin números inventados.</p>)}
                </article>
              );
            })}
            <details className="rounded-xl bg-night p-3 text-xs">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">Input enviado al prompt</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap text-muted">{JSON.stringify(res.input, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
