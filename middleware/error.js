import { ValidationError } from "../lib/helpers.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ValidationError || err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Ukuran file terlalu besar." });
  }
  // Error unik Postgres (duplikat)
  if (err?.code === "23505") {
    return res.status(400).json({ error: "Data sudah ada (duplikat)." });
  }
  console.error("Server error:", err);
  res.status(500).json({ error: "Terjadi kesalahan di server." });
}
