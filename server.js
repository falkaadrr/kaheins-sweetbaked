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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🍪 Kaheins Sweetbaked v2.1 jalan di port ${PORT}`);
  console.log(`   Toko : http://localhost:${PORT}/`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html`);
  // Seed admin di latar belakang — tidak memblokir startup.
  ensureAdminSeed().catch((e) => console.warn("Seed admin gagal:", e.message));
});
