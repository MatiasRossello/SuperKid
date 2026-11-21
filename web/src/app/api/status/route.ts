import { isScenario } from "@/lib/scenarios.ts";
import { scenarioSnapshot, snapshot } from "@/lib/status.ts";

// ?scenario=replay|maipu&at=<ISO> → that scenario at that virtual time. Otherwise live.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const scenario = q.get("scenario"), at = q.get("at");
  if (scenario || at) {
    if (!isScenario(scenario) || !at || isNaN(Date.parse(at))) return new Response("bad scenario/at", { status: 400 });
    return Response.json(scenarioSnapshot(scenario, new Date(at).toISOString()), { headers: { "cache-control": "public, max-age=3600" } });
  }
  return Response.json(await snapshot(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
