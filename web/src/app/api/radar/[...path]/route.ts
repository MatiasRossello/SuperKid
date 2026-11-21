// Proxy for the DACC radar images and lightning feed (no CORS upstream).
// The CDN caches by path, so upstream sees at most one hit per path per 2 min.
import { DACC } from "@/lib/sources.ts";

const FRAME = /^radar\/web\/\d{8}\/\d{6}_(dbz|granizo|dbz_manga|granizo_manga)\.png$/;
const LIVE = new Set(["radar/web/file_list.json", "rayos/rayos.json"]);

export async function GET(_req: Request, ctx: RouteContext<"/api/radar/[...path]">) {
  const path = (await ctx.params).path.join("/");
  const frame = FRAME.test(path);
  if (!frame && !LIVE.has(path)) return new Response("not found", { status: 404 });
  try {
    const r = await fetch(`${DACC}/${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return new Response("upstream error", { status: 502 });
    return new Response(r.body, {
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/octet-stream",
        // frames never change once published
        "cache-control": frame ? "public, max-age=86400, immutable" : "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch {
    return new Response("upstream timeout", { status: 504 });
  }
}
