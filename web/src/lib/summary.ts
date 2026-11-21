// Summaries through OpenRouter (OpenAI-compatible chat completions).
import type { Departamento } from "./departamentos.ts";
import type { Reason } from "./level.ts";
import { DEFAULT_MODEL, isModel, type ModelId } from "./models.ts";

const SYSTEM = `Reescribís datos meteorológicos oficiales de Mendoza para la gente común.
Reglas:
- Máximo 2 frases, en español rioplatense (vos), tono directo y tranquilo.
- Usá SOLO los datos del input. Si un dato no está en el input, no lo menciones. No pronostiques ni inventes horas, lugares, direcciones ni intensidades.
- Las horas del input están en hora de Mendoza.
- Terminá con una acción concreta y razonable para el fenómeno (por ejemplo, guardar el auto bajo techo si hay granizo).
- Devolvé solo el texto, sin comillas ni formato.`;

export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Mendoza" });

export const summaryInput = (d: Departamento, level: number, reasons: Reason[]) => ({
  departamento: d, nivel: level, datos: reasons.map((r) => ({ fuente: r.fuente, hora: hhmm(r.at), ...r.dato })),
});

/** Deterministic fallback, also used for level 0 and whenever the model fails. Only states input facts. */
export function templateSummary(d: Departamento, level: number, reasons: Reason[]): string {
  if (level === 0) return `Sin alertas para ${d} por ahora.`;
  const top = [...reasons].sort((a, b) => b.level - a.level)[0];
  const x = top.dato;
  if (x.fenomeno === "granizo")
    return `El radar marca granizo cerca de ${x.paraje} (${d}) a las ${hhmm(top.at)}, con ${x.probabilidad} % de probabilidad. Guardá el auto bajo techo.`;
  if (x.alerta) return `El SMN tiene alerta ${x.alerta} por ${x.evento} en ${d}. Seguí las indicaciones oficiales.`;
  if (x.precipitacion_mm !== undefined) return `La estación ${x.estacion} midió ${x.precipitacion_mm} mm de lluvia. Manejá con cuidado.`;
  return `El pronóstico de la DACC anuncia tormentas para ${d}. Tené a mano dónde guardar el auto.`;
}

/**
 * Numbers and times in the output that are not in the input. Catches invented hours/percentages/areas.
 * ponytail: numeric check only; invented place names need a human eye in /lab.
 */
export function inventedFacts(output: string, input: unknown): string[] {
  const src = JSON.stringify(input);
  const facts = output.match(/\d{1,2}:\d{2}|\d+(?:[.,]\d+)?/g) ?? [];
  return [...new Set(facts)].filter((f) => !src.includes(f.replace(",", ".")) && !src.includes(f));
}

export type Generated = { text: string; model: ModelId | "plantilla"; ms: number; invented: string[]; error?: string };

export async function generate(d: Departamento, level: number, reasons: Reason[], model: ModelId): Promise<Generated> {
  const t0 = Date.now();
  const input = summaryInput(d, level, reasons);
  const fallback = (error: string): Generated => ({ text: templateSummary(d, level, reasons), model: "plantilla", ms: Date.now() - t0, invented: [], error });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return fallback("OPENROUTER_API_KEY no configurada");
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "SuperKid" },
      body: JSON.stringify({
        model,
        max_tokens: 800, // reasoning models spend part of it thinking
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(input) }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
    const text = String(j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) throw new Error(`respuesta vacía (${j.choices?.[0]?.finish_reason})`);
    return { text, model, ms: Date.now() - t0, invented: inventedFacts(text, input) };
  } catch (e) {
    console.error(`[summary] ${model} ${d}: ${(e as Error).message}`);
    return fallback((e as Error).message);
  }
}

/** Pipeline entry: level 0 never calls a model; invented facts fall back to the template. */
export async function summarize(d: Departamento, level: number, reasons: Reason[]): Promise<string> {
  if (level === 0) return templateSummary(d, level, reasons);
  const env = process.env.SUMMARY_MODEL;
  const g = await generate(d, level, reasons, isModel(env) ? env : DEFAULT_MODEL);
  return g.invented.length ? templateSummary(d, level, reasons) : g.text;
}
