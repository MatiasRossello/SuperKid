// Read-only API for Grokbot and other bots. Docs: docs/api-bots.md
// GET /api/v1/zonas?departamento=maipu&min_nivel=2   (Authorization: Bearer <GROKBOT_TOKEN>)
// GET /api/v1/zonas?escenario=maipu&hora=15:26       simulación / replay a una hora de Mendoza
import { createHash, timingSafeEqual } from "node:crypto";
import { botResponse } from "@/lib/bot-api.ts";
import { findDepartamento } from "@/lib/departamentos.ts";
import { isScenario, SCENARIOS } from "@/lib/scenarios.ts";
import { scenarioSnapshot, snapshot } from "@/lib/status.ts";

const err = (status: number, error: string) => Response.json({ error }, { status });
const sha = (s: string) => createHash("sha256").update(s).digest();

export async function GET(req: Request) {
  const token = process.env.GROKBOT_TOKEN;
  if (!token) return err(503, "API para bots no configurada (falta GROKBOT_TOKEN)");
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(sha(given), sha(token))) return err(401, "token inválido");

  const q = new URL(req.url).searchParams;
  const dq = q.get("departamento");
  const departamento = dq ? findDepartamento(dq) : null;
  if (dq && !departamento) return err(400, `departamento desconocido: ${dq}`);
  const minNivel = Number(q.get("min_nivel") ?? 0);
  if (!Number.isInteger(minNivel) || minNivel < 0 || minNivel > 5) return err(400, "min_nivel debe ser 0 a 5");

  const esc = q.get("escenario");
  let snap;
  if (esc) {
    if (!isScenario(esc)) return err(400, `escenarios: ${Object.keys(SCENARIOS).join(", ")}`);
    const hora = q.get("hora");
    if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return err(400, "con escenario hace falta hora=HH:MM (hora de Mendoza)");
    const day = new Date(Date.parse(SCENARIOS[esc].start) - 3 * 3600_000).toISOString().slice(0, 10);
    snap = scenarioSnapshot(esc, new Date(`${day}T${hora}:00-03:00`).toISOString());
  } else snap = await snapshot();

  return Response.json(botResponse(snap, { departamento, minNivel }), { headers: { "cache-control": "private, max-age=60" } });
}
