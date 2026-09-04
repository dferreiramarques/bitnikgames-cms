const { isAuthenticated } = require("./_lib/auth");
const { getFile, putFile, deleteFile } = require("./_lib/github");
const { getCollection, isValidSlug, validateContent } = require("./_lib/collections");

function paths(collectionKey, slug) {
  const { basePath } = getCollection(collectionKey);
  return { pt: `${basePath}/pt/${slug}.md`, en: `${basePath}/en/${slug}.md` };
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Sessão expirada, entra novamente." });
    return;
  }

  const collectionKey = req.method === "GET" || req.method === "DELETE" ? req.query.collection : req.body?.collection;
  const slug = req.method === "GET" || req.method === "DELETE" ? req.query.slug : req.body?.slug;

  if (!collectionKey) {
    res.status(400).json({ error: "Falta a coleção." });
    return;
  }
  let collection;
  try {
    collection = getCollection(collectionKey);
  } catch {
    res.status(400).json({ error: "Coleção desconhecida." });
    return;
  }
  if (!isValidSlug(slug)) {
    res.status(400).json({ error: "Slug inválido — usa só letras minúsculas, números e hífens." });
    return;
  }

  const p = paths(collectionKey, slug);

  try {
    if (req.method === "GET") {
      const [pt, en] = await Promise.all([getFile(p.pt), getFile(p.en)]);
      res.status(200).json({
        pt: pt ? pt.content : collection.template(slug),
        en: en ? en.content : collection.template(slug),
        exists: Boolean(pt || en),
      });
      return;
    }

    if (req.method === "PUT") {
      const { pt: ptContent, en: enContent } = req.body || {};
      if (typeof ptContent !== "string" || typeof enContent !== "string") {
        res.status(400).json({ error: "Falta o conteúdo em pt e/ou en." });
        return;
      }
      // Validated against the target site's schema *before* anything
      // touches GitHub — this is what stops invalid content (e.g. no
      // frontmatter at all) from ever reaching a real commit and breaking
      // the site's build, regardless of what the UI did or didn't check.
      const ptError = validateContent(ptContent, collection);
      if (ptError) {
        res.status(400).json({ error: `pt inválido: ${ptError}` });
        return;
      }
      const enError = validateContent(enContent, collection);
      if (enError) {
        res.status(400).json({ error: `en inválido: ${enError}` });
        return;
      }
      const [ptExisting, enExisting] = await Promise.all([getFile(p.pt), getFile(p.en)]);
      const message = `content: ${ptExisting || enExisting ? "update" : "add"} ${collectionKey}/${slug} (via CMS)`;
      // Sequential, not atomic — see README "Known limitation" note. `sha`
      // in the response is the *last* commit made here (en, written last) —
      // the tip of the branch once this request finishes, which is what
      // /api/deploy-status polls Vercel for.
      await putFile(p.pt, ptContent, message, ptExisting?.sha);
      const sha = await putFile(p.en, enContent, message, enExisting?.sha);
      res.status(200).json({ ok: true, sha });
      return;
    }

    if (req.method === "DELETE") {
      const [pt, en] = await Promise.all([getFile(p.pt), getFile(p.en)]);
      const message = `content: remove ${collectionKey}/${slug} (via CMS)`;
      let sha;
      if (pt) sha = await deleteFile(p.pt, message, pt.sha);
      if (en) sha = await deleteFile(p.en, message, en.sha);
      res.status(200).json({ ok: true, sha });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro a falar com o GitHub." });
  }
};
