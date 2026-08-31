// Describes the content collections this CMS knows how to edit. Mirrors
// bitnikgames' src/content/config.ts — kept as plain data so pointing this
// tool at a different Astro content-collections project later just means
// swapping this one file (and GITHUB_OWNER/REPO) rather than touching the
// API routes or the admin UI.
//
// `basePath` must match the collection's `base` in the target repo's
// src/content/config.ts. Every collection here is assumed bilingual
// (basePath/pt/<slug>.md + basePath/en/<slug>.md), matching bitnikgames'
// "every entry is a matched pt/en pair" rule.
const COLLECTIONS = {
  games: {
    label: "Catálogo",
    basePath: "src/content/games",
    // Fields the target Zod schema (src/content/config.ts) requires with
    // no default — everything else (players, duration, age, price, tags,
    // featured) either has a schema default or is genuinely optional, so
    // leaving it out is fine.
    requiredFields: ["title", "shortDescription", "status", "publishedDate"],
    // Shows the "Destacar na homepage" checkbox in the editor for this
    // collection — must match the target schema having a featured:boolean
    // field with a default, otherwise toggling it does nothing useful.
    supportsFeatured: true,
    // Allows the list view's drag-and-drop reordering — must match the
    // target schema having an order:number field with a default.
    supportsOrder: true,
    template: (slug) =>
      [
        "---",
        `title: "${slug}"`,
        'shortDescription: "Descrição a preencher."',
        "players: { min: 2, max: 4 }",
        "duration: 30",
        "age: 10",
        'status: "buy-now"',
        'price: "0€"',
        "tags: []",
        "featured: false",
        "order: 0",
        `publishedDate: ${new Date().toISOString().slice(0, 10)}`,
        "---",
        "",
        "Descrição completa a chegar em breve.",
        "",
      ].join("\n"),
  },
  pnp: {
    label: "Print & Play",
    basePath: "src/content/pnp",
    requiredFields: ["title", "shortDescription", "status", "publishedDate"],
    supportsFeatured: true,
    supportsOrder: true,
    template: (slug) =>
      [
        "---",
        `title: "${slug}"`,
        'shortDescription: "Descrição a preencher."',
        'status: "free"',
        'fileUrl: "#"',
        "players: { min: 1, max: 4 }",
        "duration: 20",
        "tags: []",
        "featured: false",
        "order: 0",
        `publishedDate: ${new Date().toISOString().slice(0, 10)}`,
        "---",
        "",
        "Descrição completa a chegar em breve.",
        "",
      ].join("\n"),
  },
  posts: {
    label: "Blog",
    basePath: "src/content/posts",
    requiredFields: ["title", "excerpt", "publishedDate"],
    supportsFeatured: true,
    supportsOrder: true,
    template: (slug) =>
      [
        "---",
        `title: "${slug}"`,
        'excerpt: "Excerto a preencher."',
        "readingMinutes: 4",
        "tags: []",
        "featured: false",
        "order: 0",
        `publishedDate: ${new Date().toISOString().slice(0, 10)}`,
        "---",
        "",
        "Texto do post a chegar em breve.",
        "",
      ].join("\n"),
  },
  // Coleção "singleton" — só faz sentido ter uma entrada, de slug "home",
  // com o texto do hero da homepage (título, eyebrow, subtítulo). Sem
  // featured/order porque não há lista a ordenar.
  hero: {
    label: "Hero (Home)",
    basePath: "src/content/hero",
    requiredFields: ["title", "eyebrow", "subtitle"],
    supportsFeatured: false,
    supportsOrder: false,
    template: () =>
      [
        "---",
        'title: "Jogos pequenos, ideias grandes."',
        'eyebrow: "Publisher independente de jogos de tabuleiro"',
        'subtitle: "Descrição a preencher."',
        "---",
        "",
      ].join("\n"),
  },
};

function collectionKeys() {
  return Object.keys(COLLECTIONS);
}

function getCollection(key) {
  const c = COLLECTIONS[key];
  if (!c) throw new Error(`Unknown collection: ${key}`);
  return c;
}

// Simple slug guard — mirrors what a filesystem + a URL segment can both
// safely hold, and blocks path traversal into the GitHub API calls.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isValidSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 80 && SLUG_RE.test(slug);
}

// Not a real YAML parser — just enough to catch the failure mode that
// actually happened (content saved with no frontmatter at all, or missing
// a field the site's Zod schema requires) *before* it reaches GitHub and
// breaks the site's build. Pulls out top-level `key:` lines inside the
// first --- ... --- block; nested/indented keys aren't collected, which is
// fine since every field these templates use is a single top-level line.
function extractFrontmatterKeys(markdown) {
  if (typeof markdown !== "string") return null;
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const keys = new Set();
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

// Returns null when valid, or a human-readable error string when not.
function validateContent(markdown, collection) {
  const keys = extractFrontmatterKeys(markdown);
  if (!keys) {
    return "Sem bloco de frontmatter (---...---) no início do ficheiro.";
  }
  const missing = (collection.requiredFields || []).filter((f) => !keys.has(f));
  if (missing.length > 0) {
    return `Falta(m) no frontmatter: ${missing.join(", ")}.`;
  }
  return null;
}

// Server-side counterpart to admin.html's readFeatured/writeFeatured, for
// the numeric order: field the reorder endpoint needs to rewrite. Same
// deliberately narrow scope — one named top-level key, not a YAML parser.
function getOrder(markdown) {
  const m = markdown.match(/^order:\s*(-?\d+)/m);
  return m ? Number(m[1]) : 0;
}
function setOrder(markdown, order) {
  const line = `order: ${order}`;
  if (/^order:\s*-?\d+/m.test(markdown)) {
    return markdown.replace(/^order:\s*-?\d+/m, line);
  }
  return markdown.replace(/^---\r?\n/, `---\n${line}\n`);
}

module.exports = {
  COLLECTIONS,
  collectionKeys,
  getCollection,
  isValidSlug,
  validateContent,
  getOrder,
  setOrder,
};
