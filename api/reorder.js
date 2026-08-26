const { isAuthenticated } = require("./_lib/auth");
const { getFile, putFile } = require("./_lib/github");
const { getCollection, isValidSlug, getOrder, setOrder } = require("./_lib/collections");

// Batch endpoint for the list view's drag-and-drop: takes the *whole* new
// order for a collection (not a single move), and reassigns sequential
// order:0,1,2... to match. Simpler than computing a diff, and cheap enough
// given these collections are a handful of entries each -- the tradeoff is
// this can touch every entry's files on one drag, not just the one moved.
module.exports = async (req, res) => {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Sessão expirada, entra novamente." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { collection: collectionKey, slugs } = req.body || {};
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
  if (!Array.isArray(slugs) || slugs.length === 0 || !slugs.every(isValidSlug)) {
    res.status(400).json({ error: "Lista de slugs inválida." });
    return;
  }

  try {
    let updated = 0;
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const p = {
        pt: `${collection.basePath}/pt/${slug}.md`,
        en: `${collection.basePath}/en/${slug}.md`,
      };
      const [pt, en] = await Promise.all([getFile(p.pt), getFile(p.en)]);
      const message = `content: reorder ${collectionKey}/${slug} -> ${i} (via CMS)`;

      if (pt && getOrder(pt.content) !== i) {
        await putFile(p.pt, setOrder(pt.content, i), message, pt.sha);
        updated++;
      }
      if (en && getOrder(en.content) !== i) {
        await putFile(p.en, setOrder(en.content, i), message, en.sha);
        updated++;
      }
    }
    res.status(200).json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro a falar com o GitHub." });
  }
};
