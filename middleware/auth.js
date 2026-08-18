import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-ganti-di-produksi";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "7d" },
  );
}

// Wajib login (admin). Pasang di route yang perlu proteksi.
export function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Belum login." });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: "Sesi tidak valid / kedaluwarsa." });
  }
}
