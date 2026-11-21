// POST { pregunta, departamento, scenario?, at? } → { text, source, intent, model }
// The server rebuilds the snapshot itself: the client never supplies the facts the model sees.
import { ask } from "@/lib/ask.ts";
import { answer, chatFacts } from "@/lib/chat.ts";
import { isDepartamento } from "@/lib/departamentos.ts";
import { isScenario } from "@/lib/scenarios.ts";
import { scenarioSnapshot, snapshot } from "@/lib/status.ts";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const question = typeof body?.pregunta === "string" ? body.pregunta.trim().slice(0, 140) : "";
  const depto = body?.departamento;
  if (!question || !isDepartamento(depto)) return new Response("bad request", { status: 400 });

  const { scenario, at } = body;
  const snap = scenario && isScenario(scenario) && typeof at === "string" && !isNaN(Date.parse(at))
    ? scenarioSnapshot(scenario, new Date(at).toISOString())
    : await snapshot();

  const base = answer(question, depto, snap);
  const r = await ask(question, chatFacts(depto, snap), base.text);
  return Response.json({ ...base, text: r.text, model: r.model }, { headers: { "cache-control": "no-store" } });
}
