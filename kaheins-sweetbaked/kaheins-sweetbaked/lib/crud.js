import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap, ValidationError, audit } from "./helpers.js";

/**
 * CRUD standar untuk satu tabel Supabase.
 * opts: collection(=table), entity, sortBy, ascending, publicList, hasActive,
 *       allowed[], required[], beforeWrite(body)
 */
export function crudRouter(opts) {
  const {
    collection: table, entity = opts.collection,
    sortBy = "created_at", ascending = false,
    publicList = false, hasActive = false,
    allowed = [], required = [], beforeWrite = null,
  } = opts;
  const router = express.Router();
  const pick = (b) => { const o = {}; for (const k of allowed) if (b[k] !== undefined) o[k] = b[k]; return o; };

  const listHandler = wrap(async (req, res) => {
    let q = supabase.from(table).select("*").order(sortBy, { ascending });
    if (req._public && hasActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  });

  if (publicList) {
    router.get("/", (req, _res, next) => { req._public = true; next(); }, listHandler);
    router.get("/admin", requireAuth, listHandler);
  } else {
    router.get("/", requireAuth, listHandler);
  }

  router.get("/:id", requireAuth, wrap(async (req, res) => {
    const { data, error } = await supabase.from(table).select("*").eq("id", req.params.id).single();
    if (error || !data) throw new ValidationError("Data tidak ditemukan.");
    res.json({ data });
  }));

  router.post("/", requireAuth, wrap(async (req, res) => {
    let body = pick(req.body || {});
    for (const f of required)
      if (body[f] === undefined || body[f] === "" || body[f] === null)
        throw new ValidationError(`Field "${f}" wajib diisi.`);
    if (beforeWrite) body = await beforeWrite(body);
    const { data, error } = await supabase.from(table).insert(body).select().single();
    if (error) throw error;
    await audit(req.user?.email, "create", entity, data.id);
    res.status(201).json({ data });
  }));

  router.patch("/:id", requireAuth, wrap(async (req, res) => {
    let body = pick(req.body || {});
    if (Object.keys(body).length === 0) throw new ValidationError("Tidak ada perubahan.");
    if (beforeWrite) body = await beforeWrite(body, true);
    const { data, error } = await supabase.from(table).update(body).eq("id", req.params.id).select().single();
    if (error || !data) throw new ValidationError("Data tidak ditemukan / gagal update.");
    await audit(req.user?.email, "update", entity, req.params.id);
    res.json({ data });
  }));

  router.delete("/:id", requireAuth, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq("id", req.params.id);
    if (error) throw error;
    await audit(req.user?.email, "delete", entity, req.params.id);
    res.json({ ok: true });
  }));

  return router;
}
