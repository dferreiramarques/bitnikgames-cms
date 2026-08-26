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
    template: (slug) =>
      [
        "---",
        `title: "${slug}"`,
        'shortDescription: "Descrição a preencher."',
        'access: "free"',
        'fileUrl: "#"',
        "players: { min: 1, max: 4 }",
        "duration: 20",
        "tags: []",
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
    template: (slug) =>
      [
        "---",
        `title: "${slug}"`,
        'excerpt: "Excerto a preencher."',
        "readingMinutes: 4",
        "tags: []",
        `publishedDate: ${new Date().toISOString().slice(0, 10)}`,
        "---",
        "",
        "Texto do post a chegar em breve.",
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

module.exports = { COLLECTIONS, collectionKeys, getCollection, isValidSlug };
