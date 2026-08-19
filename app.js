import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { errorHandler } from "./middleware/error.js";
import authRouter, { ensureAdminSeed } from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import vouchersRouter from "./routes/vouchers.js";
import uploadsRouter from "./routes/uploads.js";
import lombaRouter from "./routes/lomba.js";
import dashboardRouter from "./routes/dashboard.js";
import accountRouter from "./routes/account.js";
import { categoriesRouter, bannersRouter, promosRouter, galleryRouter } from "./routes/cms.js";
import { testimonialsRouter, reviewsRouter } from "./routes/testimonials.js";
import {
  settingsRouter, homepageRouter, customersRouter,
  notificationsRouter, mediaRouter, auditRouter,
} from "./routes/misc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
// Static folder tetap dipasang untuk dev lokal. Di Vercel, file di /public
// dilayani langsung oleh CDN sebelum request sampai ke function ini.
app.use(express.static(path.join(__dirname, "public")));

// Health
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "kaheins-sweetbaked", version: "2.1" }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/banners", bannersRouter);
app.use("/api/promos", promosRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/vouchers", vouchersRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/lomba", lombaRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/account", accountRouter);
app.use("/api/testimonials", testimonialsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/gallery", galleryRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/homepage", homepageRouter);
app.use("/api/customers", customersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/audit", auditRouter);

// Error handler (paling akhir)
app.use(errorHandler);

// --- Seed admin (idempotent) ---
// Di server tradisional dulu ini dijalankan saat startup. Di serverless,
// dijalankan sekali per cold-start secara latar belakang (non-blocking),
// jadi tidak menambah latensi request. Aman diulang karena idempotent.
let _seeded = false;
export function seedOnce() {
  if (_seeded) return;
  _seeded = true;
  ensureAdminSeed().catch((e) => console.warn("Seed admin gagal:", e.message));
}
seedOnce();

export default app;
