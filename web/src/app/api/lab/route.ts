// Model comparison for /lab. Same prompt and input as the pipeline; never writes anything.
import { demoSummaryExtra, isDemoConfig } from "@/lib/demo.ts";
import { demoAt, demoSnapshot } from "@/lib/demo-snapshot.ts";
import { isDepartamento } from "@/lib/departamentos.ts";
import { isModel, MODELS } from "@/lib/models.ts";
import { isScenario } from "@/lib/scenarios.ts";
import { scenarioSnapshot, snapshot } from "@/lib/status.ts";
import { generate, summaryInput, type SummaryExtra } from "@/lib/summary.ts";

export async function POST(req: Request) {
  const secret = process.env.LAB_SECRET;
  if (secret && req.headers.get("x-lab-secret") !== secret) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { departamento, at, models, scenario, demo } = body as { departamento?: unknown; at?: unknown; models?: unknown; scenario?: unknown; demo?: unknown };
  if (!isDepartamento(departamento)) return new Response("bad departamento", { status: 400 });
  const ids = Array.isArray(models) ? models.filter(isModel).slice(0, MODELS.length) : [];
  if (!ids.length) return new Response("bad models", { status: 400 });

  let extra: SummaryExtra | undefined;
  let snap;
  if (isDemoConfig(demo)) {
    const atIso = typeof at === "string" && !isNaN(Date.parse(at)) ? new Date(at).toISOString() : demoAt(demo);
    snap = demoSnapshot({ ...demo, departamento }, atIso);
    extra = demoSummaryExtra({ ...demo, departamento });
  } else if (isScenario(scenario) && typeof at === "string" && !isNaN(Date.parse(at))) {
    snap = scenarioSnapshot(scenario, new Date(at).toISOString());
  } else {
    snap = await snapshot();
  }

  const z = snap.zones[departamento];
  if (z.level === 0) return Response.json({ input: summaryInput(departamento, 0, [], extra), results: [], note: "Nivel 0: el pipeline no llama a ningún modelo." });

  const results = await Promise.all(ids.map((m) => generate(departamento, z.level, z.sources, m, extra)));
  return Response.json({ input: summaryInput(departamento, z.level, z.sources, extra), results });
}
