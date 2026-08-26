const { isAuthenticated } = require("./_lib/auth");
const { listDir, getFile } = require("./_lib/github");
const { collectionKeys, getCollection } = require("./_lib/collections");

// Cheap frontmatter title peek — avoids pulling in a YAML parser just to
// show a readable label in the list view. Falls back to the slug itself.
function peekTitle(markdown, fallback) {
  const m = markdown.match(/^title:\s*"([^"]*)"/m) || markdown.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : fallback;
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
      const { label, basePath } = getCollection(key);
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
            };
          })
      );

      entries.sort((a, b) => a.slug.localeCompare(b.slug));
      result[key] = { label, entries };
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro a listar conteúdo." });
  }
};
