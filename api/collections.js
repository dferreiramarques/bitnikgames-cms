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

// Timestamp (ms) or null. Used only as the order tiebreak below — needs to
// match src/lib/sortEntries.ts on the site exactly, or the list here shows
// a different order than what actually renders.
function peekPublishedDate(markdown) {
  const m = markdown.match(/^publishedDate:\s*(\S+)/m);
  if (!m) return null;
  const t = new Date(m[1]).getTime();
  return Number.isNaN(t) ? null : t;
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
              publishedDate: pt ? peekPublishedDate(pt.content) : null,
            };
          })
      );

      // Same rule as the site's sortEntries(): order ascending, then
      // publishedDate descending (most recent first) as the tiebreak —
      // matching this exactly is what's needed for the order shown here to
      // be the order that actually renders on the site. Collections without
      // a publishedDate (playOnline) fall through to publishedDate:null for
      // every entry, so the comparison is 0 and slug decides, same as
      // before.
      entries.sort(
        (a, b) => a.order - b.order || (b.publishedDate ?? 0) - (a.publishedDate ?? 0) || a.slug.localeCompare(b.slug)
      );
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
