const bcrypt = require("bcryptjs");
const { createSessionCookie } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedUser = process.env.CMS_USERNAME || "admin";
  const hash = process.env.CMS_PASSWORD_HASH;
  if (!hash) {
    res.status(500).json({ error: "CMS_PASSWORD_HASH não está configurado no servidor." });
    return;
  }

  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Falta o utilizador ou a password." });
    return;
  }

  // Fixed-shape comparison for the username (it isn't secret, but keep it
  // simple and explicit rather than implying it's a real lookup).
  const userOk = username === expectedUser;
  const passOk = await bcrypt.compare(password, hash);

  if (!userOk || !passOk) {
    res.status(401).json({ error: "Credenciais inválidas." });
    return;
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  res.status(200).json({ ok: true });
};
