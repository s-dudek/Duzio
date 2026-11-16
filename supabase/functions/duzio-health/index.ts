// Duzio: nimmt Apple-Health-Werte vom iPhone-Kurzbefehl an (Gewicht, Schritte, aktive Energie).
// Anmeldung über den Zugangsschlüssel im Header "x-duzio-token" (in der Tabelle nur als SHA-256 gespeichert).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

// Zahl aus Zahl oder Text (auch "76,4"); sonst null
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const viennaToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const day = (v: unknown) => {
  if (v == null || v === "") return viennaToday();
  const s = String(v).slice(0, 10);
  const d = new Date(s + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(+d) && d.toISOString().startsWith(s) ? s : null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { fehler: "Nur POST" });
  const token = req.headers.get("x-duzio-token") || "";
  if (token.length < 20) return reply(401, { fehler: "Zugang verweigert" });
  const { data: owner } = await db.from("duzio_health_token").select("owner_id").eq("token_hash", await sha256(token)).maybeSingle();
  if (!owner) return reply(401, { fehler: "Zugang verweigert" });

  const text = await req.text();
  let b: Record<string, unknown> | null = null;
  try { if (text.length < 2000) b = JSON.parse(text); } catch { /* bleibt null */ }
  if (!b || typeof b !== "object") return reply(400, { fehler: "Ungültige Daten" });

  const tag = day(b.tag), weightDay = day(b.gewicht_tag ?? b.tag);
  if (!tag || !weightDay) return reply(400, { fehler: "Ungültiger Tag" });
  const kg = num(b.gewicht, 20, 400), steps = num(b.schritte, 0, 200000), kcal = num(b.aktive_kcal, 0, 20000);
  if (kg == null && steps == null && kcal == null) return reply(400, { fehler: "Keine gültigen Werte" });

  const saved: string[] = [];
  if (kg != null) {
    const { error } = await db.from("duzio_weights").upsert({ owner_id: owner.owner_id, day: weightDay, kg: Math.round(kg * 10) / 10 });
    if (error) return reply(500, { fehler: "Speichern fehlgeschlagen" });
    saved.push("gewicht");
  }
  if (steps != null || kcal != null) {
    const row: Record<string, unknown> = { owner_id: owner.owner_id, day: tag };
    if (steps != null) row.steps = Math.round(steps);
    if (kcal != null) row.active_kcal = Math.round(kcal);
    const { error } = await db.from("duzio_activity").upsert(row);
    if (error) return reply(500, { fehler: "Speichern fehlgeschlagen" });
    if (steps != null) saved.push("schritte");
    if (kcal != null) saved.push("aktive_kcal");
  }
  return reply(200, { ok: true, gespeichert: saved });
});
