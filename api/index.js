// Entry serverless untuk Vercel.
// Semua request (yang tidak cocok dengan file statis di /public) diarahkan
// ke sini lewat rewrite di vercel.json, lalu ditangani Express app.
import app from "../app.js";

export default app;
