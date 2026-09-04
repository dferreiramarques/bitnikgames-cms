const { isAuthenticated } = require("./_lib/auth");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Polled by the frontend after a save, with the commit sha that save just
// produced (see api/entry.js / api/reorder.js). Answers "has that exact
// commit finished deploying on Vercel yet?" so the editor can unlock the UI
// on real completion instead of guessing a fixed wait.
//
// Needs VERCEL_TOKEN (a Vercel API token) and VERCEL_PROJECT_ID (the
// bitnikgames project's id) — VERCEL_TEAM_ID only if that project lives
// under a team, not a personal account. If these aren't set yet, this
// throws and the frontend falls back to a fixed timer instead of hanging.
module.exports = async (req, res) => {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Sessão expirada, entra novamente." });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sha = req.query.sha;
  if (!sha) {
    res.status(400).json({ error: "Falta o sha." });
    return;
  }

  try {
    const token = requireEnv("VERCEL_TOKEN");
    const projectId = requireEnv("VERCEL_PROJECT_ID");
    const params = new URLSearchParams({ projectId, sha: String(sha), limit: "1" });
    if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);

    const vres = await fetch(`https://api.vercel.com/v7/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!vres.ok) {
      throw new Error(`Vercel deployments lookup failed: ${vres.status} ${await vres.text()}`);
    }
    const data = await vres.json();
    const deployment = data.deployments?.[0];
    // O push do GitHub->Vercel demora um instante a aparecer na lista de
    // deployments — "PENDING" para o frontend continuar a tentar em vez de
    // interpretar a ausência como erro.
    res.status(200).json(deployment ? { state: deployment.readyState, url: deployment.url } : { state: "PENDING" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro a consultar o Vercel." });
  }
};
