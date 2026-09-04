const { isAuthenticated } = require("./_lib/auth");
const { listDir, getFile } = require("./_lib/github");
const { collectionKeys, getCollection, getOrder } = require("./_lib/collections");

// Cheap frontmatter title peek — avoids pulling in a YAML parser just to
// show a readable label in the list view. Falls back to the slug itself.
function peekTitle(markdown, fallback) {
  const m = markdown.match(/^title:\s*"([^"]*)"/m) || markdown.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function peekFeatured(markdown) {
  const m = markdown.match(/^featured:\s*(true|false)/m);
  return m ? m[1] === "true" : false;
}

function peekDraft(markdown) {
  const m = markdown.match(/^draft:\s*(true|false)/m);
  return m ? m[1] === "true" : false;
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Sessão expirada, entra novamente." });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = {};
    for (const key of collectionKeys()) {
      const { label, basePath, supportsFeatured, supportsOrder, supportsDraft, singleton } = getCollection(key);
      const ptFiles = await listDir(`${basePath}/pt`);
      const enNames = new Set((await listDir(`${basePath}/en`)).map((f) => f.name));

      const entries = await Promise.all(
        ptFiles
          .filter((f) => f.name.endsWith(".md"))
          .map(async (f) => {
            const slug = f.name.replace(/\.md$/, "");
            const pt = await getFile(f.path);
            return {
              slug,
              title: pt ? peekTitle(pt.content, slug) : slug,
              hasEn: enNames.has(f.name),
              featured: pt ? peekFeatured(pt.content) : false,
              draft: pt ? peekDraft(pt.content) : false,
              order: pt ? getOrder(pt.content) : 0,
            };
          })
      );

      // Same rule as the site's sortEntries(): order ascending, slug as a
      // stable tiebreak (the site breaks ties by publishedDate instead,
      // but the list here doesn't have that loaded — slug is good enough
      // to keep the list from jumping around between reloads).
      entries.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
      result[key] = {
        label,
        entries,
        supportsFeatured: Boolean(supportsFeatured),
        supportsOrder: Boolean(supportsOrder),
        supportsDraft: Boolean(supportsDraft),
        singleton: Boolean(singleton),
      };
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro a listar conteúdo." });
  }
};
