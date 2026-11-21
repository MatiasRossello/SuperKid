import { contingencyFromReasons } from "./contingencies.ts";
import { db, tryWrite } from "./db.ts";
import { DEPARTAMENTOS } from "./departamentos.ts";
import { computeLevels, type LevelInputs } from "./level.ts";
import { notifyContingency } from "./push.ts";
import { summarize } from "./summary.ts";

/** inputs → zone_status → notify. Shared by the live poller and the replay. */
export async function runPipeline(inputs: LevelInputs, opts: { replay?: boolean } = {}) {
  const levels = computeLevels(inputs);
  const { data: prev } = await db().from("zone_status").select("departamento, level, sources");
  const before = new Map(prev?.map((p) => [p.departamento, p]));
  const rises: string[] = [];

  await Promise.all(
    DEPARTAMENTOS.map(async (d) => {
      const { level, reasons } = levels[d];
      const old = before.get(d);
      const unchanged = old && old.level === level && JSON.stringify(old.sources) === JSON.stringify(reasons);
      if (unchanged) return; // ponytail: no model call when nothing changed, which is most polls
      const summary = await summarize(d, level, reasons);
      await tryWrite(`zone_status ${d}`, db().from("zone_status").upsert({
        departamento: d, level, summary, sources: reasons,
        valid_until: new Date(Date.now() + 10 * 60_000).toISOString(), // stale if the poller stops
        updated_at: new Date().toISOString(),
      }));
      if (level > (old?.level ?? 0)) {
        const contingency = contingencyFromReasons(reasons);
        rises.push(contingency ? `${d} ${old?.level ?? 0}→${level} ${contingency.code}` : `${d} ${old?.level ?? 0}→${level}`);
        if (contingency) await notifyContingency(d, contingency, summary, { replay: opts.replay, level });
      }
    }),
  );
  return { rises, levels: Object.fromEntries(DEPARTAMENTOS.map((d) => [d, levels[d].level])) };
}
