import { sendNotification, setVapidDetails } from "web-push";
import { db, tryWrite } from "./db.ts";
import type { Departamento } from "./departamentos.ts";

let ready = false;
function init() {
  if (ready) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  setVapidDetails(VAPID_SUBJECT ?? "mailto:alertas@superkid.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return (ready = true);
}

const DEDUPE_MS = 60 * 60_000; // same sub, same or higher level within 1 h → skip (stops 3→4→3→4 flapping)

/** Called only when a departamento's level went up. */
export async function notifyRise(d: Departamento, level: number, summary: string, replay = false) {
  if (!init()) return console.error("[push] VAPID keys missing, skipping");
  const { data: subs, error } = await db().from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("departamento", d);
  if (error) return console.error(`[push] ${error.message}`);
  if (!subs?.length) return;

  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const { data: recent } = await db().from("notifications_log").select("subscription_id").eq("departamento", d).gte("level", level).gte("sent_at", since);
  const skip = new Set(recent?.map((r) => r.subscription_id));

  const payload = JSON.stringify({ title: `${replay ? "[REPLAY] " : ""}NUEVA ALERTA · ${d}`, body: summary, level, departamento: d, url: "/alerta" });
  for (const s of subs) {
    if (skip.has(s.id)) continue;
    try {
      await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 1800, urgency: level >= 4 ? "high" : "normal" });
      await tryWrite("notifications_log", db().from("notifications_log").insert({ subscription_id: s.id, departamento: d, level }));
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await tryWrite("prune sub", db().from("push_subscriptions").delete().eq("id", s.id));
      else console.error(`[push] ${s.id}: ${(e as Error).message}`);
    }
  }
}
