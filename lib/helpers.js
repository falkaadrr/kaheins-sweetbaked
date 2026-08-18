import { supabase, PROOF_BUCKET } from "../config/supabase.js";

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = "ValidationError"; }
}
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function slugify(text) {
  return String(text || "").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}
export const nowIso = () => new Date().toISOString();

// Nomor pesanan gaya POS: KHS/YYYYMMDD/XXXX
export function genOrderNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `KHS/${ymd}/${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// Signed URL untuk file di Storage (default 1 jam)
export async function signedUrl(path, bucket = PROOF_BUCKET, seconds = 3600) {
  if (!path) return null;
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
    return data?.signedUrl || null;
  } catch (_) { return null; }
}

export async function audit(actor, action, entity, entityId) {
  try {
    await supabase.from("audit_logs").insert({
      actor: actor || null, action, entity, entity_id: entityId ? String(entityId) : null,
    });
  } catch (_) {}
}
export async function notify(type, title, body) {
  try { await supabase.from("notifications").insert({ type, title, body: body || null }); } catch (_) {}
}
