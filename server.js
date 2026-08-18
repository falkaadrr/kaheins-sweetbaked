// Entry untuk DEV LOKAL saja (node server.js / npm run dev).
// Di Vercel, entry-nya adalah api/index.js (serverless) — file ini tidak dipakai.
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍪 Kaheins Sweetbaked v2.1 jalan di port ${PORT}`);
  console.log(`   Toko : http://localhost:${PORT}/`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html`);
});
