import { replaySnapshot, snapshot } from "@/lib/status.ts";

// ?at=<ISO> → replay of the 18–19/11 storm at that virtual time. Otherwise live.
export async function GET(req: Request) {
  const at = new URL(req.url).searchParams.get("at");
  if (at) {
    if (isNaN(Date.parse(at))) return new Response("bad at", { status: 400 });
    return Response.json(replaySnapshot(new Date(at).toISOString()), { headers: { "cache-control": "public, max-age=3600" } });
  }
  return Response.json(await snapshot(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
