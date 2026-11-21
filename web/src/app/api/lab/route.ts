// Model comparison for /lab. Same prompt and input as the pipeline; never writes anything.
import { isDepartamento } from "@/lib/departamentos.ts";
import { isModel, MODELS } from "@/lib/models.ts";
import { replaySnapshot, snapshot } from "@/lib/status.ts";
import { generate, summaryInput } from "@/lib/summary.ts";

export async function POST(req: Request) {
  const secret = process.env.LAB_SECRET;
  if (secret && req.headers.get("x-lab-secret") !== secret) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { departamento, at, models } = body as { departamento?: unknown; at?: unknown; models?: unknown };
  if (!isDepartamento(departamento)) return new Response("bad departamento", { status: 400 });
  const ids = Array.isArray(models) ? models.filter(isModel).slice(0, MODELS.length) : [];
  if (!ids.length) return new Response("bad models", { status: 400 });

  const snap = typeof at === "string" && !isNaN(Date.parse(at)) ? replaySnapshot(new Date(at).toISOString()) : await snapshot();
  const z = snap.zones[departamento];
  if (z.level === 0) return Response.json({ input: summaryInput(departamento, 0, []), results: [], note: "Nivel 0: el pipeline no llama a ningún modelo." });

  const results = await Promise.all(ids.map((m) => generate(departamento, z.level, z.sources, m)));
  return Response.json({ input: summaryInput(departamento, z.level, z.sources), results });
}
